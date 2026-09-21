# Seguridad del tutor RAG

## Modelo de credenciales BYOK

Cada usuario, sin distinción de rol, registra su propia API key de Groq. En producción,
`RAG_CREDENTIAL_MODE=user_required`: no existe clave institucional, fallback global ni
credencial compartida. La ausencia, invalidez o revocación de la clave personal cierra
el chat para ese usuario, sin afectar el acceso normal al curso.

La API key se valida contra el endpoint de modelos de Groq antes de aceptarse. Titi
nunca devuelve la clave: expone solo estado, últimos cuatro caracteres y fechas de
validación/actualización. Cambiarla reemplaza el registro cifrado; eliminarla borra el
material cifrado y revoca su uso inmediato. Una respuesta `401` o `403` del proveedor
marca la credencial inválida y exige reemplazo.

## Cifrado y almacenamiento

- Cifrado en reposo: AES-256-GCM con nonce único y tag de autenticación por registro.
- Persistencia: PostgreSQL. Las credenciales nunca se guardan ni replican en Neo4j.
- Aislamiento: un registro por usuario y proveedor; ninguna clave puede resolver la
  credencial de otro usuario.
- Descifrado: solo dentro del request de chat que la necesita. El texto plano vive en
  memoria durante esa llamada y no entra en caché, logs, jobs ni respuestas.
- Keyring: `AI_CREDENTIAL_KEY_CURRENT` identifica la versión activa y variables
  versionadas como `AI_CREDENTIAL_KEY_V1` contienen claves maestras secretas en Render.
  Rotar agrega una versión, cambia `CURRENT`, reenvuelve gradualmente registros y solo
  después retira la versión anterior. Nunca rotar borrando primero la clave vieja.

Respaldos, exportaciones y restore points de Neon contienen ciphertext, no claves
maestras. Las claves maestras permanecen exclusivamente en el gestor de secretos de
Render y deben tener respaldo operativo separado.

## Flujo de datos

```text
usuario -> backend Titi -> PostgreSQL/pgvector (acceso, evidencia, cuota, credencial cifrada)
                       -> Cloudflare Workers AI (texto de chunks/consulta para embeddings)
                       -> Cloudflare AI Gateway -> Groq (prompt RAG + API key BYOK)
```

El backend autentica, valida acceso al curso y recupera solo fragmentos activos de
lecciones publicadas. PostgreSQL es fuente de verdad de credenciales y cuotas. Neo4j
no participa en almacenamiento de claves, prompts, respuestas ni contadores RAG.

Para embeddings, Cloudflare recibe el texto estrictamente necesario. Para generación,
Cloudflare AI Gateway reenvía a Groq el prompt delimitado, evidencia minimizada e
historial incluido por el cliente. El backend envía:

- `Authorization: Bearer <API key Groq del usuario>`;
- `cf-aig-authorization: Bearer <token administrado del gateway>`;
- `cf-aig-collect-log-payload: false`.

Cloudflare y Groq son subprocesadores externos. Antes de habilitar el chat, informar
que consulta, fragmentos recuperados e historial enviado pueden transitar ambos
proveedores bajo sus políticas. No enviar PII, notas, respuestas de evaluación ni datos
de otros estudiantes.

## Controles de aplicación

- Contexto recuperado e historial se tratan como datos no confiables.
- Se detectan señales de prompt injection y se bloquean solicitudes de modificar notas,
  progreso, inscripciones o ejecutar SQL.
- El modelo no tiene tools, function calling ni acceso directo a APIs de negocio o DB.
- Las citas se validan contra curso, lección publicada, documento activo y corpus
  `assessmentSafe`; un `chunkId` del cliente nunca se confía sin revalidación.
- `PRACTICA` y `RETROALIMENTAR` son formativos: no crean `Intento`, nota ni `Progreso`.
- No se persisten prompts, historial conversacional ni respuestas completas.
- Logs y eventos guardan solo metadata operativa: usuario opaco, proveedor, status,
  latencia, consumo agregado, código de error sanitizado y marcas de seguridad.
- Cuotas por usuario se mantienen de forma durable y atómica en PostgreSQL; sobreviven
  reinicios y no dependen de memoria del proceso Render.
- Timeouts, tamaño máximo, rate limit y concurrencia fallan cerrado.

## Activación y revocación

`RAG_ENABLED` es el kill switch maestro. `RAG_CHAT_ENABLED` apaga generación sin
desactivar readiness ni indexado. `RAG_AUDIENCE_MODE=canary` limita acceso a correos
exactos de `RAG_ALLOWED_USER_EMAIL`; `course_access` amplía solo a usuarios con acceso
al curso. `RAG_COURSE_IDS` debe contener exclusivamente
`bceba93d-d954-4bc9-abf7-db865b1df8ff` durante este rollout.

Revocación operativa, en orden:

1. Cambiar `RAG_CHAT_ENABLED=false` para cortar nuevas llamadas.
2. Si el incidente excede chat, cambiar `RAG_ENABLED=false`.
3. Eliminar o invalidar credenciales afectadas y rotar token Cloudflare o versión de
   keyring según el alcance.
4. Revisar metadata de auditoría; nunca reconstruir prompts o respuestas completas.

El rollback legacy (`GROQ_API_KEY`, `RAG_CHAT_MODE`, `AI_GATEWAY_URL/TOKEN`) se conserva
solo para desarrollo local o recuperación controlada. No forma parte del despliegue
BYOK productivo y no debe configurarse como fallback.

Runbook de despliegue: [produccion-rag-byok.md](process/produccion-rag-byok.md).
