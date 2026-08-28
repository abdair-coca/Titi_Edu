# Seguridad del tutor RAG

## Flujo de datos

El backend autentica al estudiante, verifica su acceso al curso y recupera únicamente
fragmentos publicados del curso solicitado. El LLM nunca recibe credenciales ni acceso
directo a PostgreSQL/pgvector.

En local/staging, el backend puede llamar directamente al proveedor usando
`AI_PROVIDER_ROUTE=legacy` y `RAG_CHAT_MODE=direct`. En producción, el modo directo
queda bloqueado: se requiere el gateway propio (`RAG_CHAT_MODE=gateway`) o Cloudflare
AI Gateway (`AI_PROVIDER_ROUTE=cloudflare_gateway`).

Durante piloto productivo, `RAG_COURSE_IDS` debe contener únicamente el curso
autorizado y `RAG_ALLOWED_USER_EMAIL` debe limitar status/chat a una sola cuenta.
El reindexado sigue protegido para admin, propietario o profesor del curso.

## Controles implementados

- Contexto delimitado como datos no confiables.
- Detección de señales de prompt injection en consulta y contenido recuperado.
- Bloqueo determinista de solicitudes para modificar notas, progreso, inscripciones o ejecutar SQL.
- Sin herramientas ni llamadas a APIs de negocio desde el LLM.
- Validación de citas: solo se aceptan números de fuentes recuperadas.
- Respuesta fija cuando no hay evidencia o la respuesta no está grounded.
- Rate limit local: 5 mensajes/minuto y 30/día por estudiante, configurable.
- Errores de proveedor convertidos a respuestas controladas.
- Eventos de seguridad sin guardar el texto completo de la conversación.

## Gateway IA

`ai-gateway/` es un servicio Node sin dependencias externas que mantiene Groq server-side.
El piloto temporal puede usar límites en memoria desde una instancia local. En
producción estable falla cerrado si `AI_GATEWAY_STATE_STORE` no es `redis`; todavía
falta implementar el adaptador Redis compartido antes de desplegarlo públicamente.

El gateway:

- autentica al backend con `AI_GATEWAY_TOKEN`;
- recibe un identificador opaco del estudiante;
- limita cuota, concurrencia y tamaño de request;
- aplica timeout y circuit breaker;
- rechaza tools/function calling;
- no registra prompts ni respuestas completas.

### Cloudflare AI Gateway

La ruta alternativa conserva Groq server-side y llama al endpoint oficial:
`/v1/{account_id}/{gateway_id}/groq/chat/completions`. Requiere estas variables
únicamente en el backend:

```env
AI_PROVIDER_ROUTE=cloudflare_gateway
CLOUDFLARE_ACCOUNT_ID=<account-id>
CLOUDFLARE_AI_GATEWAY_ID=<gateway-id>
CLOUDFLARE_AI_GATEWAY_TOKEN=<secreto-del-gateway>
GROQ_API_KEY=<secreto-del-proveedor>
GROQ_MODEL=<modelo-activo>
```

El backend envía `Authorization` con `GROQ_API_KEY` y
`cf-aig-authorization` con `CLOUDFLARE_AI_GATEWAY_TOKEN`. Ninguna de estas
credenciales llega al frontend. `AI_PROVIDER_ROUTE=legacy` mantiene comportamiento
actual y permite rollback cambiando una sola variable.

## Verificación local

```powershell
cd ai-gateway
$env:AI_GATEWAY_TOKEN='gateway-local-token'
$env:AI_GATEWAY_USER_SALT='local-salt'
$env:GROQ_API_KEY='<secreto>'
$env:GROQ_MODEL='<modelo>'
npm start
```

Para habilitar el backend contra el gateway:

```env
RAG_CHAT_MODE=gateway
AI_GATEWAY_URL=http://127.0.0.1:8080
AI_GATEWAY_TOKEN=gateway-local-token
```

El piloto autorizado usa `RAG_CHAT_MODE=gateway` con AI Gateway local mediante túnel.
Sin gateway configurado, producción responde `503` deliberadamente. No presentar
esta topología temporal como disponibilidad productiva continua.
