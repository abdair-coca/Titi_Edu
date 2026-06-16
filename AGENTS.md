# AGENTS.md — Titi | Etapa 5: Pulido y Deploy

> **🔄 ETAPA 5 EN CURSO.** Este documento es el **plan** de la etapa: qué falta para cortar la **v1.0.0** (primer release público). Fuente de verdad del producto: `AGENTSGoal.md`. El cierre de la Etapa 4 quedó archivado en el tag `v0.4.0` y resumido en `AGENTSGoal.md` §9.

> **Etapas 1–4 cerradas.** Ver `AGENTSGoal.md` §9. Esta etapa corta el `MAJOR` a `1` (`AGENTSGoal.md` §16).

---

## 1. Objetivo

> **Llevar Titi de "funciona en mi máquina" a producto público estable.**
> Archivos en la nube, queries que no se caen con datos reales, tests que protegen los flujos críticos, CI que rechaza regresiones, y un sitio live al que cualquiera entra.

Done en una línea: si para que un extraño use Titi hay que correr el backend localmente, subir archivos al disco del server, o confiar en que "no rompí nada" sin tests, la Etapa 5 **no** está cerrada.

---

## 2. Estado de partida

### Heredado de Etapa 4 (deuda técnica a saldar)

| Ítem | Origen | Acción en Etapa 5 |
|---|---|---|
| Archivos en disco local (`/uploads`, `/uploads/materials`) | Etapa 2 | Migrar a Cloudinary (5.1) |
| Delete admin borra certificados (`Certificado.cursoId` `NOT NULL`) | Etapa 4 §10 | Migración a nullable + snapshot del título (5.2) |
| `PUT /courses/:id/approve` fallback sin uso | Etapa 4 §6 | Decidir: documentar o eliminar (5.6) |
| Relaciones del feed académico sembradas a mano para demo | Etapa 4 §10 | Mover a `seed.js` idempotente (5.3) |
| Sin tests automatizados (testing manual hasta Etapa 4) | `AGENTSGoal.md` §11 | Suite Vitest + supertest (5.3) |
| Feed/Explore sin paginación (limit fijo) | Etapa 4 §6 | Paginación real (5.2) |
| TODOs marcados "Etapa 5" en el código | varias | Limpieza (5.6) — 12 archivos los referencian |

### Lo que ya está listo y no se toca

- Auth, dual DB Neo4j↔Postgres, espejo `neoId`, propagación social.
- CRUDs de cursos/módulos/lecciones/materiales/evaluaciones.
- Panel admin, feed académico, recomendaciones.
- `resolveMediaUrl` (`frontend/src/lib/format.js`) ya deja pasar URLs absolutas (`https?://` → as-is). **Cloudinary devuelve URLs absolutas, así que el frontend de render no cambia.**

---

## 3. Plan — Storage (Cloudinary)

### 3.1 Helper `services/upload.service.js` (nuevo)

Concentra subida y borrado contra Cloudinary. Patrón espejo del de Neo4j: una función que el resto del código llama sin conocer el SDK.

```js
// services/upload.service.js
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Sube un buffer (multer memoryStorage) y devuelve { url, publicId }.
export async function uploadBuffer(buffer, folder, resourceType = 'auto') { /* ... */ }
// Borra por publicId. try/catch que loguea pero no rompe (igual que Neo4j sync).
export async function destroyAsset(publicId, resourceType = 'image') { /* ... */ }
```

### 3.2 Cambiar multer de disco a memoria

Hoy `multer` usa `diskStorage` en `routes/posts.js` y `routes/materials.js`, y `index.js` sirve `/uploads` como estático. Cambiar a `memoryStorage` y subir el buffer a Cloudinary en el handler.

- **`routes/posts.js`** — al crear post con imagen: `uploadBuffer(file.buffer, 'titi/posts')` → guardar la `url` en `Post.imageUrl` (Neo4j). Al borrar post: `destroyAsset(publicId)`.
- **`routes/materials.js`** — al subir material: `uploadBuffer(file.buffer, 'titi/materials', 'raw')` (pdf/word/codigo van como `raw`, imagen como `image`). Guardar `url` + `publicId` en `Material`. Al borrar material: `destroyAsset`.
- **`prisma/schema.prisma`** — agregar `publicId String?` a `Material` (y donde haga falta para poder borrar el asset remoto). Migración nueva.
- **`index.js`** — quitar `app.use('/uploads', express.static(...))` una vez migrado (o dejarlo para archivos legacy; decidir en 5.6).

### 3.3 Variables de entorno

`backend/.env` ya tiene los placeholders (`AGENTSGoal.md` §5):

```bash
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

Llenar con cuenta real. Documentar en `.env.example`. **Fallback dev:** si no hay credenciales, loguear warning y caer a disco (no romper el flujo local de quien no tenga cuenta).

---

## 4. Plan — Performance

### 4.1 Paginación de feed y explore

Hoy `GET /api/posts/feed` y `/explore` traen un limit fijo. Pasar a paginación cursor-based por `createdAt`:

- Query param `?cursor=<ISO>&limit=20`. Devolver `{ items, nextCursor }`.
- El feed académico (`/feed/academic`) entra en la misma paginación al mezclarse.
- Frontend `pages/Feed.jsx` y `pages/Explore.jsx`: scroll infinito (IntersectionObserver) o botón "Cargar más". Sin librerías nuevas si se puede.

### 4.2 Índices

- **Postgres** (`schema.prisma`): índices en las FKs y campos de filtro calientes — `Inscripcion(usuarioId)`, `Progreso(usuarioId, leccionId)`, `Curso(publicado, categoriaId)`, `Material(leccionId)`. `@@index([...])`.
- **Neo4j**: los constraints de `db.js` ya crean índices de unicidad. Agregar índice en `CursoRef(cursoId)` (las queries de recomendación/feed académico lo filtran).

### 4.3 Migración `Certificado.cursoId` nullable

Saldar deuda de Etapa 4: hacer `cursoId` nullable + agregar `cursoTitulo String` (snapshot). Así el delete admin **preserva certificados** (`SET NULL` + título congelado) en vez de borrarlos. Actualizar el delete forzado en `routes/admin.js`.

---

## 5. Plan — Tests, CI/CD y Deploy

### 5A. Tests (Vitest + supertest)

Objetivo de cobertura: **30%** en `backend/src/routes/` y `backend/src/services/` (`AGENTSGoal.md` §11). Caminos felices + rechazos importantes (401/403/409).

| Capa | Herramienta | Alcance mínimo |
|---|---|---|
| Backend unit | Vitest | `progress.service` (racha: hoy/ayer/rota), `achievement.service` (checkers), validadores |
| Backend integration | Vitest + supertest | `auth` (register/login/me), `posts` (CRUD + like/save), `courses` (CRUD + enroll + progress), `evaluations` (attempt + grading), `admin` (verify/role/delete con guard 403) |
| Frontend | Vitest + Testing Library | `PostCard`, `EvaluationQuiz` |
| E2E | Playwright (opcional) | registro → inscripción → completar lección |

DB de test: Postgres efímero (o schema dedicado) + Neo4j mockeado/efímero. Las llamadas a Cloudinary y Neo4j en tests van a stubs.

### 5B. CI/CD (GitHub Actions)

`.github/workflows/ci.yml`: en cada PR a `main` → install + lint + `vitest run`. PR que rompe tests o lint **se bloquea** (branch protection).

### 5C. Deploy

- **Backend → Railway**: `DATABASE_URL` a Postgres administrado de Railway, `NEO4J_*` a Aura, `CLOUDINARY_*`, `JWT_SECRET`, `FRONTEND_URL`. `npx prisma migrate deploy` en el release.
- **Frontend → Vercel**: `VITE_API_URL` apuntando al backend de Railway.
- **CORS**: `FRONTEND_URL` admite múltiples orígenes separados por coma (ya soportado) para previews de Vercel.

---

## 6. Plan — Documentación y limpieza

- **README** en raíz: setup local (<15 min), diagrama de arquitectura, capturas, link al sitio live.
- **Limpieza de TODOs** marcados "Etapa 5" — 12 archivos los referencian (posts.js, Explore.jsx, Profile.jsx, LearnCourse.jsx, ModulesEditor.jsx, CourseEditor.jsx, PostCard.jsx, format.js, etc.). Resolver o re-etiquetar.
- **Decidir `PUT /courses/:id/approve`**: documentar como fallback o eliminar.

---

## 7. Decisiones tomadas

| Decisión | Razón |
|---|---|
| Cloudinary con `memoryStorage`, no `diskStorage` | El buffer va directo a la nube; el server no toca disco (Railway tiene FS efímero) |
| Helper `upload.service.js` con fallback a disco en dev | Quien clona sin cuenta Cloudinary igual desarrolla local |
| Paginación **cursor-based** por `createdAt`, no offset | Estable ante inserciones; el feed es un stream temporal |
| Certificados se **preservan** al borrar curso (nullable + snapshot) | Un certificado emitido es un hecho histórico; no debe desaparecer si se borra el curso |
| Cobertura objetivo 30%, no 100% | Cubrir caminos felices + rechazos (403/409); no perseguir cobertura total |
| Neo4j/Cloudinary **stubbeados** en tests | Tests deben correr en CI sin Aura ni cuenta Cloudinary reales |

### Pendiente de confirmar

1. **Servir `/uploads` legacy** — ¿migrar los archivos existentes a Cloudinary o dejar el estático para los viejos? Propuesta: script de migración una vez + quitar el estático.
2. **DB de test** — Postgres efímero en CI (servicio de GitHub Actions) vs schema dedicado. Propuesta: servicio `postgres` en el workflow.
3. **Playwright** — opcional; entra solo si el tiempo alcanza.

---

## 8. Subfases de la Etapa 5

Seis subfases en orden de dependencia. Cada una es una **unidad commitable**: cierra con su checkpoint verificado antes de pasar a la siguiente.

```
5.1 (Cloudinary) ──┐
5.2 (Performance) ─┼─► 5.3 (Tests) ──► 5.4 (CI/CD) ──► 5.5 (Deploy) ──► 5.6 (Docs + cierre)
                   │                                        ▲
                   └────────────────────────────────────────┘
```

5.1 y 5.2 son paralelizables (ambas tocan backend, archivos distintos). 5.3 prueba lo que 5.1/5.2 dejaron estable. 5.5 necesita 5.1 (env de prod) y 5.4 (CI verde). 5.6 depende de todas.

---

### 🔄 Subfase 5.1 — Migración a Cloudinary

**Objetivo:** que ningún archivo nuevo toque el disco del server. Posts y materiales viven en Cloudinary.

**Depende de:** nada (arranca aquí).

**Archivos:** `services/upload.service.js` (nuevo), `routes/posts.js`, `routes/materials.js`, `prisma/schema.prisma` (+ migración), `index.js`, `.env.example`.

**Pasos:**
1. Helper `upload.service.js` (`uploadBuffer`, `destroyAsset`) con config desde env y fallback a disco si no hay credenciales.
2. Cambiar `multer` a `memoryStorage` en `posts.js` y `materials.js`.
3. Subir buffer en cada handler de creación; guardar `url` + `publicId`. Borrar asset remoto en cada delete.
4. Migración Prisma: `Material.publicId String?` (y lo que haga falta).
5. `.env.example` documentado.

**Checkpoint:** subir una imagen de post y un material → la URL guardada es `https://res.cloudinary.com/...`; el archivo aparece en el dashboard de Cloudinary; borrar el recurso lo elimina de Cloudinary. Sin credenciales, cae a disco con warning. El render en frontend funciona sin cambios (`resolveMediaUrl` pasa la URL absoluta).

---

### 🔄 Subfase 5.2 — Performance (paginación + índices + certificados)

**Objetivo:** que feed/explore escalen y que el delete admin deje de borrar certificados.

**Depende de:** nada (paraleliza con 5.1).

**Archivos:** `routes/posts.js`, `pages/Feed.jsx`, `pages/Explore.jsx`, `prisma/schema.prisma` (+ migración), `db.js`, `routes/admin.js`.

**Pasos:**
6. Paginación cursor-based en `/feed`, `/explore`, `/feed/academic` (`?cursor=&limit=`, devolver `nextCursor`).
7. Scroll infinito o "Cargar más" en `Feed` y `Explore`.
8. Índices Postgres (`@@index`) en FKs/filtros calientes + índice Neo4j en `CursoRef(cursoId)`.
9. Migración: `Certificado.cursoId` nullable + `cursoTitulo` snapshot. Ajustar delete forzado en `admin.js` para preservar certificados.

**Checkpoint:** el feed carga de a 20 y trae más al scrollear; borrar un curso con certificados emitidos deja los certificados con `cursoId = null` y título congelado; `EXPLAIN` de las queries calientes usa los índices nuevos.

---

### 🔄 Subfase 5.3 — Tests

**Objetivo:** suite que protege los flujos críticos. 30% en `routes/` + `services/`.

**Depende de:** 5.1 y 5.2 (prueba el comportamiento ya estabilizado).

**Archivos:** `backend/test/**` (nuevo), `vitest.config.js`, `prisma/seed.js` (mover datos demo del feed académico aquí), `package.json` (script `test`).

**Pasos:**
10. Unit: `progress.service` (racha hoy/ayer/rota), `achievement.service` (checkers).
11. Integration (supertest): `auth`, `posts`, `courses`, `evaluations`, `admin` con guard 403. Neo4j/Cloudinary stubbeados.
12. Frontend: `PostCard`, `EvaluationQuiz` (Vitest + Testing Library).
13. Mover las relaciones demo del feed académico a `seed.js` idempotente (saldar deuda Etapa 4 §10.3).

**Checkpoint:** `npm test` corre verde sin Aura ni Cloudinary reales; cobertura ≥30% en `routes/` + `services/`; los rechazos 401/403/409 están cubiertos.

---

### 🔄 Subfase 5.4 — CI/CD

**Objetivo:** que ningún PR que rompe tests o lint entre a `main`.

**Depende de:** 5.3 (necesita la suite).

**Archivos:** `.github/workflows/ci.yml` (nuevo), config de lint si falta.

**Pasos:**
14. Workflow: en PR a `main` → install + lint + `vitest run`, con servicio `postgres` efímero.
15. Branch protection en `main`: requiere el check verde.

**Checkpoint:** abrir un PR con un test roto → el check falla y el merge se bloquea. PR limpio → check verde.

---

### 🔄 Subfase 5.5 — Deploy

**Objetivo:** sitio público live.

**Depende de:** 5.1 (env de storage), 5.2, idealmente 5.4 (CI verde antes de soltar).

**Archivos:** config de Railway/Vercel, `.env` de prod (fuera del repo), `README` (sección deploy).

**Pasos:**
16. Backend en Railway: Postgres administrado, `prisma migrate deploy`, todas las env. Verificar conexión a Aura y Cloudinary desde prod.
17. Frontend en Vercel: `VITE_API_URL` al backend. Verificar CORS con `FRONTEND_URL`.
18. Smoke en prod: registro → post con imagen (Cloudinary) → inscripción → completar lección → certificado.

**Checkpoint:** un extraño entra a la URL pública, se registra, sube un post con imagen y se inscribe en un curso, todo contra prod. Tiempo de carga inicial del feed < 2s en 3G simulada.

---

### 🔄 Subfase 5.6 — Documentación, limpieza y cierre

**Objetivo:** verificar el flujo completo, documentar y cortar `v1.0.0`.

**Depende de:** 5.1–5.5.

**Archivos:** `README.md`, archivos con TODOs "Etapa 5", `AGENTSGoal.md` (marcar Etapa 5 cerrada), este doc (§10 cierre).

**Pasos:**
19. README: setup <15 min, diagrama de arquitectura, capturas, link live.
20. Resolver/re-etiquetar los TODOs "Etapa 5" (12 archivos). Decidir destino de `PUT /courses/:id/approve` y del estático `/uploads` legacy.
21. Smoke E2E final + tildar §9 DoD.
22. Cerrar Etapa 5 en `AGENTSGoal.md` §9 y §16 (✅, tag `v1.0.0`), llenar §10 de este doc.

**Checkpoint:** los ítems de §9 tildados; README permite a alguien nuevo arrancar en <15 min; tag `v1.0.0` sobre `main` con árbol limpio.

---

## 9. Definition of Done — Etapa 5

- [ ] Subir un material o imagen de post va a Cloudinary, no al disco
- [ ] Borrar post/material elimina también el asset remoto de Cloudinary
- [ ] Feed y Explore paginan (scroll infinito o "Cargar más")
- [ ] Carga inicial del feed < 2s en red 3G simulada
- [ ] Borrar un curso con certificados emitidos **preserva** los certificados
- [ ] Índices Postgres + Neo4j en las queries calientes
- [ ] `npm test` corre verde sin Aura ni Cloudinary reales, cobertura ≥30% en `routes/` + `services/`
- [ ] CI rechaza PRs que rompen tests o lint
- [ ] Backend live en Railway, frontend live en Vercel, CORS OK
- [ ] Un extraño se registra y usa Titi contra prod (smoke E2E)
- [ ] README permite arrancar el proyecto en < 15 min
- [ ] TODOs "Etapa 5" resueltos o re-etiquetados

---

## 10. Convenciones

- **Diseño**: todo componente nuevo pasa checklist de `frontend/design.md` §12.
- **UI plana**: sin `bg-gradient-*` ni `blur-*` en componentes nuevos.
- **Mascota Titi**: `<img src="/Titi.png" />`, nunca emoji 🐒.
- **Respuesta API**: `{ success, data }` éxito; `{ success: false, message }` error.
- **Nombres**: modelos Prisma, nodos/relaciones Neo4j y campos en **español**. Código (variables, funciones, archivos) en **inglés**.
- **Commits**: prefijos en español (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, `test:`).
- **CodeGraph**: usar `codegraph_*` antes de grep para preguntas estructurales.
- **Servicios externos (Neo4j, Cloudinary)**: siempre en `try/catch` que loguea pero no rompe la respuesta principal.
- **Versionado**: la Etapa 5 corta `v1.0.0` (`AGENTSGoal.md` §16). Bugfixes dentro de la etapa → patch (`v1.0.1`…).

---

## 11. Cierre — Etapa 5

> _Se llena al cerrar la etapa (mismo formato que Etapa 4 §10): changelog de commits por subfase, desvíos/deuda técnica, y tag `v1.0.0`._
