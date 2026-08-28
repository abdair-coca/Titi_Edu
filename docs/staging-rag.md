# Piloto RAG en Render staging — guía operativa

## Objetivo

Probar flujo RAG sobre datos reales de staging con proveedores administrados:

```text
frontend staging -> backend Render staging -> Neon main / Neo4j Aura
                  -> Cloudflare Workers AI (embeddings)
                  -> Cloudflare AI Gateway -> Groq
```

El piloto no usa branch Neon separada. La branch `rag-staging` fue eliminada.
Los servicios locales quedan disponibles únicamente como rollback controlado.

## Alcance

```text
Neon staging + Neo4j Aura staging
               ↓
backend Render staging
               ↓
Cloudflare Workers AI       Cloudflare AI Gateway
                                 ↓
                               Groq
```

No se avanzan Fases RAG 2–5 hasta cerrar este piloto visual.

## Recursos necesarios

- PostgreSQL Neon `main` con `pgvector`.
- Neo4j Aura existente.
- Cuenta docente/admin para reindexar.
- Una cuenta estudiante piloto autorizada.
- Curso, módulo, lección e inscripción de staging/piloto.
- Cuenta Cloudflare con Workers AI habilitado.
- Gateway Cloudflare `titi-rag` con token de permiso `Run`.
- API key Groq y modelo activo, actualmente `openai/gpt-oss-20b`.

## Configuración

Usar Render staging para backend. No reemplazar su `DATABASE_URL`:

- `render.yaml`
- `backend/.env.example`
- `ai-gateway/` y `embedding-service/` quedan como rollback local/legacy

Nunca subir secretos al repo ni compartirlos por chat.

Backend staging debe usar valores cerrados:

```env
RAG_ENABLED=true
RAG_COURSE_IDS=<STAGING_COURSE_ID>
RAG_ALLOWED_USER_EMAIL=<PILOT_USER_EMAIL>
EMBEDDING_PROVIDER=cloudflare
EMBEDDING_MODEL=@cf/google/embeddinggemma-300m
EMBEDDING_DIMENSIONS=768
CLOUDFLARE_ACCOUNT_ID=<ACCOUNT_ID>
CLOUDFLARE_AI_API_TOKEN=<secreto-workers-ai>
AI_PROVIDER_ROUTE=cloudflare_gateway
CLOUDFLARE_AI_GATEWAY_ID=titi-rag
CLOUDFLARE_AI_GATEWAY_TOKEN=<secreto-gateway>
GROQ_API_KEY=<secreto-groq>
GROQ_MODEL=openai/gpt-oss-20b
```

No usar `RAG_COURSE_IDS=*` fuera de un entorno staging aislado.
El usuario piloto debe existir en Neo4j, Postgres y estar inscrito en curso.

## Orden de ejecución

1. Confirmar base de datos staging, curso piloto y usuario piloto autorizados.
2. Verificar backend staging con `GET /api/health` sin cambiar producción.
3. Cargar variables Cloudflare/Groq en Render staging, sin compartir secretos por chat.
4. Mantener `autoDeploy=false` y desplegar staging manualmente después del gate.
5. Aplicar migraciones con `npx prisma migrate deploy`.
6. Verificar embeddings con dimensión `768` y health del backend.
7. Reindexar curso desde `/api/admin/rag/courses/:courseId/reindex`.
8. Confirmar documentos `LISTO` y fragmentos en la base staging.
9. Abrir lección staging con usuario piloto.

## Reindexado staging

Requiere token de usuario admin, propietario o profesor asignado:

```text
POST /api/admin/rag/courses/<STAGING_COURSE_ID>/reindex
Authorization: Bearer <ADMIN_OR_TEACHER_TOKEN>
```

No ejecutar `backend/scripts/e2e-rag-phase1.mjs` contra datos compartidos sin revisar
variables y consentimiento de escritura. El script reindexa y escribe datos.

## Validación manual

- Usuario piloto ve Tutor en curso piloto.
- Usuario piloto recibe respuesta con fuentes.
- Pregunta fuera del material devuelve fallback sin evidencia.
- Solicitud para modificar notas/progreso recibe rechazo.
- Otro estudiante recibe `403`.
- Estudiante sin inscripción recibe `403`.
- Curso fuera de allowlist no muestra Tutor.
- Curso no publicado no se indexa.
- Detener o invalidar proveedor produce error controlado.
- Cambiar `AI_PROVIDER_ROUTE=legacy` y restaurar variables propias recupera chat legacy.
- Desktop y móvil no muestran overflow.

## Rollback

En backend staging:

```env
RAG_ENABLED=false
```

Después del redeploy, Tutor desaparece y cursos continúan funcionando.
No detener servicios legacy hasta confirmar rollback.

La configuración legacy sigue siendo rollback; no se elimina hasta cerrar validación.
