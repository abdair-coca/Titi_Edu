---
title: Titi BGE-M3 Embeddings
sdk: docker
app_port: 7860
---

# Titi BGE-M3 Embeddings

OpenAI-compatible embedding service for Titi's RAG tutor. It serves
`BAAI/bge-m3` with 1024-dimensional normalized dense vectors.

## Hugging Face Space setup

1. Create a Docker Space with this directory as its repository content.
2. Add `EMBEDDING_API_KEY` as a Space secret with a long random value.
3. Select free CPU hardware. Select free GPU hardware only when Hugging Face
   offers it for the Space; the application automatically falls back to CPU.
4. Configure Titi backend with the Space URL:

```env
EMBEDDING_API_URL=https://<space-owner>-<space-name>.hf.space
EMBEDDING_API_KEY=<same-space-secret>
EMBEDDING_MODEL=BAAI/bge-m3
EMBEDDING_DIMENSIONS=1024
```

The first request after sleep can be slow while the model loads. Titi's
backend uses a configurable timeout (`EMBEDDING_TIMEOUT_MS`, default 120000).

## Contract

```http
GET /health
POST /embeddings
Authorization: Bearer <EMBEDDING_API_KEY>
Content-Type: application/json
```

Request body follows the OpenAI shape:

```json
{"model":"BAAI/bge-m3","input":["texto 1","texto 2"]}
```

Response contains one normalized vector per input under `data[].embedding`.
