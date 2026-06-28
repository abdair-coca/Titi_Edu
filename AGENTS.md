# AGENTS.md — Titi

> **Entrada para cualquier LLM/dev.** Slim a propósito: lee esto primero y salta
> al doc específico solo cuando lo necesites. Para humanos / setup → `README.md`.

**Titi** = plataforma educativa social universitaria boliviana. Una **red social**
(feed, follows, posts) fundida con una **plataforma de cursos** (módulos, lecciones,
evaluaciones, certificados). El diferencial: el aprendizaje es social —ves qué cursos
toman tus amigos, las recomendaciones salen de tu red.

**Identidad:** mascota Titi (mono titi boliviano), paleta amarillo `#FFD93D` + crema
`#FFFBF0` + dark `#1A1A2E`, tipografía Nunito. Tono cálido y universitario.

```
Frontend   React 18 + Vite 5 + Tailwind 3 + React Router v6 + Axios + GSAP
Backend    Node 20 + Express 5 + JWT + bcrypt + multer
Neo4j      Red social (Aura)        PostgreSQL  Educativo + gamificación (Prisma)
Storage    Cloudinary               Deploy      Railway (back) + Vercel (front)
```

**Dual-DB en una línea:** cada usuario vive en ambas bases, ligadas por
`Usuario.neoId`. El JWT lleva el id de Neo4j; el código resuelve el `Usuario` de
Postgres por `neoId`. Social → Neo4j; educativo + gotas → Postgres. Detalle en
[docs/architecture.md](docs/architecture.md).

---

## Documentación (lee solo lo que necesites)

| Doc | Cuándo |
|---|---|
| [docs/architecture.md](docs/architecture.md) | Dual-DB, auth, modelos, sync, lógica de negocio |
| [docs/api.md](docs/api.md) | Catálogo de endpoints REST |
| [docs/conventions.md](docs/conventions.md) | Patrones de código, naming, versionado, glosario |
| [docs/roadmap.md](docs/roadmap.md) | **Estado actual y qué falta** (etapas + Etapa 6) |
| `frontend/design.md` | Sistema visual (paleta, componentes, checklist §12) |
| `frontend/motion.md` | Motion GSAP + animación de la mascota |
| `frontend/agent.md` | Specs vivas del frontend (rediseño Learn) |
| [docs/archive/](docs/archive/) | Specs ya implementadas (histórico) |

**Skills locales** (`Skill` tool, más barato que leer docs enteros):
`titi-orientation` (mapa), `titi-backend-patterns`, `titi-frontend-patterns`,
`titi-dual-db`.

---

## Estado actual

**Etapa 6 — Gamificación + Titi Vivo: CERRADA (`v2.0.0`).** Gotas (XP), misiones
diarias, ranking de amigos semanal y mascota WebP animada, todo en la app. Próxima
etapa sin definir (candidata: Etapa 7 — tienda de gotas). Detalle en
[docs/roadmap.md](docs/roadmap.md).

App live: frontend `https://titiedu.vercel.app` · backend `https://titiedu-production.up.railway.app`.

---

## Mapa del repo

```
backend/src/
  app.js                Express app (rutas + middleware) — exportada para tests
  index.js              arranque (listen + constraints Neo4j)
  db.js                 driver Neo4j + runQuery(cypher, params)
  prisma.js             singleton PrismaClient
  middleware/auth.js    requireAuth, optionalAuth (JWT → req.user)
  routes/
    auth, users, posts, comments, search, notifications, sounds, locations   (social)
    courses, modules, lessons, materials, categories, evaluations, progress  (educativo)
    gotas, missions, ranking                                                  (gamificación)
    admin
  services/
    progress.service       racha + checkCursoCompletado
    achievement.service    catálogo de logros + checkers
    neo4j-sync.service     propaga eventos educativos a Neo4j
    upload.service         Cloudinary (fallback a disco)
    gotas.service          economía de gotas (ledger + topes)
    mision.service         misiones diarias
    ranking.service        ranking de amigos semanal + premio lazy
  prisma/  schema.prisma · migrations/ · seed.js (idempotente)
  test/    vitest + supertest (prisma/Neo4j mockeados)

frontend/src/
  api/client.js         axios + interceptor JWT
  context/AuthContext   { user, isAuthenticated, login, logout }
  hooks/useStreak.js
  lib/  motion.js (GSAP) · format.js · nivel.js
  components/  PostCard, CreatePost, EvaluationQuiz, TitiMascot (+ titi/titiAssets),
               StreakBadge, AchievementToast, AcademicActivityCard, RecommendedCourseCard…
  pages/  Feed, Explore, Profile, Notifications, HashtagFeed, Login, Register,
          Courses, CourseDetail, LearnCourse, MyCourses, Certificates,
          teacher/* (MyTeaching, CourseEditor, ModulesEditor, EvaluationEditor),
          admin/*  (Dashboard, Users, Courses, Categories)
```

---

## Reglas de oro

1. **Respuesta API:** `{ success, data }` éxito · `{ success: false, message }` error (en español).
2. **Servicios externos** (Neo4j, Cloudinary) y **gamificación** (gotas/misiones)
   van después de la operación principal, en `try/catch` que **nunca** la bloquea.
3. **Fuente de verdad dual-DB:** social → Neo4j; educativo + gotas → Postgres
   (propaga a Neo4j para queries sociales). Ver `titi-dual-db`.
4. **UI plana:** sin `bg-gradient-*` ni `blur-*`. Mascota siempre `<TitiMascot>`, nunca 🐒.
5. **Commits:** conventional en español, identidad `abdair-coca <cocaabdair@gmail.com>`,
   sin `Co-Authored-By`. Tag por subfase (ver [docs/conventions.md](docs/conventions.md)).
