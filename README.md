<div align="center">

<img src="docs/banner.png" alt="Titi banner" width="100%" />

# Titi — Social Learning, Built Different

**The Bolivian university social network where learning is social.**  
Courses, interactive lessons, evaluations & certificates — fused with a real social feed, friendships, streaks and an AI tutor that is grounded in your course content.

[![Live](https://img.shields.io/badge/Live-titiedu.vercel.app-FFD93D?style=for-the-badge&logo=vercel&logoColor=1A1A2E)](https://titiedu.vercel.app)
[![API](https://img.shields.io/badge/API-titi--backend.onrender.com-1A1A2E?style=for-the-badge&logo=render&logoColor=white)](https://titi-backend.onrender.com)
[![Node](https://img.shields.io/badge/Node-20+-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind](https://img.shields.io/badge/Tailwind-3-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![Neo4j](https://img.shields.io/badge/Neo4j-Aura-008CC1?logo=neo4j&logoColor=white)](https://neo4j.com/cloud/aura/)
[![Postgres](https://img.shields.io/badge/PostgreSQL-Prisma-4169E1?logo=postgresql&logoColor=white)](https://www.prisma.io)
[![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)](https://expressjs.com)

[Features](#-features) · [Architecture](#-architecture) · [RAG System](#-rag-system--grounded-ai-tutor) · [MCP Authoring](#-mcp--titi-authoring) · [Quick Start](#-quick-start) · [API](#-api-reference)

</div>

---

## Why Titi?

Most LMSs are lonely. Most social networks are noisy. **Titi is both — and engineered to stay coherent.**

- Recommendations come from your **graph**, not a black-box recommender.
- The learning path is **gated and versioned** — drafts never leak, publishes are confirmed, deletes are previewed.
- The AI tutor **cannot hallucinate** outside your course: retrieval is course-scoped, answers are citation-validated, actions are blocked.
- Authoring is **MCP-native** — an AI agent can scaffold an entire course without tripping optimistic concurrency.

> **Identity:** Titi monkey mascot, palette `#FFD93D` + `#FFFBF0` + `#1A1A2E`, Nunito. Warm, university, proudly Bolivian.

---

## ✨ Features

### 🌐 Social Graph (Neo4j)

Cursor-paginated feeds, follow graph, hashtags, sounds, locations, likes/saves, nested comments, full-text search, academic feed (`INSCRITO_EN` / `COMPLETO_CURSO` traversals) and friend-based course recommendations — all as Cypher patterns, not JOIN cascades.

### 📚 Learning Platform (PostgreSQL + Prisma)

- **Catalog** — public, filterable (category/level/search), guest-browsable; real content gated by `ensureCourseContentAccess`.
- **Courses / Modules / Lessons** — ordered, lifecycle `BORRADOR → PUBLICADA → ARCHIVADA`, course-level publish/unpublish with HMAC confirmations.
- **Two lesson formats** — `MARKDOWN` (GFM + `rehype-highlight` + Mermaid) and `HTML` (self-contained `iframe srcDoc sandbox="allow-scripts"`, CSP-injected, no external network/forms/frames).
- **Evaluable HTML** — `RecursoHtmlLeccion` with `intentosMax` (1–10) + optional `fechaLimite`; `postMessage` bridge with ephemeral `attemptToken`, idempotent `html-results` transaction, best-score tracking.
- **Materials** — per-lesson uploads (pdf/word/image/code/other, 10 MB, SHA256 dedup) via Cloudinary (prod) or local disk (dev).
- **Enrollments & Progress** — idempotent `(usuarioId, cursoId)`, propagated to Neo4j `CursoRef`; per-lesson `Progreso`, course `%` + `nuevasPendientes`.
- **Notes & Discussions** — private `NotaLeccion` (5000 chars) + threaded `ComentarioLeccion` with reply notifications.
- **Evaluations** — module quizzes + final exam (`OPCION_MULTIPLE` / `VERDADERO_FALSO` / `RESPUESTA_CORTA`), server-side grading, `intentosMax`/`notaMinima`/`fechaLimite`.
- **Certificates** — auto-issued when all lessons + evaluations passed; `codigoVerif` (UUID) + public `GET /certificates/verify/:codigo`; survives course deletion via nullable `cursoId` + `cursoTitulo` snapshot.
- **Revisions** — JSON snapshot + author on every lesson edit; restore any version.

### 🧑‍🏫 Authoring Studio (REST + MCP)

Fingerprint-guarded (`expectedFingerprint` SHA), idempotent (`Idempotency-Key` → `OperacionAutoria`), version-claimed (`claimCourseVersion` / `claimModuleVersion` / `claimLessonMutation`). Preview → signed phrase + token (10 min HMAC) → publish. Deletion previews with impact graph. Quiz editors, portada uploads, material uploads, deadline edits.

### 🎮 Gamification

**Gotas (XP)** — `MovimientoGota` ledger + `gotasSaldo` (spendable) / `gotasTotal` (lifetime); learning idempotent, social capped (post 5×2/day, like 1×10/day, comment 2×5/day, follow 3×3/day). **Daily missions** — 3/day from seeded pool, reset midnight server TZ. **Weekly friends leaderboard** — Neo4j follow graph × Postgres weekly gotas, lazy prize (`InsigniaSemanal` + 50 gotas). **Streaks** — `actualizarRacha` with `startOfDay`. **Achievements** — 7 idempotent badges. **Living Titi** — `TitiMascot` WebP by state (`idle`/`celebra`/`triste`/`racha`/`saludo`/`pensando`), `prefers-reduced-motion` fallback.

### 🛒 Gotas Shop

Consumables on `gotasSaldo` (never `gotasTotal`): `congelar_racha` (~50, lazy-consumed on gap, `limiteStack:3`), `intento_extra` (~80, `usarIntentoExtra:true` on blocked attempt), `multiplicador_gotas` (~100, 2× for 1h via `gotasMultiplicadorHasta`). `ItemTienda` / `CompraItem` / `InventarioItem`, `POST /shop/buy` + `POST /shop/use`.

### 👤 Profiles, Roles & Access

JWT + `bcrypt`, dual-DB mirror via `Usuario.neoId`, `PUT /users/me` (avatar/banner/bio via Cloudinary), roles `ESTUDIANTE → PROFESOR (verificado) → ADMIN` with `requireRole` / `isOwnerOrAdmin` guards. Guest catalog via `GuestShell.jsx`. Admin panel (`/admin/*`) — users, courses, categories, stats, RAG.

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
   social graph    educational + gamification + pgvector
        │                │
        └──────► Cloudinary ◄──────┘
                 (images & materials)
```

**Golden rules**

1. **API contract:** `{ success: true, data }` / `{ success: false, message }` (Spanish).
2. **External services never break the main operation** — Neo4j & Cloudinary are `try/catch`, log and continue (`docs/architecture.md:42`).
3. **Dual-DB source of truth:** social → Neo4j; educational + gotas + RAG → Postgres (propagated to Neo4j via `neo4j-sync.service.js` for `CursoRef` / `INSCRITO_EN` / `COMPLETO_CURSO`).
4. **Flat UI:** no `bg-gradient-*` / `blur-*`. Mascot always `<TitiMascot>`.
5. **Conventional commits (Spanish)**, `abdair-coca <cocaabdair@gmail.com>`, no `Co-Authored-By`.

### Dual-DB Bridge

JWT carries Neo4j `Usuario.id` (`req.user.id`). Postgres mirror `Usuario.neoId` links them. Standard loader for any authenticated Postgres route:

```js
const usuario = await prisma.usuario.findUnique({ where: { neoId: req.user.id } });
```

| Operation | Source of Truth | Replication |
|---|---|---|
| User registration | Neo4j | Mirror in `Usuario` via `neoId` |
| Inscription | Postgres | `(:Usuario)-[:INSCRITO_EN]->(:CursoRef)` |
| Course completed | Postgres | `(:Usuario)-[:COMPLETO_CURSO]->(:CursoRef)` + follower notif |
| Post / like / follow | Neo4j | None |

Full model, constraints, invariants and sync matrix → [`docs/architecture.md`](docs/architecture.md).

### Stack

| Layer | Tech |
|---|---|
| **Frontend** | React 18, Vite 5, Tailwind 3, React Router v6, Axios, GSAP, `react-markdown` + `rehype-highlight` + `mermaid` |
| **Backend** | Node 20, Express 5, Prisma 5, `neo4j-driver`, `jsonwebtoken`, `bcrypt`, `multer`, `cloudinary` |
| **Databases** | Neo4j Aura (social) + PostgreSQL Neon + `pgvector` (RAG) |
| **Storage** | Cloudinary (prod) + local disk fallback (dev) |
| **AI** | EmbeddingGemma 300M (768d) + Groq (chat) + Cloudflare AI Gateway (optional) |
| **MCP** | `titi-authoring` — course authoring via Model Context Protocol |
| **Tests** | Vitest + Supertest (hermetic — DBs mocked) |
| **Deploy** | Render (backend) + Vercel (frontend) |

---

## 🧠 RAG System — Grounded AI Tutor

Titi's tutor is **retrieval-first, citation-enforced, action-blocked**. It never answers outside your course.

![Tutor Panel](docs/screenshots/tutor.png)
*Tutor IA — side panel (desktop) & bottom sheet (mobile), grounded citations. Replace `docs/screenshots/tutor.png` with your capture.*

### Pipeline

```
Lesson (titulo + contenido + RecursoHtmlLeccion.html)
  → extractLessonHtmlContent()          # DOM + data-*/alt/aria-label + <script> JSON + JS string literals
  → lessonRagText()                     # normalize + join
  → chunkText(900, overlap 120)         # deterministic windowing
  → createEmbedding(chunk, {kind:'document', title})  # local or Cloudflare Workers AI
  → formatVector() → pgvector vector(768)
  → DocumentoRag + FragmentoRag (transactional swap)
```

**`html-extractor.service.js:17`** — `CODE_EXCLUDE_TOKENS` blocklist (`addEventListener`, `postMessage`, …) + `isNaturalLanguageText` filter prevents indexing boilerplate JS/CSS as knowledge.

**`rag.service.js:193`** — `lessonRagText` is the single source for indexing: `titulo + contenido + extracted HTML`. No notes, progress or PII ever indexed.

### Storage

```prisma
model DocumentoRag {
  leccionId     String
  version       Int
  estado        EstadoDocumentoRag // PENDIENTE | LISTO | FALLIDO
  activo        Boolean
  hashContenido String             // SHA256 of lessonRagText
  modelo        String             // embedding model
  fragmentos    FragmentoRag[]
  @@unique([leccionId, version])
}
model FragmentoRag {
  documentoId String
  orden       Int
  contenido   String
  embedding   Unsupported("vector(768)")
  @@unique([documentoId, orden])
}
```

Only `activo=true AND estado=LISTO AND leccion.estado=PUBLICADA AND modulo.estado=PUBLICADO AND curso.publicado=true` are retrievable (`rag.service.js:475`).

### Indexing

- `indexLesson(lessonId)` — gates: unpublished → `SKIPPED`, feature-disabled (`RAG_ENABLED` + `RAG_COURSE_IDS=*|list`) → `SKIPPED feature_disabled`, empty → `SKIPPED empty`, same `hash+model` + `LISTO` → `UNCHANGED` (dedup). On embedding failure → `FALLIDO` + throw. On success → transactional deactivate old docs + `INSERT …::vector` + `LISTO`.
- `indexCourse(courseId)` — sequential `indexLesson` over all published lessons, per-lesson `FAILED` capture.
- `scheduleLessonIndex` / `scheduleCourseIndex` — `setImmediate` fire-and-forget on `PUT /lessons/:id`, `POST /lessons/:id/publish`, `POST /lessons/:id/html` (authoring).
- Manual: `POST /admin/rag/courses/:courseId/reindex` (creator/professor/ADMIN, course-enabled else 409).

### Retrieval

```sql
SELECT f.contenido, l.titulo, m.titulo,
       1 - (f.embedding <=> $embedding::vector) AS similarity
FROM "FragmentoRag" f
JOIN "DocumentoRag" d ON d.id = f."documentoId"
JOIN "Leccion" l ON l.id = d."leccionId"
JOIN "Modulo" m ON m.id = l."moduloId"
WHERE c.id = $courseId AND d.activo AND d.estado='LISTO' …
ORDER BY f.embedding <=> $embedding::vector LIMIT 5
```

Lesson-prioritized: `RAG_LESSON_PRIORITY_LIMIT` (default = `LIMIT`) splits `only(currentLesson)` + `exclude(currentLesson)` fills remainder (`rag.service.js:487`).

### Generation

`requireChatConfig()` resolves three modes:

| Mode | Env | Endpoint |
|---|---|---|
| `direct` (local/staging) | `RAG_CHAT_MODE=direct` | `GROQ_API_URL` + `GROQ_API_KEY` |
| `gateway` (self-hosted) | `RAG_CHAT_MODE=gateway` + `AI_GATEWAY_URL/TOKEN` | `AI_GATEWAY_URL/v1/chat/completions` |
| `cloudflare_gateway` | `AI_PROVIDER_ROUTE=cloudflare_gateway` | `gateway.ai.cloudflare.com/v1/{account}/{gateway}/groq/chat/completions` |

Production blocks `direct` — requires `gateway` or `cloudflare_gateway` (`rag.service.js:124`). Context is wrapped as **untrusted data** with `<<<RETRIEVED_SOURCE>>>` delimiters; system prompt enforces `temperature:0.2`, citations `[1]`… only from retrieved numbers, `NO_EVIDENCE_ANSWER` fallback, no tool calling.

### Safety

`rag.security.js` — `detectPromptInjection` (10 injection patterns), `isBlockedActionRequest` (grade/progress/inscription/SQL), `validateGroundedAnswer` (missing/out-of-context citation → `NO_EVIDENCE_ANSWER`), `ChatRateLimiter` (5/min, 30/day per `opaquePrincipalId` = `sha256(salt:usuarioId)`), `securityEvent` logging without storing full prompts. `docs/rag-security.md` is the living reference.

### Gating & Admin

`RAG_ENABLED` + `RAG_COURSE_IDS` + `RAG_ALLOWED_USER_EMAIL` gate both `GET /lessons/:id/chat/status` and `POST /lessons/:id/chat`. `pages/admin/AdminRag.jsx` + `routes/admin-rag.js` — published course selector, paginated lesson table (`page`/`pageSize`/`courseId`/`status`/`search`), per-lesson `indexLesson` and course `indexCourse` with `force` flag, KPIs.

---

## 🔌 MCP — titi-authoring

Titi ships a **Model Context Protocol** server that lets an AI agent author courses without fighting the REST concurrency model. This is not a toy wrapper — it encodes the hard-won rules that prevent `412`/`409`/`500`.

### Why MCP?

The authoring REST API is deliberately strict: every mutation needs a fresh `expectedFingerprint` and an `Idempotency-Key`, publishes need a separate preview, and quizzes cap at 4 questions per transaction (Neon/PgBouncer limit). An LLM calling raw `curl` will trip constantly. The MCP **bakes those rules into tools** so the agent gets it right by construction.

### Tools

| Category | Tool | What it does |
|---|---|---|
| **Read** | `list_courses` | Courses owned by the service-token author |
| | `list_categories` | Available `categoriaId` values |
| | `get_course` | Full snapshot + fingerprints (heavy — only when content needed) |
| | `get_quiz_analytics` | Privacy-preserving aggregate analytics |
| **Cheap read** | `get_course_fingerprints` | Only `{ fingerprint, publicationFingerprint, resources }` |
| | `get_module_fingerprints` | Only module-level fingerprints |
| **Writes** | `create_course_draft` / `update_course_draft` | Course CRUD (never publishes) |
| | `create_module_draft` / `update_module_draft` | Module CRUD (draft only) |
| | `create_lesson_draft` / `update_lesson_draft` | Lesson CRUD (`MARKDOWN` default, `HTML` for presentations) |
| | `upsert_lesson_html` | Create/replace HTML presentation (`html` + `evaluable` + `intentosMax` + `fechaLimite`) |
| | `upsert_quiz_draft` | Create/replace module quiz (max 4 questions per call) |
| | `attach_material` | Attach file to lesson (explicit `filePath`, never scans dirs) |
| | `delete_draft_resource` | Delete one draft resource by fingerprint |
| **Publish** | `preview_course_publication` / `preview_module_publication` | Returns human phrase + signed token + fingerprint (does not publish) |
| | `publish_course` / `publish_module` | Publishes only with phrase+token+fingerprint from a recent separate preview |
| | `preview_module_unpublish` / `unpublish_module` | Draft-rollback for published modules |

Full workflow, golden rules and error table → [`.claude/skills/titi-authoring/SKILL.md`](.claude/skills/titi-authoring/SKILL.md).

### Golden Rules (what the README must not let you forget)

1. **Fresh fingerprint before every write** — each write bumps `curso.version` + `modulo.version`; stale fingerprint → `412`. Use `get_course_fingerprints` / `get_module_fingerprints` (cheap) between writes, not `get_course`.
2. **Right resource fingerprint** — module writes need module fingerprint, lesson writes need lesson fingerprint, etc. (`SKILL.md:62`).
3. **Idempotency** — every write takes `idempotencyKey` (UUID); reuse on timeout. MCP auto-generates if omitted.
4. **Preview ≠ publish** — `preview_*` then human-verified `publish_*` with phrase+token+fingerprint. Never chain in one call.
5. **Quiz cap 4** — `upsert_quiz_draft` with 5+ questions → `500` (PgBouncer). Split large quizzes.
6. **Draft-only edits** — published modules are immutable; `unpublish_module` first.

### Typical Token-Saving Sequence

```
1. list_courses → list_categories
2. get_course_fingerprints              # cheap, not get_course
3. WRITE 1 (idempotencyKey + expectedFingerprint of that resource)
4. get_module_fingerprints              # refresh — version bumped
5. WRITE 2 … repeat
6. get_course (only if full content needed)
7. preview_*_publication → human verify phrase/token/fingerprint → publish_*
```

### Example — Create a Course via MCP

```js
// 1. Cheap fingerprint read
const { fingerprint } = await mcp.get_course_fingerprints({ courseId });

// 2. Create module (needs course fingerprint)
await mcp.create_module_draft({
  courseId, expectedFingerprint: fingerprint,
  titulo: "Módulo 1 — Fundamentos", orden: 1,
  idempotencyKey: crypto.randomUUID(),
});

// 3. Refresh, then create lesson (needs module fingerprint)
const { resources } = await mcp.get_module_fingerprints({ moduleId });
await mcp.create_lesson_draft({
  moduleId, expectedFingerprint: resources[moduleId].module,
  titulo: "Introducción", contenido: "# Hola Titi", orden: 1,
  idempotencyKey: crypto.randomUUID(),
});
```

---

## 📸 Screenshots

> Drop your captures into `docs/screenshots/` — these three are the ones that matter for a technical reader.

| File | View |
|---|---|
| `docs/screenshots/learn.png` | LearnCourse — 3-column layout + side rail + Tutor IA |
| `docs/screenshots/tutor.png` | RAG tutor — grounded answer with citations |
| `docs/screenshots/admin-rag.png` | Admin RAG — course filter, lesson table, KPIs, forced reindex |

![Learn](docs/screenshots/learn.png)
*Learn view — lesson index, Markdown/HTML content, notes/materials/comments rail.*

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
npm run seed                  # demo data (courses, achievements, shop items, demo users)
npm run dev                   # http://localhost:3001
```

### 2. Frontend

```bash
cd ../frontend
cp .env.example .env          # VITE_API_URL=http://localhost:3001
npm install
npm run dev                   # http://localhost:5173
```

Open `http://localhost:5173` and sign in:

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
EMBEDDING_PROVIDER=local         # or cloudflare
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_AI_API_TOKEN=
GROQ_API_KEY=
GROQ_MODEL=
AI_PROVIDER_ROUTE=legacy         # or cloudflare_gateway
CLOUDFLARE_AI_GATEWAY_ID=
CLOUDFLARE_AI_GATEWAY_TOKEN=
RAG_CHAT_MODE=direct             # direct | gateway | disabled
RAG_PRINCIPAL_SALT=local-staging-salt
```

**`frontend/.env`**

```bash
VITE_API_URL=http://localhost:3001
```

---

## 📖 API Reference

**Convention:** `{ success: true, data }` / `{ success: false, message }` (Spanish). Codes: 200/201 · 400 · 401 · 403 · 404 · 409 · 500.

| Group | Endpoints |
|---|---|
| **Auth** | `POST /api/auth/register` → `{user,token}` · `POST /login` · `GET /me` |
| **Social (Neo4j)** | `GET /users/me` · `GET /users/:username` · `POST /users/:username/follow\|unfollow` · `GET /posts/feed` (cursor) · `GET /posts/explore` · `POST /posts` (multipart) · `POST /posts/:id/like\|save` · `POST /comments` · `GET /notifications` · `GET /search` |
| **Courses** | `GET /api/courses?categoria=&nivel=&search=` · `GET /:id` · `POST /` (PROFESOR verificado) · `PUT /:id` · `DELETE /:id` (409 if enrollments) · `POST /:id/enroll` · `GET /:id/progress` · `GET /my/enrolled\|teaching` · `GET /recommended` |
| **Modules / Lessons** | `POST /courses/:id/modules` · `PUT /modules/:id` · `GET /modules/:id/lessons` · `POST /modules/:id/lessons` · `GET /lessons/:id` · `POST /lessons/:id/complete` · `GET /lessons/:id/note` · `PUT /lessons/:id/note` · `GET /lessons/:id/comments` |
| **Materials** | `POST /lessons/:id/materials` (multipart, 10 MB) · `DELETE /materials/:id` |
| **Evaluations** | `POST /modules/:id/evaluation` · `POST /courses/:id/final-evaluation` · `GET /evaluations/:id` · `POST /evaluations/:id/attempt` (server-side grading) |
| **Progress** | `GET /progress/streak` · `GET /progress/achievements` · `GET /progress/certificates` · `GET /progress/certificates/verify/:codigo` (public) |
| **Gamification** | `GET /gotas` · `GET /gotas/history` · `GET /missions/today` · `GET /ranking/friends` |
| **Shop** | `GET /shop/items` · `GET /shop/inventory` · `POST /shop/buy` · `POST /shop/use` |
| **HTML Lessons** | `GET /lessons/:id/html` (auth, no public URL) · `POST /lessons/:id/html-attempts` · `POST /lessons/:id/html-results` (`{score, attemptToken}`) |
| **RAG Tutor** | `GET /lessons/:id/chat/status` · `POST /lessons/:id/chat {message}` → `{answer, citations, usage}` · `POST /admin/rag/courses/:courseId/reindex` |
| **Admin RAG** | `GET /admin/rag/courses` · `GET /admin/rag/lessons?page=&pageSize=&courseId=&status=&search=` · `POST /admin/rag/lessons/:id/reindex` · `POST /admin/rag/courses/:courseId/reindex?force=true` · `POST /admin/rag/search {query, courseId}` |
| **Authoring** | See MCP section — `POST /authoring/courses`, `PUT /authoring/courses/:id`, `POST /authoring/courses/:id/modules`, `PUT /authoring/modules/:id`, `POST /authoring/modules/:id/lessons`, `PUT /authoring/lessons/:id`, `POST /authoring/lessons/:id/publish\|archive\|restore`, `GET /authoring/lessons/:id/revisions`, `POST /authoring/lessons/:id/html`, `PUT /authoring/lessons/:id/html-deadline`, `POST /authoring/lessons/:id/materials`, `POST /authoring/courses/:id/preview-publication` → `publish`, etc. All require `Idempotency-Key` + `expectedFingerprint`. |
| **Admin** | `GET /admin/users` · `PUT /admin/users/:id/verify|role` · `GET /admin/courses` · `DELETE /admin/courses/:id` (forced) · `GET /admin/stats` · `POST /admin/categories` |

Full catalog → [`docs/api.md`](docs/api.md).

---

## 🧪 Tests

Hermetic — Postgres & Neo4j are mocked, so CI needs no real Aura or Cloudinary.

```bash
cd backend
npm test                # vitest run
npm run test:coverage   # v8 coverage report
npm run lint            # eslint (real errors, not style)
```

Covers auth, posts, courses, evaluations (server-side grading), gotas, missions, ranking, shop, admin guards, RAG indexing/retrieval/security, plus unit tests for streak/achievement/gotas/shop.

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

`FRONTEND_URL` controls CORS: localhost always allowed; add production + preview URLs comma-separated.

**Live:** `https://titiedu.vercel.app` · `https://titi-backend.onrender.com`

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
                        ranking, shop, admin, rag, admin-rag, authoring
    services/           upload (Cloudinary), neo4j-sync, progress (streak),
                        achievement, gotas, mision, ranking, tienda,
                        rag (+ security), html-extractor, deadline,
                        content-deletion, authoring (+ idempotency)
  prisma/
    schema.prisma       models + indexes + enums
    migrations/         versioned migrations (incl. pgvector)
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
                        DailyMissions, Leaderboard, ItemCard, …
    pages/              Feed, Explore, Profile, Notifications, HashtagFeed,
                        Login, Register, Courses, CourseDetail, LearnCourse,
                        MyCourses, Certificates, Leaderboard, Shop,
                        teacher/*, admin/* (Dashboard, Users, Courses, Categories, Rag)
  design.md / motion.md / agent.md
```

---

## 📖 Documentation

| Doc | When to read |
|---|---|
| [`docs/architecture.md`](docs/architecture.md) | Dual-DB, auth, models, sync, invariants |
| [`docs/api.md`](docs/api.md) | REST endpoint catalog |
| [`docs/conventions.md`](docs/conventions.md) | Code patterns, naming, versioning, glossary |
| [`docs/roadmap.md`](docs/roadmap.md) | Stage history + live plan |
| [`docs/rag-security.md`](docs/rag-security.md) | RAG security (living reference) |
| [`docs/specs/README.md`](docs/specs/README.md) | SDD workflow |
| [`.claude/skills/titi-authoring/SKILL.md`](.claude/skills/titi-authoring/SKILL.md) | MCP authoring — golden rules |
| `frontend/design.md` | Design system |
| `frontend/motion.md` | Motion + mascot spec |

---

## 🗺️ Roadmap

| Stage | Tag | Shipped |
|---|---|---|
| 1 — Social | `v0.1.0` | Auth/JWT, feed, explore, profiles, posts, nested comments, search, notifications |
| 2 — Educational | `v0.2.0` | Postgres+Prisma, course/module/lesson/material CRUD, enrollments, categories |
| 3 — Evaluations & Progress | `v0.3.0` | Server-side grading, streaks, 7 achievements, certificates |
| 4 — Social + Admin | `v0.4.0` | `CursoRef` propagation, academic feed, friend recommendations, admin panel |
| 5 — Polish & Deploy | `v1.0.0` | Cloudinary, cursor pagination, indexes, hermetic tests, CI/CD, public deploy |
| 6 — Gamification + Living Titi | `v2.0.0` | Gotas + ledger + caps, daily missions, weekly friends leaderboard, animated mascot |
| 7 — Gotas Shop | `v3.0.0` | Consumables (`congelar_racha`, `intento_extra`, `multiplicador_gotas`) |
| — | — | Side tracks: guest catalog, authoring studio, interactive HTML, RAG v1, 3-col Learn |

---

## 🔒 Security Notes

- JWT in `Authorization: Bearer …` only.
- Authoring confirmations HMAC-signed with `AUTHORING_CONFIRMATION_SECRET` (never `JWT_SECRET`), 10 min expiry.
- RAG: no tool calling, no business-API access from LLM, grounded citations only, prompt-injection + blocked-action detection, rate limiting, opaque principal IDs.
- HTML lessons: self-contained, inline/data-URI only, CSP injected, `sandbox="allow-scripts"` iframe, no public URL.
- Uploads: 10 MB, type-validated, SHA256 tracked.

---

## 📄 License

University project — all rights reserved. Built with care in Bolivia.

<div align="center">

**Made with 💛 by [abdair-coca](https://github.com/abdair-coca) · Powered by Titi 🐒**

*Learning is better together.*

</div>
