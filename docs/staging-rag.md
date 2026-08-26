# Piloto RAG sobre producción — guía operativa

## Objetivo

Probar flujo RAG Fase 1 sobre datos reales de producción, con proveedores locales
temporales y costo incremental cero:

```text
frontend producción -> backend producción -> Neon main / Neo4j Aura
                     -> Cloudflare Tunnel -> EmbeddingGemma local
                     -> AI Gateway local -> Groq o modelo local
```

El piloto no usa branch Neon separada. La branch `rag-staging` fue eliminada.
La PC local y los túneles deben permanecer activos durante cada prueba.

## Alcance

```text
Neon main + Neo4j Aura producción
              ↓
backend Render producción
              ↓
Cloudflare Tunnel
       ↙                  ↘
EmbeddingGemma local    AI Gateway local
                             ↓
                           Groq
```

No se avanzan Fases RAG 2–5 hasta cerrar este piloto visual.

## Recursos necesarios

- PostgreSQL producción Neon `main` con `pgvector`.
- Neo4j Aura producción existente.
- Cuenta docente/admin para reindexar.
- Una cuenta estudiante piloto autorizada.
- Curso, módulo, lección e inscripción productivos.
- EmbeddingGemma local en `127.0.0.1:8001`.
- AI Gateway local en `127.0.0.1:8080`.
- Cloudflare Tunnel activo para ambos servicios.
- Cuota gratuita disponible en Groq, o modelo local compatible.
- Cuenta Hugging Face con licencia Gemma aceptada y token de lectura.

## Configuración

Usar producción Render para backend. No reemplazar su `DATABASE_URL`:

- `render.yaml`
- `backend/.env.example`
- `ai-gateway/.env.staging.example` solo como referencia local
- `embedding-service/.env.staging.example` solo como referencia local

Nunca subir secretos al repo ni compartirlos por chat.

Backend producción debe usar valores cerrados:

```env
RAG_ENABLED=true
RAG_COURSE_IDS=<PRODUCTION_COURSE_ID>
RAG_ALLOWED_USER_EMAIL=<PILOT_USER_EMAIL>
RAG_CHAT_MODE=gateway
EMBEDDING_API_URL=https://<EMBEDDING_TUNNEL_HOST>
AI_GATEWAY_URL=https://<GATEWAY_TUNNEL_HOST>
```

No usar `RAG_COURSE_IDS=*` en producción.
El usuario piloto debe existir en Neo4j, Postgres y estar inscrito en curso.

## Orden de ejecución

1. Confirmar respaldo y branch Neon `rag-staging` eliminada.
2. Verificar producción con `GET /api/health`.
3. Levantar EmbeddingGemma local y verificar dimensión `768`.
4. Levantar AI Gateway local con `NODE_ENV=development` y estado memory.
5. Crear túneles HTTPS para puertos `8001` y `8080`.
6. Verificar ambos servicios desde una red externa.
7. Configurar Render con curso y usuario piloto exactos.
8. Aplicar migraciones con `npx prisma migrate deploy`.
9. Reindexar curso desde `/api/admin/rag/courses/:courseId/reindex`.
10. Confirmar documentos `LISTO` y fragmentos en Neon `main`.
11. Abrir lección productiva con usuario piloto.

## Reindexado productivo

Requiere token de usuario admin, propietario o profesor asignado:

```text
POST /api/admin/rag/courses/<PRODUCTION_COURSE_ID>/reindex
Authorization: Bearer <ADMIN_OR_TEACHER_TOKEN>
```

No ejecutar `backend/scripts/e2e-rag-phase1.mjs` contra producción sin revisar
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
- Detener proveedor local produce error controlado.
- Restaurar proveedor recupera chat.
- Desktop y móvil no muestran overflow.

## Rollback

En backend producción:

```env
RAG_ENABLED=false
```

Después del redeploy, Tutor desaparece y cursos continúan funcionando.
Detener proveedores locales solo después de confirmar rollback.

Este túnel local es válido para piloto autorizado, no para disponibilidad continua.
