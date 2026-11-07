# Tasks — Correcciones del Tutor RAG

> Marcar `[x]` al avanzar. Un commit por unidad, sin push.
> Change: `correcciones-tutor-rag`
> Verificación por unidad: `cd backend && npx vitest run test/services test/routes/rag.test.js`

## U3 — Bloqueo de acciones (punto 3)

- [x] Acotar `ACTION_PATTERNS` en `rag.security.js` a pedidos, no vocabulario.
- [x] Agregar `ACTION_BLOCKED_ANSWER` y usarla en `chatWithContext`.
- [x] Tests: preguntas técnicas pasan, pedidos se bloquean sin proveedor.

## U4 — Validación de respuestas (punto 4)

- [x] Reescribir la extracción de citas: código excluido, `[1, 2]`, `[1][2]`, `【1】`.
- [x] Normalizar las citas de la respuesta entregada.
- [x] Agregar respaldo por términos con `RAG_SUPPORT_MIN_OVERLAP`.
- [x] Responder mensajes sociales sin recuperación ni proveedor.
- [x] Pedir código entre backticks en el prompt.
- [x] Tests de cada formato, respaldo y mensajes sociales.

## U9 — Grados de evidencia y continuación (punto 9)

- [x] Agregar `RAG_EVIDENCE_STRONG_THRESHOLD` y usarlo en `partialEvidence`.
- [x] Acotar y exportar `isConversationContinuation`.
- [x] Tests de evidencia parcial y de continuación.

## U2 — Consultas de recuperación (puntos 2 y 10)

- [x] Separar la consulta de embedding (`buildContextualRetrievalQuery`) de la full-text.
- [x] Pasar `ftsQuery` por `searchCourseContext` y `searchFragments`.
- [x] SQL híbrido: `ftsMatch` exige todos los términos; orden con coincidencia parcial.
- [x] Quitar marcas `[n]` de los turnos enviados al modelo.
- [x] Alinear el simulador de `admin-rag.js` con el chat.
- [x] Probar el SQL contra pgvector desechable (`test/integration/rag.sql.test.js`).

## U1 — Índice sincronizado (punto 1)

- [x] Programar reindexación tras adjuntar o borrar material y tras cambiar plazo.
- [x] Reasignar el documento a la versión actual si la huella no cambió.
- [x] Incluir título y versión de chunking en la huella.
- [x] Panel admin: mostrar documentos desactualizados y excluirlos de "listos".
- [x] Tests de rutas de authoring, de reutilización y de `admin-rag`.

## U5 — HTML evaluable (punto 5)

- [x] Enmascarar clases e ids ocultados por `<style>` en modo seguro.
- [x] Lista permitida de atributos `data-*` en modo seguro.
- [x] Excluir bloques de `contenido` que revelen respuestas en lecciones evaluables.
- [x] Tests de fugas y de que el modo no evaluable no cambia.

## U6 — Protección de evaluaciones (punto 6)

- [x] Crear `services/rag.assessment.js`: carga, comparación y filtro de salida.
- [x] Integrar en `chatWithContext`: forzar `PISTA` y aplicar el filtro.
- [x] Eximir a profesores y administradores desde `routes/rag.js`.
- [x] Tests: coincidencia, aprobada, staff, fallo de consulta y prompt sin opciones.

## U7 — Lectura de JavaScript (punto 7)

- [x] Localizar literales con un escáner que respete strings y comentarios.
- [x] Convertir objetos JS a JSON respetando strings.
- [x] Tests: sin `;`, con URL, literal inválido y modo seguro.

## U8 — Chunking (punto 8)

- [x] `lessonRagText` conserva párrafos y encabezados de `contenido`.
- [x] Encabezados HTML como secciones.
- [x] Cortes en espacios y solapamiento al empaquetar oraciones.
- [x] Sección en el embedding y en los metadatos del prompt.
- [x] No indexar fragmentos que solo repiten el título.
- [x] Tests de estructura, cortes y metadatos.

## Cierre

- [x] `npm --prefix backend test`
- [x] `npm --prefix backend run lint`
- [x] `npm --prefix frontend run build`
- [x] Actualizar `docs/api.md`, `docs/rag-security.md`, variables de entorno de ejemplo e índice de `AGENTS.md`.
- [x] Escribir `verify-report.md`.
- [x] Confirmar con el usuario la reindexación de producción: desplegado `4906e0b` y todos los cursos con RAG reindexados el 2026-11-07 (lecciones en `LISTO`).
- [x] Comparar con Groq y Cloudflare reales sobre una copia local del curso piloto.
- [ ] Medir la versión final con el modelo (pendiente por el límite diario de Groq).
