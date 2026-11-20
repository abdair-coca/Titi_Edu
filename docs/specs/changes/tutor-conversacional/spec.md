# Spec — Tutor conversacional

> Proposal: [proposal.md](proposal.md).

## 1. Tipos de respuesta

| Tipo | Cuándo | Cómo se reconoce | Validación |
|---|---|---|---|
| **Con material** | La respuesta explica contenido del curso | Cita al menos una fuente `[n]` | La de siempre: citas válidas y respaldo de términos |
| **Charla** | Saludo, ánimo, tema no cubierto (orientación) o tema ajeno | No cita ninguna fuente | R3 |
| **Aviso fijo** | Acción bloqueada, evaluación pendiente o respuesta rechazada | Texto fijo del servidor | — |

## 2. Requisitos — backend

### R1. Saludos y charla
- Un saludo puro (la detección actual de mensajes sociales) ya no recibe un texto fijo:
  va al modelo sin búsqueda y sin fuentes.
- Si el modelo falla con una respuesta vacía, se usa el texto fijo de saludo.

### R2. Mensajes sin fuentes recuperadas
- Si la búsqueda (y las fuentes reusadas del historial) no devuelve nada, el mensaje
  igual va al modelo, avisándole que no hay fuentes.
- Si además coincide con una evaluación pendiente, no se llama al modelo y se devuelve
  la guía de evaluación.
- Se elimina la respuesta fija de aclaración para seguimientos sin fuentes: el modelo,
  con el historial, pregunta a qué se refiere.

### R3. Validación de una respuesta sin citas
Se acepta solo si cumple todo:
- No está vacía ni es el texto de rechazo.
- Tiene hasta 600 caracteres.
- No trae bloques de código.
- No trae listas: dos o más líneas que empiezan con viñeta o número.
- En DIL, todos los nodos son `Text` y son hasta 3.
- El mensaje no coincide con una evaluación pendiente.
- La intención no es `RETROALIMENTAR`: juzgar la respuesta de una práctica es un
  veredicto y siempre necesita una fuente.

Si no cumple, el estudiante recibe el texto de rechazo y se registra el evento
`ungrounded_answer_rejected` con el motivo.

### R4. Prompt
- Tono cercano y cálido, como un compañero que sabe del curso.
- Lo que explique del curso sale solo de las fuentes y lleva cita.
- Reglas para responder sin fuentes: charla natural; tema del curso no cubierto → no
  explicarlo ni dar definiciones, ejemplos o código de memoria, decir que el material
  no lo trata y sugerir qué parte de la lección se relaciona; tema ajeno → una o dos
  frases y ofrecer volver a la lección, sin adivinar datos que cambian (precios,
  noticias, resultados recientes).
- Recibe el título del curso como metadato no confiable.

### R5. Texto de rechazo
- Más cálido: "No encontré esto en los materiales del curso y prefiero no inventarte
  una respuesta. ¿Qué parte de la lección querés repasar?"

### R6. API
- `POST /api/lessons/:id/chat` no cambia de forma: una charla llega con
  `citations: []` y `relatedLesson: null`.

## 3. Requisitos — frontend

### R7. Carga del panel
- Las etapas previas a la respuesta no mencionan búsqueda ("Leyendo tu mensaje…",
  "Pensando…").
- "Encontré N fuentes" aparece solo si la respuesta cita fuentes; N es el número de
  fuentes citadas.
- Una respuesta sin citas se muestra sin la etapa de fuentes y sin la espera extra.

## 4. Medición

- `eval/rag/generation.mjs` cuenta la charla como `conversacion`, separada de
  `respondida` (con citas) y de los rechazos.
