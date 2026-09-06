<div align="center">

<img src="docs/banner.png" alt="Titi banner" width="100%" />

# Titi — Social Learning, Built Different

**The Bolivian university social network where learning is social.**  
Courses, interactive lessons, evaluations & certificates — fused with a real social feed, friendships, streaks and an AI tutor that actually knows your course.

[![Live](https://img.shields.io/badge/Live-titiedu.vercel.app-FFD93D?style=for-the-badge&logo=vercel&logoColor=1A1A2E)](https://titiedu.vercel.app)
[![API](https://img.shields.io/badge/API-titi--backend.onrender.com-1A1A2E?style=for-the-badge&logo=render&logoColor=white)](https://titi-backend.onrender.com)
[![Node](https://img.shields.io/badge/Node-20+-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind](https://img.shields.io/badge/Tailwind-3-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![Neo4j](https://img.shields.io/badge/Neo4j-Aura-008CC1?logo=neo4j&logoColor=white)](https://neo4j.com/cloud/aura/)
[![Postgres](https://img.shields.io/badge/PostgreSQL-Prisma-4169E1?logo=postgresql&logoColor=white)](https://www.prisma.io)
[![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)](https://expressjs.com)

[Features](#-features) · [Screenshots](#-screenshots) · [Architecture](#-architecture) · [Quick Start](#-quick-start) · [API](#-api-reference) · [Deploy](#-deploy)

</div>

---

## Why Titi?

Most LMSs are lonely. Most social networks are noisy. **Titi is both — and better for it.**

- See what your friends are learning, not just what they post.
- Recommendations come from your graph, not an algorithm spying on you.
- Streaks, XP, missions and a living mascot keep you coming back — with friends, not pressure from strangers.
- An embedded AI tutor answers from *your* course content, with citations — no hallucinations.

> **Identity:** Titi monkey mascot, palette `#FFD93D` + `#FFFBF0` + `#1A1A2E`, Nunito typeface. Warm, university, proudly Bolivian.

---

## ✨ Features

### 🌐 Social Network — Real Graph, Real Feed

| Capability | Detail |
|---|---|
| **Feed & Explore** | Personalized feed from people you follow + global Explore. Cursor-based pagination, infinite scroll. |
| **Posts** | Text + optional image, hashtags (auto-extracted), sounds, locations. Like, save, edit, delete. |
| **Comments** | Nested threads, reply-to, delete. |
| **Follow Graph** | Follow / unfollow, followers & following lists, `isFollowing` resolution. |
| **Search** | Users, posts and hashtags in one endpoint. |
| **Hashtags & Discovery** | Hashtag feeds, trending via graph traversals. |
| **Sounds & Locations** | Attach sounds (`Sonido`) and geotags (`Ubicacion`) to posts. |
| **Notifications** | Likes, follows, comment replies, new-lesson alerts — stored as Neo4j `Notificacion` nodes. |
| **Academic Feed** | "What my friends are learning" — `INSCRITO_EN` / `COMPLETO_CURSO` traversals. |
| **Course Recommendations** | "Courses my friends took and I didn't" — pure Cypher, no JOIN hell. |

![Feed](docs/screenshots/01-feed.png)
*Feed — personal + academic activity, infinite scroll.*

![Explore & Hashtags](docs/screenshots/02-explore.png)
*Explore, hashtag feeds and search.*

![Notifications](docs/screenshots/03-notifications.png)
*Real-time notifications: replies, follows, new lessons.*

---

### 📚 Learning Platform — Courses That Feel Alive

| Capability | Detail |
|---|---|
| **Course Catalog** | Public catalog with filters (category, level, search). Guest-browsable; content gated by enrollment. |
| **Categories** | Admin-managed categories with icons. |
| **Course Lifecycle** | `BORRADOR` → `PUBLICADO` → `ARCHIVADA` for modules; course-level publish/unpublish with confirmation. |
| **Modules & Lessons** | Ordered modules, ordered lessons. Two lesson formats: `MARKDOWN` (rich text + video) and `HTML` (fully interactive). |
| **Markdown Lessons** | GitHub-flavored Markdown, syntax highlighting, Mermaid diagrams, safe URL sanitization. |
| **Interactive HTML Lessons** | Self-contained HTML presentations/games rendered in `iframe srcDoc sandbox="allow-scripts"`. No external network, no forms/frames. CSP-injected. |
| **Evaluable HTML** | HTML activities can be gradable (`evaluable`) with `intentosMax` (1–10) and optional `fechaLimite` deadline. `postMessage` bridge with `attemptToken`, idempotent scoring, best-score tracking. |
| **Video Embeds** | YouTube (watch/shortlink → embed) & Vimeo, normalized and validated (strict `https:` + host allowlist). |
| **Materials** | Per-lesson file uploads (PDF, Word, image, code, other) — 10 MB limit, Cloudinary or local disk fallback. |
| **Enrollments** | Idempotent enroll, dedup by `(usuarioId, cursoId)`, propagated to Neo4j for social queries. |
| **Progress** | Per-lesson completion, course progress bar, `total / completadas / porcentaje` + `nuevasPendientes` signaling. |
| **Notes** | Private per-lesson notes (`NotaLeccion`, max 5000 chars), keyed by `(usuarioId, leccionId)`. |
| **Lesson Comments** | Threaded discussion per lesson (single-level reply flattening), with notification to replied user. |
| **Evaluations** | Module quizzes + final course exam. `OPCION_MULTIPLE` / `VERDADERO_FALSO` / `RESPUESTA_CORTA`, server-side grading, `intentosMax` + `notaMinima`, optional deadline. |
| **Certificates** | Auto-issued when all lessons + all evaluations passed. `codigoVerif` (UUID) + public verification `GET /certificates/verify/:codigo` without auth. Survives course deletion via nullable `cursoId` + `cursoTitulo` snapshot. |
| **Revisions** | Every lesson edit snapshots JSON + author; restore any revision. |
| **My Courses & Teaching** | `GET /my/enrolled` (student) + `GET /my/teaching` (teacher) dashboards. |

![Catalog](docs/screenshots/04-catalog.png)
*Course catalog — filters, levels, categories.*

![Course Detail](docs/screenshots/05-course-detail.png)
*Course detail — modules, lessons, enroll CTA, progress.*

![Learn — 3 Columns](docs/screenshots/06-learn.png)
*Learn view — 3-column layout: lesson index, content, side rail.*

![Lesson Panels](docs/screenshots/07-lesson-panels.png)
*Notes, Materials & Comments — collapsible side panels.*

![Evaluations](docs/screenshots/08-evaluations.png)
*Evaluations — quiz, attempts, server-side grading, certificates.*

![HTML Interactive](docs/screenshots/09-html-lesson.png)
*Interactive HTML lesson — sandboxed iframe, scored via postMessage.*

---

### 🧑‍🏫 Authoring Studio — For Teachers Who Ship

- **Dedicated `/api/authoring` surface** — JWT or service-token (`course:create`, `content:write`, `publish`, `material:write`, `analytics:read`).
- **Optimistic concurrency** — every mutation requires `expectedFingerprint` (SHA of the resource) + `Idempotency-Key`. Prevents lost updates; `412` on stale view.
- **Publication confirmations** — preview → signed phrase + token + fingerprint → publish. 10-minute expiry, HMAC with `AUTHORING_CONFIRMATION_SECRET`. Separate preview and publish calls by design.
- **Deletion previews** — `preview-deletion` returns impact graph + confirmation before irreversible delete.
- **Course & Module editors** — create/update, ordering, draft/published states, version claims.
- **Lesson editor** — Markdown or HTML, archived/restore lifecycle, revision history.
- **Material uploads** — `multipart/form-data`, Cloudinary in prod, disk fallback in dev, SHA256 dedup, 10 MB.
- **Portada uploads** — image validation, Cloudinary `portada-<hash>` dedup.
- **Quiz editors** — module quiz + final quiz, question CRUD, option correctness, `intentosMax`/`notaMinima`/`fechaLimite`.
- **Analytics** — private per-evaluation analytics (pass rates, etc.) without leaking PII.

![Authoring — Course Editor](docs/screenshots/10-authoring-course.png)
*Course & module editors — fingerprint-guarded, idempotent.*

![Authoring — HTML Upload](docs/screenshots/11-authoring-html.png)
*HTML lesson authoring — validation, deadlines, attempts.*

---

### 🤖 AI Tutor (RAG) — Grounded, Cited, Safe

Titi's tutor doesn't hallucinate. It retrieves from **your course** and answers with citations or says it doesn't know.

| Layer | Detail |
|---|---|
| **Embeddings** | `google/embeddinggemma-300M` (768 dims), `pgvector` `vector(768)`. Provider `local` (self-hosted) or `cloudflare` (Workers AI). |
| **Chunking** | `lessonRagText = titulo + contenido + extractLessonHtmlContent(html)` → `chunkText(900, overlap 120)` → per-chunk embedding. |
| **HTML Extraction** | DOM text + `data-*`/`alt`/`aria-label` + structured JSON in `<script>` (questions, options, flashcards, slides) + JS string literals — filtered by `isNaturalLanguageText` and `CODE_EXCLUDE_TOKENS` blocklist. |
| **Storage** | `DocumentoRag` (per `leccionId+version`, `estado` `PENDIENTE→LISTO→FALLIDO`, `activo`, `hashContenido`) + `FragmentoRag` (`orden`, `contenido`, `embedding`). |
| **Indexing** | `indexLesson` / `indexCourse` with `UNCHANGED` dedup, `SKIPPED` gates (unpublished / feature-disabled / empty), transactional fragment swap. Auto-triggered via `scheduleLessonIndex` on publish/edit/HTML upsert. Manual `POST /admin/rag/courses/:courseId/reindex`. |
| **Retrieval** | Cosine similarity (`<=>`), filtered to `activo + LISTO + PUBLICADA`, course-scoped, lesson-prioritized (`RAG_LESSON_PRIORITY_LIMIT`). |
| **Generation** | Groq (`groqEndpoint`) directly or via self-hosted AI Gateway or Cloudflare AI Gateway (`AI_PROVIDER_ROUTE=cloudflare_gateway`). `temperature: 0.2`, system prompt enforces citations `[1]`… only from retrieved sources. |
| **Grounding & Safety** | Prompt-injection detection on query + retrieved chunks, blocked-action detection (`isBlockedActionRequest`), `NO_EVIDENCE_ANSWER` fallback, citation validation (`validateGroundedAnswer`), rate limits (5/min, 30/day per principal), security events (no full prompt logging). |
| **Gating** | `RAG_ENABLED` + `RAG_COURSE_IDS=*|list` + `RAG_ALLOWED_USER_EMAIL` (pilot) gate both `status` and `chat`. Reindex requires `ADMIN` / creator / professor. |
| **Admin UI** | `pages/admin/AdminRag.jsx` — enable/disable, course allowlist, reindex controls. |

![Tutor Panel](docs/screenshots/12-tutor.png)
*Tutor IA — side panel (desktop) & bottom sheet (mobile), cited answers.*

![RAG Admin](docs/screenshots/13-rag-admin.png)
*Admin RAG controls — pilot gating & reindex.*

---

### 🎮 Gamification — The Loop That Keeps You Learning

| Mechanic | How It Works |
|---|---|
| **Gotas (XP)** | Earned by learning (`leccion` +10, `evaluacion` +20, `curso` +50) and social actions (`post` +5, `like` +1, `comment` +2, `follow` +3) with **daily caps** anti-farm. Learning is **idempotent** — repeating a lesson doesn't pay twice. `MovimientoGota` ledger + denormalized `gotasSaldo` (spendable) / `gotasTotal` (lifetime). `POST /lessons/:id/complete` + evaluation attempts trigger `otorgarGotas`. |
| **Daily Missions** | 3 per day from a seeded pool (`Mision`), assigned per `(usuarioId, misionId, fecha)`, reset at midnight server TZ. Advance on real events (`leccion`, `evaluacion`, `post`, `comentario`, `follow`). Complete → bonus gotas. |
| **Weekly Friends Leaderboard** | `GET /ranking/friends` — cross `follow` graph (Neo4j) × weekly gotas (Postgres). Resets Mondays. Lazy prize: first access in a new week grants `InsigniaSemanal` + 50 gotas to last week's #1 in your circle (idempotent by `(usuarioId, semana)`). |
| **Streaks** | Consecutive days completing ≥1 lesson/evaluation. `actualizarRacha` with `startOfDay` server TZ. Surfaced via `StreakBadge` + `StreakToast`. |
| **Achievements** | 7 idempotent badges (`Logro` + `LogroUsuario`): First Lesson, First Course, 7/30-day streak, First Evaluation, Perfect Score (100%), Social (follow 10). Shown on any profile. `AchievementToast`. |
| **Living Titi** | `TitiMascot` — WebP animated by state (`idle`, `celebra`, `triste`, `racha`, `saludo`, `pensando`), `titiAssets.js` mapping, `prefers-reduced-motion` → static `/Titi.png`. Reacts to events (earn gotas → celebrate). **Never the 🐒 emoji.** |

![Gamification Bar](docs/screenshots/14-gamification.png)
*Gotas counter, streak badge, daily missions & friends leaderboard.*

![Mascot States](docs/screenshots/15-titi-states.png)
*TitiMascot — 6 animated states + reduced-motion fallback.*

---

### 🛒 Gotas Shop — The Economy Sink

Turns accumulated XP into meaningful choices.

| Item | Price | Effect |
|---|---|---|
| `congelar_racha` | ~50 gotas | Protects streak for 1 inactive day. Lazy-consumed when a gap is detected. `limiteStack: 3`. |
| `intento_extra` | ~80 gotas | Extra attempt on a blocked evaluation (`usarIntentoExtra: true` in attempt body). Auto-consumed. |
| `multiplicador_gotas` | ~100 gotas | 2× gotas for 1 hour (`gotasMultiplicadorHasta` on `Usuario`). Manually consumed via `POST /shop/use`. |

- **Models:** `ItemTienda` (catalog), `CompraItem` (purchase ledger with price snapshot), `InventarioItem` (`@@unique([usuarioId, itemId])`).
- **Economy:** `gastarGotas` debits `gotasSaldo` (never `gotasTotal`) + writes negative `MovimientoGota` in a single transaction.
- **Endpoints:** `GET /shop/items` (catalog + your count), `GET /shop/inventory`, `POST /shop/buy`, `POST /shop/use`.
- **UI:** `pages/Shop.jsx` + `components/ItemCard.jsx` + `PurchaseToast`, wired into `EvaluationQuiz` blocked state.

![Shop](docs/screenshots/16-shop.png)
*Gotas Shop — catalog, balance, inventory, purchase toasts.*

---

### 👤 Profiles, Roles & Access

| Feature | Detail |
|---|---|
| **Auth** | JWT (`jsonwebtoken` + `bcrypt`), `POST /register` creates Neo4j node + Postgres mirror via `neoId`, `POST /login` merges role/streak/gotas, `GET /me` full profile. |
| **Edit Profile** | Avatar/banner upload (Cloudinary), bio. `PUT /users/me` + `components/EditProfileModal.jsx`. |
| **Roles** | `ESTUDIANTE` (default) → `PROFESOR` (needs `verificado`) → `ADMIN`. Guards: `requireRole`, `isOwnerOrAdmin`, `ensureCourseContentAccess`. |
| **Guest Catalog** | Guests browse `/` catalog + `CourseDetail` without login (`GuestShell.jsx`). Real content + social endpoints require auth + enrollment. 401 interceptor redirects to login preserving return URL. |
| **Admin Panel** | `pages/admin/*` — Dashboard stats, user verification/role changes, course moderation (including forced delete with cascade), category management, RAG controls. 10 endpoints under `/api/admin`. |

![Profile](docs/screenshots/17-profile.png)
*Profile — avatar, banner, bio, achievements, streak, stats.*

![Admin](docs/screenshots/18-admin.png)
*Admin — users, courses, categories, RAG.*

---

## 📸 Screenshots

> Place your captures in `docs/screenshots/` with the names below. The README already points to them — just drop the files and they appear.

| # | File | View |
|---|---|---|
| 01 | `docs/screenshots/01-feed.png` | Feed — personal + academic |
| 02 | `docs/screenshots/02-explore.png` | Explore, search, hashtags |
| 03 | `docs/screenshots/03-notifications.png` | Notifications |
| 04 | `docs/screenshots/04-catalog.png` | Course catalog + filters |
| 05 | `docs/screenshots/05-course-detail.png` | Course detail |
| 06 | `docs/screenshots/06-learn.png` | LearnCourse 3-column layout |
| 07 | `docs/screenshots/07-lesson-panels.png` | Notes / Materials / Comments panels |
| 08 | `docs/screenshots/08-evaluations.png` | Evaluations & certificates |
| 09 | `docs/screenshots/09-html-lesson.png` | Interactive HTML lesson |
| 10 | `docs/screenshots/10-authoring-course.png` | Authoring — course/module editor |
| 11 | `docs/screenshots/11-authoring-html.png` | Authoring — HTML upload & deadlines |
| 12 | `docs/screenshots/12-tutor.png` | Tutor IA panel |
| 13 | `docs/screenshots/13-rag-admin.png` | Admin RAG controls |
| 14 | `docs/screenshots/14-gamification.png` | Gotas, missions, leaderboard, streak |
| 15 | `docs/screenshots/15-titi-states.png` | TitiMascot states |
| 16 | `docs/screenshots/16-shop.png` | Gotas Shop |
| 17 | `docs/screenshots/17-profile.png` | Profile + achievements |
| 18 | `docs/screenshots/18-admin.png` | Admin dashboard |

---

## 🏗️ Architecture

```
Frontend (React 18 + Vite + Tailwind + GSAP)
  AuthContext + JWT in localStorage
  Axios client with 401 interceptor
        │  REST + JWT (Authorization: Bearer …)
        ▼
Backend (Express 5 — Node 20)
  requireAuth / optionalAuth  (middleware/auth.js)
  requireRole / ensureCourseContentAccess (middleware/permissions.js)
  multer + Cloudinary (services/upload.service.js)
        │                │
        ▼                ▼
   Neo4j (Aura)    PostgreSQL (Prisma — Neon)
   social graph    educational + gamification
        │                │
        └──────► Cloudinary ◄──────┘
                 (images & materials)
```

**Golden rules**

1. **API contract:** `{ success: true, data }` on success · `{ success: false, message }` (Spanish) on error.
2. **External services never break the main operation** — Neo4j & Cloudinary are wrapped in `try/catch`, they log and continue.
3. **Dual-DB source of truth:** social → Neo4j; educational + gotas → Postgres (propagated to Neo4j via `neo4j-sync.service.js` for `CursoRef` / `INSCRITO_EN` / `COMPLETO_CURSO`).
4. **Flat UI:** no `bg-gradient-*` or `blur-*`. Mascot always `<TitiMascot>`.
5. **Conventional commits (Spanish)**, identity `abdair-coca <cocaabdair@gmail.com>`, no `Co-Authored-By`.

### Dual-DB Bridge

- JWT carries Neo4j `Usuario.id` (`req.user.id`).
- Postgres mirror `Usuario.neoId` links the two.
- Standard loader for any authenticated Postgres route:

```js
const usuario = await prisma.usuario.findUnique({ where: { neoId: req.user.id } });
```

Full table of what lives where, sync rules, and invariants → [`docs/architecture.md`](docs/architecture.md).
Full endpoint catalog → [`docs/api.md`](docs/api.md).
Code patterns & naming → [`docs/conventions.md`](docs/conventions.md).

### Stack

| Layer | Tech |
|---|---|
| **Frontend** | React 18, Vite 5, Tailwind 3, React Router v6, Axios, GSAP, `react-markdown` + `rehype-highlight` + `mermaid`, `highlight.js` |
| **Backend** | Node 20, Express 5, Prisma 5 (PostgreSQL), `neo4j-driver`, JWT, `bcrypt`, `multer`, `cloudinary` |
| **Databases** | Neo4j Aura (social) + PostgreSQL (Neon, `pgvector` for RAG) |
| **Storage** | Cloudinary (images/materials), local disk fallback in dev |
| **AI** | EmbeddingGemma 300M (768d) + Groq (chat) + Cloudflare AI Gateway (optional) |
| **Deploy** | Render (backend) + Vercel (frontend) |
| **Tests** | Vitest + Supertest (hermetic — Postgres & Neo4j mocked) |

---

## 🚀 Quick Start

**Requirements:** Node 20+, PostgreSQL, Neo4j (local or [Aura free](https://neo4j.com/cloud/aura/)). Cloudinary is optional in dev.

```bash
git clone <repo-url> titi && cd titi
```

### 1. Backend

```bash
cd backend
cp .env.example .env          # fill DATABASE_URL, NEO4J_*, JWT_SECRET
npm install
npx prisma migrate deploy     # create schema in Postgres
npm run seed                  # demo data (courses, achievements, academic feed)
npm run dev                   # http://localhost:3001
```

### 2. Frontend

```bash
cd ../frontend
cp .env.example .env          # VITE_API_URL=http://localhost:3001
npm install
npm run dev                   # http://localhost:5173
```

Open `http://localhost:5173` and sign in with a demo account:

| Account | Email | Password |
|---|---|---|
| Professor | `profesor.demo@titi.local` | `titi1234` |
| Admin | `admin_demo@titi.local` | `titi1234` |

> Change the demo password with `SEED_PASSWORD` in `backend/.env`.

### Environment Variables

**`backend/.env`** — see `backend/.env.example` for the full list:

```bash
DATABASE_URL=postgresql://user:password@host:5432/titi
NEO4J_URI=neo4j+s://XXXX.databases.neo4j.io
NEO4J_USER=neo4j
NEO4J_PASSWORD=XXXXXXXXXX
JWT_SECRET=change_me
FRONTEND_URL=https://titiedu.vercel.app   # comma-separated for Vercel previews
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
AUTHORING_CONFIRMATION_SECRET=distinct_random_secret
SEED_PASSWORD=titi1234

# RAG (optional — staging/pilot)
RAG_ENABLED=false
RAG_COURSE_IDS=*                 # or comma-separated course IDs
RAG_ALLOWED_USER_EMAIL=pilot@example.com
EMBEDDING_API_URL=http://127.0.0.1:8001
EMBEDDING_API_KEY=local-dev-key
EMBEDDING_MODEL=google/embeddinggemma-300M
EMBEDDING_DIMENSIONS=768
GROQ_API_KEY=
GROQ_MODEL=
AI_PROVIDER_ROUTE=legacy         # or cloudflare_gateway
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_AI_API_TOKEN=
CLOUDFLARE_AI_GATEWAY_ID=
CLOUDFLARE_AI_GATEWAY_TOKEN=
```

**`frontend/.env`**

```bash
VITE_API_URL=http://localhost:3001
```

---

## 🧪 Tests

Hermetic suite — Postgres & Neo4j are mocked, so CI needs no real Aura or Cloudinary.

```bash
cd backend
npm test                # vitest run
npm run test:coverage   # with v8 coverage report
npm run lint            # eslint (real errors, not style)
```

Covers critical flows and important rejections (401/403/409): `auth`, `posts`, `courses`, `evaluations` (server-side grading), `gotas`, `missions`, `ranking`, `shop`, `admin` guards, plus unit tests for streak, achievements, gotas and shop services.

Frontend contract checks:

```bash
cd frontend
npm run test:markdown-url
npm run test:authoring-contract
npm run test:html-lesson
npm run test:deadline
npm run test:rag
```

CI (`.github/workflows/ci.yml`): every PR to `main` runs backend lint + tests and frontend build. Red check blocks merge.

---

## ☁️ Deploy

| Layer | Platform | Notes |
|---|---|---|
| Backend | **Render** | Blueprint `render.yaml`; `prisma migrate deploy && npm start` on boot; free tier sleeps after 15 min → UptimeRobot ping |
| PostgreSQL | **Neon** | Serverless, free, `pgvector` ready |
| Frontend | **Vercel** | `vercel.json` SPA rewrite; set `VITE_API_URL` |
| Neo4j | **Aura** | `NEO4J_URI/USER/PASSWORD` |
| Images | **Cloudinary** | `CLOUDINARY_*` vars |

`FRONTEND_URL` controls CORS: localhost is always allowed; add production + preview URLs there (comma-separated).

**Live:** frontend `https://titiedu.vercel.app` · backend `https://titi-backend.onrender.com`

---

## 📂 Project Structure

```
backend/
  src/
    app.js              Express app (routes + middleware) — exported for tests
    index.js            server bootstrap (listen + Neo4j constraints)
    db.js               Neo4j driver + runQuery + constraints
    prisma.js           PrismaClient singleton
    middleware/         auth (JWT), permissions, authoring-auth
    routes/             auth, users, posts, comments, search, notifications,
                        sounds, locations, courses, modules, lessons, materials,
                        categories, evaluations, progress, gotas, missions,
                        ranking, shop, admin, rag, authoring
    services/           upload (Cloudinary), neo4j-sync, progress (streak),
                        achievement, gotas, mision, ranking, tienda,
                        rag (+ security), html-extractor, deadline,
                        content-deletion, authoring (+ idempotency)
  prisma/
    schema.prisma       models + indexes + enums
    migrations/         versioned migrations
    seed.js             idempotent seed (courses, achievements, shop items, demo users)
  test/                 vitest + supertest (services + routes)
  scripts/              e2e-rag-phase1.mjs

frontend/
  src/
    api/client.js       axios + JWT interceptor
    context/            AuthContext, GamificationContext
    hooks/useStreak.js
    lib/                motion (GSAP), format, nivel, markdown
    components/         PostCard, CreatePost, EvaluationQuiz, HtmlLessonPlayer,
                        TutorPanel, TitiMascot (+ titi/titiAssets), StreakBadge,
                        AchievementToast, GotaToast, PurchaseToast,
                        DailyMissions, Leaderboard, ItemCard, Shop,
                        LessonComments, MarkdownContent, Navbar, …
    pages/              Feed, Explore, Profile, Notifications, HashtagFeed,
                        Login, Register, Courses, CourseDetail, LearnCourse,
                        MyCourses, Certificates, Leaderboard, Shop,
                        teacher/* (MyTeaching, CourseEditor, ModulesEditor, EvaluationEditor),
                        admin/* (Dashboard, Users, Courses, Categories, Rag)
  design.md             visual system (palette, components, checklist §12)
  motion.md             GSAP motion + mascot animation spec
  agent.md              frontend working guide
```

---

## 📖 Documentation

| Doc | When to read |
|---|---|
| [`docs/architecture.md`](docs/architecture.md) | Dual-DB, auth, models, sync, business rules |
| [`docs/api.md`](docs/api.md) | REST endpoint catalog |
| [`docs/conventions.md`](docs/conventions.md) | Code patterns, naming, versioning, glossary |
| [`docs/roadmap.md`](docs/roadmap.md) | Stage history + live plan |
| [`docs/rag-security.md`](docs/rag-security.md) | RAG security reference |
| [`docs/specs/README.md`](docs/specs/README.md) | SDD workflow (specs + tasks + history) |
| `frontend/design.md` | Design system |
| `frontend/motion.md` | Motion & mascot animation |

---

## 🗺️ Roadmap

| Stage | Tag | Shipped |
|---|---|---|
| 1 — Social | `v0.1.0` | Auth/JWT, feed, explore, profiles, posts, nested comments, search, notifications, visual identity |
| 2 — Educational Module | `v0.2.0` | Postgres+Prisma, course/module/lesson/material CRUD, enrollments, categories, student + teacher UIs |
| 3 — Evaluations & Progress | `v0.3.0` | Server-side grading, streaks, 7 achievements, certificates, `EvaluationQuiz` |
| 4 — Social + Admin Integration | `v0.4.0` | `CursoRef` propagation to Neo4j, academic feed, friend recommendations, admin panel (10 endpoints) |
| 5 — Polish & Deploy | `v1.0.0` | Cloudinary, cursor pagination, indexes, hermetic test suite, CI/CD, public deploy |
| 6 — Gamification + Living Titi | `v2.0.0` | Gotas (XP + ledger + caps), daily missions, weekly friends leaderboard, animated mascot |
| 7 — Gotas Shop | `v3.0.0` | Consumables (`congelar_racha`, `intento_extra`, `multiplicador_gotas`), inventory, purchase/use flows |

Side tracks shipped (no tag): public catalog for guests, authoring studio (fingerprints + idempotency + confirmations), interactive HTML lessons, RAG tutor v1, 3-column Learn redesign with side-rail + Tutor IA.

---

## 🔒 Security Notes

- JWT in `Authorization: Bearer …`, never in query strings.
- Authoring confirmations are HMAC-signed with a dedicated `AUTHORING_CONFIRMATION_SECRET` (never `JWT_SECRET`), 10-minute expiry.
- RAG tutor: no tool calling, no business-API access from the LLM, grounded citations only, prompt-injection detection, rate limiting, opaque principal IDs.
- HTML lessons: self-contained, inline/data-URI resources only, CSP injected, `sandbox="allow-scripts"` iframe, no public URL.
- File uploads: 10 MB, type-validated (`pdf`/`word`/`imagen`/`codigo`/`otro`), SHA256 tracked.

---

## 📄 License

University project — all rights reserved. Built with care in Bolivia.

<div align="center">

**Made with 💛 by [abdair-coca](https://github.com/abdair-coca) · Powered by Titi 🐒**

*Learning is better together.*

</div>
