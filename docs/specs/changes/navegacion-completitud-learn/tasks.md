# Tasks — Navegación, completitud dinámica y notas HTML en Learn

## Frontend

- [x] Actualizar `LearnCourse.jsx` para sincronizar selección y `lessonId`.
- [x] Preservar `comments` y soportar recarga/atrás/adelante.
- [x] Mostrar posición actual separada de completadas y porcentaje.
- [x] Extender `check-html-lesson-player.mjs` con las regresiones de navegación.
- [x] Verificar `npm run test:html-lesson` y `npm run build`.

## Backend: completitud y progreso

- [x] Recalcular `checkCursoCompletado` con todas las lecciones publicadas actuales.
- [x] Reabrir inscripciones inconsistentes sin borrar certificados históricos.
- [x] Ajustar `GET /api/courses/:id/progress` para reflejar el mismo denominador.
- [x] Mantener fuera borradores y lecciones archivadas.
- [x] Agregar regresiones en `progress.service.test.js` y `courses.test.js`.

## Backend: HTML evaluable

- [x] Ampliar `lessons.test.js` para score válido, token inválido, límites,
      vencimiento e idempotencia.
- [x] Confirmar que una nota HTML no completa el curso si hay lecciones pendientes.
- [x] Verificar `cd backend && npm test`.

## Cierre

- [x] Actualizar este checklist con evidencia de ejecución.
- [x] Escribir `verify-report.md` al finalizar implementación y verificación.
