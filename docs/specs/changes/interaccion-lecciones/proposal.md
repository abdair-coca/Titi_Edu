# Proposal — Hilos en Comentarios de Lecciones y Notificación de Publicación

> **Change:** `interaccion-lecciones`
> **Estado:** propuesta lista para revisión y ejecución.
> Orquestador: agente principal.

## Intención

Fortalecer la interacción académica y social en los cursos de Titi implementando:
1. **Hilos de respuestas en comentarios de lecciones:** permitir a estudiantes y profesores responder a comentarios específicos dentro del reproductor de lecciones (con 1 solo nivel de anidado y notificación directa al autor respondido).
2. **Notificación de nueva lección publicada:** alertar automáticamente a los estudiantes inscritos en un curso (que aún no lo hayan completado) cuando el profesor publique una nueva lección por primera vez, permitiendo navegar directamente al reproductor con un click.

## Alcance

### In Scope
- **PostgreSQL / Prisma:**
  - Migración y adición del campo `parentId` en el modelo `ComentarioLeccion` con relación autoreferencial para soportar respuestas.
- **Backend — Comentarios en Lecciones (`backend/src/routes/lessons.js`):**
  - Actualizar `POST /api/lessons/:id/comments` para aceptar `parentId` (validando que pertenezca a la misma lección y sea un comentario raíz para forzar nivel 1).
  - Si es una respuesta, disparar notificación en Neo4j al autor del comentario respondido (`type: 'lesson_comment_reply'`), excluyendo auto-respuestas.
  - Actualizar `GET /api/lessons/:id/comments` para devolver `parentId` y enriquecer respuestas con `replyToUsername`.
- **Backend — Publicación de Lecciones (`backend/src/routes/authoring.js`):**
  - En `POST /lessons/:id/publish`, detectar si es la **primera vez** que la lección se publica (`lesson.publishedAt === null`).
  - Buscar inscripciones activas no completadas (`completado: false`) del curso en PostgreSQL.
  - Generar notificaciones en lote en Neo4j (`type: 'new_lesson'`) con `cursoId`, `leccionId`, `cursoTitulo`, `leccionTitulo` y `actorId` (profesor).
  - Ejecutar la creación de notificaciones en un bloque `try/catch` posterior sin bloquear la respuesta de publicación (Regla de oro 2).
- **Backend — Notificaciones (`backend/src/routes/notifications.js`):**
  - Exponer campos educativos (`cursoId`, `leccionId`, `cursoTitulo`, `leccionTitulo`) en `GET /api/notifications`.
- **Frontend — Componente `LessonComments.jsx`:**
  - Botón "Responder" en cada comentario.
  - Indicador / chip visual en el formulario: *"Respondiendo a @usuario"* con botón para cancelar.
  - Renderizado agrupado en 1 solo nivel de indentación para las respuestas.
- **Frontend — Vista de Notificaciones (`Notifications.jsx`):**
  - Renderizado específico para `type === 'new_lesson'` y `type === 'lesson_comment_reply'`.
  - Navegación directa con un click al reproductor de la lección (`/courses/:cursoId/learn?lessonId=:id`).
- **Tests:**
  - Tests unitarios e integración para comentarios con respuestas y publicación con notificación.

### Out of Scope
- Anidación infinita de comentarios (se limita estrictamente a 1 nivel para preservar legibilidad mobile).
- Notificaciones a estudiantes que ya completaron el curso y obtuvieron certificado.
- Notificaciones en re-publicaciones posteriores o lecciones archivadas que se desarchivan.
- Respuestas en comentarios de posts sociales (se mantiene el alcance en cursos/lecciones en PostgreSQL).

## Hallazgos técnicos (exploración)

1. **Dual-DB & Comentarios:**
   - Los comentarios de lecciones viven en PostgreSQL (`ComentarioLeccion`). Actualmente son una lista plana (`id`, `texto`, `usuarioId`, `leccionId`, `createdAt`).
   - Agregar `parentId String?` permite enlazar respuestas manteniendo integridad referencial.
2. **Notificaciones en Neo4j:**
   - El sistema de notificaciones vive en Neo4j con nodos `(u:Usuario)<-[:RECIBIO]-(n:Notificacion)`.
   - Soporta propiedades dinámicas como `cursoId`, `leccionId`, `cursoTitulo`, `leccionTitulo`.
   - Las inscripciones viven en PostgreSQL (`Inscripcion`), donde cada `Usuario` tiene su `neoId`. Esto permite mapear estudiantes inscritos a sus nodos en Neo4j de forma eficiente.
3. **Pipeline de autoría:**
   - La publicación de lecciones ocurre en `backend/src/routes/authoring.js` bajo una transacción idempotente. Validar `lesson.publishedAt === null` garantiza que la alerta solo se emita la primera vez que la lección ve la luz.

## Decisiones tomadas

1. **Entorno:** Comentarios educativos en PostgreSQL (`ComentarioLeccion`).
2. **Nivel:** 1 solo nivel de indentación (padre → respuestas).
3. **Notificación de respuesta:** Solo al autor del comentario al que se le responde.
4. **UI de respuesta:** Chip visual fijo *"Respondiendo a @usuario [X]"* sobre el textarea.
5. **Disparador:** Únicamente al transicionar a `PUBLICADA` en `/publish`.
6. **Re-publicación:** Exclusivamente en la primera publicación (`publishedAt === null`).
7. **Filtrado de alumnos:** Solo inscritos activos no completados (`completado: false`).
8. **Destino de navegación:** Directo al reproductor `/courses/:cursoId/learn?lessonId=:id`.

## Criterios de éxito

- [ ] Un usuario puede responder a un comentario dentro de una lección.
- [ ] La UI muestra el chip visual *"Respondiendo a @usuario"* y permite cancelarlo.
- [ ] Las respuestas se muestran indentadas debajo de su comentario padre (sin anidar más de 1 nivel).
- [ ] El autor del comentario padre recibe una notificación en Neo4j cuando alguien le responde.
- [ ] Al publicar una lección por primera vez, todos los alumnos inscritos no completados reciben una notificación.
- [ ] La notificación en `/notifications` muestra el título del curso y de la lección, y al hacer click lleva al reproductor.
- [ ] No se envían notificaciones si la lección ya había sido publicada previamente.
- [ ] Tests de backend pasando al 100% y build de frontend limpio.
