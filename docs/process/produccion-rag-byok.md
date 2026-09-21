# Despliegue directo a producción — RAG BYOK

## Alcance

Rollout manual sobre backend Render productivo y Neon productivo. No existe DB staging
para este despliegue. Curso único:
`bceba93d-d954-4bc9-abf7-db865b1df8ff`.

Render permanece en plan free y `autoDeploy: false`. Los cold starts son esperables;
no hay SLA de disponibilidad ni latencia. No presentar este piloto como servicio con
alta disponibilidad.

## Gate 0 — personas, ventana y secretos

No iniciar sin responsable de despliegue, responsable de DB, ventana de observación y
correo canary confirmados. Cargar secretos directamente en Render, nunca en git, chat
o capturas:

- `AI_CREDENTIAL_KEY_CURRENT` y `AI_CREDENTIAL_KEY_V1`;
- `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_AI_API_TOKEN`;
- `CLOUDFLARE_AI_GATEWAY_ID`, `CLOUDFLARE_AI_GATEWAY_TOKEN`;
- `RAG_PRINCIPAL_SALT` (el modelo del tutor queda fijo en `openai/gpt-oss-20b`);
- `RAG_ALLOWED_USER_EMAIL` con correo exacto de la cuenta canary.

No configurar `GROQ_API_KEY` institucional, `AI_GATEWAY_URL` ni `AI_GATEWAY_TOKEN`.

## Gate 1 — restore point y migraciones

1. Crear restore point/branch de recuperación en Neon inmediatamente antes del deploy.
2. Registrar identificador y hora fuera del repositorio.
3. Desde `backend/`, ejecutar contra producción:

```powershell
npx prisma migrate status
```

Detener despliegue si aparecen migraciones pendientes no pertenecientes al cambio,
migraciones históricas destructivas, drift, fallo de conexión o destino dudoso. No
ejecutar `migrate deploy` hasta revisar cada migración pendiente y confirmar que la
nueva migración es aditiva. Nunca usar `migrate reset` en producción.

## Gate 2 — backend oscuro

Configurar:

```env
RAG_ENABLED=true
RAG_CHAT_ENABLED=false
RAG_COURSE_IDS=bceba93d-d954-4bc9-abf7-db865b1df8ff
RAG_AUDIENCE_MODE=canary
RAG_ALLOWED_USER_EMAIL=<CORREO_CANARY_EXACTO>
RAG_CREDENTIAL_MODE=user_required
AI_PROVIDER_ROUTE=cloudflare_gateway
EMBEDDING_PROVIDER=cloudflare
```

Desplegar manualmente backend con migración aditiva. No desplegar frontend todavía.
Esperar cold start y exigir:

```text
GET /api/health  -> 200
GET /api/ready   -> 200, status=ready y todos los checks=ok
```

Un `503` de readiness bloquea avance. Corregir configuración o restaurar versión del
backend; no habilitar chat.

## Gate 3 — credencial canary y reindexado

1. Autenticar cuenta canary y registrar su API key con
   `PUT /api/rag/credentials/groq`.
2. Exigir `configured=true` y `status=VALID`. Confirmar que API y logs nunca muestran
   la clave completa.
3. Con cuenta admin/docente autorizada, solicitar reindexado de:

```text
POST /api/admin/rag/courses/bceba93d-d954-4bc9-abf7-db865b1df8ff/reindex
```

4. Seguir job/estado mediante contratos admin publicados. No repetir a ciegas una
   solicitud aceptada.
5. Gate duro: 100 % de lecciones publicadas esperadas en estado `LISTO`, cero
   `PENDIENTE` o `FALLIDO`, dimensiones/modelo correctos. Si no se alcanza 100 %,
   mantener chat apagado.

## Gate 4 — frontend y canary

Desplegar frontend con gestión de credencial y estados de indisponibilidad. Mantener:

```env
RAG_AUDIENCE_MODE=canary
RAG_CHAT_ENABLED=false
```

Verificar primero que usuarios fuera de allowlist no obtienen chat y que cursos fuera
del ID objetivo permanecen cerrados. Luego cambiar solo `RAG_CHAT_ENABLED=true`,
redeploy manual, y probar con canary:

- alta, reemplazo y borrado de API key;
- chat sin credencial, credencial inválida y credencial válida;
- respuesta grounded con citas y fallback sin evidencia;
- rechazo de acciones sobre notas/progreso/inscripciones;
- cuota durable tras reinicio/cold start;
- ausencia de prompt, respuesta y secreto en logs de Titi y payload logs de Cloudflare.

Cualquier fallo de seguridad, aislamiento, cuota o grounding bloquea ampliación.

## Gate 5 — apertura por acceso al curso

Tras canary exitoso, cambiar:

```env
RAG_AUDIENCE_MODE=course_access
RAG_CHAT_ENABLED=true
```

No modificar `RAG_COURSE_IDS`. Confirmar que todos los roles con acceso al curso pueden
gestionar su propia credencial y que nadie sin acceso obtiene status/chat.

## Monitoreo 24 horas

Durante 24 horas revisar disponibilidad, cold starts, latencia, `429`, timeouts,
errores Groq/Cloudflare, credenciales `INVALID`, consumo de cuota, jobs de indexado,
documentos fuera de `LISTO` y eventos de seguridad. Logs solo metadata. Mantener una
persona con acceso a flags durante la ventana.

No declarar rollout cerrado antes de completar 24 horas sin incidente crítico.

## Rollback

Primer nivel, chat solamente:

```env
RAG_CHAT_ENABLED=false
```

Segundo nivel, RAG completo:

```env
RAG_ENABLED=false
```

Redeploy manual y confirmar que cursos siguen disponibles sin tutor. Revertir frontend
si su UI no degrada correctamente. No hacer rollback de schema: migración es aditiva y
los registros cifrados/cuotas pueden permanecer inactivos para diagnóstico. Usar restore
point Neon solo ante corrupción de datos confirmada y bajo procedimiento separado.

## Verificación documental previa

Estos comandos no ejecutan el despliegue ni prueban servicios externos; solo validan
configuración versionada:

```powershell
rg -n "autoDeploy|RAG_CHAT_ENABLED|RAG_AUDIENCE_MODE|RAG_CREDENTIAL_MODE|AI_CREDENTIAL_KEY|bceba93d-d954-4bc9-abf7-db865b1df8ff" render.yaml backend/.env.example docs
rg -n "RAG_COURSE_IDS=\*|student@gmail.com" render*.yaml backend/.env*.example docs/process
git diff --check
```
