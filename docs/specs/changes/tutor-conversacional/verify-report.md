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

## Pendiente

- **Medir con Groq real.** Los tests usan un modelo simulado. Falta comprobar con el
  modelo real que (a) en un tema del curso no cubierto orienta y no explica de memoria,
  (b) con fuentes disponibles sigue citando en vez de charlar, y (c) el tono suena
  natural. `npm run eval:rag:generation` ya cuenta la charla como `conversacion`, separada
  de `respondida`, para ver si el modelo deja de usar el material.
- Probar el panel a mano: "hola", "¿cómo estás?", "¿qué es una tupla?" (curso de Python
  sin ese tema) y "¿quién ganó el mundial?".
