import os

import gradio as gr
import torch
from transformers import AutoModel, AutoTokenizer


MODEL_ID = os.getenv("EMBEDDING_MODEL", "BAAI/bge-m3")
EXPECTED_DIMENSIONS = 1024
MAX_LENGTH = int(os.getenv("EMBEDDING_MAX_LENGTH", "8192"))
MAX_BATCH_SIZE = int(os.getenv("EMBEDDING_MAX_BATCH_SIZE", "8"))
API_KEY = os.getenv("EMBEDDING_API_KEY", "").strip()
FORCE_CPU = os.getenv("EMBEDDING_FORCE_CPU", "false").lower() == "true"
DEVICE = torch.device("cpu" if FORCE_CPU or not torch.cuda.is_available() else "cuda")

tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
model = AutoModel.from_pretrained(
    MODEL_ID,
    torch_dtype=torch.float16 if DEVICE.type == "cuda" else torch.float32,
).to(DEVICE)
model.eval()

def require_api_key(authorization: str | None) -> None:
    if API_KEY and authorization != f"Bearer {API_KEY}":
        raise gr.Error("Invalid embedding service credentials")


def mean_pool(last_hidden_state: torch.Tensor, attention_mask: torch.Tensor) -> torch.Tensor:
    mask = attention_mask.unsqueeze(-1).expand(last_hidden_state.size()).float()
    masked = last_hidden_state * mask
    return masked.sum(dim=1) / torch.clamp(mask.sum(dim=1), min=1e-9)


def encode_texts(texts: list[str]) -> list[list[float]]:
    outputs: list[list[float]] = []
    for start in range(0, len(texts), MAX_BATCH_SIZE):
        batch = texts[start:start + MAX_BATCH_SIZE]
        encoded = tokenizer(
            batch,
            padding=True,
            truncation=True,
            max_length=MAX_LENGTH,
            return_tensors="pt",
        )
        encoded = {key: value.to(DEVICE) for key, value in encoded.items()}
        with torch.inference_mode():
            hidden = model(**encoded).last_hidden_state
            pooled = mean_pool(hidden, encoded["attention_mask"])
            normalized = torch.nn.functional.normalize(pooled, p=2, dim=1)
        outputs.extend(normalized.float().cpu().tolist())
    return outputs


def embed(text: str, request: gr.Request) -> list[float]:
    require_api_key(request.headers.get("authorization"))
    if not isinstance(text, str) or not text.strip():
        raise gr.Error("input must be a non-empty string")
    vector = encode_texts([text])[0]
    if len(vector) != EXPECTED_DIMENSIONS:
        raise gr.Error("Embedding model returned an unexpected dimension")
    return vector


demo = gr.Interface(
    fn=embed,
    inputs=gr.Textbox(label="Text"),
    outputs=gr.JSON(label="Embedding"),
    api_name="embed",
    title="Titi BGE-M3 Embeddings",
    description="Private embedding endpoint for Titi RAG.",
)

if __name__ == "__main__":
    demo.queue().launch()
