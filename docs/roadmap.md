# Roadmap y estado — Titi

Historia de etapas + **plan vivo de la etapa actual**. Este es el doc de "qué
falta". Modelos y reglas de la gamificación en [architecture.md](architecture.md).

> **Etapa 6 — Gamificación + Titi Vivo: CERRADA (`v2.0.0`).** Todas las subfases
> (6.1–6.6) cerradas. La app gana gotas, misiones diarias, ranking de amigos y una
> mascota animada. Próxima etapa sin definir (candidata: Etapa 7 — tienda de gotas).

---

## Etapas cerradas (1–5)

| Etapa | Tag | Qué entregó |
|---|---|---|
| 1 Titi Social | `v0.1.0` | Red social: auth/JWT, feed, explore, perfil con tabs, posts (imagen/hashtag/sonido/ubicación/like/save), comentarios anidados, búsqueda, notificaciones, identidad visual Titi |
| 2 Módulo Educativo | `v0.2.0` | Postgres+Prisma, CRUD cursos/módulos/lecciones/materiales (multer, 10 MB), inscripciones dedup, categorías, UI estudiante (catálogo+filtros, LearnCourse) y profesor (MyTeaching, editores), guard de rol |
| 3 Evaluaciones y Progreso | `v0.3.0` | Evaluaciones con calificación server-side, racha, 7 logros, certificados (lecciones + todas las evaluaciones), EvaluationQuiz, StreakBadge, AchievementToast |
| 4 Integración Social + Admin | `v0.4.0` | Propagación a Neo4j (`CursoRef`, `INSCRITO_EN`/`COMPLETO_CURSO`), feed académico, recomendaciones por amigos, panel admin (10 endpoints), eliminado `become-teacher` |
| 5 Pulido y Deploy | `v1.0.0` | Cloudinary, paginación cursor-based, índices, suite hermética Vitest+supertest (41 tests, 30.7%), CI/CD, deploy público |

**Live:** frontend `https://titiedu.vercel.app` · backend `https://titiedu-production.up.railway.app`.

Decisiones de arrastre relevantes: cascadas manuales con transacción Prisma; borrar
curso con inscripciones → 409 (ADMIN puede forzar); certificados preservados con
`cursoId` nullable + `cursoTitulo` snapshot; suite hermética con prisma/Neo4j mockeados.

---

## Etapa 6 — Gamificación + Titi Vivo (`v2.0.0`)

**Objetivo:** enganchar y retener. Loop diario —**gotas** (XP), **misiones
diarias**, **ranking de amigos semanal**— + Titi **vivo** (animado, reactivo a
eventos). Todo entre amigos, sin presión de extraños.

**Stack nuevo:** la mascota pasa de `/Titi.png` estático a **WebP animado por
estado** (`<TitiMascot state=…>`, assets en `public/titi/`). GSAP se mantiene para
el resto de la UI. _(Nota: el plan original proponía SVG por capas con Framer Motion;
en ejecución se optó por WebP animado — más simple y fiel al arte real de Titi.)_

### Estado por subfase

| Subfase | Tag | Estado | Detalle |
|---|---|---|---|
| 6.1 Gotas | `v1.1.0` | ✅ | Ledger `MovimientoGota` + `gotas.service` (idempotencia + topes) + triggers + `/api/gotas` |
| 6.2 Misiones | `v1.2.0` | ✅ | `Mision`/`MisionUsuario` + `mision.service` + `/api/missions/today` + triggers |
| 6.3 Ranking | `v1.3.0` | ✅ | `InsigniaSemanal` + `ranking.service` (cruce dual-DB) + premio lazy + `/api/ranking/friends` |
| 6.4 Titi vivo | `v1.4.0` | ✅ | Mascota WebP animada por estado (6 estados) en `TitiMascot` |
| 6.5 UI gamificación | `v1.5.0` | ✅ | `GamificationContext`, GotasCounter, GotaToast, DailyMissions, Leaderboard, premio overlay |
| 6.6 Tests + docs + cierre | `v2.0.0` | ✅ | Route tests gotas/missions/ranking, README, cierre |

### Cómo quedó

- **6.4 Titi vivo:** `TitiMascot` renderiza WebP animado por `state`; `titiAssets.js`
  mapea los 6 estados (`idle`, `celebra`, `triste`, `racha`, `saludo`, `pensando`),
  todos presentes en `public/titi/`. `prefers-reduced-motion` → `Titi.png` estático.
- **6.5 UI gamificación:** `GamificationContext` (gotas + cola de toasts + premio
  semanal, montado en `main.jsx`); `GotasCounter` en el Navbar; `GotaToast` con Titi
  `celebra` disparado desde `LearnCourse.handleProgressEvents`; `DailyMissions` en el
  Feed; `Leaderboard` en `/leaderboard`; `WeeklyPrizeCelebration` overlay.
- **6.6 Tests + docs:** route tests de `/api/gotas`, `/api/missions`,
  `/api/ranking/friends` (guards 401 + shapes), suite hermética de 13 archivos,
  cobertura **36.3%** (≥30%). README con sección de gamificación; `motion.md` +
  `animationTiti.md` con la animación de la mascota.

### Definition of Done — Etapa 6 ✅

- [x] Completar lección otorga gotas y dispara animación de Titi.
- [x] Gotas sociales con tope diario (anti-farmeo); aprendizaje idempotente.
- [x] 3 misiones diarias que resetean y otorgan gotas.
- [x] Ranking de amigos por gotas de la semana, solo gente que sigo.
- [x] Al cerrar la semana, el top recibe gotas + insignia (idempotente).
- [x] Titi animado por estado, reactivo, respeta `prefers-reduced-motion`.
- [x] Economía con saldo gastable listo para tienda futura (sin tienda aún).
- [x] Contador de gotas + racha en la navegación principal.
- [x] `npm test` verde, cobertura ≥30% en `routes/` + `services/`.

> **Smoke E2E visual** (completar lección → gotas + toast → misión avanza → ranking):
> a confirmar manualmente con la app corriendo; los caminos backend están cubiertos
> por tests.

---

## Trabajo fuera del plan de etapa (side tracks)

- **Rediseño catálogo de Cursos (v2 + v2.1):** ✅ implementado. Histórico en
  [archive/courses-redesign.md](archive/courses-redesign.md). Pendiente opcional no
  bloqueante: repaso responsive 375px + checklist `design.md` §12.
- **Rediseño LearnCourse (3 columnas):** parcial. Backend de notas implementado
  (`NotaLeccion` + `GET/PUT /api/lessons/:id/note`). El layout de 3 columnas y la
  card "Profundiza" (stub de Claude API) viven como spec en `frontend/agent.md`.
