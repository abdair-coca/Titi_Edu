# Tasks — Tutor RAG orientado al aprendizaje

> Marcar `[x]`. Cerrar cada etapa con pruebas, resultados y feedback explícito.

## Review Workload Forecast

| Campo | Valor |
|---|---|
| Líneas estimadas | 250-380 |
| Riesgo presupuesto 400 líneas | Medium |
| PR encadenadas | No |
| Entrega | Single PR, sin cadena por ahora |
| Estrategia de cadena | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Schema y contrato autoral | PR única | `npm --prefix backend test -- authoring` | N/A: no runtime harness nuevo | Migración + authoring |
| 2 | Índice, citas y diagnóstico | PR única | `npm --prefix backend test -- rag` | N/A: job existente `scheduleLessonIndex` | Servicio RAG |
| 3 | Editor y regresión | PR única | `npm --prefix frontend run test:rag` | N/A: flujo UI existente | Editor frontend |

## Etapa 1 — Seguridad y evidencia confiable (completada)

- [x] `backend/src/services/html-extractor.service.js`: excluir claves HTML evaluable y conservar contenido visible seguro.
- [x] `backend/src/services/rag.service.js`: umbral híbrido/vectorial, deduplicación, `NO_EVIDENCE_ANSWER`, citas seguras y controles existentes.
- [x] `frontend/src/components/TutorPanel.jsx`: historial request-scoped, aislamiento por `lessonId` y reintentos.
- [x] Tests extractor, retrieval, historial y seguridad; `npm --prefix backend test`; `npm --prefix backend run lint`.
- [x] Informar cierre y recibir feedback antes de Etapa 2.

## Etapa 2 — Tutoría formativa y adaptación (completada)

- [x] `backend/src/routes/lessons.js`, `backend/src/services/rag.service.js`: `intent`, contexto efímero mínimo, adaptación y reglas de práctica sin mutaciones.
- [x] Tests de intent, contexto neutral, minimización, prompts, práctica, pista y feedback; backend test/lint.
- [x] Informar cierre; Etapa 3 quedó bloqueada hasta feedback explícito.

## Etapa 3 — Experiencia de estudio y cierre (completada)

- [x] `frontend/src/components/TutorPanel.jsx`: acciones rápidas, estado de práctica por lección, citas honestas y lenguaje formativo.
- [x] `npm --prefix frontend run test:rag`; `npm --prefix frontend run build`; documentación API, seguridad, README y `verify-report.md` actualizados.
- [x] Regresión backend final; tareas marcadas y micro-commits convencionales preparados sin `Co-Authored-By`.

## Etapa 4 — Contexto autoral

### RED antes de producción

- [x] RED `backend/test/routes/authoring.test.js`: JSON pegado/archivo, extensión inválida, fingerprint, revisión y no uso de Material/Cloudinary.
- [x] RED `backend/test/services/rag.indexing.test.js`: precedencia `AUTOR`, fallback `HTML_FALLBACK`, contenido prohibido y estados de fallo.
- [x] RED `backend/test/services/rag.retrieval.test.js`: secciones, deduplicación y citas con origen/sección/extracto; legacy intacto.
- [x] RED `frontend` editor: lectura `.txt`/`.md`, envío JSON y diagnóstico visible.

### Producción y GREEN

- [x] `backend/prisma/schema.prisma` + migración: `contextoRag` nullable, origen documental y sección de fragmento; verificar defaults legacy.
- [x] `backend/src/routes/authoring.js`: validar contexto seguro, incluirlo en fingerprint/snapshot, versionar y programar reindexación.
- [x] `backend/src/services/rag.service.js`: seleccionar fuente exclusiva, chunking estructural, origen, citas y `ragStatusForLesson`; pasar tests RED.
- [x] `backend/src/services/html-extractor.service.js`: conservar extracción solo para `HTML_FALLBACK`; verificar claves evaluables.
- [x] `frontend/src/pages/teacher/ModulesEditor.jsx`: campo, archivo leído localmente y JSON; verificar no creación de Material.
- [x] Reindexación programada al guardar/restaurar; backend test/lint y frontend test/build ejecutados; evidencia documentada en `verify-report.md`.
- [x] Ejecutar reindexación operativa por lotes sobre publicados con DB y proveedor configurados: 6 lecciones procesadas, 6 documentos activos `LISTO`.
