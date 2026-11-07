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
