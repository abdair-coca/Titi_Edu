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

- [ ] Agregar `RAG_EVIDENCE_STRONG_THRESHOLD` y usarlo en `partialEvidence`.
- [ ] Acotar y exportar `isConversationContinuation`.
- [ ] Tests de evidencia parcial y de continuación.

## U2 — Consultas de recuperación (puntos 2 y 10)

- [ ] Separar la consulta de embedding (`buildContextualRetrievalQuery`) de la full-text.
- [ ] Pasar `ftsQuery` por `searchCourseContext` y `searchFragments`.
- [ ] SQL híbrido: `ftsMatch` exige todos los términos; orden con coincidencia parcial.
- [ ] Quitar marcas `[n]` de los turnos enviados al modelo.
- [ ] Alinear el simulador de `admin-rag.js` con el chat.
- [ ] Probar el SQL contra pgvector desechable (`test/integration/rag.sql.test.js`).

## U1 — Índice sincronizado (punto 1)

- [ ] Programar reindexación tras adjuntar o borrar material y tras cambiar plazo.
- [ ] Reasignar el documento a la versión actual si la huella no cambió.
- [ ] Incluir título y versión de chunking en la huella.
- [ ] Panel admin: mostrar documentos desactualizados y excluirlos de "listos".
- [ ] Tests de rutas de authoring, de reutilización y de `admin-rag`.

## U5 — HTML evaluable (punto 5)

- [ ] Enmascarar clases e ids ocultados por `<style>` en modo seguro.
- [ ] Lista permitida de atributos `data-*` en modo seguro.
- [ ] Excluir bloques de `contenido` que revelen respuestas en lecciones evaluables.
- [ ] Tests de fugas y de que el modo no evaluable no cambia.

## U6 — Protección de evaluaciones (punto 6)

- [ ] Crear `services/rag.assessment.js`: carga, comparación y filtro de salida.
- [ ] Integrar en `chatWithContext`: forzar `PISTA` y aplicar el filtro.
- [ ] Eximir a profesores y administradores desde `routes/rag.js`.
- [ ] Tests: coincidencia, aprobada, staff, fallo de consulta y prompt sin opciones.

## U7 — Lectura de JavaScript (punto 7)

- [ ] Localizar literales con un escáner que respete strings y comentarios.
- [ ] Convertir objetos JS a JSON respetando strings.
- [ ] Tests: sin `;`, con URL, literal inválido y modo seguro.

## U8 — Chunking (punto 8)

- [ ] `lessonRagText` conserva párrafos y encabezados de `contenido`.
- [ ] Encabezados HTML como secciones.
- [ ] Cortes en espacios y solapamiento al empaquetar oraciones.
- [ ] Sección en el embedding y en los metadatos del prompt.
- [ ] No indexar fragmentos que solo repiten el título.
- [ ] Tests de estructura, cortes y metadatos.

## Cierre

- [ ] `npm --prefix backend test`
- [ ] `npm --prefix backend run lint`
- [ ] `npm --prefix frontend run build`
- [ ] Actualizar `docs/api.md`, `docs/rag-security.md`, variables de entorno de ejemplo e índice de `AGENTS.md`.
- [ ] Escribir `verify-report.md`.
- [ ] Confirmar con el usuario la reindexación de producción (pendiente, no se ejecuta en este change sin su aprobación).
