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

## Fase C — Número de fuentes variable

- [x] `holdout3` (35 preguntas) y 30 preguntas sin respuesta más (15 de ajuste, 15 reservadas), escritas antes de medir.
- [x] El script guarda el puntaje y la utilidad de cada fuente.
- [x] Simular el corte con las preguntas de ajuste: 0.05 del mejor puntaje (desde 0.06 se pierden respuestas).
- [x] Confirmar `op12-k5-corte` con `holdout3`: fuentes útiles 26 % → 34 %, sin perder aciertos.
- [x] Aplicarlo en `rerankContext` con tests; la variante `produccion` da lo mismo que `op12-k5-corte`.

## Cierre

- [x] `npm --prefix backend test` y `npm --prefix backend run lint`.
- [x] `verify-report.md` con los resultados.
- [x] Reindexar producción, con confirmación del usuario (junto con `correcciones-tutor-rag`): desplegado `4906e0b` y todos los cursos con RAG reindexados el 2026-11-07.
- [x] Guardar mediciones de referencia en `backend/eval/rag/baselines/` y `HISTORIAL.md`, con `--save` y `--compare` para comparar cambios futuros.
