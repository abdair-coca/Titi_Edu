<div align="center">

<img src="docs/banner.png" alt="Titi banner" width="100%" />

<br/><br/>

# 🐒 Titi

**Plataforma educativa social full-stack — Neo4j + PostgreSQL + React 18**

Una red social de aprendizaje: cursos con módulos, lecciones, evaluaciones y
certificados, montados sobre un feed social con seguidores, posts, logros y
recomendaciones. La parte social vive en un grafo (Neo4j); la educativa, en una
base relacional (PostgreSQL). Las dos se sincronizan con un espejo de usuario.

[![Node](https://img.shields.io/badge/Node-20+-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind](https://img.shields.io/badge/Tailwind-3-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![Neo4j](https://img.shields.io/badge/Neo4j-Aura-008CC1?logo=neo4j&logoColor=white)](https://neo4j.com/cloud/aura/)
[![Postgres](https://img.shields.io/badge/PostgreSQL-Prisma-4169E1?logo=postgresql&logoColor=white)](https://www.prisma.io)
[![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)](https://expressjs.com)

[Quick start](#-quick-start) · [Arquitectura](#-arquitectura) · [Tests](#-tests) · [Deploy](#-deploy) · [Estructura](#-estructura-del-repo)

</div>

---

## 🧠 Por qué dos bases de datos

Titi mezcla dos dominios con formas de consulta distintas:

- **Social (Neo4j)** — feed personalizado, seguidores, hashtags, recomendaciones,
  notificaciones. Son recorridos de grafo que en Cypher quedan como patrones
  `MATCH` legibles en vez de cascadas de JOINs.
- **Educativo (PostgreSQL vía Prisma)** — cursos, módulos, lecciones, materiales,
  evaluaciones, inscripciones, progreso y certificados. Datos tabulares con
  integridad referencial fuerte.

Cada usuario existe en ambas: el nodo `Usuario` en Neo4j y la fila `Usuario` en
Postgres, ligados por `Usuario.neoId`. El JWT lleva el id de Neo4j; el código
resuelve el usuario de Postgres por `neoId` cuando lo necesita.

```cypher
// Feed académico: actividad de cursos de la gente que sigo
MATCH (yo:Usuario {id: $userId})-[:SIGUIO]->(amigo:Usuario)-[r:INSCRITO_EN]->(ref:CursoRef)
RETURN amigo.username, ref.cursoId, r.fechaInscripcion
ORDER BY r.fechaInscripcion DESC
```

---

## 🚀 Quick start

Requisitos: **Node 20+**, una base **PostgreSQL** y una **Neo4j** (local o
[Aura](https://neo4j.com/cloud/aura/) gratis). Cloudinary es opcional en dev
(sin credenciales, las subidas caen a disco local).

```bash
git clone <repo-url> titi && cd titi
```

### 1. Backend

```bash
cd backend
cp .env.example .env          # completá DATABASE_URL, NEO4J_*, JWT_SECRET
npm install
npx prisma migrate deploy     # crea el schema en Postgres
npm run seed                  # datos demo (cursos, logros, feed académico)
npm run dev                   # http://localhost:3001
```

### 2. Frontend

```bash
cd ../frontend
cp .env.example .env          # VITE_API_URL=http://localhost:3001
npm install
npm run dev                   # http://localhost:5173
```

Listo. Abrí `http://localhost:5173` y entrá con una cuenta demo:

| Cuenta | Email | Password |
|---|---|---|
| Profesor | `profesor.demo@titi.local` | `titi1234` |
| Admin | `admin_demo@titi.local` | `titi1234` |

> El password demo se puede cambiar con `SEED_PASSWORD` en `backend/.env`.

---

## 🏗️ Arquitectura

```
┌──────────────┐        HTTPS/JSON        ┌──────────────────────────┐
│   Frontend   │ ───────────────────────► │         Backend          │
│  React 18    │   { success, data }      │      Express 5 (Node)     │
│  Vite +      │ ◄─────────────────────── │                          │
│  Tailwind 3  │                          │  ┌────────┐  ┌─────────┐ │
│  GSAP motion │                          │  │ Prisma │  │ neo4j-  │ │
└──────────────┘                          │  │ client │  │ driver  │ │
       ▲                                  │  └───┬────┘  └────┬────┘ │
       │ Vercel                           └──────┼───────────┼──────┘
       │                                         ▼           ▼
       │                                  ┌───────────┐ ┌──────────┐
       │                                  │ PostgreSQL│ │  Neo4j   │
       │                                  │ (Railway) │ │ (Aura)   │
       │                                  └───────────┘ └──────────┘
       │                                         │
       │                                  ┌──────▼──────┐
       └──────────── imágenes ───────────►│ Cloudinary  │
                                          └─────────────┘
```

- **Servicios externos en `try/catch`**: Neo4j y Cloudinary nunca rompen la
  respuesta principal — si fallan, loguean y siguen.
- **Storage**: posts y materiales suben a Cloudinary (`upload.service.js`). Sin
  credenciales, fallback a disco local en dev.
- **Paginación**: feed y explore son cursor-based por `createdAt`
  (`?cursor=&limit=`), con scroll infinito en el frontend.

---

## 🎮 Gamificación

Un loop diario para enganchar, todo **entre amigos** (sin presión de extraños):

- **Gotas (XP):** se ganan al **aprender** (lección +10, evaluación +20, curso +50)
  y por **actividad social** (post, like, comentario, follow) con **topes diarios**
  anti-farmeo. El aprendizaje es idempotente (una lección no paga dos veces). Hay un
  ledger (`MovimientoGota`) + saldo/total denormalizados en `Usuario`. El saldo se
  acumula para una tienda futura (aún sin tienda).
- **Misiones diarias:** 3 por día desde un pool, resetean a medianoche, otorgan gotas
  al completarse. Avanzan con eventos reales (lección, evaluación, post, comentario).
- **Ranking de amigos (semanal):** leaderboard de gotas de la semana cruzando el
  follow-graph de Neo4j con las gotas de Postgres. Reinicia los lunes; el #1 de su
  grupo recibe un bonus + insignia (cálculo lazy al primer acceso de la semana nueva).
- **Titi vivo:** la mascota es WebP animado por estado (`idle`, `celebra`, `triste`,
  `racha`…), reacciona a los eventos (ganar gotas → Titi celebra) y respeta
  `prefers-reduced-motion`. Ver `frontend/animationTiti.md`.

Endpoints: `GET /api/gotas`, `/api/gotas/history`, `/api/missions/today`,
`/api/ranking/friends`. Detalle de la economía en
[`docs/architecture.md`](docs/architecture.md).

## 🧪 Tests

Suite hermética (Vitest + supertest): Postgres y Neo4j están **mockeados**, así
que corre en CI sin Aura ni Cloudinary reales.

```bash
cd backend
npm test                # vitest run
npm run test:coverage   # con reporte de cobertura
npm run lint            # eslint (errores reales, no estilo)
```

Cubre los flujos críticos y los rechazos importantes (401/403/409): `auth`,
`posts`, `courses`, `evaluations` (calificación server-side) y el guard de
`admin`, más unit tests de los servicios de racha y logros. Objetivo de
cobertura: **≥30%** en `routes/` + `services/`.

CI (`.github/workflows/ci.yml`): cada PR a `main` corre lint + tests del backend
y build del frontend. Un check rojo bloquea el merge.

---

## ☁️ Deploy

| Capa | Plataforma | Notas |
|---|---|---|
| Backend | **Railway** | Postgres administrado + `prisma migrate deploy` en el release (`railway.json`) |
| Frontend | **Vercel** | `vercel.json` con rewrite SPA; setear `VITE_API_URL` al backend |
| Neo4j | **Aura** | `NEO4J_URI/USER/PASSWORD` |
| Imágenes | **Cloudinary** | `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET` |

**Variables de entorno (backend):** `DATABASE_URL`, `NEO4J_URI`, `NEO4J_USER`,
`NEO4J_PASSWORD`, `JWT_SECRET`, `FRONTEND_URL` (admite varias URLs separadas por
coma para previews de Vercel), `CLOUDINARY_*`. Ver `backend/.env.example`.

`FRONTEND_URL` controla CORS: localhost siempre está permitido; agregá ahí el
dominio de producción y los previews.

---

## 📂 Estructura del repo

```
backend/
  src/
    app.js            Express app (rutas + middleware) — exportada para tests
    index.js          arranque del servidor (listen + constraints Neo4j)
    db.js             driver Neo4j + runQuery + índices/constraints
    prisma.js         PrismaClient
    routes/           auth, posts, courses, modules, lessons, materials,
                      evaluations, progress, admin, search, ...
    services/         upload (Cloudinary), neo4j-sync, progress (racha),
                      achievement (logros)
    middleware/       auth (JWT)
  prisma/
    schema.prisma     modelos + índices
    migrations/       migraciones versionadas
    seed.js           seed idempotente (cursos, logros, feed académico demo)
  test/               vitest + supertest (services + routes)
frontend/
  src/
    pages/            Feed, Explore, Courses, Learn, perfil, admin, teacher...
    components/       PostCard, CreatePost, EvaluationQuiz, TitiMascot...
    lib/              motion (GSAP), format (resolveMediaUrl)
    api/              cliente axios con interceptor de JWT
.github/workflows/ci.yml   lint + tests + build en cada PR
```

---

## 🛠️ Stack

**Backend** — Node 20, Express 5, Prisma (PostgreSQL), neo4j-driver, JWT,
bcrypt, multer, Cloudinary, Vitest + supertest.

**Frontend** — React 18, Vite 5, Tailwind 3, React Router, axios, GSAP.

---

<div align="center">
<sub>Proyecto universitario de Bases de Datos — dual graph + relacional.</sub>
</div>
