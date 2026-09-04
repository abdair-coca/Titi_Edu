# Tasks — Hilos en Comentarios de Lecciones y Notificación de Publicación

> **Change:** `interaccion-lecciones`
> **Estado:** completado

## Fase 1 — Base de Datos & Backend

- [x] 1.1 Agregar campo `parentId` y relación autoreferencial en `model ComentarioLeccion` en `backend/prisma/schema.prisma` y generar migración SQL correspondiente.
- [x] 1.2 Actualizar `POST /api/lessons/:id/comments` en `backend/src/routes/lessons.js` para recibir `parentId`, validar pertenencia y forzar nivel 1.
- [x] 1.3 Integrar notificación en Neo4j (`lesson_comment_reply`) para el autor original en `POST /api/lessons/:id/comments` (en `try/catch` asíncrono).
- [x] 1.4 Actualizar `GET /api/lessons/:id/comments` para incluir `parentId` y autor del comentario padre.
- [x] 1.5 En `POST /lessons/:id/publish` (`backend/src/routes/authoring.js`), verificar `publishedAt === null` y disparar notificaciones en lote en Neo4j (`new_lesson`) para alumnos inscritos con `completado: false`.
- [x] 1.6 Actualizar `backend/src/routes/notifications.js` para exponer metadata de cursos/lecciones en `GET /api/notifications`.
- [x] 1.7 Escribir tests de backend en `backend/test/routes/lessons.test.js` y `authoring.test.js` cubriendo respuestas y notificaciones.

## Fase 2 — Frontend & UI

- [x] 2.1 Actualizar `frontend/src/components/LessonComments.jsx` con botón "Responder", chip visual *"Respondiendo a @usuario [X]"* y renderizado de respuestas en 1 nivel de indentación.
- [x] 2.2 Actualizar `frontend/src/pages/Notifications.jsx` para renderizar notificaciones de `new_lesson` y `lesson_comment_reply` con enlace directo a `/courses/:cursoId/learn?lessonId=:id`.

## Fase 3 — Verificación y Cierre

- [x] 3.1 Ejecutar suite completa de tests de backend (`npx vitest run`).
- [x] 3.2 Verificar build de producción de frontend (`npm run build`).
- [x] 3.3 Generar reporte `verify-report.md`.
