# Informe — RAG Fase 1: tutor de texto + HTML

Fecha: 2026-08-25
Rama: `main`
Estado: implementado y verificado con E2E mock y live; producción queda protegida por flag apagado.

## 1. Qué implementamos

- Persistencia PostgreSQL con `pgvector` para documentos, versiones, estado y fragmentos.
- Extracción de texto visible desde HTML: elimina `script`, `style` y etiquetas, y decodifica entidades.
- Indexado de lecciones publicadas con hash de contenido, chunks solapados y embeddings EmbeddingGemma.
- Retrieval por similitud coseno filtrado por curso publicado, módulo/lección publicada y documento activo/listo.
- Tutor Groq con prompt de grounding, citas `[1]`, respuesta explícita sin evidencia y rechazo conceptual de acciones del sistema.
- Acceso restringido a usuarios autenticados con inscripción o rol docente/admin autorizado.
- Flag fail-closed por curso mediante `RAG_ENABLED=true` + `RAG_COURSE_IDS=<id>`.
- Reindexado autorizado de un curso piloto y reindexado asíncrono al guardar/publicar contenido.
- El reindexado automático también valida `RAG_COURSE_IDS`; no indexa cursos fuera de la allowlist.
- Tutor integrado en `LearnCourse`; no aparece para estudiantes hasta que el curso esté habilitado e indexado.
- Servicio local `embedding-service/` basado en EmbeddingGemma, con fallback automático GPU/CPU.
- El backend distingue embeddings de `query` y `document` usando prompts oficiales de retrieval.

## 2. Archivos y migración

- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20260823010000_rag_phase_1/migration.sql`
- `backend/prisma/migrations/20260824020000_rag_embeddinggemma_768/migration.sql`
- `backend/src/services/rag.service.js`
- `backend/src/routes/rag.js`
- `backend/src/routes/authoring.js`
- `backend/src/app.js`
- `backend/.env.example`
- `frontend/src/components/RagTutorCard.jsx`
- `frontend/src/pages/LearnCourse.jsx`
- `backend/test/routes/rag.test.js`
- `backend/test/services/rag.service.test.js`
- `backend/test/services/rag.indexing.test.js`
- `backend/scripts/e2e-rag-phase1.mjs`
- `frontend/scripts/check-rag-contract.mjs`
- `docs/api.md`
- `embedding-service/app.py`, `embedding-service/README.md`, `embedding-service/requirements.txt`

La migración `20260824020000_rag_embeddinggemma_768` elimina únicamente los fragmentos vectoriales
anteriores, marca los documentos como `PENDIENTE` y cambia la columna a `vector(768)`.
Los documentos y versiones se conservan. Es obligatorio reindexar antes de usar el tutor.
El proveedor configurado es `google/embeddinggemma-300M`, con 768 dimensiones normalizadas.
La migración histórica `20260824010000_rag_bge_m3_1024` se conserva sin modificar para no romper
el historial de Prisma; BGE-M3 y Gradio ya no forman parte del runtime.

## 3. Endpoints y comportamiento

### Estudiante

- `GET /api/lessons/:id/chat/status`: devuelve `enabled`, `indexed` y `status`.
- `POST /api/lessons/:id/chat` con `{ "message": "..." }`: devuelve `{ answer, citations, usage }`.
- `401`: falta autenticación.
- `403`: estudiante sin inscripción.
- `404`: contenido no publicado o flag apagado.
- `400`: mensaje vacío o mayor a 1000 caracteres.
- Sin fragmentos: respuesta `No encontré evidencia suficiente...` con `citations: []`.

### Docente/admin

- `POST /api/admin/rag/courses/:courseId/reindex`: indexa las lecciones publicadas del curso.
- Solo propietario, profesor asignado o admin.
- Los fallos por lección quedan en `FAILED` en la respuesta y no impiden continuar con las demás.

## 4. Tests y evidencia técnica

### Commits

| Commit | Unidad |
|---|---|
| `20c713c` | Persistencia Prisma + pgvector |
| `969934b` | Servicio, endpoints, integración frontend y flag |
| `14cdca8` | Tests de permisos, citas, validación y extracción |
| `a78d2c1` | Corrección del flag en indexado automático |
| `79579ce` | E2E contra Neon + proveedores mockeados |
| `c368865` | Reemplazo del runtime BGE-M3/Gradio por EmbeddingGemma local |
| `5153589` | Dependencias compatibles con EmbeddingGemma |
| `1cf72f4` | Ignorar entorno virtual Python local |
| `da11f7a` | Alinear dependencias finales con EmbeddingGemma |
| `d89cc20` | Registrar migración y reindexado piloto |

### Resultados locales

```text
npx prisma validate
The schema at prisma\\schema.prisma is valid 🚀

npx vitest run --maxWorkers=1 --minWorkers=1
Test Files  24 passed (24)
Tests       220 passed (220)

npm run lint
eslint src test  # exit 0

frontend: npm run test:rag
RAG frontend contract: OK

frontend: npm run test:html-lesson
HTML lesson player security contract: pass

frontend: npm run test:authoring-contract
Authoring evaluation contracts OK

frontend: npm run test:markdown-url
markdown URL sanitation: pass

frontend: npm run build
✓ built in 1m 21s

backend E2E controlada con mocks:
node --env-file=.env.staging scripts/e2e-rag-phase1.mjs
lessonsProcessed: 3
readyDocuments: 3
storedFragments: 21
chatStatus: 200
citationCount: 1

backend E2E live:
node --env-file=.env.staging scripts/e2e-rag-phase1.mjs
lessonsProcessed: 3
readyDocuments: 3
storedFragments: 21
chatStatus: 200
citationCount: 4
```

El primer `vitest` paralelo falló por agotamiento de recursos de workers en Windows; la ejecución serial terminó verde. El build emitió únicamente el warning preexistente de chunks grandes.

La suite hermética usa proveedores mockeados. La autenticación quedó verificada con
`hf auth whoami` (`abdair-coca`) y la descarga del modelo terminó. El servicio debe
ejecutarse con `embedding-service\\.venv\\Scripts\\python.exe`, porque el Python global
no tiene `torch` instalado.

La instalación local quedó verificada con `pip check`, `py_compile` y las versiones
`sentence-transformers 6.0.0`, `transformers 5.15.1`, `torch 2.13.0+cpu` y
`fastapi 0.115.6`. El modelo está descargado en la caché local de Hugging Face y
la inferencia real ya respondió correctamente.

La integración real Backend → servicio local quedó verificada después de levantar Uvicorn:
`createEmbedding('prueba backend local')` respondió correctamente con `dimensions: 768`.
La primera solicitud se ejecutó mientras el modelo todavía iniciaba y falló; al repetirla
con `/health` listo respondió correctamente.

### Ejecución del piloto con EmbeddingGemma (2026-08-25)

- Se creó respaldo de Neon antes de modificar el historial: `titi-neon-before-rag-gemma-20260824.dump`.
- La migración `20260824010000_rag_bge_m3_1024` fue marcada como aplicada sin ejecutar su SQL,
  por decisión de producto; no se alteró a 1024 dimensiones.
- Se aplicó únicamente `20260824020000_rag_embeddinggemma_768`.
- `prisma migrate status`: esquema actualizado.
- Verificación SQL: `DocumentoRag` y `FragmentoRag` existen; `FragmentoRag.embedding` es `vector(768)`.
- Reindexado real del curso piloto `bceba93d-d954-4bc9-abf7-db865b1df8ff`: 3 documentos LISTO y 21 fragmentos.
- Retrieval real: 3 resultados para `estructuras selectivas en Python`, con citas de `Estructuras Selectivas`.
- Tests RAG: 12 tests pasaron (6 de servicios, 5 de rutas y 1 de indexado).

La E2E mock usa la base Neon real, pero levanta proveedores locales en proceso:
reindexa el curso piloto, verifica documentos/fragmentos persistidos y consulta el chat como estudiante inscrito.
El script exige `RAG_E2E_ALLOW_DB_WRITE=true` para evitar escrituras accidentales.

La E2E live también fue verificada contra Neon real, EmbeddingGemma real y AI Gateway real:

```text
lessonsProcessed: 3
readyDocuments: 3
storedFragments: 21
chatStatus: 200
citationCount: 4
```

EmbeddingGemma respondió desde `127.0.0.1:8001` con `google/embeddinggemma-300M`
y dimensión `768`; AI Gateway respondió desde `127.0.0.1:8080` usando el modelo Groq
aprobado para la cuenta de staging.

### Consultas SQL de comprobación

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_name IN ('DocumentoRag', 'FragmentoRag');

SELECT "estado", "activo", count(*)
FROM "DocumentoRag"
GROUP BY "estado", "activo";

SELECT d."leccionId", d."version", f."orden", length(f."contenido")
FROM "DocumentoRag" d
JOIN "FragmentoRag" f ON f."documentoId" = d."id"
WHERE d."activo" = true AND d."estado" = 'LISTO'
ORDER BY d."leccionId", f."orden";
```

La consulta de retrieval usa `<=>` y limita a documentos activos/listos del curso publicado.

## 5. Guía manual

### Configuración del servicio local

1. Desde `embedding-service/`, creá el entorno Python según su `README.md`.
2. Aceptá la licencia Gemma en Hugging Face y configurá `HF_TOKEN`.
3. Levantá `uvicorn` en `127.0.0.1:8001`.
4. Verificá `/health`: debe devolver `google/embeddinggemma-300M`, `768` y el dispositivo activo.

### Configuración local/staging

Blueprint staging: `render.staging.yaml`. Despliega backend, gateway y servicio
EmbeddingGemma separados. El servicio de embeddings usa plan con recursos mayores
porque carga el modelo al iniciar; validar costo y memoria antes de desplegar.

1. Aplicá la migración en el backend: `npx prisma migrate deploy`.
2. Configurá:
   - `RAG_ENABLED=true`
   - `RAG_COURSE_IDS=*` (staging: todos los cursos publicados)
   - `RAG_ALLOWED_USER_EMAIL=student@gmail.com` (staging: único consumidor)
   - `EMBEDDING_API_URL=http://127.0.0.1:8001`
   - `EMBEDDING_API_KEY=local-dev-key`
   - `EMBEDDING_MODEL=google/embeddinggemma-300M`
   - `EMBEDDING_DIMENSIONS=768`
   - `EMBEDDING_PROVIDER=local`
   - `EMBEDDING_TIMEOUT_MS=120000`
   - `EMBEDDING_MAX_RETRIES=1`
   - `GROQ_API_KEY=<secreto>`
   - `GROQ_MODEL=<modelo-chat>`
3. Reiniciá el backend.

### Indexar y probar

1. Entrá al frontend staging con un usuario profesor propietario/admin.
2. Abrí DevTools → Application/Local Storage y copiá el JWT, o usá el token de la sesión.
3. Ejecutá:

```bash
curl -X POST "<STAGING_BACKEND_URL>/api/admin/rag/courses/<COURSE_ID>/reindex" ^
  -H "Authorization: Bearer <TOKEN>"
```

4. Esperá `success: true` y verificá al menos un resultado `INDEXED`.
5. Con `student@gmail.com` inscrito, abrí el frontend staging en una lección publicada.
6. Verificá que aparezca **Tutor de la lección**, abrilo y preguntá sobre el contenido.
7. Esperá una respuesta con `[1]` y una sección **Fuentes**.
8. Preguntá algo fuera del material: debe responder que no encontró evidencia suficiente o no afirmar datos sin cita.

Para repetir la E2E backend + Neon con proveedores mockeados:

```powershell
$env:RAG_E2E_ALLOW_DB_WRITE='true'
$env:RAG_E2E_COURSE_ID='<COURSE_ID>'
$env:RAG_E2E_STUDENT_USERNAME='<STUDENT_USERNAME>'
node backend/scripts/e2e-rag-phase1.mjs
```

La misma prueba usa proveedores reales cuando `RAG_E2E_USE_MOCKS=false`. En ese
modo requiere `EMBEDDING_API_URL`, `EMBEDDING_API_KEY` y `EMBEDDING_MODEL` reales;
Groq usa la configuración de chat del backend. El estudiante se puede seleccionar
por `RAG_E2E_STUDENT_EMAIL` (por defecto `student@gmail.com`) o por username.

### Casos de error esperados

- Estudiante sin inscripción: `403`.
- Curso no listado en `RAG_COURSE_IDS`: `404`/`409` según endpoint.
- Lección borrador: no se indexa ni se expone.
- Embedding/Groq sin configuración: `503` o `502`, sin romper publicación del contenido.
- Token ausente: `401`.

## 6. Riesgos pendientes

- Fase 1 no incluye PDF, historial, cuota diaria, retención ni métricas; quedan para Fases 2–3.
- EmbeddingGemma local no está disponible para el backend desplegado en Render; producción requiere un host alcanzable.
- El embedding está fijado a 768 dimensiones; cambiar de modelo requiere migración/versionado y reindexado.
- El indexado asíncrono actualmente registra el error y queda para reintento manual; la cola/reintentos formales son Fase 2.
- El índice vectorial ANN todavía no es necesario para el piloto pequeño; evaluar HNSW/IVFFlat con métricas en Fase 5.
- No se hizo deploy productivo: primero hay que configurar secretos en staging y probar un curso piloto con usuarios reales autorizados.
- En este Windows, `prisma generate` normal encontró un `EPERM` sobre el query engine bloqueado; `prisma validate` y `prisma generate --no-engine` pasaron. El deploy/CI debe ejecutar `prisma generate` en un entorno limpio.
