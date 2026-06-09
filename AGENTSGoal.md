# AGENTSGoal.md — Titi Platform · Documento maestro

> **Lee este archivo entero antes de tocar cualquier código.**
> Es la fuente de verdad del producto, la arquitectura y las etapas.
> Para detalle de **qué falta en la etapa actual** mira `AGENTS.md`.
> Para detalle visual mira `frontend/design.md`.

---

## 1. Visión del proyecto

**Titi** es una plataforma educativa social universitaria boliviana que combina:

- Una **red social** (estilo TikTok/Instagram) para conectar estudiantes.
- Una **plataforma de cursos** (estilo Duolingo/Udemy) para aprender.

### Diferencial

> El aprendizaje es social. Ves qué cursos toman tus amigos, comentás lecciones con compañeros, y las recomendaciones salen de tu red de contactos — no de un algoritmo opaco.

### Identidad

| Elemento | Valor |
|---|---|
| Mascota | Titi — un mono titi boliviano con bigote, estilo Duolingo. Siempre `/Titi.png`, nunca emoji 🐒 |
| Paleta | Amarillo vibrante `#FFD93D`, fondo cálido `#FFFBF0`, sidebar oscuro `#1A1A2E` |
| Tipografía | Nunito (redondeada, amigable) |
| Tono | Cálido, motivador, universitario — ni agresivo de Duolingo ni denso de Udemy |

### Principios de diseño (resumen de `frontend/design.md` §1)

1. Cálido antes que agresivo.
2. Social primero — el aprendizaje aparece integrado en el feed, no en una sección separada.
3. Progreso visible — racha, XP y logros siempre a la vista.
4. Titi aparece en momentos que importan, no en cada pantalla.
5. Consistencia sobre creatividad — reproducir patrones, no inventarlos.

---

## 2. Stack tecnológico

```
Frontend   → React 18 + Vite + Tailwind CSS 3 + React Router v6 + Axios
Backend    → Node.js 20 + Express 5 + JWT + bcrypt
Neo4j      → Red social, relaciones, recomendaciones (Neo4j Aura cloud)
PostgreSQL → Cursos, lecciones, evaluaciones, progreso, inscripciones
ORM        → Prisma (PostgreSQL)
Storage    → Disco local (Etapa 2) → Cloudinary (Etapa 5)
Deploy     → Railway (backend) + Vercel (frontend)
```

**Versiones críticas**: Node 20 LTS, Prisma 5+, React 18 (no 19), Tailwind 3 (no 4).

---

## 3. Arquitectura del sistema

```
                ┌──────────────────────────┐
                │ Frontend (React + Vite)  │
                │  • AuthContext + JWT     │
                │  • Axios client          │
                └──────────┬───────────────┘
                           │ REST + JWT en Authorization header
                           ▼
                ┌──────────────────────────┐
                │ Backend (Express 5)      │
                │  • requireAuth / optAuth │
                │  • requireRole           │
                │  • multer (uploads)      │
                └────┬─────────────────┬───┘
                     │                 │
        ┌────────────▼───┐     ┌───────▼────────────┐
        │  Neo4j (Aura)  │     │  PostgreSQL        │
        │  capa social   │     │  capa educativa    │
        └────────────────┘     └────────────────────┘
```

### Qué vive en cada base

**Neo4j — todo lo que es grafo social:**
- `Usuario`, `Post`, `Comentario`, `Hashtag`, `Notificacion`, `Sonido`, `Ubicacion`
- Relaciones: `SIGUIO`, `PUBLICO`, `LE_GUSTO`, `GUARDO`, `ESCRIBIO`, `EN`, `RESPONDE_A`, `RECIBIO`, `SOBRE`, `TIENE_HASHTAG`, `USA_SONIDO`, `VIVE_EN`, `ETIQUETADO_EN`
- Para recomendaciones (Etapa 4): `INSCRITO_EN`, `COMPLETO_CURSO` con referencia al `cursoId` de Postgres

**PostgreSQL — todo lo educativo y estructurado:**
- `Curso`, `Modulo`, `Leccion`, `Material`, `Categoria`
- `Inscripcion`, `Progreso`
- `Evaluacion`, `Pregunta`, `Opcion`, `Intento`
- `Logro`, `LogroUsuario`, `Certificado`
- `Usuario` (espejo con `neoId`, `rol`, `verificado`, `racha`, `ultimaActividad`)

### El puente Neo4j ↔ PostgreSQL

- El JWT contiene el `id` de Neo4j (`req.user.id`).
- En PostgreSQL ese id vive en `Usuario.neoId`.
- Patrón estándar para cualquier ruta Postgres autenticada (ver `routes/courses.js`):

```js
async function loadCurrentUser(req, res) {
  if (req.dbUser) return req.dbUser;
  const usuario = await prisma.usuario.findUnique({ where: { neoId: req.user.id } });
  if (!usuario) {
    res.status(401).json({ success: false, message: 'Usuario no encontrado' });
    return null;
  }
  req.dbUser = usuario;
  return usuario;
}
```

- Al registrar (`/api/auth/register`) se crea el `Usuario` en Neo4j y se replica el espejo en Postgres. Si el espejo falla, el registro **no** se rompe (se loguea y se sigue).
- Las operaciones que deben aparecer en ambas DBs (ej. inscripción) usan PostgreSQL como **fuente de verdad** y propagan a Neo4j para queries sociales.

---

## 4. Estructura de carpetas

```
SocialNeo/
├── AGENTSGoal.md                ← este archivo
├── AGENTS.md                    ← plan de la etapa actual
├── backend/
│   ├── package.json
│   ├── .env                     (gitignored)
│   ├── .env.example
│   ├── prisma/
│   │   ├── schema.prisma        ← modelo PostgreSQL completo
│   │   ├── migrations/          ← historial de migraciones
│   │   └── seed.js              ← datos demo (Etapa 2+)
│   └── src/
│       ├── index.js             ← entry point + CORS + rutas
│       ├── db.js                ← conexión Neo4j singleton + runQuery
│       ├── prisma.js            ← instancia Prisma singleton
│       ├── middleware/
│       │   └── auth.js          ← requireAuth, optionalAuth
│       ├── routes/
│       │   ├── auth.js          ← /api/auth/*
│       │   ├── users.js         ← /api/users/*
│       │   ├── posts.js         ← /api/posts/* (con save/like/feed/explore)
│       │   ├── comments.js      ← /api/comments/*
│       │   ├── search.js        ← /api/search/*
│       │   ├── notifications.js ← /api/notifications/*
│       │   ├── sounds.js        ← /api/sounds/*
│       │   ├── locations.js     ← /api/locations/*
│       │   ├── courses.js       ← /api/courses/*
│       │   ├── modules.js       ← /api/courses/:id/modules + /api/modules/*
│       │   ├── lessons.js       ← /api/lessons/*
│       │   ├── materials.js     ← /api/materials/* (Etapa 2+)
│       │   ├── categories.js    ← /api/categories/* (Etapa 2+)
│       │   ├── evaluations.js   ← Etapa 3
│       │   ├── progress.js      ← Etapa 3
│       │   └── admin.js         ← Etapa 4
│       ├── services/            ← (Etapa 3+)
│       │   ├── progress.service.js
│       │   └── achievement.service.js
│       └── uploads/             ← multer disk storage
│           ├── (imágenes de posts)
│           └── materials/       ← (Etapa 2+)
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js       ← paleta Titi
    ├── design.md                ← sistema de diseño visual
    ├── public/
    │   └── Titi.png             ← imagen oficial de la mascota
    └── src/
        ├── main.jsx
        ├── App.jsx              ← router + guards por rol
        ├── index.css
        ├── api/
        │   └── client.js        ← axios + interceptor JWT
        ├── context/
        │   ├── AuthContext.jsx  ← user, isAuthenticated, login, logout
        │   └── ProgressContext.jsx  ← (Etapa 3) racha, logros, notif Titi
        ├── lib/
        │   └── format.js        ← resolveMediaUrl, relativeTime, formatDate
        ├── components/
        │   ├── Navbar.jsx       ← sidebar desktop + bottom nav móvil
        │   ├── PostCard.jsx     ← post con like, save, comentarios
        │   ├── CreatePost.jsx
        │   ├── EditPostModal.jsx
        │   ├── CommentSection.jsx
        │   ├── OptionsPosts.jsx
        │   ├── ConfirmModal.jsx
        │   ├── TitiMascot.jsx
        │   ├── CourseCard.jsx        ← (Etapa 2) tarjeta de curso
        │   ├── LessonComments.jsx    ← (Etapa 2)
        │   ├── ProgressBar.jsx       ← (Etapa 3)
        │   ├── StreakBadge.jsx       ← (Etapa 3)
        │   ├── AchievementToast.jsx  ← (Etapa 3)
        │   └── EvaluationQuiz.jsx    ← (Etapa 3)
        └── pages/
            ├── Login.jsx
            ├── Register.jsx
            ├── Feed.jsx
            ├── Explore.jsx
            ├── Profile.jsx            ← tabs Posts/Guardados/Likes
            ├── Notifications.jsx
            ├── HashtagFeed.jsx
            ├── Courses.jsx            ← catálogo
            ├── CourseDetail.jsx       ← detalle + inscripción
            ├── LearnCourse.jsx        ← lección + sidebar + progreso
            ├── MyCourses.jsx          ← inscripciones del estudiante
            ├── teacher/               ← (Etapa 2)
            │   ├── MyTeaching.jsx
            │   ├── CourseEditor.jsx
            │   └── ModulesEditor.jsx
            └── admin/                 ← (Etapa 4)
                ├── AdminDashboard.jsx
                ├── AdminUsers.jsx
                └── AdminCourses.jsx
```

---

## 5. Variables de entorno

### `backend/.env`

```bash
# Neo4j (Aura cloud)
NEO4J_URI=neo4j+s://XXXX.databases.neo4j.io
NEO4J_USER=neo4j
NEO4J_PASSWORD=XXXXXXXXXX

# PostgreSQL
DATABASE_URL=postgresql://user:password@host:5432/titi

# Auth
JWT_SECRET=titi_secret_2026

# App
PORT=3001
FRONTEND_URL=https://titi.vercel.app
# Múltiples orígenes separados por coma — útil para previews de Vercel
# FRONTEND_URL=https://titi.vercel.app,https://titi-git-dev.vercel.app

# Seed (Etapa 2+)
SEED_PASSWORD=titi1234

# Cloudinary (Etapa 5)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

### `frontend/.env`

```bash
VITE_API_URL=http://localhost:3001
```

---

## 6. Modelos de datos

### 6.1 Neo4j (red social)

**Nodos:**
```cypher
(:Usuario {id, username, email, password, bio, avatarUrl, createdAt})
(:Post {id, content, imageUrl, createdAt})
(:Comentario {id, text, createdAt})
(:Hashtag {name})
(:Notificacion {id, type, actorId, postId?, targetId?, read, createdAt})
(:Sonido {id, name, artist})
(:Ubicacion {id, city, country})
```

**Relaciones:**
```cypher
(:Usuario)-[:SIGUIO {createdAt}]->(:Usuario)
(:Usuario)-[:PUBLICO]->(:Post)
(:Usuario)-[:ESCRIBIO]->(:Comentario)-[:EN]->(:Post)
(:Comentario)-[:RESPONDE_A]->(:Comentario)
(:Usuario)-[:LE_GUSTO {likedAt}]->(:Post)
(:Usuario)-[:GUARDO {savedAt}]->(:Post)
(:Post)-[:TIENE_HASHTAG]->(:Hashtag)
(:Post)-[:USA_SONIDO]->(:Sonido)
(:Post)-[:ETIQUETADO_EN]->(:Ubicacion)
(:Usuario)-[:VIVE_EN]->(:Ubicacion)
(:Usuario)-[:RECIBIO]->(:Notificacion)-[:SOBRE]->(:Post|:Usuario)

// Etapa 4 — recomendaciones (referencia al cursoId de Postgres)
(:Usuario)-[:INSCRITO_EN {fechaInscripcion}]->(cursoId: string)
(:Usuario)-[:COMPLETO_CURSO {fechaCompletado}]->(cursoId: string)
```

**Constraints** (creados en `db.js` `initConstraints`):
```cypher
CREATE CONSTRAINT usuario_id       FOR (u:Usuario) REQUIRE u.id IS UNIQUE
CREATE CONSTRAINT usuario_username FOR (u:Usuario) REQUIRE u.username IS UNIQUE
CREATE CONSTRAINT usuario_email    FOR (u:Usuario) REQUIRE u.email IS UNIQUE
CREATE CONSTRAINT post_id          FOR (p:Post) REQUIRE p.id IS UNIQUE
CREATE CONSTRAINT hashtag_name     FOR (h:Hashtag) REQUIRE h.name IS UNIQUE
CREATE CONSTRAINT comentario_id    FOR (c:Comentario) REQUIRE c.id IS UNIQUE
CREATE CONSTRAINT notificacion_id  FOR (n:Notificacion) REQUIRE n.id IS UNIQUE
CREATE CONSTRAINT sonido_id        FOR (s:Sonido) REQUIRE s.id IS UNIQUE
CREATE CONSTRAINT ubicacion_id     FOR (u:Ubicacion) REQUIRE u.id IS UNIQUE
```

### 6.2 PostgreSQL (Prisma)

Ver `backend/prisma/schema.prisma` para la versión canónica. Modelos:

`Usuario`, `Categoria`, `Curso`, `CursoProfesor`, `Modulo`, `Leccion`, `Material`, `Evaluacion`, `Pregunta`, `Opcion`, `Inscripcion`, `Progreso`, `Intento`, `ComentarioLeccion`, `Logro`, `LogroUsuario`, `Certificado`.

**Enums:**
- `Rol`: `ESTUDIANTE` | `PROFESOR` | `ADMIN`
- `TipoPregunta`: `OPCION_MULTIPLE` | `VERDADERO_FALSO` | `RESPUESTA_CORTA`

**Invariantes:**
- `Usuario.neoId` es único — espejo del `Usuario.id` de Neo4j.
- `Inscripcion` único por `(usuarioId, cursoId)` — un usuario no puede inscribirse dos veces.
- `Progreso` único por `(usuarioId, leccionId)` — un usuario tiene un solo registro por lección.
- `Curso.publicado=false` significa borrador (no aparece en catálogo público).
- `Usuario.verificado` solo aplica a `rol = PROFESOR`. Para crear cursos debe ser `true`.

### 6.3 Reglas de sincronización Neo4j ↔ PostgreSQL

| Operación | Fuente de verdad | Replicación |
|---|---|---|
| Registro de usuario | Neo4j (porque arranca como usuario social) | Replicar a `Usuario` en Postgres con `neoId` |
| Cambio de rol (a PROFESOR/ADMIN) | PostgreSQL | No replicar a Neo4j (el rol no afecta queries sociales) |
| Crear/editar/borrar curso | PostgreSQL | No replicar a Neo4j |
| Inscripción a curso | PostgreSQL | **Etapa 4**: crear `(:Usuario)-[:INSCRITO_EN]->(cursoId)` para recomendaciones |
| Lección completada | PostgreSQL | No replicar |
| Curso completado | PostgreSQL | **Etapa 4**: crear `(:Usuario)-[:COMPLETO_CURSO]->(cursoId)` |
| Post, like, comentario, follow | Neo4j | No replicar |

---

## 7. API REST — catálogo completo

### 7.1 Convención de respuestas

**Siempre:**
```js
// Éxito
res.json({ success: true, data: { ... } });
// Error
res.status(4xx|5xx).json({ success: false, message: 'Descripción legible para humanos' });
```

**Códigos HTTP usados:**
- `200` OK, `201` Created
- `400` validación de input
- `401` no autenticado
- `403` autenticado pero sin permiso (rol, no es el autor)
- `404` recurso no encontrado
- `409` conflicto (ya existe, no se puede borrar por dependencias)
- `500` error interno (loguear con `console.error`)

### 7.2 Auth — `/api/auth`

```
POST /register     → { user, token }     Crea Usuario en Neo4j + espejo en Postgres
POST /login        → { user, token }     Verifica password, fusiona rol/racha desde Postgres
GET  /me           → { user }            (Etapa 2+) Devuelve el perfil completo del JWT actual
```

### 7.3 Red social (Neo4j) — `/api/users`, `/api/posts`, `/api/search`, `/api/notifications`, `/api/sounds`, `/api/locations`, `/api/comments`

Ver código existente. Endpoints clave:
```
GET  /api/users/me                    Perfil propio con stats
GET  /api/users/:username             Perfil público con isFollowing/isSelf
POST /api/users/:username/follow
POST /api/users/:username/unfollow
PUT  /api/users/me/location

GET  /api/posts/feed                  Posts de gente que sigo
GET  /api/posts/explore               Posts públicos recientes
GET  /api/posts/me/saved              Posts guardados (orden savedAt DESC)
GET  /api/posts/me/liked              Posts con like (orden likedAt DESC)
POST /api/posts/:id/like              Toggle
POST /api/posts/:id/save              Toggle
POST /api/posts                       Crear post (multipart con imagen opcional)
PUT  /api/posts/:id                   Editar contenido
DELETE /api/posts/:id

POST /api/comments                    Crear comentario
DELETE /api/comments/:id

GET  /api/notifications               Mis notificaciones
GET  /api/notifications/unread/count
```

### 7.4 Cursos — `/api/courses`

```
GET    /                    Catálogo público (filtros: ?categoria=, ?nivel=, ?search=)
GET    /:id                 Detalle con módulos + lecciones + categoría + creador
POST   /                    Crear curso (PROFESOR verificado)
PUT    /:id                 Editar curso (solo autor)
DELETE /:id                 (Etapa 2) Solo autor, rechaza si tiene inscripciones
POST   /:id/publish         Publicar (solo autor)
POST   /:id/unpublish       (Etapa 2) Despublicar (solo autor)
POST   /:id/enroll          Inscribirse (ESTUDIANTE)
GET    /:id/progress        Mi progreso en este curso (auth)
GET    /my/enrolled         Mis cursos inscritos
GET    /my/teaching         Mis cursos como profesor
```

### 7.5 Módulos y Lecciones — `/api/courses/:courseId/modules`, `/api/modules`, `/api/lessons`

```
GET    /api/courses/:courseId/modules   (Etapa 2) Lista de módulos del curso
POST   /api/courses/:courseId/modules   Crear módulo (autor)
PUT    /api/modules/:id                 (Etapa 2) Editar módulo (autor)
DELETE /api/modules/:id                 (Etapa 2) Borrar módulo + cascada (autor)
GET    /api/modules/:id/lessons         Lecciones del módulo

POST   /api/modules/:moduleId/lessons   Crear lección (autor del curso)
GET    /api/lessons/:id                 (Etapa 2) Lección con materiales
PUT    /api/lessons/:id                 Editar lección (autor)
DELETE /api/lessons/:id                 (Etapa 2) Borrar lección (autor)
POST   /api/lessons/:id/complete        Marcar como completada (auth)
GET    /api/lessons/:id/comments        Comentarios (público)
POST   /api/lessons/:id/comments        Comentar (auth)
```

### 7.6 Materiales — `/api/materials` (Etapa 2)

```
POST   /api/lessons/:lessonId/materials   Subir material (multipart, autor del curso)
DELETE /api/materials/:id                 Borrar material (autor del curso)
```

Tipos: `pdf | word | imagen | codigo | otro`. Límite 10 MB.

### 7.7 Categorías — `/api/categories` (Etapa 2)

```
GET    /api/categories     Lista pública ordenada por nombre
POST   /api/categories     (ADMIN) — preparado para Etapa 4
```

### 7.8 Evaluaciones — `/api/evaluations` (Etapa 3)

```
POST   /api/modules/:id/evaluation         Crear evaluación de módulo (autor)
POST   /api/courses/:id/final-evaluation   Crear evaluación final (autor)
GET    /api/evaluations/:id                Detalle (sin respuestas correctas)
POST   /api/evaluations/:id/attempt        Iniciar/responder intento
GET    /api/evaluations/:id/my-attempts    Mis intentos
```

### 7.9 Progreso, racha, logros, certificados — `/api/progress` (Etapa 3)

```
GET    /api/progress/streak                 Mi racha actual
GET    /api/progress/achievements           Mis logros
GET    /api/progress/certificate/:courseId  Mi certificado de un curso
```

### 7.10 Admin — `/api/admin` (Etapa 4)

```
GET    /api/admin/users                 Lista de usuarios
PUT    /api/admin/users/:id/verify      Verificar profesor
PUT    /api/admin/users/:id/role        Cambiar rol
GET    /api/admin/courses               Todos los cursos (incl. borradores)
PUT    /api/admin/courses/:id/approve   Aprobar curso
GET    /api/admin/stats                 Estadísticas generales
POST   /api/admin/categories            Crear categoría
```

---

## 8. Lógica de negocio clave

### 8.1 Racha (streak) — Etapa 3

```js
// services/progress.service.js
export async function actualizarRacha(usuarioId) {
  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
  const hoy = startOfDay(new Date());
  const ayer = startOfDay(new Date(Date.now() - 86_400_000));

  if (!usuario.ultimaActividad) {
    return prisma.usuario.update({
      where: { id: usuarioId },
      data: { racha: 1, ultimaActividad: hoy },
    });
  }

  const ultima = startOfDay(usuario.ultimaActividad);
  if (sameDay(ultima, hoy)) return usuario;           // ya estudió hoy
  if (sameDay(ultima, ayer)) {
    return prisma.usuario.update({
      where: { id: usuarioId },
      data: { racha: usuario.racha + 1, ultimaActividad: hoy },
    });
  }
  // Racha rota — reinicia a 1
  return prisma.usuario.update({
    where: { id: usuarioId },
    data: { racha: 1, ultimaActividad: hoy },
  });
}
```

Triggers que llaman `actualizarRacha`:
- Marcar lección como completada (`POST /api/lessons/:id/complete`)
- Aprobar una evaluación

### 8.2 Logros (catálogo base)

```js
// services/achievement.service.js
const LOGROS = [
  { nombre: 'Primera lección', tipo: 'curso', condicion: 'Completar primera lección', icono: '📚' },
  { nombre: 'Primer curso',    tipo: 'curso', condicion: 'Completar primer curso',    icono: '🎓' },
  { nombre: 'Racha de 7 días', tipo: 'racha', condicion: '7 días consecutivos',       icono: '🔥' },
  { nombre: 'Racha de 30 días',tipo: 'racha', condicion: '30 días consecutivos',      icono: '⚡' },
  { nombre: 'Primera evaluación', tipo: 'evaluacion', condicion: 'Aprobar primera evaluación', icono: '✅' },
  { nombre: 'Perfecto',        tipo: 'evaluacion', condicion: '100% en una evaluación', icono: '💯' },
  { nombre: 'Social',          tipo: 'social', condicion: 'Seguir a 10 personas',     icono: '🤝' },
];
```

### 8.3 Mensajes Titi

```js
const MENSAJES_TITI = {
  leccionCompletada:   ['¡Excelente trabajo! 🎉', '¡Sigue así, campeón! 💪', '¡Un paso más hacia tu meta! 🚀'],
  evaluacionAprobada:  ['¡Lo lograste! 🏆', '¡Sabía que podías! ⭐', '¡Eres increíble! 🎯'],
  evaluacionFallida:   ['No te rindas, tienes más intentos 💙', '¡Revisa el material y vuelve a intentar! 📚'],
  rachaRota:           ['Tu racha se rompió 😔 ¡Pero puedes empezar una nueva hoy!'],
  rachaActiva:         (dias) => `¡${dias} días seguidos! ¡Imparable! 🔥`,
  logroDesbloqueado:   (logro) => `¡Nuevo logro: ${logro}! 🏅`,
  feedVacio:           ['¡Sigue a alguien para ver su actividad! 👀'],
  sinNotificaciones:   ['Todo tranquilo por aquí'],
  cursoCompletado:     ['¡Curso completado! Tu certificado está listo 🎓'],
};
```

**Regla:** la imagen de Titi siempre es `<img src="/Titi.png" />`. Nunca uses el emoji 🐒, ni siquiera en los mensajes.

### 8.4 Reglas de borrado (cascada vs bloqueo)

| Acción | Comportamiento |
|---|---|
| Borrar `Post` | Cascada: comentarios, notificaciones SOBRE el post, archivo de imagen del disco |
| Borrar `Curso` | **Bloquear** si tiene `Inscripciones`. Despublicar primero. Si está vacío, cascada a módulos/lecciones/materiales |
| Borrar `Modulo` | Cascada: lecciones, materiales, progresos, evaluación del módulo |
| Borrar `Leccion` | Cascada: materiales, progresos, comentarios |
| Borrar `Material` | Borrar archivo del disco antes del row |
| Borrar `Usuario` | (No implementado — Etapa 5) |

### 8.5 Permisos por rol

| Rol | Permisos |
|---|---|
| `ESTUDIANTE` | Inscribirse, completar lecciones, comentar, dar like/save, seguir, publicar posts |
| `PROFESOR` (verificado) | Todo lo de ESTUDIANTE + crear/editar/borrar cursos propios + subir materiales |
| `PROFESOR` (no verificado) | Todo lo de ESTUDIANTE. Crear curso responde 403 |
| `ADMIN` | Todo lo anterior + verificar profesores, cambiar roles, borrar cualquier recurso (Etapa 4) |

---

## 9. Etapas del proyecto

### ✅ Etapa 1 — Titi Social (COMPLETADA)

**Alcance:** red social completa con identidad visual Titi.

**Deliverables:**
- 7 nodos Neo4j con relaciones funcionando.
- Auth (registro, login, JWT).
- Feed, Explore, perfil con tabs Posts/Guardados/Likes.
- Posts con imagen, hashtag, sonido, ubicación, like, save.
- Comentarios anidados.
- Búsqueda de usuarios, posts y hashtags.
- Notificaciones (like, follow, comentario).
- UI rediseñada a Titi (Nunito, paleta amarilla, mascota).

**Estado:** Aceptada. Documento original archivado en histórico de `AGENTS.md`.

---

### 🔄 Etapa 2 — Módulo Educativo Base (EN CURSO)

> **Definition of Done detallado en `AGENTS.md`** — este archivo solo describe el alcance.

**Dependencias:** Etapa 1 cerrada, PostgreSQL provisionado, Prisma migrado.

**Alcance:**
- PostgreSQL + Prisma instalado y conectado.
- Modelo completo en `schema.prisma` (cursos, módulos, lecciones, materiales, categorías, inscripciones, progreso).
- CRUD completo de cursos, módulos, lecciones y materiales.
- Sistema de inscripciones con dedup vía constraint.
- Categorías con seed inicial.
- UI del estudiante: catálogo con filtros (categoría + nivel + búsqueda), detalle de curso, reproductor de lección con video YouTube, descarga de materiales, comentarios.
- UI del profesor: panel de mis cursos como profesor, editor de curso, editor de módulos/lecciones, subida de materiales.
- Seed con un profesor demo y un curso demo navegable.

**Deliverables:**
- 6+ endpoints REST nuevos (deletes, materiales, categorías).
- 3+ páginas nuevas en `pages/teacher/`.
- 2+ componentes nuevos (`LessonComments`, sección de materiales en `LessonView`).
- `prisma/seed.js` idempotente.

**Criterios de aceptación:** ver `AGENTS.md` §8.

**Riesgos:**
- Subida de archivos con multer es nueva para materiales pero ya existe en `posts.js`. Reusar patrón.
- Validación de profesor verificado puede romper flujos demo si el seed no marca `verificado: true`.

---

### 📋 Etapa 3 — Evaluaciones y Progreso

**Dependencias:** Etapa 2 cerrada (curso debe poder crearse con módulos antes de poder evaluar).

**Alcance:**
- Evaluaciones por módulo y evaluación final por curso.
- Tipos de pregunta: opción múltiple, verdadero/falso, respuesta corta.
- Sistema de intentos (máx configurable por evaluación, default 3) con nota mínima (default 70%).
- Servicio de racha activa al completar lecciones y al aprobar evaluaciones.
- Servicio de logros con desbloqueo automático.
- Emisión de certificado al completar un curso (con código de verificación único).
- UI de Titi con mensajes motivadores: `<TitiMascot mood="celebrating|sad|fire|proud" />`.
- `AchievementToast` que aparece desde la derecha al desbloquear logros.
- `StreakBadge` siempre visible en el sidebar.

**Deliverables:**
- `routes/evaluations.js`, `routes/progress.js` completos.
- `services/progress.service.js` con `actualizarRacha`.
- `services/achievement.service.js` con el catálogo de logros y el checker.
- Componentes: `EvaluationQuiz`, `ProgressBar`, `StreakBadge`, `AchievementToast`, `TitiMascot` con variantes de mood.
- Página `Certificates.jsx` con verificación pública.

**Criterios de aceptación:**
- [ ] Profesor crea evaluación de módulo y final, con preguntas de los 3 tipos.
- [ ] Estudiante hace intento, recibe nota y feedback.
- [ ] Después de 3 intentos fallidos queda bloqueado hasta intervención manual.
- [ ] Racha aumenta correctamente día a día y se rompe si se salta uno.
- [ ] Al completar curso se emite certificado con código verificable.
- [ ] Logros se desbloquean automáticamente al cumplir condiciones.
- [ ] Toasts de logro nunca bloquean la UI y se cierran solos.

**Riesgos:**
- Lógica de racha sensible a husos horarios — usar siempre `startOfDay` en TZ local del servidor (`America/La_Paz`).
- Logros pueden duplicarse si el checker corre múltiples veces — el `@@id([usuarioId, logroId])` lo previene a nivel DB.

---

### 📋 Etapa 4 — Integración Social + Admin

**Dependencias:** Etapa 3 cerrada.

**Alcance:**
- Feed mezcla posts sociales con **actividad académica** (inscripciones, completados, logros desbloqueados de gente que sigo).
- Recomendaciones de cursos basadas en amigos (query Cypher sobre `:INSCRITO_EN`).
- Propagación de eventos educativos a Neo4j (`INSCRITO_EN`, `COMPLETO_CURSO`).
- Notificaciones de amigos: "X se inscribió en Y", "X desbloqueó logro Z".
- Panel admin separado:
  - Verificación de profesores.
  - Cambio de rol de cualquier usuario.
  - Aprobación de cursos sensibles (opcional).
  - Estadísticas generales (totales, usuarios activos, top cursos).
  - CRUD de categorías.
- Endpoint temporal `POST /api/auth/become-teacher` se elimina aquí.

**Deliverables:**
- `routes/admin.js` completo.
- Tarjeta de "Actividad académica" en `Feed.jsx`.
- Sección "Recomendados por tus amigos" en `Courses.jsx`.
- `pages/admin/*` (3 páginas).
- Guard `requireRole('ADMIN')` en App.jsx.

**Criterios de aceptación:**
- [ ] Al inscribirme en un curso, mis seguidores reciben notificación y ven la actividad en su feed.
- [ ] El catálogo muestra una sección "Tus amigos están aprendiendo X".
- [ ] Admin verifica un profesor → ese profesor ya puede crear cursos sin el endpoint temporal.
- [ ] Estadísticas son consistentes entre Neo4j y Postgres.

**Riesgos:**
- Doble fuente de verdad: cuidar que la propagación a Neo4j no falle silenciosamente (loguear pero no bloquear la operación principal).
- Privacidad: el feed académico solo debe mostrar actividad de gente que sigo, nunca pública.

---

### 📋 Etapa 5 — Pulido y Deploy

**Dependencias:** Etapa 4 cerrada.

**Alcance:**
- Migración de almacenamiento de archivos a Cloudinary (imágenes de posts, portadas de cursos, materiales).
- Optimización de queries pesadas (índices Neo4j, índices Postgres, paginación en feed/explore).
- Tests básicos: una suite mínima de smoke tests con Vitest + supertest para auth, posts, cursos, inscripciones.
- CI/CD: GitHub Actions corriendo tests + linter en cada PR.
- Deploy:
  - Backend en Railway con `DATABASE_URL` apuntando a Postgres administrado.
  - Frontend en Vercel con `VITE_API_URL` apuntando al backend.
  - Configurar `FRONTEND_URL` para CORS de previews.
- Documentación: README en raíz con setup local + diagrama de arquitectura + capturas.
- Limpieza de TODOs marcados como "Etapa 5" en el código.

**Deliverables:**
- Helper `services/upload.service.js` para Cloudinary.
- Suite de tests con al menos 30% de cobertura en `routes/`.
- README pulido.
- Sitio live público.

**Criterios de aceptación:**
- [ ] Subir un material va a Cloudinary, no al disco.
- [ ] CI rechaza PRs que rompen tests.
- [ ] Feed paginado: scroll infinito o "cargar más".
- [ ] Tiempo de carga inicial del feed < 2s con red 3G simulada.
- [ ] Documentación permite a alguien nuevo arrancar el proyecto en < 15 min.

---

## 10. Workflow de desarrollo local

### Setup inicial

```bash
# 1. Clonar
git clone <repo>
cd SocialNeo

# 2. Backend
cd backend
cp .env.example .env       # llenar valores
npm install
npx prisma migrate dev     # aplica migraciones a Postgres
npx prisma db seed         # (Etapa 2+) carga categorías + profesor demo + curso demo
npm run dev                # arranca en :3001

# 3. Frontend (en otra terminal)
cd ../frontend
npm install
npm run dev                # arranca en :5173
```

### Comandos comunes

```bash
# Backend
npx prisma studio                  # GUI para ver/editar Postgres
npx prisma migrate dev --name X    # crear nueva migración
npx prisma generate                # regenerar el cliente Prisma
npm run dev                        # nodemon + variables de entorno

# Neo4j (vía Aura console o cliente local)
# Para inspeccionar grafo, abrir Aura web console y correr:
# MATCH (n) RETURN n LIMIT 50
```

### Probar end-to-end (smoke test manual de Etapa 2)

1. Registrar `estudiante1` desde la UI.
2. Promocionar a profesor (Etapa 4 lo hace el admin; en Etapa 2 vía `POST /api/auth/become-teacher` temporal).
3. Como profesor: crear curso → módulo → lección con video → subir material.
4. Publicar curso.
5. Logout, registrar `estudiante2`.
6. Ver catálogo, filtrar por categoría, abrir curso, inscribirse.
7. Reproducir lección, descargar material, marcar completada, comentar.
8. Volver a "Mis cursos", verificar barra de progreso.

---

## 11. Estrategia de testing

**Etapas 1–4: testing manual** vía smoke tests documentados al cerrar cada etapa.

**Etapa 5: tests automatizados.**

| Capa | Herramienta | Alcance |
|---|---|---|
| Backend unit | Vitest | `services/*` (racha, logros, validadores) |
| Backend integration | Vitest + supertest | Auth, posts (CRUD + like/save), courses (CRUD + enroll + progress), evaluations |
| Frontend | Vitest + Testing Library | Componentes con lógica (PostCard, EvaluationQuiz) |
| E2E | Playwright (opcional) | Flujo crítico: registro → inscripción → completar lección |

**Cobertura objetivo Etapa 5: 30%** en `backend/src/routes/` y `backend/src/services/`. No buscamos cobertura completa, sí cubrir los caminos felices y los rechazos importantes (403, 409).

---

## 12. Patrones obligatorios de código

### Backend

**`prisma.js` — singleton:**
```js
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
export default prisma;
```

**`db.js` — runQuery Neo4j:**
```js
export async function runQuery(cypher, params = {}) {
  const session = driver.session();
  try {
    const result = await session.run(cypher, params);
    return result.records;
  } finally {
    await session.close();
  }
}
```

**Middleware de rol** (para rutas Postgres):
```js
function requireRole(...roles) {
  return async (req, res, next) => {
    const usuario = await loadCurrentUser(req, res);
    if (!usuario) return;
    if (!roles.includes(usuario.rol)) {
      return res.status(403).json({ success: false, message: 'No tienes permiso para esta acción' });
    }
    next();
  };
}
```

**Patrón de respuesta:**
```js
res.json({ success: true, data: { ... } });
res.status(400).json({ success: false, message: '...' });
```

**Cualquier ruta nueva debe:**
1. Validar input al inicio del handler con respuestas 400.
2. Usar `requireAuth` / `optionalAuth` según corresponda.
3. Loguear errores con `console.error('NOMBRE_RUTA error', err)` antes del 500.
4. Devolver siempre `{ success, data }` o `{ success: false, message }`.

### Frontend

**Cliente API:**
```js
import client from '../api/client.js';
const { data } = await client.get('/api/...');
if (data?.success) { /* ... */ }
```

**Componentes deben pasar la checklist de `frontend/design.md` §12** antes de marcarse como terminados.

**Mascota Titi:** siempre `<img src="/Titi.png" alt="Titi" />`. Nunca emoji 🐒.

---

## 13. Convenciones

| Aspecto | Regla |
|---|---|
| IDs | UUID via `crypto.randomUUID()` en Neo4j, `@default(uuid())` en Prisma |
| Fechas | ISO 8601. Render con `new Date(s).toLocaleDateString('es-ES')` |
| Idioma de la UI | Español, voseo opcional para tono cálido ("Inscribite gratis") |
| Idioma del código | Inglés (variables, funciones, archivos) |
| Nombres en DB | Español (modelos Prisma, nodos/relaciones Neo4j, campos visibles) |
| Mensajes de error | Legibles en español ("Curso no encontrado", no "Course not found") |
| Commits | `feat:`, `fix:`, `refactor:`, `docs:`, `chore:` en español |
| Branches | `main` es producción. Trabajo en feature branches. PRs requieren review |
| Tailwind | Solo colores `titi-*` y `gray-*`. No hardcodear hex. Solo `rounded-xl`/`2xl` en cards |
| Tipografía | `font-sans` (Nunito por config). Pesos: `font-medium`, `font-bold`, `font-extrabold`, `font-black` solo para números de racha |

---

## 14. Glosario

| Término | Significado |
|---|---|
| **neoId** | El `Usuario.id` de Neo4j replicado en `Usuario.neoId` de Postgres. El JWT lleva este id |
| **Espejo** | La fila de `Usuario` en Postgres que corresponde a un `(:Usuario)` en Neo4j |
| **Inscripción** | Relación entre `Usuario` y `Curso` en Postgres (`Inscripcion`). En Etapa 4 se propaga a Neo4j como `:INSCRITO_EN` |
| **Racha** | Días consecutivos completando al menos una lección o evaluación. Vive en `Usuario.racha` |
| **Verificado** | Booleano en `Usuario`. Solo aplica a `PROFESOR`. Requerido para crear cursos |
| **Borrador** | `Curso.publicado = false`. No aparece en catálogo público |
| **Save vs Like** | Like = público y notifica al autor. Save = privado, solo para mí |
| **Etapa** | Iteración mayor del proyecto. Cada etapa tiene un `AGENTS.md` que la describe |

---

## 15. Cómo navegar este proyecto como LLM

Antes de tocar código en una sesión nueva:

1. **Lee este archivo entero** una vez.
2. **Lee `AGENTS.md`** para entender qué bloque de la etapa actual estás cerrando.
3. **Lee `frontend/design.md`** si vas a tocar UI.
4. **Si tu proyecto tiene skills locales activas** (`.claude/skills/titi-*`), invocalas con `Skill` para orientarte rápido:
   - `titi-orientation` — mapa del repo y dónde vive qué.
   - `titi-backend-patterns` — patrones de routes, auth, Prisma, Neo4j.
   - `titi-frontend-patterns` — patrones de páginas, componentes y consumo de API.
   - `titi-dual-db` — cuándo Neo4j vs Postgres y cómo sincronizar.
5. **Usa CodeGraph** (`codegraph_*`) para búsquedas estructurales antes que `grep`.
