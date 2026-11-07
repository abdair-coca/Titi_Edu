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
  - Se devuelven 5 fuentes.
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

## Límites conocidos

- Las preguntas que el curso no cubre siguen recibiendo fuentes (16/20). La búsqueda no lo
  separa; lo debe manejar el modelo de respuestas.
- Hay variación de ±1 pregunta entre corridas por empates de orden.
- El reranker suma una llamada a Cloudflare Workers AI por pregunta, que cuenta en la cuota
  de la cuenta.
- El golden set cubre un solo curso (8 lecciones).
