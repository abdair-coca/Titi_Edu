<div align="center">

<img src="docs/banner.png" alt="Titi banner" width="100%" />

# Titi

**A Bolivian university network where learning is social.**

Titi joins a social network (feed, friends, posts) and a course platform (lessons, quizzes, certificates) in one app. What you learn shows up in your network, and what your network learns shapes what you see next.

[![Live](https://img.shields.io/badge/Live-titiedu.vercel.app-FFD93D?style=for-the-badge&logo=vercel&logoColor=1A1A2E)](https://titiedu.vercel.app)
[![API](https://img.shields.io/badge/API-titi--backend.onrender.com-1A1A2E?style=for-the-badge&logo=render&logoColor=white)](https://titi-backend.onrender.com)

</div>

---

## Why Titi exists

Most learning platforms are lonely: you study by yourself and nobody notices. Most social networks are noise: lots of scrolling, nothing learned. Titi puts both in one place, so studying becomes something you do with your friends.

- **Your friends are your recommendations.** You see which courses your friends are taking and finishing. Suggestions come from your social graph, not from a black box.
- **Progress is public and rewarded.** Finishing a lesson earns *gotas* (drops, Titi's XP), keeps your streak alive and shows up in your friends' feed.
- **The AI tutor only knows your course.** It answers from the lesson material, cites its sources, and helps you practice without giving away quiz answers.
- **It feels like home.** Titi, a Bolivian titi monkey, is the mascot and guide. The palette is warm yellow `#FFD93D`, cream `#FFFBF0` and dark `#1A1A2E`, set in Nunito.

## What you can do

**As a student**

- Follow classmates, post, like, comment and get notifications.
- Browse the course catalog, even without an account, and enroll.
- Learn with Markdown or interactive HTML lessons, notes and threaded lesson discussions.
- Take module quizzes and final exams, graded on the server, and earn a verifiable certificate.
- Ask the AI tutor about the current lesson; it answers with citations.
- Earn gotas, complete daily missions, keep your streak and climb the weekly ranking among your friends.
- Spend gotas in the shop: protect your streak, get an extra quiz attempt or double your gotas for an hour.

**As a teacher**

- Create courses, modules and lessons, as drafts until you publish.
- Write quizzes, upload materials and set deadlines for evaluable HTML activities.
- Track your students' grades per course.
- Author whole courses with an AI agent through the `titi-authoring` MCP server.

<p align="center">
  <img src="docs/screenshots/feed.png" alt="Feed" width="32%" />
  <img src="docs/screenshots/explore.png" alt="Explore" width="32%" />
  <img src="docs/screenshots/profile.png" alt="Profile" width="32%" />
</p>

## How it works

Titi stores each kind of data in the database that suits it best:

- **Social (Neo4j):** follows, posts and likes are naturally a graph. "Courses my friends finished" is a short Cypher traversal instead of a chain of joins.
- **Education and gamification (PostgreSQL):** courses, progress, grades and gotas need transactions and strict integrity, so they live in Postgres through Prisma. Lesson embeddings for the tutor are stored there too, with `pgvector`.

```
React 18 + Vite + Tailwind + GSAP          (Vercel)
        │  REST + JWT
        ▼
Express 5 on Node 20                       (Render)
        │                     │
        ▼                     ▼
Neo4j Aura                 PostgreSQL + Prisma + pgvector
social graph               courses, progress, gotas, AI tutor
        └────────► Cloudinary ◄────────┘
                   images and materials
```

Every user exists in both databases, linked by `Usuario.neoId`. The JWT carries the Neo4j id, and Postgres routes resolve the user from it. Enrollments and finished courses are written to Postgres first and then mirrored to Neo4j, so they can feed social recommendations. The full model is in [`docs/architecture.md`](docs/architecture.md).

**The AI tutor** retrieves fragments only from the current course, combining vector and full-text search with a reranker. It answers through Groq with each user's own API key (BYOK), and the server checks every citation. Prompt injection and attempts to trigger actions are blocked. Details: [`docs/rag-security.md`](docs/rag-security.md).

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 5, Tailwind 3, React Router 6, Axios, GSAP, Three.js |
| Backend | Node 20, Express 5, Prisma 5, `neo4j-driver`, JWT, bcrypt, multer |
| Data | Neo4j Aura (social graph), PostgreSQL on Supabase with `pgvector` |
| AI | Cloudflare Workers AI (embeddings and reranker), Cloudflare AI Gateway, Groq |
| Storage | Cloudinary, with a local disk fallback in development |
| Tests | Vitest + Supertest, hermetic (databases mocked) |
| Deploy | Render (backend, autodeploy from `main`) and Vercel (frontend) |

## Run it locally

**Requirements:** Node 20+, a PostgreSQL database and a Neo4j database (local or [Aura free](https://neo4j.com/cloud/aura/)). Cloudinary is optional in development.

```bash
# Backend: http://localhost:3001
cd backend
cp .env.example .env          # fill DATABASE_URL, NEO4J_*, JWT_SECRET
npm install
npx prisma migrate deploy
npm run seed                  # demo courses, achievements, shop items and users
npm run dev

# Frontend: http://localhost:5173
cd ../frontend
cp .env.example .env          # VITE_API_URL=http://localhost:3001
npm install
npm run dev
```

Demo accounts (password `titi1234`, or `SEED_PASSWORD` if you set it):

| Role | Email |
|---|---|
| Teacher | `profesor.demo@titi.local` |
| Admin | `admin_demo@titi.local` |

> Point `.env` at your own databases. `migrate` and `seed` write to whatever `DATABASE_URL` and `NEO4J_*` point to.

## Tests

```bash
cd backend
npm test        # Vitest, with Postgres and Neo4j mocked
npm run lint
```

CI (`.github/workflows/ci.yml`) runs backend lint and tests plus the frontend build on every push and pull request to `main`. `backend/test/adversarial/` holds the adversarial regression suite for login and registration.

## Documentation

| Doc | What it covers |
|---|---|
| [`AGENTS.md`](AGENTS.md) | Entry point for contributors and AI agents: rules, current state, change index |
| [`docs/architecture.md`](docs/architecture.md) | Dual database, auth, models, sync rules |
| [`docs/api.md`](docs/api.md) | REST endpoint catalog |
| [`docs/conventions.md`](docs/conventions.md) | Code patterns, naming, versioning, glossary |
| [`docs/roadmap.md`](docs/roadmap.md) | Stage history and live plan |
| [`docs/rag-security.md`](docs/rag-security.md) | AI tutor security |
| [`docs/specs/README.md`](docs/specs/README.md) | How features are specified and tracked |
| [`frontend/design.md`](frontend/design.md) | Visual design system |
| [`.claude/skills/titi-authoring/SKILL.md`](.claude/skills/titi-authoring/SKILL.md) | Authoring courses through MCP |

## Roadmap

| Stage | Tag | Shipped |
|---|---|---|
| 1. Social | `v0.1.0` | Auth, feed, profiles, posts, comments, search, notifications |
| 2. Education | `v0.2.0` | Courses, modules, lessons, materials, enrollments |
| 3. Evaluations | `v0.3.0` | Server-side grading, streaks, achievements, certificates |
| 4. Social learning | `v0.4.0` | Academic feed, friend-based recommendations, admin panel |
| 5. Release | `v1.0.0` | Cloudinary, pagination, hermetic tests, CI, public deploy |
| 6. Gamification | `v2.0.0` | Gotas, daily missions, weekly ranking, animated mascot |
| 7. Shop | `v3.0.0` | Consumables bought with gotas |
| Course catalog | `v4.0.0` | Redesigned `/courses` with a 3D study room and curated rows |

## License

University project. All rights reserved. Built in Bolivia by [abdair-coca](https://github.com/abdair-coca).

<div align="center">

*Learning is better together.*

</div>
