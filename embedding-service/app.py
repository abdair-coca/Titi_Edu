import os
import torch
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
from sentence_transformers import SentenceTransformer


MODEL_ID = os.getenv("EMBEDDING_MODEL", "google/embeddinggemma-300M")
EXPECTED_DIMENSIONS = 768
API_KEY = os.getenv("EMBEDDING_API_KEY", "local-dev-key").strip()
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

model = SentenceTransformer(MODEL_ID, device=DEVICE)

app = FastAPI(title="Titi EmbeddingGemma Local", version="1.0.0")


class EmbeddingRequest(BaseModel):
    model: str = MODEL_ID
    input: str | list[str] = Field(min_length=1)


def require_api_key(authorization: str | None) -> None:
    if API_KEY and authorization != f"Bearer {API_KEY}":
        raise HTTPException(status_code=401, detail="Invalid embedding service credentials")


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "model": MODEL_ID,
        "dimensions": EXPECTED_DIMENSIONS,
        "device": DEVICE,
    }


@app.post("/embeddings")
def embeddings(request: EmbeddingRequest, authorization: str | None = Header(default=None)) -> dict:
    require_api_key(authorization)
    values = [request.input] if isinstance(request.input, str) else request.input
    if not values or any(not isinstance(value, str) or not value.strip() for value in values):
        raise HTTPException(status_code=400, detail="input must contain non-empty strings")

    texts = [value.strip() for value in values]
    vectors = model.encode(
        texts,
        normalize_embeddings=True,
        convert_to_numpy=True,
        show_progress_bar=False,
    ).tolist()
    if any(len(vector) != EXPECTED_DIMENSIONS for vector in vectors):
        raise HTTPException(status_code=500, detail="EmbeddingGemma returned an unexpected dimension")
    return {
        "object": "list",
        "model": MODEL_ID,
        "data": [
            {"object": "embedding", "index": index, "embedding": vector}
            for index, vector in enumerate(vectors)
        ],
    }
