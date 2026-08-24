---
title: Titi BGE-M3 Embeddings
sdk: gradio
sdk_version: 5.12.0
app_file: app.py
---

# Titi BGE-M3 Embeddings

Gradio embedding service for Titi's RAG tutor. It serves `BAAI/bge-m3` with
1024-dimensional normalized dense vectors.

## Hugging Face Space setup

1. Create a Gradio Space with this directory as its repository content.
2. Add `EMBEDDING_API_KEY` as a Space secret with a long random value.
3. Select free CPU hardware. Select free GPU hardware only when Hugging Face
   offers it for the Space; the application automatically falls back to CPU.
4. Configure Titi backend with the Space URL:

```env
EMBEDDING_API_URL=https://<space-owner>-<space-name>.hf.space
EMBEDDING_API_KEY=<same-space-secret>
EMBEDDING_MODEL=BAAI/bge-m3
EMBEDDING_DIMENSIONS=1024
EMBEDDING_PROVIDER=gradio
```

The first request after sleep can be slow while the model loads. Titi's
backend uses a configurable timeout (`EMBEDDING_TIMEOUT_MS`, default 120000).

## Contract

```http
GET /gradio_api/openapi.json
POST /gradio_api/call/embed
Authorization: Bearer <EMBEDDING_API_KEY>
Content-Type: application/json
```

Gradio request body:

```json
{"data":["texto 1"]}
```

The POST returns an `event_id`. The backend reads the completion from
`GET /gradio_api/call/embed/<event_id>` and validates 1024 dimensions.
