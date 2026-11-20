# Propuesta — Tutor conversacional

## Intención

Hoy el tutor solo puede contestar con citas del material. Si un mensaje no recupera
fuentes, responde "No encontré evidencia suficiente…" sin llamar al modelo, y si el
modelo contesta sin citar, la respuesta se rechaza. Por eso "hola, ¿cómo estás?",
"estoy cansado" o "¿qué podés hacer?" terminan en el mismo rechazo y la conversación
no arranca. Además, la carga siempre anuncia "Encontré N fuentes" o "No encontré
fuentes relevantes", aunque el mensaje sea un saludo.

Este change permite que el tutor converse como un compañero cercano sin perder el
respaldo en fuentes: lo que explica del curso sigue saliendo solo del material y con
citas, y lo demás es charla breve que se valida en el servidor.

## Alcance

### In Scope

| # | Qué | Unidad |
|---|---|---|
| 1 | Respuestas sin fuentes para saludos, charla y ánimo, generadas por el modelo | U1 |
| 2 | Tema del curso que el material no trata: solo orienta, sin explicarlo de memoria | U1 |
| 3 | Tema ajeno al curso: una o dos frases amables y vuelta a la lección | U1 |
| 4 | Validación en el servidor de toda respuesta sin citas (corta, sin código ni estructura) | U1 |
| 5 | Título del curso en el prompt para distinguir "tema del curso" de "tema ajeno" | U1 |
| 6 | Carga del panel sin mencionar búsqueda; el conteo de fuentes solo si la respuesta cita | U2 |
| 7 | Medición de generación: la charla se cuenta aparte de las respuestas con material | U3 |

### Out of Scope

- Responder temas del curso con conocimiento general del modelo (decisión del usuario:
  solo orientar).
- Cambiar el retrieval, los umbrales o el reranker.
- Memoria entre sesiones o personalidad configurable por curso.

## Decisiones (tomadas con el usuario el 2026-11-20)

- **Tema del curso no cubierto:** solo orienta. Dice que el material no lo trata y
  sugiere qué parte de la lección se relaciona.
- **Tema ajeno al curso:** charla breve (una o dos frases) y redirige a la lección.
- **Conteo de fuentes en la carga:** solo cuando la respuesta cita material.
- **Evaluaciones pendientes:** si el mensaje coincide con una pregunta de evaluación,
  no se acepta una respuesta sin citas; se mantiene la guía de evaluación.

## Criterios de éxito

- Un saludo, una charla o un "gracias" recibe una respuesta natural del modelo.
- Un mensaje sin fuentes recuperadas llega al modelo y recibe una respuesta de charla
  u orientación, no el rechazo fijo.
- Ninguna respuesta sin citas pasa al estudiante si es larga, trae código o tiene
  estructura de explicación (listas, tablas, pasos).
- Los tests del backend y los contratos del frontend quedan verdes.
