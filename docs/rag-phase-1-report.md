# Informe — RAG Fase 1: tutor de texto + HTML

Fecha: 2026-08-23  
Rama: `codex/rag-fase-1`  
Estado: implementado y verificado en local; producción queda protegida por flag apagado.

## 1. Qué implementamos

- Persistencia PostgreSQL con `pgvector` para documentos, versiones, estado y fragmentos.
- Extracción de texto visible desde HTML: elimina `script`, `style` y etiquetas, y decodifica entidades.
- Indexado de lecciones publicadas con hash de contenido, chunks solapados y embeddings OpenAI-compatible.
- Retrieval por similitud coseno filtrado por curso publicado, módulo/lección publicada y documento activo/listo.
- Tutor Groq con prompt de grounding, citas `[1]`, respuesta explícita sin evidencia y rechazo conceptual de acciones del sistema.
- Acceso restringido a usuarios autenticados con inscripción o rol docente/admin autorizado.
- Flag fail-closed por curso mediante `RAG_ENABLED=true` + `RAG_COURSE_IDS=<id>`.
- Reindexado autorizado de un curso piloto y reindexado asíncrono al guardar/publicar contenido.
- Tutor integrado en `LearnCourse`; no aparece para estudiantes hasta que el curso esté habilitado e indexado.

## 2. Archivos y migración

- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20260823010000_rag_phase_1/migration.sql`
- `backend/src/services/rag.service.js`
- `backend/src/routes/rag.js`
- `backend/src/routes/authoring.js`
- `backend/src/app.js`
- `backend/.env.example`
- `frontend/src/components/RagTutorCard.jsx`
- `frontend/src/pages/LearnCourse.jsx`
- `backend/test/routes/rag.test.js`
- `backend/test/services/rag.service.test.js`
- `frontend/scripts/check-rag-contract.mjs`
- `docs/api.md`

La migración crea `vector(1536)`, por eso el proveedor de embeddings debe entregar exactamente 1536 dimensiones en Fase 1.

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

### Resultados locales

```text
npx prisma validate
The schema at prisma\\schema.prisma is valid 🚀

npx vitest run --maxWorkers=1 --minWorkers=1
Test Files  23 passed (23)
Tests       217 passed (217)

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
```

El primer `vitest` paralelo falló por agotamiento de recursos de workers en Windows; la ejecución serial terminó verde. El build emitió únicamente el warning preexistente de chunks grandes.

No se ejecutó una llamada real a Groq/embeddings porque no hay credenciales de proveedor en este entorno. La ruta está cubierta con proveedor mockeado y queda lista para comprobar con claves de staging.

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

### Configuración local/staging

1. Aplicá la migración en el backend: `npx prisma migrate deploy`.
2. Configurá:
   - `RAG_ENABLED=true`
   - `RAG_COURSE_IDS=<ID_DEL_CURSO_PILOTO>`
   - `EMBEDDING_API_URL=<endpoint-compatible-con-/embeddings>`
   - `EMBEDDING_API_KEY=<secreto>`
   - `EMBEDDING_MODEL=<modelo-de-1536-dimensiones>`
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
5. Con un estudiante inscrito, abrí `https://titiedu.vercel.app/learn/<COURSE_ID>` y una lección publicada.
6. Verificá que aparezca **Tutor de la lección**, abrilo y preguntá sobre el contenido.
7. Esperá una respuesta con `[1]` y una sección **Fuentes**.
8. Preguntá algo fuera del material: debe responder que no encontró evidencia suficiente o no afirmar datos sin cita.

### Casos de error esperados

- Estudiante sin inscripción: `403`.
- Curso no listado en `RAG_COURSE_IDS`: `404`/`409` según endpoint.
- Lección borrador: no se indexa ni se expone.
- Embedding/Groq sin configuración: `503` o `502`, sin romper publicación del contenido.
- Token ausente: `401`.

## 6. Riesgos pendientes

- Fase 1 no incluye PDF, historial, cuota diaria, retención ni métricas; quedan para Fases 2–3.
- El embedding está fijado a 1536 dimensiones; cambiar de modelo requiere migración/versionado.
- El indexado asíncrono actualmente registra el error y queda para reintento manual; la cola/reintentos formales son Fase 2.
- El índice vectorial ANN todavía no es necesario para el piloto pequeño; evaluar HNSW/IVFFlat con métricas en Fase 5.
- No se hizo deploy productivo: primero hay que configurar secretos en staging y probar un curso piloto con usuarios reales autorizados.
