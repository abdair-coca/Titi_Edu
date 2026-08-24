# Informe — RAG Fase 1: tutor de texto + HTML

Fecha: 2026-08-24
Rama: `codex/rag-fase-1`  
Estado: implementado y verificado en local; producción queda protegida por flag apagado.

## 1. Qué implementamos

- Persistencia PostgreSQL con `pgvector` para documentos, versiones, estado y fragmentos.
- Extracción de texto visible desde HTML: elimina `script`, `style` y etiquetas, y decodifica entidades.
- Indexado de lecciones publicadas con hash de contenido, chunks solapados y embeddings Gradio/BGE-M3.
- Retrieval por similitud coseno filtrado por curso publicado, módulo/lección publicada y documento activo/listo.
- Tutor Groq con prompt de grounding, citas `[1]`, respuesta explícita sin evidencia y rechazo conceptual de acciones del sistema.
- Acceso restringido a usuarios autenticados con inscripción o rol docente/admin autorizado.
- Flag fail-closed por curso mediante `RAG_ENABLED=true` + `RAG_COURSE_IDS=<id>`.
- Reindexado autorizado de un curso piloto y reindexado asíncrono al guardar/publicar contenido.
- El reindexado automático también valida `RAG_COURSE_IDS`; no indexa cursos fuera de la allowlist.
- Tutor integrado en `LearnCourse`; no aparece para estudiantes hasta que el curso esté habilitado e indexado.
- Servicio separado `embedding-service/` basado en Gradio para `BAAI/bge-m3`, con fallback automático GPU/CPU.
- Timeout de 120 segundos y un reintento para cold starts o respuestas transitorias del Space gratuito.

## 2. Archivos y migración

- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20260823010000_rag_phase_1/migration.sql`
- `backend/prisma/migrations/20260824010000_rag_bge_m3_1024/migration.sql`
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

La migración `20260824010000_rag_bge_m3_1024` elimina únicamente los fragmentos vectoriales
anteriores, marca los documentos como `PENDIENTE` y cambia la columna a `vector(1024)`.
Los documentos y versiones se conservan. Es obligatorio reindexar antes de usar el tutor.
El proveedor configurado es `BAAI/bge-m3`, con 1024 dimensiones normalizadas.

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
| `6541211` | Servicio inicial de embeddings BGE-M3 para Hugging Face Space |
| `88157b3` | Ignorar artefactos Python locales |
| `f440d1c` | Migración a `vector(1024)`, timeout y contrato BGE-M3 |

### Resultados locales

```text
npx prisma validate
The schema at prisma\\schema.prisma is valid 🚀

npx vitest run test/services/rag.service.test.js test/services/rag.indexing.test.js test/routes/rag.test.js --maxWorkers=1 --minWorkers=1
Test Files  3 passed (3)
Tests       10 passed (10)

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

backend E2E controlada:
node scripts/e2e-rag-phase1.mjs
lessonsProcessed: 3
readyDocuments: 3
storedFragments: 21
chatStatus: 200
citationCount: 5
```

El primer `vitest` paralelo falló por agotamiento de recursos de workers en Windows; la ejecución serial terminó verde. El build emitió únicamente el warning preexistente de chunks grandes.

No se ejecutó una llamada real a Groq/embeddings porque el Hugging Face Space todavía no tiene URL/secreto configurados en este entorno. La ruta está cubierta con proveedor mockeado y queda lista para comprobar con el Space desplegado.

La E2E sí usó la base Neon real, pero levantó mocks locales de embeddings y Groq:
reindexó el curso piloto, verificó documentos/fragmentos persistidos y consultó el chat como estudiante inscrito.
El script exige `RAG_E2E_ALLOW_DB_WRITE=true` para evitar escrituras accidentales.

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

### Configuración del servicio de embeddings

1. Creá un Hugging Face Space Gradio gratuito.
2. Subí el contenido de `embedding-service/`.
3. Agregá el secreto `EMBEDDING_API_KEY` en el Space.
4. Usá CPU gratuita; seleccioná GPU gratuita solo si aparece disponible. La aplicación detecta CUDA y vuelve a CPU automáticamente.
5. Verificá `https://<owner>-<space>.hf.space/gradio_api/openapi.json` y confirmá endpoint `/gradio_api/call/embed`.

### Configuración local/staging

1. Aplicá la migración en el backend: `npx prisma migrate deploy`.
2. Configurá:
   - `RAG_ENABLED=true`
   - `RAG_COURSE_IDS=<ID_DEL_CURSO_PILOTO>`
   - `EMBEDDING_API_URL=https://<owner>-<space>.hf.space`
   - `EMBEDDING_API_KEY=<mismo-secreto-del-Space>`
   - `EMBEDDING_MODEL=BAAI/bge-m3`
   - `EMBEDDING_DIMENSIONS=1024`
   - `EMBEDDING_PROVIDER=gradio`
   - `EMBEDDING_TIMEOUT_MS=120000`
   - `EMBEDDING_MAX_RETRIES=1`
   - `GROQ_API_KEY=<secreto>`
   - `GROQ_MODEL=<modelo-chat>`
3. Reiniciá el backend.

### Indexar y probar

1. Entrá a `https://titiedu.vercel.app` con un usuario profesor propietario/admin.
2. Abrí DevTools → Application/Local Storage y copiá el JWT, o usá el token de la sesión.
3. Ejecutá:

```bash
curl -X POST "https://titi-backend.onrender.com/api/admin/rag/courses/<COURSE_ID>/reindex" ^
  -H "Authorization: Bearer <TOKEN>"
```

4. Esperá `success: true` y verificá al menos un resultado `INDEXED`.
5. Con un estudiante inscrito, abrí `https://titiedu.vercel.app/courses/<COURSE_ID>/learn` y una lección publicada.
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

### Casos de error esperados

- Estudiante sin inscripción: `403`.
- Curso no listado en `RAG_COURSE_IDS`: `404`/`409` según endpoint.
- Lección borrador: no se indexa ni se expone.
- Embedding/Groq sin configuración: `503` o `502`, sin romper publicación del contenido.
- Token ausente: `401`.

## 6. Riesgos pendientes

- Fase 1 no incluye PDF, historial, cuota diaria, retención ni métricas; quedan para Fases 2–3.
- BGE-M3 corre en infraestructura gratuita: el Space puede dormir, tardar en despertar o limitar CPU/GPU.
- El embedding está fijado a 1024 dimensiones; cambiar de modelo requiere migración/versionado y reindexado.
- El indexado asíncrono actualmente registra el error y queda para reintento manual; la cola/reintentos formales son Fase 2.
- El índice vectorial ANN todavía no es necesario para el piloto pequeño; evaluar HNSW/IVFFlat con métricas en Fase 5.
- No se hizo deploy productivo: primero hay que configurar secretos en staging y probar un curso piloto con usuarios reales autorizados.
- En este Windows, `prisma generate` normal encontró un `EPERM` sobre el query engine bloqueado; `prisma validate` y `prisma generate --no-engine` pasaron. El deploy/CI debe ejecutar `prisma generate` en un entorno limpio.
