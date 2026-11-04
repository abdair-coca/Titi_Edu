# Informe de verificación — Correcciones del Tutor RAG

**Fecha:** 2026-11-04
**Change:** `correcciones-tutor-rag`
**Alcance:** puntos 1 a 10 de la auditoría del tutor

## Resultado

Implementado y verificado en código y en un Postgres con pgvector desechable. **No se probó
con el proveedor real de embeddings ni con Groq**, y producción no se tocó, así que el change
sigue activo hasta completar lo pendiente.

| Comprobación | Resultado |
|---|---|
| `npm --prefix backend test` con `RAG_TEST_DATABASE_URL` | 41 archivos, 551 tests, PASS |
| SQL real (`test/integration/rag.sql.test.js`, `pgvector/pgvector:pg16`) | 11 tests, PASS |
| `npm --prefix backend run lint` | PASS |
| `npm --prefix frontend run build` | PASS |

Sin `RAG_TEST_DATABASE_URL` los tests de integración se omiten y la suite sigue siendo
hermética.

## Matriz por punto

| # | Caso | Evidencia | Resultado |
|---|---|---|---|
| 1 | Material y plazo reprograman la indexación; reintento idempotente no la repite | `routes/authoring.test.js` | PASS |
| 1 | Versión nueva sin cambios de texto no genera embeddings; un cambio de título sí | `rag.indexing.test.js` | PASS |
| 1 | Consulta de desactualizados y vuelta a la búsqueda al reasignar versión | integración | PASS |
| 2 | Término exacto con similitud baja califica; coincidencia parcial solo ordena | integración | PASS |
| 2 | La consulta enriquecida no coincidía en full-text: confirma el fallo original | integración | PASS |
| 2 | Mensaje sin términos útiles y puntuación especial no provocan error | integración | PASS |
| 3 | 8 preguntas técnicas pasan y 11 pedidos se bloquean sin proveedor | `rag.security.test.js`, `rag.chat-security.test.js` | PASS |
| 4 | `arr[7]`, `lista[0]`, `[1, 2]`, `[1][2]`, `【1】` y código entre backticks | `rag.security.test.js` | PASS |
| 4 | "Inventado total [1]" se rechaza; una paráfrasis se acepta | `rag.security.test.js` | PASS |
| 5 | Ocultos por `<style>` y `data-*` desconocidos no llegan al índice | `html-extractor.service.test.js` | PASS |
| 5 | HTML no evaluable conserva sus respuestas | `html-extractor.service.test.js`, `rag.service.test.js` | PASS |
| 6 | Coincidencia fuerza `PISTA`, las opciones no llegan al prompt y se filtra la salida | `rag.assessment.test.js` | PASS |
| 6 | Evaluación aprobada, staff, fallo de consulta y logs sin texto | `rag.assessment.test.js`, `routes/rag.test.js` | PASS |
| 6 | Consulta de evaluaciones de módulo y finales contra el esquema real | integración | PASS |
| 7 | Sin `;`, con URL, comentarios, comas finales y literal ilegible | `html-extractor.service.test.js` | PASS |
| 8 | Secciones de Markdown y HTML, cortes en espacios, solapamiento | `rag.service.test.js`, `rag.indexing.test.js` | PASS |
| 9 | Evidencia parcial activa; continuación acotada | `rag.chat-security.test.js` | PASS |
| 10 | Historial solo en continuaciones, recortado y sin `[n]` | `rag.chat-security.test.js` | PASS |

## Cómo repetir la prueba de SQL

```bash
docker run -d --name titi-rag-test -e POSTGRES_PASSWORD=test -e POSTGRES_DB=rag -p 127.0.0.1:55433:5432 pgvector/pgvector:pg16
cd backend
DATABASE_URL=postgresql://postgres:test@127.0.0.1:55433/rag npx prisma migrate deploy
RAG_TEST_DATABASE_URL=postgresql://postgres:test@127.0.0.1:55433/rag npx vitest run test/integration
docker rm -f titi-rag-test
```

La prueba rechaza cualquier host que no sea local.

## Límites conocidos

- **Calidad sin medir:** no se evaluó si las respuestas o los resultados mejoran con
  preguntas reales. Los umbrales `0.60` y `0.15` son valores iniciales sin calibrar. El
  respaldo por términos puede rechazar respuestas válidas si el material está en otro idioma
  que la respuesta; vigilar el evento `unsupported_by_cited_sources`.
- **Modelo real:** el prompt nuevo no se probó con `openai/gpt-oss-20b`.
- **Panel admin:** la tarjeta y la insignia de desactualizadas compilan, pero no se revisaron
  en el navegador.
- **Protección de evaluaciones:** una paráfrasis la evade, y no cubre preguntas de HTML
  evaluable, que no se guardan como `Pregunta`.
- **HTML evaluable:** un estilo que oculte pantallas por defecto las saca del índice; esas
  lecciones necesitan contexto autoral.

## Pendiente antes de archivar

1. Reindexar producción, con confirmación: las lecciones ya desactualizadas no se recuperan
   solas, y cada una regenera sus embeddings una vez porque cambió el formato de indexación.
2. Probar el chat con una clave Groq real en un curso piloto.
