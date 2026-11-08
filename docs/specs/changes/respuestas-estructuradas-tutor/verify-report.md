# Informe de verificación — Respuestas estructuradas del Tutor IA (DIL)

**Fecha:** 2026-11-07
**Change:** `respuestas-estructuradas-tutor`

## Resultado

Implementado y verificado en código y en el navegador. Con el rescate de
`failed_generation` (2026-11-08), DIL cumple el criterio de la spec §5 y
`RAG_DIL_ENABLED` se puede encender. Con el flag apagado el tutor responde como antes; el
único cambio activo es el límite de salida, que pasó de 1600 a 3200 tokens.

| Comprobación | Resultado |
|---|---|
| `npx vitest run` (backend) | 42 archivos, 607 tests, PASS (17 de integración omitidos sin `RAG_TEST_DATABASE_URL`) |
| `npm run lint` (backend) | PASS |
| Los 12 `npm run test:*` del frontend | PASS |
| `npm run build` (frontend) | PASS |

## Matriz por requisito

| Req. | Caso | Evidencia | Resultado |
|---|---|---|---|
| §1 | Schema estricto: todo `required`, sin propiedades extra, un branch por componente | `rag.dil.test.js` | PASS |
| R1 | Flag apagado: sin `response_format`, mismo prompt, sin `dil` | `rag.dil-chat.test.js` | PASS |
| R1 | Flag encendido: schema estricto e instrucciones DIL en el prompt | `rag.dil-chat.test.js` | PASS |
| R2 | Límites por componente, nodos desconocidos, quiz fuera de práctica, máximo 12 | `rag.dil.test.js` | PASS |
| R2 | JSON cortado o sin nodos válidos → respuesta vacía (502) | `rag.dil-chat.test.js` | PASS |
| R2 | `dil_nodes_dropped` sin contenido | `rag.dil-chat.test.js` | PASS |
| R3 | Cita fuera de contexto → `NO_EVIDENCE_ANSWER` sin `dil` | `rag.dil-chat.test.js` | PASS |
| R3 | Texto u opción de quiz con la respuesta de una evaluación pendiente → guía sin `dil` | `rag.dil-chat.test.js` | PASS |
| R4 | `data.dil` en `null` sin árbol y con el árbol cuando existe | `routes/rag.test.js` | PASS |
| R5/R9 | El historial usa el texto canónico; el árbol no vuelve al servidor | `check-tutor-history.mjs` | PASS |
| R6 | Nodos desconocidos ignorados; sin `dil` se usa Markdown; citas fuera del código | `check-rag-contract.mjs` | PASS |
| R8 | Mermaid estricto, diagrama inválido cae a texto, SVG sin scripts ni `javascript:` | Navegador (abajo) | PASS |
| R9 | Quiz: radio con teclado, "Responder" habilitado al elegir, bloqueo tras enviar | Navegador (abajo) | PASS |

## Prueba en el navegador

Una página temporal de Vite (borrada después) mostró `DilMessage` con tres respuestas
reales del modelo y un caso armado a mano con tabla, diagramas de flujo y de secuencia, un
diagrama inválido y un quiz. En Chrome:

- Los dos diagramas se dibujan con sus textos y el inválido muestra su código. El SVG no
  tiene `<script>` ni atributos `on*`, y un `click … "javascript:…"` del diagrama no llega
  al DOM.
- La insignia `[2]` avisa su número; la tarjeta de concepto se expande (`aria-expanded`); el
  quiz deshabilita "Responder" hasta elegir, envía la opción y queda bloqueado; "Responder"
  de "Comprobá tu comprensión" pide el foco del campo.
- A 340 px de ancho (el panel en mobile) nada desborda: la tabla ajusta y el diagrama escala.

**Bug encontrado y corregido:** Mermaid 11 dibuja los textos de los nodos como HTML dentro
de `<foreignObject>` aunque `flowchart.htmlLabels` sea `false`, y la limpieza del SVG lo
borraba. Ahora se conserva y se quitan solo los elementos que ejecutan código, cargan
documentos o reciben datos (`56e9bd4`).

**Sin probar:** el flujo completo dentro de `LearnCourse` con el backend y una cuenta real.
El cableado del panel se verifica con `check-rag-contract.mjs`.

**Detalle visual que no es de este change:** el código resaltado se ve con fondo blanco
dentro del bloque oscuro porque el tema `github.css` de highlight.js pinta `.hljs`. Las
respuestas Markdown de hoy se ven igual.

## Medición con Groq real (U7)

`npm run eval:rag:generation` sobre 20 preguntas con respuesta del split `dev`, con
intenciones rotadas (DUDA, EXPLICAR, EJEMPLO, PRACTICA, RESUMEN), en la copia local del
curso piloto.

| Corrida | Respondidas | Sin evidencia | `json_validate_failed` | Infraestructura | Rechazo sin infraestructura | Tokens salida (prom./máx.) | p50 / p90 |
|---|---|---|---|---|---|---|---|
| Markdown | 19/20 | 1 | — | 0 | 5 % | 434 / 865 | 1787 / 2410 ms |
| DIL, prompt inicial | 16/20 | 1 | 1 | 2 (red con Cloudflare) | 11 % (2/18) | 773 / 1999 | 2172 / 3688 ms |
| DIL, prompt corto + quiz por intención | 14/20 | 1 | 1 | 4 (2 red con Groq, 2 cuota diaria agotada) | 12,5 % (2/16) | 794 / 1242 | 2524 / 4225 ms |

- **Causa de los rechazos propios de DIL:** Groq devuelve `400 json_validate_failed`. En
  las respuestas largas el modelo cierra la lista `nodes` antes de tiempo y sigue
  escribiendo nodos fuera de ella. Groq valida el schema después de generar, así que el
  modo estricto no evita el error con este modelo. Repitiendo la pregunta más larga
  (`l21-col-1`) falló 4 de 11 veces antes del ajuste de prompt.
- **Ajuste aplicado (`3683d58`):** pedir de 2 a 5 nodos (máximo 6) e instrucciones por
  intención. Con eso el quiz aparece en práctica (2 de 3 prácticas respondidas) y los
  árboles se acortaron (máximo 1242 tokens contra 1999), pero el error persiste.
- **Límite de tokens:** ninguna respuesta se acercó a 3200; no hubo JSON cortados.
- **Muestra chica y ruidosa:** la cuota diaria de tokens de Groq se agotó a mitad de la
  segunda corrida y no se pudo repetir.

**Decisión del 2026-11-07 (spec §5):** el rechazo subía 6 a 7 puntos sobre Markdown
(criterio: ≤ 5), así que el flag quedó apagado.

### Rescate de `failed_generation` (2026-11-08)

Groq devuelve la salida rechazada en `failed_generation`. `salvageDil` (`ee59c1c`) toma sus
nodos en orden, tanto si quedaron mezclados en el objeto raíz como si quedaron después de
él, y los pasa por la misma validación, citas y bloqueo de evaluaciones. No gasta otra
llamada. Spec R2 actualizada.

| Corrida | Respondidas | Sin evidencia | Rechazo por citas | Rescatadas | Errores | Rechazo | Tokens salida (prom./máx.) | p50 / p90 |
|---|---|---|---|---|---|---|---|---|
| DIL con rescate | 18/20 | 1 (la misma que Markdown) | 1 (`missing_citation`, `l14-par-1`) | 2 (ambas respondidas) | 0 | 10 % | 805 / 1581 | 2386 / 3320 ms |

- Las dos preguntas que antes fallaban con `json_validate_failed` (`l11-par-2`,
  `l21-col-1`) se respondieron con 4 y 3 nodos rescatados.
- El quiz aparece en 2 de las 3 prácticas respondidas.

**Decisión (spec §5):** el rechazo queda 5 puntos sobre Markdown (10 % contra 5 %), justo en
el límite, y no hubo JSON cortados. Cumple. El flag se puede encender en producción; la
muestra es de 20 preguntas, así que conviene vigilar `dil_salvaged` y
`ungrounded_answer_rejected` en los logs las primeras semanas.

## Pendiente para cerrar el change

- Encender `RAG_DIL_ENABLED=true` en Render y probar en el panel real.
- Archivar el change cuando la prueba en producción esté hecha.
