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
    auth.js             ← /api/auth (register, login, me)
    posts.js            ← /api/posts (feed, explore, like, save, comentarios via /comments.js)
    users.js            ← /api/users (perfil, follow, ubicación)
    courses.js          ← /api/courses (catálogo, detalle, inscribir, publish/unpublish/delete, mis-cursos)
    modules.js          ← /api/courses/:id/modules + /api/modules/:id/lessons + CRUD módulos
    lessons.js          ← /api/lessons (CRUD, complete con racha+logros, comments)
    materials.js        ← /api/lessons/:id/materials + /api/materials/:id (multer)
    categories.js       ← /api/categories (GET público, POST admin)
    evaluations.js      ← /api/evaluations (CRUD + attempt con grading server-side)
    progress.js         ← /api/progress (streak, achievements, certificates + verify público)
    gotas.js            ← /api/gotas (saldo/total/semana + history)         [Etapa 6]
    missions.js         ← /api/missions/today (3 misiones diarias)          [Etapa 6]
    ranking.js          ← /api/ranking/friends (leaderboard semanal)        [Etapa 6]
    admin.js            ← /api/admin (users, courses, stats, categorías)
    notifications.js, search.js, comments.js, sounds.js, locations.js
  services/
    progress.service.js     ← actualizarRacha + checkCursoCompletado + rachaEstaActiva
    achievement.service.js  ← LOGROS_CATALOGO + ensureLogrosCatalog + checkers
    neo4j-sync.service.js   ← propaga inscripción/completado a Neo4j (CursoRef)
    upload.service.js       ← Cloudinary (fallback a disco)
    gotas.service.js        ← otorgarGotas (idempotencia + topes) + sumas    [Etapa 6]
    mision.service.js       ← asignar/avanzar misiones diarias               [Etapa 6]
    ranking.service.js      ← ranking de amigos + premio semanal lazy        [Etapa 6]

frontend/src/
  api/client.js         ← axios + interceptor JWT desde localStorage
  context/AuthContext   ← { user, isAuthenticated, login, logout }
  hooks/useStreak.js    ← racha actual del usuario logueado
  components/
    Navbar.jsx          ← sidebar desktop + bottom nav móvil + badge notif
    PostCard.jsx        ← post completo con like/save/comentarios
    CreatePost.jsx, EditPostModal.jsx, CommentSection.jsx, OptionsPosts.jsx
    ConfirmModal.jsx, TitiMascot.jsx
    LessonComments.jsx
    StreakBadge.jsx (3 variantes), StreakToast.jsx
    AchievementToast.jsx, AchievementsSection.jsx
    EvaluationQuiz.jsx
    AcademicActivityCard.jsx, RecommendedCourseCard.jsx   [Etapa 4]
    titi/titiAssets.js  ← mapa estado→WebP de la mascota   [Etapa 6.4]
    icons.jsx (GotaIcon, BookIcon), PageTransition.jsx
  pages/
    Feed, Explore, Profile, Notifications, HashtagFeed, Login, Register
    Courses, CourseDetail, LearnCourse, MyCourses
    Certificates.jsx (+ export VerifyCertificate para /verify/:codigo)
    teacher/MyTeaching.jsx (con FAB móvil "+ Crear curso")
    teacher/CourseEditor.jsx
    teacher/ModulesEditor.jsx
    teacher/EvaluationEditor.jsx (mode="module"|"final")
    admin/  (AdminDashboard, AdminUsers, AdminCourses, AdminCategories)   [Etapa 4]
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
| Mascota Titi | **Siempre** `<TitiMascot>` (WebP animado, fallback `/Titi.png`). NUNCA emoji 🐒 |
| Colores | Solo clases `titi-*` y `gray-*`. NUNCA hex hardcodeado en JSX |
| Tipografía | `font-sans` (Nunito). `font-black` solo para números de racha |
| Cards | `rounded-xl` o `rounded-2xl`. Nunca `rounded` solo |

## Etapas del proyecto

- ✅ **Etapa 1** — Red social Titi.
- ✅ **Etapa 2** — Módulo educativo base.
- ✅ **Etapa 3** — Evaluaciones, racha, logros, certificados.
- ✅ **Etapa 4** — Integración social + admin.
- ✅ **Etapa 5** — Cloudinary, tests, CI/CD, deploy público (`v1.0.0`).
- 🔄 **Etapa 6** — Gamificación + Titi Vivo (gotas, misiones, ranking, mascota
  animada). Subfases 6.1–6.3 ✅; **en curso 6.4**. Estado y qué falta en `docs/roadmap.md`.

## Lecturas antes de tocar código

1. `AGENTS.md` (raíz) — entrada slim: mapa + punteros + estado actual.
2. `docs/roadmap.md` — qué falta en la etapa actual.
3. `docs/architecture.md` / `docs/api.md` / `docs/conventions.md` — según lo que toques.
4. `frontend/design.md` — si tocás UI.

## Para preguntas estructurales sobre el código

Usa `Grep`/`Glob` para localizar, o las skills hermanas para patrones. Si existe
`graphify-out/`, tratá la pregunta como query de `graphify` primero.

## Skills hermanas

- `titi-backend-patterns` — patrones de routes, auth, Prisma, Cypher.
- `titi-frontend-patterns` — patrones de páginas, componentes, axios.
- `titi-dual-db` — cuándo y cómo sincronizar Neo4j y Postgres.
