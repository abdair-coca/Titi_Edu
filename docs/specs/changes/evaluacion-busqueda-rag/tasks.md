# Tasks — Evaluación de la búsqueda del Tutor RAG

## Fase A — Golden set y medición

- [x] Golden set en `backend/eval/rag/golden-set.json` (129 preguntas: 85 de ajuste, 28 reservadas y 16 reservadas `holdout2`; 20 sin respuesta en el curso).
- [x] Script `backend/eval/rag/retrieval.mjs`: base local, carga del curso, indexación por variante, métricas.
- [x] Variantes en `backend/eval/rag/variants.mjs`; la variante `actual` reproduce la indexación de producción.
- [x] Caché de embeddings y datos del curso fuera de git.
- [x] `npm run eval:rag` y `backend/eval/rag/README.md`.
- [x] Línea base con la variante actual.
- [x] Revisión del usuario sobre una muestra de 20 preguntas.
- [x] Categoría `presentacion` (5 preguntas) para no perder "¿qué voy a aprender?" al quitar secciones.

## Fase B — Fragmentación

- [x] Medir todas las variantes con las preguntas de ajuste.
- [x] Confirmar finalistas con las preguntas reservadas (mejora el orden, no la cobertura).
- [x] Probar la consulta sin título de lección (descartado: pierde paráfrasis y coloquiales).
- [x] Probar reranker `@cf/baai/bge-reranker-base` sobre 15 candidatos (mejor resultado: `iu-rerank-k4`).
- [x] Reservadas nuevas `holdout2` (16 preguntas) escritas antes de medir las opciones 1, 2 y 5.
- [x] Opción 1 (un fragmento por ítem de lista), 2 (bajar Presentación y Pistas al reordenar) y 5 (umbral 0.35, descartada).
- [x] Decidir con el usuario entre `op2-degradar` y `op12-k5`: eligió `op12-k5`.
- [x] Aplicarla en `rag.service.js` (`prepareLessonFragments`, `rerankContext`,
  `retrieveLessonContext`) con tests y `INDEX_FORMAT_VERSION` 3.
- [x] El chat y la vista previa del admin usan la misma recuperación.
- [x] Variante `produccion` en la evaluación: mismo resultado que `op12-k5`.

## Cierre

- [x] `npm --prefix backend test` y `npm --prefix backend run lint`.
- [x] `verify-report.md` con los resultados.
- [ ] Reindexar producción, con confirmación del usuario (junto con `correcciones-tutor-rag`).
