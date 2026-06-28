# API REST — Titi

Catálogo de endpoints. Montaje real en `backend/src/app.js`. Para modelos y reglas
ver [architecture.md](architecture.md).

---

## Convención de respuestas

```js
res.json({ success: true, data: { ... } });                      // éxito
res.status(4xx|5xx).json({ success: false, message: '...' });    // error (en español)
```

Códigos: `200/201` ok · `400` validación · `401` no autenticado · `403` sin permiso ·
`404` no encontrado · `409` conflicto (ya existe / dependencias) · `500` interno.

Montaje (`app.js`): `/api/auth`, `/api/users`, `/api/posts`, `/api/search`,
`/api/comments`, `/api/notifications`, `/api/sounds`, `/api/locations`,
`/api/courses`, `/api` (modules+lessons+materials+evaluations), `/api/categories`,
`/api/progress`, `/api/admin`, `/api/gotas`, `/api/missions`, `/api/ranking`.

---

## Auth — `/api/auth`
```
POST /register   → { user, token }   Crea Usuario en Neo4j + espejo en Postgres
POST /login      → { user, token }   Verifica password, fusiona rol/racha/gotas
GET  /me         → { user }          Perfil completo del JWT actual
```

## Red social (Neo4j)
```
GET  /api/users/me                   Perfil propio con stats
GET  /api/users/:username            Perfil público (isFollowing/isSelf)
POST /api/users/:username/follow | /unfollow
PUT  /api/users/me/location

GET  /api/posts/feed                 Posts de gente que sigo (cursor por createdAt)
GET  /api/posts/feed/academic        Actividad de cursos de gente que sigo
GET  /api/posts/explore              Posts públicos recientes (cursor)
GET  /api/posts/me/saved | /me/liked
POST /api/posts                      Crear post (multipart, imagen opcional)
POST /api/posts/:id/like | /save     Toggle
PUT  /api/posts/:id                  Editar contenido
DELETE /api/posts/:id

POST /api/comments                   Crear comentario
DELETE /api/comments/:id

GET  /api/notifications
GET  /api/notifications/unread/count
GET  /api/search                     Usuarios, posts, hashtags
```

## Cursos — `/api/courses`
```
GET    /                   Catálogo público (?categoria= ?nivel= ?search=)
GET    /:id                Detalle (módulos + lecciones + categoría + creador)
POST   /                   Crear (PROFESOR verificado)
PUT    /:id                Editar (autor)
DELETE /:id                Borrar (autor; 409 si tiene inscripciones)
POST   /:id/publish | /unpublish
POST   /:id/enroll         Inscribirse (ESTUDIANTE) → propaga a Neo4j
GET    /:id/progress       Mi progreso en el curso
GET    /my/enrolled | /my/teaching
GET    /recommended        Cursos que tomaron mis amigos y yo no
```

## Módulos / Lecciones — `/api/courses/:id/modules`, `/api/modules`, `/api/lessons`
```
GET    /api/courses/:courseId/modules
POST   /api/courses/:courseId/modules       Crear módulo (autor)
PUT    /api/modules/:id                      DELETE /api/modules/:id (cascada)
GET    /api/modules/:id/lessons
POST   /api/modules/:moduleId/lessons        Crear lección (autor)
GET    /api/lessons/:id                       PUT / DELETE (autor)
POST   /api/lessons/:id/complete             Completar → racha + logros + gotas + misiones
GET    /api/lessons/:id/comments              POST (auth)
GET    /api/lessons/:id/note                  Nota personal privada (auth)
PUT    /api/lessons/:id/note                  Guardar/actualizar nota (máx 5000 chars)
```

## Materiales — `/api/materials`
```
POST   /api/lessons/:lessonId/materials   Subir (multipart, autor) — pdf|word|imagen|codigo|otro, 10 MB
DELETE /api/materials/:id                 Borrar (autor) — borra archivo del storage
```

## Categorías — `/api/categories`
```
GET    /     Lista pública    ·    POST  / (ADMIN)
```

## Evaluaciones — `/api/evaluations`
```
POST   /api/modules/:id/evaluation          Crear evaluación de módulo (autor)
POST   /api/courses/:id/final-evaluation    Crear evaluación final (autor)
GET    /api/evaluations/:id                 Detalle (sin respuestas correctas para estudiantes)
POST   /api/evaluations/:id/attempt         Intento — calificación server-side; aprobar → gotas
GET    /api/evaluations/:id/my-attempts
```

## Progreso / racha / logros / certificados — `/api/progress`
```
GET    /api/progress/streak                        Mi racha
GET    /api/progress/achievements                  Mis logros
GET    /api/progress/:username/achievements | /streak   Públicos
GET    /api/progress/certificates                  Mis certificados
GET    /api/progress/certificate/:courseId
GET    /api/progress/certificates/verify/:codigo   Público (sin auth)
```

## Gamificación (Etapa 6)
```
GET  /api/gotas              → { saldo, total, semana }
GET  /api/gotas/history      → movimientos paginados (cursor por createdAt)
GET  /api/missions/today     → 3 misiones de hoy con progreso (asigna si faltan)
GET  /api/ranking/friends    → leaderboard semanal de amigos + mi posición (dispara premio lazy)
```

## Admin — `/api/admin` (requireRole ADMIN)
```
GET /users · PUT /users/:id/verify · PUT /users/:id/role
GET /courses (incl. borradores) · PUT /courses/:id/approve · DELETE /courses/:id (cascada forzada)
GET /stats · POST /categories
```
