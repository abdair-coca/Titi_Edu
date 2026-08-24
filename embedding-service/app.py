import os
from typing import Union

import torch
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
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

app = FastAPI(title="Titi BGE-M3 Embeddings", version="1.0.0")


class EmbeddingRequest(BaseModel):
    model: str = MODEL_ID
    input: Union[str, list[str]] = Field(min_length=1)


def require_api_key(authorization: str | None) -> None:
    if API_KEY and authorization != f"Bearer {API_KEY}":
        raise HTTPException(status_code=401, detail="Invalid embedding service credentials")


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


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "model": MODEL_ID,
        "dimensions": EXPECTED_DIMENSIONS,
        "device": str(DEVICE),
    }


@app.post("/embeddings")
def embeddings(request: EmbeddingRequest, authorization: str | None = Header(default=None)) -> dict:
    require_api_key(authorization)
    texts = [request.input] if isinstance(request.input, str) else request.input
    if not texts or any(not isinstance(text, str) or not text.strip() for text in texts):
        raise HTTPException(status_code=400, detail="input must contain non-empty strings")
    if len(texts) > MAX_BATCH_SIZE:
        raise HTTPException(status_code=413, detail=f"input supports at most {MAX_BATCH_SIZE} texts")

    vectors = encode_texts(texts)
    if any(len(vector) != EXPECTED_DIMENSIONS for vector in vectors):
        raise HTTPException(status_code=500, detail="Embedding model returned an unexpected dimension")
    return {
        "object": "list",
        "model": MODEL_ID,
        "data": [
            {"object": "embedding", "index": index, "embedding": vector}
            for index, vector in enumerate(vectors)
        ],
    }
