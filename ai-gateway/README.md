# Titi AI Gateway

Gateway server-side para Groq. El frontend nunca recibe la API key de Groq.

## Estado

La implementación local/staging usa límites en memoria. `NODE_ENV=production` exige
`AI_GATEWAY_STATE_STORE=redis`; no se debe desplegar producción hasta implementar ese
adaptador compartido.

## Variables

```env
AI_GATEWAY_TOKEN=<token interno Backend -> Gateway>
AI_GATEWAY_USER_SALT=<salt privado para cuotas>
GROQ_API_KEY=<secreto>
GROQ_MODEL=<modelo>
GROQ_API_URL=https://api.groq.com/openai/v1/chat/completions
AI_GATEWAY_RATE_LIMIT_PER_MINUTE=5
AI_GATEWAY_DAILY_QUOTA=30
AI_GATEWAY_MAX_CONCURRENCY=2
AI_GATEWAY_TIMEOUT_MS=30000
AI_GATEWAY_STATE_STORE=memory
```

## Endpoints

- `GET /health`: estado sin secretos.
- `GET /metrics`: métricas mínimas, requiere token interno.
- `POST /v1/chat/completions`: requiere token interno y headers
  `X-Titi-Course-Id`, `X-Titi-Principal-Id`.

El gateway no acepta herramientas, no guarda conversaciones y solo reenvía `model`,
`temperature` y `messages` a Groq.
