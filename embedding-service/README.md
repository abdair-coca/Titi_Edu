# Titi EmbeddingGemma local

Servidor local de embeddings para el tutor RAG de Titi. Usa
`google/embeddinggemma-300M`, entrega vectores normalizados de **768
dimensiones** y funciona con CPU o GPU local.

## Requisitos

- Python 3.11+
- CPU o GPU local
- Cuenta Hugging Face con licencia Gemma aceptada
- Token Hugging Face con permiso de lectura para descargar el modelo

## Instalación

PowerShell:

```powershell
cd embedding-service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Aceptá la licencia de Gemma en Hugging Face y configurá el token:

```powershell
$env:HF_TOKEN="hf_..."
huggingface-cli login --token $env:HF_TOKEN
```

## Ejecución

```powershell
$env:EMBEDDING_API_KEY="local-dev-key"
python -m uvicorn app:app --host 127.0.0.1 --port 8001
```

El primer arranque descarga el modelo y puede tardar. Luego:

```text
GET  http://127.0.0.1:8001/health
POST http://127.0.0.1:8001/embeddings
```

## Contrato

El backend prepara el texto con el contrato oficial de retrieval antes de
enviarlo al proveedor. El servicio local recibe ese texto ya preparado.

Consulta preparada:

```json
{
  "model": "google/embeddinggemma-300M",
  "input": "task: search result | query: ¿Qué es una variable?"
}
```

Documento preparado:

```json
{
  "model": "google/embeddinggemma-300M",
  "input": "title: Variables | text: Una variable almacena un valor."
}
```

El endpoint devuelve formato OpenAI-compatible. Los formatos siguen los prompts
de retrieval recomendados por EmbeddingGemma.
