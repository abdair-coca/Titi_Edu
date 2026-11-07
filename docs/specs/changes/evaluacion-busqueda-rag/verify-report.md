# Informe de verificación — Evaluación de la búsqueda del Tutor RAG

**Fecha:** 2026-11-06
**Change:** `evaluacion-busqueda-rag`
**Alcance:** golden set, medición de la búsqueda y la variante elegida (`op12-k5`)

## Resultado

Implementado y verificado en código, con Postgres y pgvector locales y con los proveedores
reales de Cloudflare (embeddings y reranker) sobre una copia local del curso piloto.
Producción no se tocó. Falta reindexar producción, junto con `correcciones-tutor-rag`, con
confirmación del usuario.

| Comprobación | Resultado |
|---|---|
| `npm --prefix backend test` | 40 archivos, 562 tests, PASS (17 de integración omitidos) |
| SQL real (`test/integration`, `pgvector/pgvector:pg16`, `RAG_TEST_DATABASE_URL`) | 17 tests, PASS |
| `npm --prefix backend run lint` | PASS |
| `npm --prefix backend run eval:rag -- --variants produccion,op12-k5 --split all` | Mismas métricas en las 109 preguntas con respuesta |

## Qué cambió en el tutor

- **Fragmentos** (`prepareLessonFragments`, `INDEX_FORMAT_VERSION` 3):
  - Propósito, Objetivos de aprendizaje y Contexto se unen en un fragmento `Presentación`.
  - Errores frecuentes, Glosario y Resumen se parten en un fragmento por ítem, con el
    nombre de la sección delante. Si la sección tiene texto antes de la lista, queda entera.
  - Se quitan los fragmentos que solo tienen un encabezado.
- **Orden** (`retrieveLessonContext`, `rerankContext`):
  - La búsqueda híbrida trae 15 candidatos.
  - `@cf/baai/bge-reranker-base` los ordena con la pregunta del alumno, sin el título de
    la lección.
  - Presentación y Pistas multiplican su puntaje por 0.3.
  - Se devuelven hasta 5 fuentes (ver "Número de fuentes variable").
- **Respaldo**: si el reranker falla o tarda más de `RAG_RERANK_TIMEOUT_MS`, se usa el orden
  híbrido. Sin credenciales de Cloudflare, o con `RAG_RERANK_ENABLED=false`, la búsqueda
  es la de antes (5 fuentes, sin reranker).
- La vista previa de búsqueda del admin usa la misma recuperación que el chat.

## Métricas (109 preguntas con respuesta: dev, holdout y holdout2)

| | Antes | Ahora |
|---|---|---|
| Respuesta en la 1.ª fuente | 53 % | 65 % |
| Entre las 3 primeras | 77 % | 89 % |
| Entre las 5 | 94 % | 94 % |
| Evidencia completa | 90 % | 91 % |
| MRR | 0.676 | 0.765 |
| Fuentes útiles | 26 % | 27 % |
| Tokens de contexto por pregunta | 611 | 437 (−28 %) |
| Fragmentos del curso piloto | 178 | 257 |
| Preguntas sin respuesta que reciben fuentes | 17/20 | 16/20 |

Las preguntas `holdout2` se escribieron antes de medir las opciones finales.

## Matriz de casos

| Caso | Evidencia | Resultado |
|---|---|---|
| Presentación une propósito y objetivos | `rag.service.test.js` → lesson fragments | PASS |
| Sin título suelto ni encabezados vacíos | `rag.service.test.js` | PASS |
| Un fragmento por ítem; continuación de línea dentro del ítem | `rag.service.test.js` | PASS |
| Lista con texto previo queda entera | `rag.service.test.js` | PASS |
| Orden por puntaje del reranker, límite y renumeración | `rag.retrieval.test.js` → RAG reranking | PASS |
| Presentación y Pistas bajan de puntaje | `rag.retrieval.test.js` | PASS |
| Reranker caído: orden híbrido | `rag.retrieval.test.js` | PASS |
| 15 candidatos; reranker sin título de lección | `rag.retrieval.test.js` | PASS |
| Reranker apagado: búsqueda anterior | `rag.retrieval.test.js` | PASS |
| Vista previa del admin usa la misma recuperación | `admin-rag.test.js` | PASS |

## Número de fuentes variable (2026-11-07)

`rerankContext` conserva siempre la mejor fuente y, de las demás, solo las que tienen al
menos el 5 % de su puntaje (`RERANK_MIN_RELATIVE_SCORE`). Si el reranker falla, no hay
corte. El valor se eligió con las preguntas de ajuste: desde 0.06 se pierden respuestas.

El golden set pasó a 194 preguntas: `holdout3` (35 con respuesta) y 30 sin respuesta más,
temas de Python cercanos al curso que el material no explica.

Confirmación con `holdout3` (35 preguntas, usadas una sola vez):

| | 5 fuentes fijas | Fuentes variables |
|---|---|---|
| Respuesta en la 1.ª fuente | 74 % | 74 % |
| Entre las 5 | 86 % | 86 % |
| Evidencia completa | 86 % | 86 % |
| Fuentes útiles | 26 % | 34 % |
| Tokens de contexto por pregunta | 409 | 299 (−27 %) |
| Sin respuesta que reciben fuentes | 14/15 | 14/15 |

Todas las preguntas (144 con respuesta, 50 sin respuesta), código del tutor:

| | Antes (`op12-k5`) | Ahora (`produccion`) |
|---|---|---|
| Respuesta en la 1.ª fuente | 67 % | 68 % |
| Entre las 5 | 92 % | 91 % |
| Evidencia completa | 90 % | 88 % |
| MRR | 0.772 | 0.774 |
| Fuentes útiles | 27 % | 38 % |
| Tokens de contexto por pregunta | 430 | 304 (−29 %) |
| Sin respuesta que reciben fuentes | 45/50 | 45/50 |

`npm --prefix backend test` (564 tests, PASS), SQL real (17 tests, PASS) y lint (PASS).

## Límites conocidos

- Las preguntas que el curso no cubre siguen recibiendo fuentes (45/50 con el golden set
  ampliado). Ni la similitud ni el puntaje del reranker las separan de las que sí tienen
  respuesta; lo debe manejar el modelo de respuestas.
- Hay variación de ±1 pregunta entre corridas por empates de orden.
- El reranker suma una llamada a Cloudflare Workers AI por pregunta, que cuenta en la cuota
  de la cuenta.
- El golden set cubre un solo curso (8 lecciones).
