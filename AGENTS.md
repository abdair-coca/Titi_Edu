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
| `rediseno-learn-v3` | 🟡 Implementado, falta probar con la API real | Learn con el lenguaje v3 (la fase que `rediseno-plataforma-v3` dejó afuera): índice como ruta de nodos con el acento de la categoría, avance en panel oscuro, lecciones nuevas marcadas, lección sobre superficie con barra de acción que muestra lo que sigue, riel y paneles v3, evaluación con opciones con letra y nota con conteo, comentarios con `Avatar`, tutor IA completo (burbujas, fuentes, acciones rápidas, clave de Groq), respuestas estructuradas (DIL) y cifras de la actividad HTML, y estados con Titi. Cero emojis en el chrome. Sin cambios de API ni de la lógica que vigilan los `test:learn-*`. [proposal](docs/specs/changes/rediseno-learn-v3/proposal.md) · [spec](docs/specs/changes/rediseno-learn-v3/spec.md) · [tasks](docs/specs/changes/rediseno-learn-v3/tasks.md) · [verify](docs/specs/changes/rediseno-learn-v3/verify-report.md) |
| `rediseno-plataforma-v3` | 🟡 Implementado, falta probar con la API real | El resto de la app con el lenguaje v3: perfil (racha y logros sin emojis, `FollowButton`), hashtag, notificaciones, Mis cursos (panel oscuro, ruta con nodos por categoría), certificados, ranking con podio, tienda (ícono por código), detalle de curso, ajustes de navegación, enseñar y admin. Piezas comunes en `components/ui/v3.jsx` y clases `.titi-surface` / `.titi-btn-outline`. Arregla `/certificates` (export que faltaba). Sin cambios de API; Learn se hizo aparte en `rediseno-learn-v3`. [proposal](docs/specs/changes/rediseno-plataforma-v3/proposal.md) · [spec](docs/specs/changes/rediseno-plataforma-v3/spec.md) · [tasks](docs/specs/changes/rediseno-plataforma-v3/tasks.md) · [verify](docs/specs/changes/rediseno-plataforma-v3/verify-report.md) |
| `rediseno-inicio-explorar` | 🟡 Implementado, falta probar con la API real | Inicio y Explorar con el lenguaje v3 de `/courses`. Inicio: saludo, composer plegable sin emojis, *Continuá donde quedaste*, pestañas Todo/Publicaciones/Aprendizaje, post v3 (doble toque = like), actividad que abre la vista rápida del curso, gente para seguir y rail *Tu día*. Explorar: buscador del catálogo con `?q=`, tendencias, gente para seguir, cursos de la comunidad y resultados por pestañas. API: `GET /api/users/suggestions`, `GET /api/search/trending` e `isFollowing` en la búsqueda. [proposal](docs/specs/changes/rediseno-inicio-explorar/proposal.md) · [spec](docs/specs/changes/rediseno-inicio-explorar/spec.md) · [tasks](docs/specs/changes/rediseno-inicio-explorar/tasks.md) · [verify](docs/specs/changes/rediseno-inicio-explorar/verify-report.md) |
| `rediseno-catalogo-cursos` | 🟡 Implementado (`v4.0.0`), falta probar con sesión | Todo `/courses` debajo del hero rehecho para descubrir y elegir rápido: filas curadas (Continúa con avance, amigos, para empezar, nuevos, populares; las temáticas solo con 8+ cursos), catálogo con filtros en la URL (categoría, nivel, largo, orden, certificado), tarjeta v3 con inclinación, reordenamiento FLIP, vista rápida (panel/hoja), rutas en camino serpenteante con Titi y bloque final según haya sesión. Íconos SVG por categoría con acento y microinteracción; cero emojis (también en `design.md`). API suma lecciones al catálogo y avance a `/my/enrolled`. [proposal](docs/specs/changes/rediseno-catalogo-cursos/proposal.md) · [spec](docs/specs/changes/rediseno-catalogo-cursos/spec.md) · [tasks](docs/specs/changes/rediseno-catalogo-cursos/tasks.md) · [verify](docs/specs/changes/rediseno-catalogo-cursos/verify-report.md) |
| `titi-3d-cursos` | 🟡 Pulido, sin medir con GPU real | Titi en 3D dentro del cuarto de `/courses`, hecho en código y fiel a `Titi.png`. Estilo toon: colores de marca exactos en la luz, sombra cálida diseñada, rim y contorno fino. Cabeza, torso, muslos, manos y pies esculpidos en una pieza (antifaz y panza pintados); bigote de dos capas desde un puente con la "w" encima, cejas en mechones y cresta de tres puntas medidos sobre la imagen; cola de 20 huesos en espiral limpia. Vive solo (respira, parpadea con ease, mira de reojo, olfatea, camina, saluda, piensa) y cambia de expresión (cejas y bigote). Tocarlo celebra; arrastrarlo lo deja colgando y al soltarlo cae y se marea. Laboratorio visual: `npm run shots:titi`. Falta medir FPS con GPU real y en celular. [proposal](docs/specs/changes/titi-3d-cursos/proposal.md) · [spec](docs/specs/changes/titi-3d-cursos/spec.md) · [tasks](docs/specs/changes/titi-3d-cursos/tasks.md) · [verify](docs/specs/changes/titi-3d-cursos/verify-report.md) |
| `rediseno-hero-cursos` | 🟡 Implementado, sin medir en celular | Hero de `/courses` minimalista: sin promo, chip ni cifras; llena la primera pantalla. Título Nunito 900 letra a letra que juega con el 3D: viento al paso de drones y avión, gotas que rebotan en las letras, el avión choca contra una letra al azar, tocar una letra llama al dron más cercano, y "hoy" cambia por la categoría que el mouse tiene encima en el cuarto. Globos que revientan en lugar de nubes; avión y globos pasan por detrás y por delante del texto (lienzo medio, solo desktop). [proposal](docs/specs/changes/rediseno-hero-cursos/proposal.md) · [spec](docs/specs/changes/rediseno-hero-cursos/spec.md) · [tasks](docs/specs/changes/rediseno-hero-cursos/tasks.md) · [verify](docs/specs/changes/rediseno-hero-cursos/verify-report.md) |
| `cielo-hero-cursos` | 🟡 Implementado, sin medir en celular | Cielo 3D detrás del header de `/courses` (barra amarilla + texto): dron repartidor, dron chico, avión de papel, gotas y nubes con la luz del cuarto; esquivan/miran al mouse y al tocarlos hacen rizos y sueltan gotas que caen sobre el buscador. En celular solo repartidor + avión. Chunk propio de 6,7 KB gzip (three compartido con el cuarto); sin 3D no se muestra nada. Falta medir FPS en un celular real. [proposal](docs/specs/changes/cielo-hero-cursos/proposal.md) · [spec](docs/specs/changes/cielo-hero-cursos/spec.md) · [tasks](docs/specs/changes/cielo-hero-cursos/tasks.md) · [verify](docs/specs/changes/cielo-hero-cursos/verify-report.md) |
| `tutor-conversacional` | 🟡 Medido con Groq (10/10), sin deploy | El tutor conversa como un compañero: saludos y charla van al modelo, un mensaje sin fuentes ya no termina en rechazo fijo, un tema del curso que el material no cubre solo se orienta y uno ajeno recibe una o dos frases. Toda respuesta sin citas se valida en el servidor (corta, sin código ni listas). La carga solo muestra "Encontré N fuentes" si la respuesta cita. Medido con Groq: 10/10 en tres corridas; el LaTeX se pasa a texto plano. Falta probarlo en el panel tras el deploy. [proposal](docs/specs/changes/tutor-conversacional/proposal.md) · [spec](docs/specs/changes/tutor-conversacional/spec.md) · [tasks](docs/specs/changes/tutor-conversacional/tasks.md) · [verify](docs/specs/changes/tutor-conversacional/verify-report.md) |
| `habitacion-3d-cursos` | 🟡 Implementado, sin medir en celular | Reemplaza la escena de `hero-3d-cursos`: el hero de `/courses` es la sala de estudio de Titi, un cuarto isométrico con luz suave donde los 8 objetos de categoría están en su lugar (tocar uno filtra). Se gira arrastrando (±35°, el gesto vertical sigue scrolleando), paralaje con el mouse y 7 sorpresas en adornos. Sin Titi en la escena ni modelos nuevos; chunk 3D 258 KB gzip. Falta medir FPS en un celular real. [proposal](docs/specs/changes/habitacion-3d-cursos/proposal.md) · [spec](docs/specs/changes/habitacion-3d-cursos/spec.md) · [tasks](docs/specs/changes/habitacion-3d-cursos/tasks.md) · [verify](docs/specs/changes/habitacion-3d-cursos/verify-report.md) |
| `hero-3d-cursos` | 🔁 Escena reemplazada por `habitacion-3d-cursos` | Hero de `/courses` en 3D (React Three Fiber + drei): 8 modelos gratuitos por categoría alrededor de Titi; tocar uno filtra el catálogo. 3D liviano en mobile, chunk diferido (249 KB gzip) y poster de 27 KB como respaldo y LCP (−1,6 s en Fast 3G). Falta medir FPS en un celular real. [proposal](docs/specs/changes/hero-3d-cursos/proposal.md) · [spec](docs/specs/changes/hero-3d-cursos/spec.md) · [tasks](docs/specs/changes/hero-3d-cursos/tasks.md) · [verify](docs/specs/changes/hero-3d-cursos/verify-report.md) |
| `respuestas-estructuradas-tutor` | 🟡 Implementado, listo para encender | DIL (Declarative Interface Language): el tutor declara su respuesta como árbol JSON de componentes (pasos, avisos, tarjetas, tablas, código, diagramas Mermaid, quiz sin respuesta) y el panel la arma; protecciones sobre el texto canónico. Con el rescate de `failed_generation` rechaza 10 % contra 5 % de Markdown (cumple el criterio); falta encender `RAG_DIL_ENABLED` en Render. [proposal](docs/specs/changes/respuestas-estructuradas-tutor/proposal.md) · [spec](docs/specs/changes/respuestas-estructuradas-tutor/spec.md) · [tasks](docs/specs/changes/respuestas-estructuradas-tutor/tasks.md) · [verify](docs/specs/changes/respuestas-estructuradas-tutor/verify-report.md) |
| `correcciones-tutor-rag` | 🟡 En producción, sin archivar | Diez correcciones de la auditoría del tutor: búsqueda, citas, indexación y protección de evaluaciones. Desplegado y reindexado el 2026-11-07; falta medir la versión final con Groq. [proposal](docs/specs/changes/correcciones-tutor-rag/proposal.md) · [spec](docs/specs/changes/correcciones-tutor-rag/spec.md) · [tasks](docs/specs/changes/correcciones-tutor-rag/tasks.md) · [verify](docs/specs/changes/correcciones-tutor-rag/verify-report.md) |
| `evaluacion-busqueda-rag` | ✅ Completado | Golden set y medición local de la búsqueda; fragmentos por ítem, Presentación unida, reranker y número de fuentes variable (MRR 0.68 → 0.77, fuentes útiles 27 % → 38 %). En producción desde el 2026-11-07. Mediciones guardadas para comparar: [`backend/eval/rag/HISTORIAL.md`](backend/eval/rag/HISTORIAL.md). [proposal](docs/specs/changes/evaluacion-busqueda-rag/proposal.md) · [spec](docs/specs/changes/evaluacion-busqueda-rag/spec.md) · [tasks](docs/specs/changes/evaluacion-busqueda-rag/tasks.md) · [verify](docs/specs/changes/evaluacion-busqueda-rag/verify-report.md) |
| `centralizador-notas` | ✅ Completado | Notas de estudiantes por curso para teachers (`routes/grades.js`, `CourseGrades.jsx`). Verificado el 2026-11-19; falta solo un smoke visual con un curso real. [proposal](docs/specs/changes/centralizador-notas/proposal.md) · [spec](docs/specs/changes/centralizador-notas/spec.md) · [tasks](docs/specs/changes/centralizador-notas/tasks.md) · [verify](docs/specs/changes/centralizador-notas/verify-report.md) |
| `control-admin-rag` | ✅ Completado | Panel de control y monitoreo RAG para administradores. [proposal](docs/specs/changes/control-admin-rag/proposal.md) · [spec](docs/specs/changes/control-admin-rag/spec.md) · [tasks](docs/specs/changes/control-admin-rag/tasks.md) · [verify](docs/specs/changes/control-admin-rag/verify-report.md) |
| `mejoras-tutor-rag` | ✅ Completado | Búsqueda híbrida (pgvector + full-text), historial en el chat y grounding gradual del Tutor RAG. [proposal](docs/specs/changes/mejoras-tutor-rag/proposal.md) · [spec](docs/specs/changes/mejoras-tutor-rag/spec.md) · [tasks](docs/specs/changes/mejoras-tutor-rag/tasks.md) · [verify](docs/specs/changes/mejoras-tutor-rag/verify-report.md) |
| `tutor-rag-aprendizaje` | ✅ Completado | Tutor IA como apoyo formativo: ayuda a comprender y practicar sin resolver evaluaciones por adelantado ni inventar evidencia. [proposal](docs/specs/changes/tutor-rag-aprendizaje/proposal.md) · [spec](docs/specs/changes/tutor-rag-aprendizaje/spec.md) · [tasks](docs/specs/changes/tutor-rag-aprendizaje/tasks.md) · [verify](docs/specs/changes/tutor-rag-aprendizaje/verify-report.md) |
| `optimizacion-carga-learn` | 🔄 En curso | Optimización incremental de carga en Learn. 20 de 33 tareas; faltan las mediciones manuales y decidir continuar/revertir; sin `verify-report.md`. [proposal](docs/specs/changes/optimizacion-carga-learn/proposal.md) · [spec](docs/specs/changes/optimizacion-carga-learn/spec.md) · [tasks](docs/specs/changes/optimizacion-carga-learn/tasks.md) |
| `navegacion-completitud-learn` | ✅ Completado | Persistencia de lección activa, completitud dinámica y regresiones HTML evaluable. [proposal](docs/specs/changes/navegacion-completitud-learn/proposal.md) · [spec](docs/specs/changes/navegacion-completitud-learn/spec.md) · [tasks](docs/specs/changes/navegacion-completitud-learn/tasks.md) · [verify](docs/specs/changes/navegacion-completitud-learn/verify-report.md) |
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
  lib/  motion.js (GSAP) · format.js
  components/  PostCard, CreatePost, EvaluationQuiz, TitiMascot (+ titi/titiAssets),
               StreakBadge, AchievementToast, AcademicActivityCard,
               catalog/* (catálogo de /courses: tarjeta, filtros, filas, vista rápida, rutas)…
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
