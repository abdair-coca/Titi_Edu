# Verify — Tutor conversacional

> Spec: [spec.md](spec.md). Verificado el 2026-11-20.

## Automático

| Qué | Comando | Resultado |
|---|---|---|
| Suite backend | `cd backend && npx vitest run` | 637 pasan, 17 saltados (antes 621) |
| Lint backend (archivos tocados) | `npx eslint src/services/rag.service.js src/services/rag.security.js src/routes/rag.js test/...` | Sin errores |
| Contrato RAG del frontend | `cd frontend && npm run test:rag` | OK |
| Historial del tutor | `npm run test:tutor-history` | OK |
| Build del frontend | `npx vite build` | OK |

El frontend no tiene ESLint configurado, así que no hay lint para `TutorPanel.jsx`.

## Tests nuevos o cambiados

- Un saludo va al modelo sin búsqueda; si el modelo no devuelve nada, se usa el saludo
  fijo (R1).
- Un mensaje sin fuentes llega al modelo, avisándole que no hay fuentes, y su charla se
  acepta (R2).
- Un seguimiento poco claro sin fuentes lo resuelve el modelo, que pregunta a qué se
  refiere; ya no hay aclaración fija (R2).
- Una respuesta sin citas se rechaza si es larga, trae código o es una lista; en DIL, si
  trae más de 3 nodos o alguno que no es `Text` (R3).
- Una respuesta sin citas a una práctica (`RETROALIMENTAR`) se rechaza (R3).
- Ante una evaluación pendiente: sin fuentes da la guía sin llamar al modelo, y una
  respuesta sin citas se reemplaza por la guía (R2, R3).
- La ruta pasa el título del curso al servicio (R4).

## Con Groq real

`npm run eval:rag:generation -- --set conversacion` (10 llamadas, Markdown, `openai/gpt-oss-20b`,
sin límites de Groq alcanzados). Registro en
[`backend/eval/rag/HISTORIAL.md`](../../../../backend/eval/rag/HISTORIAL.md).

| | Corrida 1 (`14188a0`) | Corrida 2 (`3f45621`, prompt ajustado) |
|---|---|---|
| Como se esperaba | 10/10 | 10/10 |
| Saludos | Naturales; uno llamó "Titi" al estudiante | Naturales, sin ponerle nombre |
| Tema no cubierto (tupla, archivos, try/except) | Orientó sin explicar; **inventó una sección** "de manejo de excepciones" | Orientó sin explicar; solo nombró lo que estaba en las fuentes |
| Tema ajeno (mundial, salteñas) | Declinó en frío | Salteñas: breve y amable. Mundial: sigue diciendo "el material no lo cubre" |
| Con respuesta en el curso | Citó [1][2] y [1][2][3] | Citó [1][2][5] y [1][2][3] |
| "¡Hola!" sin que el estudiante salude | 5 de 7 | 0 |

Las 25 preguntas no cubiertas del split `dev` recuperan fuentes igual (no relacionadas), así
que el modelo tuvo que elegir orientar en vez de citar: lo hizo en los 3 casos.

### Corrida 3 (`0788f26`)

- Tema ajeno: el prompt dice que no mencione el material ni pida disculpas, con un ejemplo
  de charla. El mundial pasó a *"Argentina ganó el Mundial de 2022. Si quieres seguir
  charlando o volver a la lección…"*. 10/10 como se esperaba.
- LaTeX: el modelo siguió escribiendo `\(n\)` y `\[ … \]` aunque el prompt lo prohíbe, y el
  panel no tiene un renderizador de matemáticas. `plainMath` (en `rag.security.js`) lo pasa a
  texto plano en el servidor, en Markdown y en los textos DIL, sin tocar el código. Aplicado
  a la respuesta real de esa corrida queda `n! = n × (n-1) × … × 1` y "si el caso base fuera 0".
- Suite backend: 639 pasan.

## Pendiente

- Las salteñas todavía reciben un "Lo siento, no tengo una receta" seco; aceptable.
- El modelo mezcla tú y vos según la respuesta; no se fijó un registro.
- Probar el panel a mano con la clave propia después del deploy.
