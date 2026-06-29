# Roadmap y estado — Titi

Historia de etapas + **plan vivo de la etapa actual**. Este es el doc de "qué
falta". Modelos y reglas de la gamificación en [architecture.md](architecture.md).

> **Etapa 6 — Gamificación + Titi Vivo: CERRADA (`v2.0.0`).** La app gana gotas,
> misiones diarias, ranking de amigos y una mascota animada.
> **Etapa 7 — Tienda de gotas: 📋 PLANIFICADA (`v3.0.0`).** Plan detallado abajo.

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

## Etapa 7 — Tienda de gotas (`v3.0.0`) 📋 PLANIFICADA

**Objetivo:** darle un **sumidero** a la economía. Hasta ahora las gotas solo se
acumulan; la tienda permite **gastarlas** en **consumibles que afectan la mecánica**:
proteger la racha y power-ups educativos. Cierra el loop ganar → gastar y le da peso
a `gotasSaldo`.

**Alcance (confirmado):** solo **consumibles** (se compran, se acumulan en un saldo
por ítem, se gastan). Sin cosméticos ni accesorios de Titi (quedan para una etapa
futura). Cada consumible tiene un **efecto** que toca un sistema existente.

### Catálogo inicial propuesto

| Código | Categoría | Precio (gotas) | Efecto |
|---|---|---|---|
| `congelar_racha` | Protección de racha | ~50 | Protege la racha 1 día sin actividad (no se rompe). Se consume solo al detectarse el gap. |
| `intento_extra` | Power-up educativo | ~80 | Un intento adicional en una evaluación que agotó `intentosMax`. |
| `multiplicador_gotas` | Power-up educativo | ~100 | x2 gotas durante 1 h desde que se usa (campo `gotasMultiplicadorHasta` en `Usuario`). |

> Precios y el set final se afinan al sembrar (`seed.js`). El límite de acumulación
> por ítem (`limiteStack`) evita farmear protección infinita (ej. máx 3 congelaciones).

### Modelo de datos (Postgres, solo consumibles)

```prisma
model Usuario {
  // ... + comprasItem CompraItem[]  + inventario InventarioItem[]
  // + gotasMultiplicadorHasta DateTime?   // x2 gotas activo hasta este instante
}

model ItemTienda {
  id          String  @id @default(uuid())
  codigo      String  @unique          // 'congelar_racha'
  nombre      String
  descripcion String
  precio      Int                       // en gotas
  efecto      String                    // 'congelar_racha'|'intento_extra'|'multiplicador_gotas'
  icono       String?
  limiteStack Int?                      // tope de acumulación por usuario (null = sin tope)
  activo      Boolean @default(true)
  compras     CompraItem[]
  inventario  InventarioItem[]
}

model CompraItem {                      // ledger de compras (auditoría + debita gotas)
  id        String   @id @default(uuid())
  usuarioId String
  itemId    String
  precio    Int                         // snapshot del precio pagado
  createdAt DateTime @default(now())
  usuario   Usuario    @relation(fields: [usuarioId], references: [id])
  item      ItemTienda @relation(fields: [itemId], references: [id])
  @@index([usuarioId, createdAt])
}

model InventarioItem {                  // saldo de consumibles por usuario
  id        String @id @default(uuid())
  usuarioId String
  itemId    String
  cantidad  Int    @default(0)
  usuario   Usuario    @relation(fields: [usuarioId], references: [id])
  item      ItemTienda @relation(fields: [itemId], references: [id])
  @@unique([usuarioId, itemId])
}
```

### Economía: gastar gotas (cambio a la Etapa 6)

Etapa 6 dejó `MovimientoGota.cantidad` **siempre > 0** (solo ganancia). La tienda
introduce el **gasto**:
- `gotas.service.js` gana `gastarGotas(usuarioId, cantidad, { motivo, refId })`:
  valida saldo suficiente, **debita `gotasSaldo`** (NO `gotasTotal` — el total es
  lifetime ganado), escribe un `MovimientoGota` con **cantidad negativa**
  (`motivo: 'compra_tienda'`). Todo en transacción.
- Actualizar `architecture.md` (la nota "cantidad siempre > 0") al implementarlo.

### Servicios

- `services/tienda.service.js`:
  - `comprarItem(usuarioId, codigo)` → transacción: valida ítem activo, saldo y
    `limiteStack`; `gastarGotas`; escribe `CompraItem`; incrementa `InventarioItem`.
    Devuelve `{ saldo, inventario }`. 409 si saldo insuficiente o stack lleno.
  - `consumirItem(usuarioId, codigo)` → decrementa `InventarioItem` si `cantidad > 0`;
    devuelve si pudo. Lo llaman los efectos.
  - `inventarioDe(usuarioId)` → lista de consumibles con cantidad.

### Efectos (integración en sistemas existentes)

| Consumible | Dónde se aplica | Cómo |
|---|---|---|
| `congelar_racha` | `progress.service.js` → `actualizarRacha` | Al detectar que la racha se rompería por gap, si hay `congelar_racha` en inventario se **consume 1** y la racha se preserva en vez de reiniciar. Consumo **lazy** (en la próxima actividad/lectura de racha), como el premio del ranking. |
| `intento_extra` | `routes/evaluations.js` → attempt | Cuando el intento está `bloqueado` (agotó `intentosMax`), permitir un intento más si el body trae `usarIntentoExtra: true`; se **consume 1** antes de calificar. |
| `multiplicador_gotas` | `gotas.service.js` → `otorgarGotas` | Al usarlo, setea `Usuario.gotasMultiplicadorHasta = now + 1 h`. Mientras esté activo, `otorgarGotas` duplica la cantidad (solo el aprendizaje/social, no el premio del ranking). |

### Endpoints — `/api/shop`

```
GET  /api/shop/items       → catálogo activo + mi cantidad por ítem
GET  /api/shop/inventory   → mi inventario de consumibles
POST /api/shop/buy         → { codigo } compra (debita gotas, 409 si no alcanza/stack lleno)
POST /api/shop/use         → { codigo } consumo manual (los auto-consumos van por su trigger)
```

### Frontend

- `pages/Shop.jsx` (`/shop`, entrada "Tienda" en el sidebar): grid de ítems con
  icono + precio (`GotaIcon`) + CTA comprar (optimista, refresca saldo vía
  `GamificationContext.refreshGotas`); saldo visible; mi inventario.
- `components/ItemCard.jsx`: ítem con precio, badge "tenés N", estado disabled si no
  alcanza el saldo.
- `EvaluationQuiz`: en el estado **bloqueado**, ofrecer "Usar intento extra" si hay
  uno en inventario (POST attempt con `usarIntentoExtra`).
- Toast de compra reutilizando el patrón de `GotaToast`/`AchievementToast`.

### Subfases (commitables, en orden) + versionado

Como en la Etapa 6: cada subfase cierra con un **MINOR**; el cierre corta el **MAJOR**.

| Subfase | Tag | Qué entrega |
|---|---|---|
| 7.1 Tienda backend ✅ | `v2.1.0` | Modelos + migración + seed de ítems + `gastarGotas` + `tienda.service` (comprar/inventario) + `/api/shop` (items, inventory, buy) + tests |
| 7.2 Efectos consumibles | `v2.2.0` | `congelar_racha` (en `actualizarRacha`) + `intento_extra` (en attempt) + `/use` + tests |
| 7.3 UI Tienda | `v2.3.0` | `Shop` + `ItemCard` + nav + saldo/inventario + intento extra en `EvaluationQuiz` + toast |
| 7.4 Tests + docs + cierre | `v3.0.0` | Route tests `/api/tienda`, README, smoke, cierre de etapa |

### Definition of Done — Etapa 7

- [ ] Comprar un ítem debita gotas del saldo (no del total) y suma al inventario.
- [ ] No se puede comprar sin saldo suficiente ni superar `limiteStack` (409).
- [ ] `congelar_racha` evita que la racha se rompa una vez, consumiéndose.
- [ ] `intento_extra` permite reintentar una evaluación bloqueada, consumiéndose.
- [ ] La tienda muestra catálogo, precios, saldo e inventario.
- [ ] `npm test` verde, cobertura ≥30% en `routes/` + `services/`.

### Decisiones tomadas

| Decisión | Razón |
|---|---|
| Solo **consumibles** (sin cosméticos) | El usuario los priorizó; tocan la mecánica y reusan sistemas existentes (racha, evaluaciones) |
| Gasto = `MovimientoGota` **negativo** | Un solo ledger audita ganancia y gasto; no se duplica contabilidad |
| Debita `gotasSaldo`, no `gotasTotal` | El total es lifetime ganado (ranking/niveles futuros); el saldo es lo gastable |
| Consumo de `congelar_racha` **lazy** | No hay scheduler; se aplica en la próxima actividad, como el premio del ranking |
| `multiplicador_gotas` por **ventana de 1 h** (`gotasMultiplicadorHasta`) | Estado temporal simple en `Usuario`, sin tabla de efectos activos ni scheduler |
| Ruta `/api/shop` (no `/api/tienda`) | Consistencia con los paths en inglés del resto de la API |

---

## Trabajo fuera del plan de etapa (side tracks)

- **Rediseño catálogo de Cursos (v2 + v2.1):** ✅ implementado. Histórico en
  [archive/courses-redesign.md](archive/courses-redesign.md). Pendiente opcional no
  bloqueante: repaso responsive 375px + checklist `design.md` §12.
- **Rediseño LearnCourse (3 columnas):** parcial. Backend de notas implementado
  (`NotaLeccion` + `GET/PUT /api/lessons/:id/note`). El layout de 3 columnas y la
  card "Profundiza" (stub de Claude API) viven como spec en `frontend/agent.md`.
