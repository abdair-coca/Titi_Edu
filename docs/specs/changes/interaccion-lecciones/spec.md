# Spec — Hilos en Comentarios de Lecciones y Notificación de Publicación

## U1 — Modelo y Persistencia: `parentId` en `ComentarioLeccion`

**Requisito:** el modelo de comentarios de lección en PostgreSQL soporta relación padre-hijo para enlazar respuestas a un comentario raíz.

- **Schema:**
  - Campo `parentId String?` en `model ComentarioLeccion`.
  - Relación `parent ComentarioLeccion? @relation("RespuestasComentarioLeccion", fields: [parentId], references: [id], onDelete: Cascade)`.
  - Relación `respuestas ComentarioLeccion[] @relation("RespuestasComentarioLeccion")`.
- **Regla de 1 nivel:**
  - Si un usuario responde a un comentario que ya tiene `parentId`, el backend asigna automáticamente el `parentId` del comentario raíz, manteniendo la jerarquía plana en nivel 1.

---

## U2 — Backend: Crear y Listar Respuestas en Lecciones

**Requisito:** `POST /api/lessons/:id/comments` y `GET /api/lessons/:id/comments` soportan hilos de 1 nivel y disparan notificación al autor respondido.

- **Creación (`POST /api/lessons/:id/comments`):**
  - Payload: `{ texto: string, parentId?: string }`.
  - Si `parentId` está presente:
    - Valida que el comentario padre exista y pertenezca a la misma lección.
    - Si el comentario padre ya es una respuesta (tiene `parentId`), se resuelve su raíz para forzar nivel 1.
    - Si el autor del comentario respondido es diferente al usuario que responde:
      - Obtiene el `neoId` del autor original desde PostgreSQL.
      - Crea una notificación en Neo4j:
        ```cypher
        MATCH (target:Usuario {id: $targetNeoId}), (actor:Usuario {id: $actorNeoId})
        CREATE (target)<-[:RECIBIO]-(n:Notificacion {
          id: $notifId, type: 'lesson_comment_reply', read: false,
          createdAt: datetime(), actorId: $actorNeoId,
          cursoId: $cursoId, leccionId: $leccionId,
          cursoTitulo: $cursoTitulo, leccionTitulo: $leccionTitulo,
          commentId: $commentId
        })
        ```
      - Se ejecuta en bloque `try/catch` que no bloquea la respuesta HTTP.
- **Listado (`GET /api/lessons/:id/comments`):**
  - Devuelve los comentarios con `parentId` e incluye información del autor (`id`, `username`, `avatarUrl`).
  - Orden cronológico de comentarios raíz (`createdAt ASC` o `DESC` según vista) y respuestas ordenadas cronológicamente bajo su raíz.

### Escenarios U2

- **DADO** un comentario raíz existente
  **CUANDO** otro estudiante envía un comentario con `parentId`
  **ENTONCES** se guarda con dicho `parentId` y se genera una notificación para el autor del comentario original.
- **DADO** un usuario respondiendo a su propio comentario
  **CUANDO** se envía la respuesta
  **ENTONCES** se guarda con éxito pero NO se genera notificación hacia sí mismo.
- **DADO** un intento de responder con un `parentId` de otra lección o inexistente
  **CUANDO** se envía el comentario
  **ENTONCES** devuelve `400 Bad Request` con mensaje descriptivo.

---

## U3 — Backend: Notificación masiva al Publicar Lección

**Requisito:** en `POST /api/authoring/lessons/:id/publish`, notificar a los alumnos inscritos no completados cuando la lección se publique por primera vez.

- **Condición de disparo:**
  - `lesson.estado === 'BORRADOR'` y `lesson.publishedAt === null` (primera publicación).
  - Si `lesson.publishedAt !== null` (lección previamente publicada y archivada/re-publicada), NO se emiten notificaciones.
- **Audiencia:**
  - Alumnos inscritos en el curso con `completado === false` en `Inscripcion`.
- **Persistencia en Neo4j:**
  - Crea notificaciones en lote mediante `UNWIND $students AS studentNeoId` con:
    `type: 'new_lesson'`, `cursoId`, `leccionId`, `cursoTitulo`, `leccionTitulo`, `actorId: req.user.id`.
  - Manejado en `try/catch` sin bloquear la transacción ni la respuesta de publicación.

### Escenarios U3

- **DADO** una lección nueva nunca antes publicada (`publishedAt: null`)
  **CUANDO** el profesor ejecuta la acción de publicar
  **ENTONCES** todos los estudiantes inscritos activos (no completados) reciben una notificación de tipo `new_lesson`.
- **DADO** una lección que ya fue publicada en el pasado y archivada
  **CUANDO** el profesor la desarchiva o la re-publica
  **ENTONCES** la lección se publica pero NO se disparan notificaciones duplicadas a los alumnos.
- **DADO** un estudiante que ya completó el curso (`completado: true`)
  **CUANDO** se publica una lección nueva
  **ENTONCES** dicho estudiante es excluido del lote de notificaciones.

---

## U4 — Frontend: Hilos y Formulario de Respuesta en `LessonComments.jsx`

**Requisito:** interfaz intuitiva para responder comentarios dentro de la lección con chip visual de respuesta y visualización indentada de 1 nivel.

- **Acción "Responder":**
  - Cada comentario muestra un botón accesible "Responder".
  - Al presionarlo, el formulario inferior muestra un chip visible arriba del textarea:
    `Respondiendo a @username` + botón `[X]` para cancelar la respuesta.
  - El textarea recibe foco automáticamente.
- **Envío:**
  - Envía `{ texto, parentId }` al endpoint.
  - Al completarse con éxito, limpia el chip de respuesta y el texto.
- **Renderizado de 1 nivel:**
  - Los comentarios raíz se muestran en la lista principal.
  - Las respuestas a un comentario raíz se renderizan agrupadas directamente debajo de este con sangría visual (`ml-6 pl-4 border-l-2 border-gray-200`).
  - No se permite anidar visualmente respuestas dentro de respuestas.

---

## U5 — Frontend: Renderizado y Navegación en `Notifications.jsx`

**Requisito:** la pantalla `/notifications` renderiza claramente las notificaciones educativas y permite acceder directamente a la lección.

- **Tipo `new_lesson`:**
  - Icono de libro o lección con acento Titi.
  - Texto: "Nueva lección en **{cursoTitulo}**: *{leccionTitulo}*".
  - Al hacer click o pulsar el enlace, navega a `/courses/:cursoId/learn?lessonId=:leccionId`.
- **Tipo `lesson_comment_reply`:**
  - Icono de mensaje o comentario.
  - Texto: "**@{actor.username}** respondió a tu comentario en *{leccionTitulo}*".
  - Al hacer click, navega a `/courses/:cursoId/learn?lessonId=:leccionId`.
