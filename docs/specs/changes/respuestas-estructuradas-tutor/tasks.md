# Tasks — Respuestas estructuradas del Tutor IA (DIL)

> Marcar `[x]` al avanzar. Un commit por unidad, sin push.
> Change: `respuestas-estructuradas-tutor`
> Verificación backend: `cd backend && npx vitest run test/services test/routes/rag.test.js`
> Verificación frontend: `cd frontend && npm run test:rag && npm run build`

## U1 — Contrato DIL v1 (backend)

- [x] Crear `backend/src/services/rag.dil.js` con el JSON Schema estricto (raíz +
      `anyOf` de los 9 componentes, todos los campos `required`,
      `additionalProperties: false`).
- [x] `validateDil(tree, { intent })`: aplica los límites de la spec §1, descarta
      nodos inválidos o `Quiz` fuera de `PRACTICA` y devuelve `{ nodes, dropped }`.
- [x] `dilToCanonicalText(nodes)`: serializa a Markdown con `[n]`; código y
      diagramas en bloques cercados.
- [x] Tests `test/services/rag.dil.test.js`: cada componente válido e inválido,
      límites, `Quiz` por intención, árbol vacío y serialización estable.

## U2 — Generación con structured outputs

- [x] Subir `MAX_COMPLETION_TOKENS` de 1600 a 3200.
- [x] Leer `RAG_DIL_ENABLED` y, con el flag encendido, agregar `response_format`
      con el schema y el bloque de instrucciones DIL al prompt de `generateAnswer`.
- [x] Parsear el JSON; si es ilegible o queda sin nodos, tratarlo como respuesta
      vacía (mismo camino que hoy, incluido el respaldo de evaluaciones).
- [x] En `chatWithContext`, aplicar `validateGroundedAnswer` y `answerRevealsOption`
      sobre el texto canónico; `dil = null` si alguna protección rechaza.
- [x] Registrar `dil_nodes_dropped` sin contenido.
- [x] Tests: con el flag apagado el body enviado a Groq no cambia; con el flag
      encendido, rechazo por citas, quiz que revela una opción, JSON cortado.

## U3 — API y documentación

- [x] `data.dil` en `POST /api/lessons/:id/chat` (`null` en todas las respuestas fijas).
- [x] Test de ruta: forma de la respuesta con y sin DIL.
- [x] Actualizar `docs/api.md`, `docs/rag-security.md` (texto canónico como base de
      las protecciones) y `.env.example` (`RAG_DIL_ENABLED`).

## U4 — Renderer DIL (frontend)

- [x] `frontend/src/components/tutor/DilMessage.jsx` + un componente por nodo:
      Text, Steps, Callout, Concepts, Table, Code, Check.
- [x] Insignias de cita `[n]` que despliegan la `CitationCard` correspondiente.
- [x] `MessageBubble` usa `DilMessage` si hay `dil`; guardar `dil` en el mensaje.
- [x] Revisar contra `frontend/design.md` §12 (plano, sombra dura, tonos).
- [x] Extender `scripts/check-rag-contract.mjs`: nodos desconocidos ignorados,
      mensaje sin `dil` cae a Markdown.

## U5 — Diagram

- [x] Extraer el loader de Mermaid de `HtmlLessonPlayer` a `lib/mermaid.js` y
      reutilizarlo (misma config estricta).
- [x] `DiagramNode`: carga diferida, caption accesible, "Ver como texto" y
      respaldo a código si falla.

## U6 — Quiz interactivo

- [x] `QuizNode`: radiogroup con teclado, "Responder", bloqueo tras enviar y solo
      lectura si no es el último mensaje.
- [x] Enviar `Mi respuesta: <opción>` con intención `RETROALIMENTAR`; mantener el
      estado de práctica de `tutorPractice.js`.
- [x] Check en `scripts/check-tutor-history.mjs`: el historial usa `content` canónico.

## U7 — Medición con Groq real

- [x] Script `backend/eval/rag/generation.mjs`: 20 preguntas del golden set en
      ambos modos; reporta rechazos por motivo, nodos descartados, tokens, p50/p90
      y JSON cortados. **Gasta cuota de Groq: correr solo con confirmación.**
- [x] Decidir el flag según la spec §5 y registrar en `HISTORIAL.md`.

## U8 — Cierre

- [x] Prueba manual en el panel (desktop y mobile): explicar, ejemplo, quiz,
      diagrama y fallo de Mermaid. Hecha con una vista aislada del renderer y respuestas
      reales del modelo; el flujo completo en `LearnCourse` queda sin probar.
- [x] `verify-report.md` con comandos y resultados reales.
- [x] Actualizar el estado del change en el índice de `AGENTS.md`.

## Pendiente (fuera del plan original)

- [x] Rescatar los nodos de `failed_generation` cuando Groq responde
      `json_validate_failed` (`salvageDil` + spec R2) y probarlo con las formas reales.
- [x] Volver a medir antes de encender `RAG_DIL_ENABLED` (18/20, cumple §5).
- [ ] Encender `RAG_DIL_ENABLED=true` en Render y probar en el panel real.
