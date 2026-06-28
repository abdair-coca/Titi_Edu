# Roadmap y estado — Titi

Historia de etapas + **plan vivo de la etapa actual**. Este es el doc de "qué
falta". Modelos y reglas de la gamificación en [architecture.md](architecture.md).

> **Etapa actual: 6 — Gamificación + Titi Vivo (corta `v2.0.0`).**
> Subfases 6.1–6.3 cerradas (`v1.1.0`–`v1.3.0`). En curso: **6.4 (Titi vivo)**.

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
| 6.4 Titi vivo | `v1.4.0` | 🔄 | Ver pendientes abajo |
| 6.5 UI gamificación | `v1.5.0` | 🔄 | Construida (falta smoke + tag) |
| 6.6 Tests + docs + cierre | `v2.0.0` | 📋 | No empezada |

### 🔄 6.4 — Titi vivo (en curso)

Hecho: `TitiMascot` re-hecho para WebP animado por `state`; `titiAssets.js` mapea
6 estados (`idle`, `celebra`, `triste`, `racha`, `saludo`, `pensando`). Existen 2
WebP: `titi-idle.webp`, `titi-celebra.webp`. `prefers-reduced-motion` → PNG estático.

**Pendiente:**
- Convertir los GIF crudos de `frontend/public/GifTiti/` (gitignorado, ~12 MB c/u:
  Gretting/Racha/celebration/curios/idle/sad) a **WebP optimizado** y colocarlos como
  `titi-<estado>.webp` en `public/titi/`. Faltan: `triste`, `racha`, `saludo`,
  `pensando` (hoy caen al PNG).
- Verificar que cambiar `state` cambia la animación y reduced-motion deja a Titi quieto.
- Doc de animación de la mascota en `motion.md`.
- **Cierre:** commit `feat(titi): mascota WebP animada por estado` → tag **`v1.4.0`**.

### 🔄 6.5 — UI de gamificación (construida)

Hecho:
- `context/GamificationContext` con `gotas` (fetch `/api/gotas`), cola de toasts
  (`pushGota`) y detección del premio semanal al entrar. Montado en `main.jsx`.
- `GotasCounter` en `Navbar` (sidebar + top bar móvil), linkea al ranking.
- `GotaToast` (Titi `state="celebra"`), montado global en `App.jsx`; lo dispara
  `pushGota`, cableado en `LearnCourse.handleProgressEvents` (lección + evaluación).
- `DailyMissions` (panel en el Feed) + `Leaderboard` (`/leaderboard` + entrada
  "Ranking" en el sidebar).
- `WeeklyPrizeCelebration` (overlay) cuando el contexto detecta insignia nueva.

**Pendiente:** smoke visual + commit `feat(gamif): UI de gotas, misiones, ranking y
celebraciones` → tag **`v1.5.0`**.

### 📋 6.6 — Tests, docs y cierre

- Integration tests (supertest, mocks) de `/api/gotas`, `/api/missions`,
  `/api/ranking/friends` con guards 401. Cobertura **≥30%** en `routes/` + `services/`.
- README: sección de gamificación. `motion.md`: animación de la mascota.
- Smoke E2E: completar lección → gotas + toast Titi → misión avanza → ranking refleja
  → (simular) premio semanal.
- **Cierre:** actualizar este doc + `conventions.md` (✅ Etapa 6), tag **`v2.0.0`**.

### Definition of Done — Etapa 6

- [ ] Completar lección otorga gotas y dispara animación de Titi.
- [ ] Gotas sociales con tope diario (anti-farmeo); aprendizaje idempotente.
- [ ] 3 misiones diarias que resetean y otorgan gotas.
- [ ] Ranking de amigos por gotas de la semana, solo gente que sigo.
- [ ] Al cerrar la semana, el top recibe gotas + insignia (idempotente).
- [ ] Titi animado por estado, reactivo, respeta `prefers-reduced-motion`.
- [ ] Economía con saldo gastable listo para tienda futura (sin tienda aún).
- [ ] Contador de gotas + racha en la navegación principal.
- [ ] `npm test` verde, cobertura ≥30% en `routes/` + `services/`.

---

## Trabajo fuera del plan de etapa (side tracks)

- **Rediseño catálogo de Cursos (v2 + v2.1):** ✅ implementado. Histórico en
  [archive/courses-redesign.md](archive/courses-redesign.md). Pendiente opcional no
  bloqueante: repaso responsive 375px + checklist `design.md` §12.
- **Rediseño LearnCourse (3 columnas):** parcial. Backend de notas implementado
  (`NotaLeccion` + `GET/PUT /api/lessons/:id/note`). El layout de 3 columnas y la
  card "Profundiza" (stub de Claude API) viven como spec en `frontend/agent.md`.
