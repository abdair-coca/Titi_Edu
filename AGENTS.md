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
Storage    Cloudinary               Deploy      Render (back) + Vercel (front)
```

**Dual-DB en una línea:** cada usuario vive en ambas bases, ligadas por
`Usuario.neoId`. El JWT lleva el id de Neo4j; el código resuelve el `Usuario` de
Postgres por `neoId`. Social → Neo4j; educativo + gotas → Postgres. Detalle en
[docs/architecture.md](docs/architecture.md).

---

## Documentación (lee solo lo que necesites)

| Doc | Cuándo |
|---|---|
| [docs/specs/README.md](docs/specs/README.md) | **Flujo SDD**: cómo se agrega/lee una feature (specs + tasks + historial) |
| [docs/specs/changes/](docs/specs/changes/) | Changes activos (en curso) |
| [docs/specs/changes/archive/](docs/specs/changes/archive/) | Historial inmutable de features cerradas |
| [docs/architecture.md](docs/architecture.md) | Dual-DB, auth, modelos, sync, lógica de negocio |
| [docs/api.md](docs/api.md) | Catálogo de endpoints REST |
| [docs/conventions.md](docs/conventions.md) | Patrones de código, naming, versionado, glosario |
| [docs/roadmap.md](docs/roadmap.md) | **Estado de etapas** y plan vivo |
| [docs/rag-security.md](docs/rag-security.md) | Seguridad del tutor RAG (referencia viva) |
| [docs/process/](docs/process/) | Guías operativas (runbooks, pilotos) |
| `frontend/design.md` | Sistema visual (paleta, componentes, checklist §12) |
| `frontend/motion.md` | Motion GSAP + animación de la mascota |
| `frontend/agent.md` | Guía de trabajo frontend + links a rediseños archivados |

**Skills locales** (`Skill` tool, más barato que leer docs enteros):
`titi-orientation` (mapa), `titi-backend-patterns`, `titi-frontend-patterns`,
`titi-dual-db`.

---

## Estado actual

**Etapa 6 — Gamificación + Titi Vivo: CERRADA (`v2.0.0`).** Gotas (XP), misiones
diarias, ranking de amigos semanal y mascota WebP animada, todo en la app.
**Etapa 7 — Tienda de gotas: CERRADA (`v3.0.0`)** — consumibles que gastan
`gotasSaldo` (proteger racha, power-ups educativos). DoD en
[docs/roadmap.md](docs/roadmap.md).

**Side-track en curso (sin tag):** catálogo público para guests + gate por
login/inscripción en contenido de cursos y endpoints sociales. Detalle en
[docs/roadmap.md](docs/roadmap.md) → "Trabajo fuera del plan de etapa".

App live: frontend `https://titiedu.vercel.app` · backend `https://titi-backend.onrender.com`.

---

## Flujo de trabajo — specs (SDD)

Cada feature nueva (o corrección grande) sigue un **change** en
`docs/specs/changes/{nombre}/`: `proposal.md` (qué+por qué) → `spec.md`
(requisitos en español claro) → `tasks.md` (checklist de implementación) →
`verify-report.md` (cómo se probó). Al cerrar, la carpeta se mueve a
`docs/specs/changes/archive/YYYY-MM-DD-{nombre}/` — **historial inmutable**.

Guía completa (ciclo, plantillas, convenciones): [docs/specs/README.md](docs/specs/README.md).

**Reglas del flujo en Titi:**

- **Root override:** las skills SDD escriben por defecto a `openspec/`; acá el
  root es `docs/specs/changes/`. Todo subagente delegado recibe la ruta explícita
  en el prompt.
- **Idioma:** specs/tasks en español, neutral y legible por humano. El detalle
  fino para LLMs vive en Engram (`titi_edu`).
- **Naming:** `kebab-case` en español (ej. `centralizador-notas`).
- **Archivo inmutable:** nunca editar un change en `archive/`.
- **Cada change respeta las reglas de oro** de este doc (respuesta API, dual-DB,
  UI plana, etc.) — ver `docs/specs/config.yaml`.

### Índice de cambios

**Activos** (en curso):

| Change | Estado | Detalle |
|---|---|---|
| `centralizador-notas` | 🔲 Planificado | Notas de estudiantes por curso para teachers. [proposal](docs/specs/changes/centralizador-notas/proposal.md) · [spec](docs/specs/changes/centralizador-notas/spec.md) · [tasks](docs/specs/changes/centralizador-notas/tasks.md) |
| `edicion-perfil` | ✅ Completado | Edición de perfil propio (avatar, banner, bio). [proposal](docs/specs/changes/edicion-perfil/proposal.md) · [spec](docs/specs/changes/edicion-perfil/spec.md) · [tasks](docs/specs/changes/edicion-perfil/tasks.md) |
| `interaccion-lecciones` | ✅ Completado | Hilos en comentarios de lecciones y notificación de nueva lección a inscritos. [proposal](docs/specs/changes/interaccion-lecciones/proposal.md) · [spec](docs/specs/changes/interaccion-lecciones/spec.md) · [tasks](docs/specs/changes/interaccion-lecciones/tasks.md) |

**Archivados** (historial):

| Change | Fecha | Detalle |
|---|---|---|
| `2026-06-27-courses-redesign` | 2026-06-27 | Rediseño catálogo de Cursos v2/v2.1 |
| `2026-08-25-rag-fase-1` | 2026-08-25 | Tutor RAG texto + HTML (pgvector, embeddings, Groq) |
| `2026-08-30-learn-redesign` | 2026-08-30 | Sección Learn 3 columnas + Tutor IA panel lateral |

> Historial de **etapas** (roadmap, tags) → [docs/roadmap.md](docs/roadmap.md).
> Los cambios acá son features/rediseños puntuales, algunos fuera del plan de etapa.

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
6. **Subagentes:** antes de cada lanzamiento o reanudación (`spawn_agent`,
   `followup_task` o delegación equivalente), leer y aplicar
   `C:\Users\abdai\.codex\skills\orchestrate-subagents\SKILL.md`.
