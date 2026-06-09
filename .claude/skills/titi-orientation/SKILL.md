---
name: titi-orientation
description: Mapa rápido del proyecto Titi (estructura, dual DB, auth flow, etapa actual). Úsalo al empezar una sesión nueva sobre este repo, antes de buscar archivos. Disparadores - "qué hace este proyecto", "cómo está organizado", "no conozco este repo", "dónde está X", primera intervención sobre un módulo nuevo, o cualquier tarea cross-cutting sobre Titi.
---

# Orientación rápida — Titi Platform

## Qué es

Plataforma educativa social universitaria boliviana. **Dos DBs, un backend, un frontend.**

- Frontend: React + Vite + Tailwind 3 + React Router v6.
- Backend: Express 5 + JWT + Prisma + neo4j-driver.
- **Neo4j Aura** → red social (usuarios, posts, follows, likes, comentarios, hashtags, sonidos, ubicaciones, notificaciones).
- **PostgreSQL** → módulo educativo (cursos, módulos, lecciones, materiales, evaluaciones, progreso, certificados).

## Dónde está qué

```
backend/src/
  index.js              ← entry + CORS + monta /api/auth, /api/users, /api/posts, /api/courses…
  db.js                 ← driver Neo4j + runQuery(cypher, params)
  prisma.js             ← singleton PrismaClient
  middleware/auth.js    ← requireAuth, optionalAuth (parsea JWT a req.user)
  routes/
    auth.js             ← /api/auth (register, login) — crea Neo4j + espejo Postgres
    posts.js            ← /api/posts (feed, explore, like, save, comentarios via /comments.js)
    users.js            ← /api/users (perfil, follow, ubicación)
    courses.js          ← /api/courses (catálogo, detalle, inscribir, mi-progreso, mis-cursos)
    modules.js          ← /api/courses/:id/modules + /api/modules/:id/lessons
    lessons.js          ← /api/lessons (POST/PUT/complete/comments)
    notifications.js, search.js, comments.js, sounds.js, locations.js

frontend/src/
  api/client.js         ← axios + interceptor JWT desde localStorage
  context/AuthContext   ← { user, isAuthenticated, login, logout }
  components/
    Navbar.jsx          ← sidebar desktop + bottom nav móvil + badge notif
    PostCard.jsx        ← post completo con like/save/comentarios
    CreatePost.jsx, EditPostModal.jsx, CommentSection.jsx, OptionsPosts.jsx
    ConfirmModal.jsx, TitiMascot.jsx
  pages/
    Feed, Explore, Profile, Notifications, HashtagFeed, Login, Register
    Courses, CourseDetail, LearnCourse, MyCourses
```

## El puente Neo4j ↔ Postgres (CRÍTICO)

- El JWT tiene **el `id` de Neo4j** en `req.user.id`.
- En Postgres ese id vive en `Usuario.neoId` (no en `Usuario.id`).
- Para rutas Postgres autenticadas, usar este helper (copiado de `routes/courses.js`):

```js
async function loadCurrentUser(req, res) {
  if (req.dbUser) return req.dbUser;
  const usuario = await prisma.usuario.findUnique({ where: { neoId: req.user.id } });
  if (!usuario) { res.status(401).json({ success: false, message: 'Usuario no encontrado' }); return null; }
  req.dbUser = usuario;
  return usuario;
}
```

**Nunca uses `req.user.id` como `usuarioId` en queries Prisma.** Es el id de Neo4j. Usa `req.dbUser.id`.

## Convenciones absolutas

| Cosa | Regla |
|---|---|
| Respuesta API éxito | `res.json({ success: true, data: {...} })` |
| Respuesta API error | `res.status(4xx).json({ success: false, message: '...' })` |
| IDs | `crypto.randomUUID()` |
| Texto en UI | Español, voseo opcional ("Inscribite") |
| Código, variables, archivos | Inglés |
| Modelos Prisma / nodos Neo4j | Español (`Usuario`, `Curso`, `LE_GUSTO`) |
| Mascota Titi | **Siempre** `<img src="/Titi.png" />`. NUNCA emoji 🐒 |
| Colores | Solo clases `titi-*` y `gray-*`. NUNCA hex hardcodeado en JSX |
| Tipografía | `font-sans` (Nunito). `font-black` solo para números de racha |
| Cards | `rounded-xl` o `rounded-2xl`. Nunca `rounded` solo |

## Etapas del proyecto

- ✅ **Etapa 1** — Red social Titi (completa).
- 🔄 **Etapa 2** — Módulo educativo base (en curso). Ver `AGENTS.md` para checklist.
- 📋 **Etapa 3** — Evaluaciones, racha, logros, certificados.
- 📋 **Etapa 4** — Integración social + admin.
- 📋 **Etapa 5** — Cloudinary, tests, deploy.

## Lecturas obligatorias antes de tocar código

1. `AGENTSGoal.md` — visión y arquitectura (este doc).
2. `AGENTS.md` — qué falta en la etapa actual.
3. `frontend/design.md` — si tocás UI.

## Para preguntas estructurales sobre el código

Usa `codegraph_*` antes que `grep`:
- "¿Qué llama a X?" → `codegraph_callers`
- "¿Qué llama X?" → `codegraph_callees`
- "¿Dónde está definido X?" → `codegraph_search`
- "Survey de área desconocida" → `codegraph_explore`

## Skills hermanas

- `titi-backend-patterns` — patrones de routes, auth, Prisma, Cypher.
- `titi-frontend-patterns` — patrones de páginas, componentes, axios.
- `titi-dual-db` — cuándo y cómo sincronizar Neo4j y Postgres.
