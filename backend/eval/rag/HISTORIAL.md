# Historial de la evaluación RAG

Registro de las mediciones de la búsqueda del tutor con el golden set. Cada fila de la
tabla de mediciones guardadas tiene su archivo en `baselines/`, que permite comparar con
`--compare`. Cómo guardar y comparar: [README.md](README.md).

## Antes de guardar mediciones (golden set v1, 129 preguntas)

Tomadas de `docs/specs/changes/evaluacion-busqueda-rag/verify-report.md`. No tienen archivo
por pregunta, así que no se pueden usar con `--compare`.

| Fecha | Variante | Acierto@1 | Acierto@3 | Acierto@5 | MRR | Fuentes útiles | Tokens | Sin respuesta con fuentes |
|---|---|---|---|---|---|---|---|---|
| 2026-11-06 | `actual` (antes del reranker) | 53 % | 77 % | 94 % | 0.676 | 26 % | 611 | 17/20 |
| 2026-11-06 | `op12-k5` (reranker, listas por ítem) | 65 % | 89 % | 94 % | 0.765 | 27 % | 437 | 16/20 |
| 2026-11-07 | `op12-k5-corte` (`holdout3`, 35 preguntas) | 74 % | 83 % | 86 % | 0.788 | 34 % | 299 | 14/15 |

## Mediciones guardadas

| Fecha | Variante | Split | Commit | Golden set | Acierto@1 | Acierto@5 | MRR | Fuentes útiles | Tokens | Sin respuesta con fuentes | Nota | Archivo |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2026-11-07 | actual | all | 3e9d33b | v2 (53ca98f56fa3) | 56% | 91% | 0.686 | 26% | 616 | 45/50 | Búsqueda original: sin reranker, una sección por fragmento | [2026-11-07-actual-all](baselines/2026-11-07-actual-all.json) |
| 2026-11-07 | op12-k5 | all | 3e9d33b | v2 (53ca98f56fa3) | 68% | 92% | 0.779 | 27% | 429 | 45/50 | Reranker y listas por ítem, 5 fuentes fijas | [2026-11-07-op12-k5-all](baselines/2026-11-07-op12-k5-all.json) |
| 2026-11-07 | produccion | all | 3e9d33b | v2 (53ca98f56fa3) | 68% | 91% | 0.775 | 38% | 302 | 45/50 | Desplegado 2026-11-07: reranker + fuentes variables (5 %) | [2026-11-07-produccion-all](baselines/2026-11-07-produccion-all.json) |
