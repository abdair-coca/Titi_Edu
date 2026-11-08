# Spec — Respuestas estructuradas del Tutor IA (DIL)

> Proposal: [proposal.md](proposal.md). Requisitos en lenguaje funcional; el
> contrato DIL v1 se fija acá porque es la interfaz entre modelo, backend y frontend.

## 1. Contrato DIL v1

Una respuesta DIL es un objeto `{ "version": 1, "nodes": [ ... ] }` con 1 a 12
nodos. Cada nodo tiene un campo `c` que nombra su componente. En el schema
estricto todos los campos son obligatorios; lo opcional vale `null` o `[]`.

| Componente | Campos | Límites | Uso |
|---|---|---|---|
| `Text` | `text` | ≤ 800 caracteres | Párrafo con formato en línea (negrita, cursiva, código) |
| `Steps` | `title` (texto o null), `items[]` (`text`) | 2–8 pasos, ≤ 300 c/u | Procedimientos y explicaciones graduales |
| `Callout` | `tone`, `title` (texto o null), `text` | `tone` ∈ `definicion`, `tip`, `advertencia`, `nota`; ≤ 400 | Definiciones, consejos, errores comunes |
| `Concepts` | `items[]` (`term`, `text`) | 1–6 tarjetas; `term` ≤ 60, `text` ≤ 300 | Glosario o conceptos clave expandibles |
| `Table` | `caption` (texto o null), `head[]`, `rows[][]` | 2–4 columnas, 1–8 filas, celdas ≤ 120 | Comparaciones |
| `Code` | `language`, `code`, `caption` (texto o null) | `code` ≤ 1500; `language` de la lista de lenguajes resaltados o `text` | Ejemplos de código |
| `Diagram` | `kind`, `source`, `caption` | `kind` ∈ `flowchart`, `sequence`; `source` ≤ 1200; `caption` obligatorio | Flujos y secuencias en Mermaid |
| `Quiz` | `question`, `options[]` | 2–4 opciones, ≤ 150 c/u; pregunta ≤ 300 | Práctica de opción múltiple **sin respuesta correcta** |
| `Check` | `question` | ≤ 300 | Pregunta abierta para comprobar comprensión |

**Citas:** las citas `[n]` van en los campos de texto visibles: `text`, `items`,
celdas, `title` y `caption`. El cuerpo de `Code` y el `source` de `Diagram` no
cuentan como citas, igual que hoy el código no cuenta.

## 2. Requisitos — backend

### R1. Activación por flag
- Con `RAG_DIL_ENABLED` distinto de `true`, el tutor responde exactamente como hoy:
  mismo prompt, sin `response_format`, `data.dil = null`.
- Con el flag en `true`, la llamada a Groq pide `response_format` de tipo
  `json_schema` con `strict: true` y el schema DIL v1, y el prompt describe el
  catálogo y cuándo conviene cada componente.
- El límite de salida del modelo (`MAX_COMPLETION_TOKENS`) pasa de 1600 a 3200 en
  ambos modos, porque el razonamiento y el JSON comparten ese límite.

### R2. Validación de nodos
- El backend valida cada nodo contra los límites de la tabla. El modo estricto
  garantiza la forma, pero los largos y cantidades se controlan acá.
- Un nodo inválido o de componente desconocido se descarta y el resto se conserva.
- `Quiz` solo se acepta con intención `PRACTICA` y como máximo uno por respuesta.
  En otra intención se descarta.
- Si no queda ningún nodo válido, la respuesta se trata como vacía, igual que hoy
  cuando el modelo no devuelve contenido.
- Un JSON que no se puede leer, por ejemplo cortado por el límite de tokens, se
  trata como respuesta vacía. No se reintenta: cada reintento gasta la clave del
  estudiante.
- Si Groq rechaza la salida con `400 json_validate_failed` (el modelo rompió el
  schema), se leen los nodos de `failed_generation` que devuelve el error y pasan por
  la misma validación y protecciones. No hay llamada extra. Se registra
  `dil_salvaged` con la cantidad de nodos; si no se rescata ninguno, el error sigue
  siendo 502 como hoy. *(Agregado el 2026-11-08 tras la medición de U7.)*
- Los descartes se registran con `securityEvent('dil_nodes_dropped', { count, reason })`
  y sin contenido.

### R3. Texto canónico y protecciones
- El árbol válido se serializa a un texto canónico en Markdown con sus `[n]`. Por
  ejemplo, `Steps` pasa a lista numerada, `Callout` a cita con etiqueta, `Table` a
  tabla GFM y `Quiz` a pregunta con opciones listadas.
- Sobre ese texto se aplican, sin cambios de lógica, `validateGroundedAnswer`
  (citas válidas y respaldo por términos) y `answerRevealsOption` (evaluaciones).
- Si alguna protección rechaza, la respuesta es la de hoy (`NO_EVIDENCE_ANSWER` o
  `ASSESSMENT_GUIDANCE_ANSWER`) con `dil = null`. Una opción de quiz que coincide
  con la respuesta correcta de una evaluación pendiente también cuenta como revelar.
- Las citas devueltas en `data.citations` son las que aparecen en el texto canónico.

### R4. Respuesta de la API
- `POST /api/lessons/:id/chat` devuelve `{ success, data: { answer, dil, citations, relatedLesson, usage } }`.
- `answer` es siempre el texto canónico (o la respuesta fija) y sigue siendo lo que
  el cliente manda como historial.
- `dil` es el árbol validado o `null`: con el flag apagado, en respuestas fijas
  (sin evidencia, evaluación, saludo, acción bloqueada, aclaración) o cuando una
  protección rechazó.
- Un cliente viejo que solo lee `answer` sigue funcionando.

### R5. Historial
- El historial que llega del cliente se sigue tratando como texto no confiable.
  Nunca se acepta un árbol DIL desde el cliente.

## 3. Requisitos — frontend

### R6. Renderer
- Si el mensaje del tutor trae `dil`, el panel lo muestra con componentes Titi;
  si no, con `MarkdownContent`, como hoy.
- Componentes desconocidos se ignoran sin romper el mensaje.
- El texto de los nodos se pinta como texto React o Markdown en línea con
  `skipHtml`; no se admiten enlaces ni imágenes dentro de un nodo.
- Las citas `[n]` se muestran como insignias tocables que despliegan la fuente
  correspondiente en la lista "Fuentes utilizadas".
- Estilo según `frontend/design.md`: plano, sin `bg-gradient-*` ni `blur-*`, tiles
  con borde y sombra dura. Cada tono de `Callout` usa colores del sistema.
- Las animaciones de entrada respetan `prefers-reduced-motion`.

### R7. Concepts, Table y Code
- `Concepts` muestra tarjetas con el término; al tocar se expande el texto
  (`aria-expanded`, teclado).
- `Table` se desplaza en horizontal dentro del panel y nunca desborda la página.
- `Code` reutiliza el bloque con resaltado y botón "Copiar".

### R8. Diagram
- Mermaid se carga solo cuando hay un diagrama y con `securityLevel: 'strict'` y
  `htmlLabels: false`, igual que en `HtmlLessonPlayer`.
- El `caption` es el nombre accesible del diagrama. Un botón "Ver como texto"
  muestra el `source`.
- Si Mermaid no puede renderizar, se muestra el `caption` y el `source` como
  código, sin error visible.

### R9. Quiz
- Las opciones se muestran como un grupo de radio tocable y operable con teclado.
  El botón "Responder" se habilita al elegir una.
- Al responder se envía `Mi respuesta: <opción>` con intención `RETROALIMENTAR`, se
  bloquea el quiz y se marca la opción elegida. El feedback llega en el turno
  siguiente.
- Solo el quiz del último mensaje del tutor es interactivo; los anteriores quedan
  de solo lectura.
- El estudiante puede seguir escribiendo libremente en el campo de abajo.
- Nunca se muestra "correcto" ni "incorrecto" en el cliente: no tiene esa información.

### R10. Check
- `Check` se muestra como una tarjeta de "Comprobá tu comprensión" con un botón
  que lleva el foco al campo de texto, listo para responder.

## 4. Casos borde

| Caso | Comportamiento |
|---|---|
| Flag apagado | Idéntico a hoy; `dil = null` |
| Groq rechaza el `response_format` (400) | Error 502 como hoy; el flag se puede apagar |
| Groq rechaza la salida (`json_validate_failed`) | Se rescatan los nodos de `failed_generation` y se validan; sin nodos, 502 |
| JSON cortado por límite de tokens | Respuesta vacía → mismo manejo que hoy |
| Todos los nodos inválidos | Respuesta vacía → mismo manejo que hoy |
| Respuesta sin citas o con citas inventadas | `NO_EVIDENCE_ANSWER`, `dil = null` |
| Quiz fuera de `PRACTICA` | Se descarta ese nodo |
| Quiz con la opción correcta de una evaluación pendiente | `ASSESSMENT_GUIDANCE_ANSWER`, `dil = null` |
| Mermaid inválido | Caption + source como código |
| Mensaje viejo en la conversación sin `dil` | Se muestra con Markdown |
| Teacher o admin en vista previa | Igual que estudiante; sin datos de aprendizaje privados (regla actual) |

## 5. Medición (U7)

- Con el flag apagado y encendido, sobre las mismas 20 preguntas del golden set
  (`backend/eval/rag/golden-set.json`), con Groq real, se registra: tasa de
  rechazo por motivo, nodos descartados, tokens de salida, latencia p50 y p90, y
  JSON cortados.
- Decisión: el flag queda encendido si la tasa de rechazo no sube más de 5 puntos
  y no hay JSON cortados en más del 5 % de las preguntas. Si no se cumple, se ajusta
  el prompt o `MAX_COMPLETION_TOKENS` y se vuelve a medir.
- El resultado se registra en `verify-report.md` y en `backend/eval/rag/HISTORIAL.md`.
