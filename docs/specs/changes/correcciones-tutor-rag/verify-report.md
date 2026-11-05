# Informe de verificación — Correcciones del Tutor RAG

**Fecha:** 2026-11-04
**Change:** `correcciones-tutor-rag`
**Alcance:** puntos 1 a 10 de la auditoría del tutor

## Resultado

Implementado y verificado en código, en Postgres con pgvector desechable y con proveedores
reales sobre una copia local del curso piloto (ver "Verificación con proveedores reales").
Producción no se tocó, y la versión final no se pudo medir completa con Groq por su límite
diario, así que el change sigue activo hasta completar lo pendiente.

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

## Verificación con proveedores reales

Curso piloto copiado en solo lectura a un Postgres local, con embeddings de Cloudflare y
`openai/gpt-oss-20b` reales. El curso no tiene evaluaciones guardadas: se añadió una de prueba
solo en la copia. Versiones: **anterior** `03cb712`, **primera** `f843566`, **final** `b6e8e48`.

Búsqueda, 48 preguntas con respuesta en el material (fragmento correcto entre las 5 fuentes):

| Medida | Anterior | Primera | Final |
|---|---|---|---|
| Fragmento correcto en las 5 fuentes | 43 | 45 | 48 |
| Término exacto, 8 preguntas | 5 | 5 | 8 |
| Cambio de tema, 6 preguntas | 4 | 6 | 6 |
| Preguntas con coincidencia exacta | 0 | 16 | 29 |
| Fuera de tema admitido por texto, 6 preguntas | 0 | 0 | 0 |

Respuestas, 47 casos y 54 turnos, anterior frente a primera. Faltan por medir `g05` en adelante.

| Medida | Anterior | Primera |
|---|---|---|
| Criterio automático | 35/54 | 46/54 |
| Respuestas descartadas por el validador | 13 | 6 |
| Pregunta de evaluación copiada sin revelar | 0/4 | 4/4 |
| Gana en lectura a ciegas, 50 turnos (34 empates) | 3 | 13 |
| Respuestas cortadas por el tope de tokens | 1 | 4 |

Punta a punta con HTTP, clave del usuario, gateway de Cloudflare y worker: 27/27 en `7aa7de6`.
El código anterior falla el punto 1: tras adjuntar un material la búsqueda devuelve 0 resultados
y el panel sigue mostrando `LISTO`. Panel admin y chat revisados en el navegador.

### Fallos que encontró esta verificación

- **Fuga por el punto 7:** el lector nuevo llevaba al índice las ayudas `hints` y el código de
  referencia del HTML evaluable. Corregido en `7aa7de6`.
- **Punto 2 incompleto:** las palabras de la pregunta (`sirve`, `significa`) impedían coincidir
  en 8 de 12 preguntas probadas. Corregido en `b6e8e48`.
- **Tope de 800 tokens:** el razonamiento lo agotaba y causaba respuestas vacías o sin citas.
  Subido a 1600 en `b6e8e48`; falta confirmar el efecto con el modelo.

### Observaciones

- La protección de evaluaciones actúa sobre todo por el filtro de salida: en los casos medidos el
  modelo dio la respuesta aunque se le pidió una pista, así que el alumno recibe el mensaje de
  repaso y no una pista.
- El límite gratuito de Groq es de 200.000 tokens al día, unas 100 preguntas por clave.
- Las lecciones 1.1 y 2.2 tienen el mismo HTML, pero el contexto del tutor de la 1.1 es de
  recursividad. Es un problema de datos del curso, no corregido aquí.

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

- **Medición limitada:** una sola pasada, preguntas escritas por quien hizo el cambio y un solo
  curso. La lectura a ciegas la hizo la misma persona. Los umbrales `0.60` y `0.15` siguen sin
  calibrar. El respaldo por términos no se activó en ningún turno real, así que solo está probado
  con tests; vigilar el evento `unsupported_by_cited_sources`.
- **Versión final:** su efecto en las respuestas del modelo está pendiente de medir.
- **Protección de evaluaciones:** una paráfrasis la evade, y no cubre preguntas de HTML
  evaluable, que no se guardan como `Pregunta`.
- **HTML evaluable:** un estilo que oculte pantallas por defecto las saca del índice; esas
  lecciones necesitan contexto autoral.

## Pendiente antes de archivar

1. Medir la versión final con el modelo: casos afectados por el tope de tokens y el full-text,
   intenciones pedagógicas, paráfrasis e inyección.
2. Reindexar producción, con confirmación: las lecciones ya desactualizadas no se recuperan
   solas, y cada una regenera sus embeddings una vez porque cambió el formato de indexación.
