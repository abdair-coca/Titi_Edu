# AGENTS.md — Titi | Etapa 6: Gamificación + Titi Vivo

> **🔄 ETAPA 6 EN CURSO — corta `v2.0.0`.** Este documento es el **plan de acción** de la etapa: pasos concretos, cada uno con su **✅ verificación** antes de pasar al siguiente. Fuente de verdad del producto: `AGENTSGoal.md` (Etapa 6 en §9). El cierre de la Etapa 5 quedó en el tag `v1.0.0` y resumido en `AGENTSGoal.md` §9.

> **Etapas 1–5 cerradas.** App live: frontend `https://titiedu.vercel.app`, backend `https://titiedu-production.up.railway.app`.

---

## 1. Objetivo

> **Enganchar y retener.** Convertir el progreso en un loop diario adictivo —**gotas** (XP), **misiones diarias**, **ranking de amigos semanal**— y darle a Titi una presencia **viva** (SVG animado con Framer Motion) que reacciona a lo que pasa. Todo **entre amigos**, sin presión de extraños.

Done en una línea: si completar una lección no suma gotas, no hay misiones que resetean cada día, el ranking no compara solo con amigos, o Titi sigue siendo un PNG estático, la Etapa 6 **no** está cerrada.

---

## 2. Estado de partida

### Lo que reutilizo (ya existe, no se reinventa)

- **Racha** (`services/progress.service.js` → `actualizarRacha`) — se mantiene tal cual; las gotas son un sistema aparte que convive con la racha.
- **Logros** (`services/achievement.service.js`, modelos `Logro`/`LogroUsuario`) — patrón de "otorgar una vez" que imito para insignias semanales.
- **AchievementToast** (`components/AchievementToast.jsx`) — cola de toasts no bloqueante; lo reuso para los toasts de gotas.
- **ProgressContext** (`context/ProgressContext.jsx`) — ya tiene racha/logros; lo extiendo con gotas y eventos para Titi.
- **Puente dual-DB** — el cruce "gente que sigo (Neo4j) ↔ datos en Postgres" ya está resuelto en el feed académico (`routes/posts.js` `/feed/academic`). El ranking de amigos usa el mismo patrón.
- **TitiMascot** (`components/TitiMascot.jsx`) — hoy renderiza `/Titi.png` con props `mood`/`message`. Conservo la API (`mood`/`state`) y cambio el render interno a SVG animado.
- **Motion GSAP** (`lib/motion.js`, `motion.md`) — sigue para entradas/stagger de la UI. Framer Motion entra **solo** para mascota + gamificación.

### Lo que NO se toca

- Auth, CRUDs de cursos/módulos/lecciones/evaluaciones, panel admin, Cloudinary, paginación, deploy.
- La suite de tests hermética y el CI (se le agregan tests nuevos, no se reescribe).

### Decisión de stack

- **Framer Motion** = dependencia nueva del frontend (`npm i framer-motion`). Uso: mascota Titi + animaciones de gamificación (toasts de gotas, level-up, ranking). GSAP **se queda** para el resto. Conviven.
- **Mascota** = SVG vectorial de Titi por capas (lo armo de cero, on-brand), animado por estado con Framer. Reemplaza el `<img src="/Titi.png">` dentro de `TitiMascot`. El PNG queda de favicon/fallback.

---

## 3. Plan — Modelo de datos (Postgres)

Las gotas viven en **Postgres** (estructurado, atado al espejo `Usuario`). Esquema nuevo (canónico en `schema.prisma`):

```prisma
model Usuario {
  // ... campos existentes
  gotasSaldo Int @default(0)   // saldo gastable — acumula, SIN tienda aún (Etapa 7)
  gotasTotal Int @default(0)   // lifetime — alimenta ranking histórico y futuros niveles
  movimientosGota MovimientoGota[]
  misionesUsuario MisionUsuario[]
  insignias       InsigniaSemanal[]
}

model MovimientoGota {
  id        String   @id @default(uuid())
  usuarioId String
  cantidad  Int      // siempre > 0 en esta etapa (solo ganancia)
  motivo    String   // 'leccion'|'evaluacion'|'curso'|'mision'|'social_post'|'social_like'|'social_comment'|'social_follow'|'ranking_semanal'
  refId     String?  // id de lección/evaluación/post/etc — auditoría + idempotencia
  createdAt DateTime @default(now())
  usuario   Usuario  @relation(fields: [usuarioId], references: [id])
  @@index([usuarioId, createdAt])   // sumar por semana
}

model Mision {
  id          String  @id @default(uuid())
  codigo      String  @unique  // 'completar_2_lecciones'
  titulo      String
  descripcion String
  evento      String  // qué evento la avanza: 'leccion'|'evaluacion'|'post'|'comentario'|'follow'
  meta        Int     // cuántas veces (ej. 2)
  recompensa  Int     // gotas al completar
  activa      Boolean @default(true)
  asignaciones MisionUsuario[]
}

model MisionUsuario {
  id         String  @id @default(uuid())
  usuarioId  String
  misionId   String
  fecha      String  // 'YYYY-MM-DD' del día asignado (TZ server)
  progreso   Int     @default(0)
  completada Boolean @default(false)
  usuario    Usuario @relation(fields: [usuarioId], references: [id])
  mision     Mision  @relation(fields: [misionId], references: [id])
  @@unique([usuarioId, misionId, fecha])
  @@index([usuarioId, fecha])
}

model InsigniaSemanal {
  id          String   @id @default(uuid())
  usuarioId   String
  semana      String   // 'YYYY-Www' (ISO week)
  puesto      Int      // 1 = top de su grupo de amigos esa semana
  gotasSemana Int
  createdAt   DateTime @default(now())
  usuario     Usuario  @relation(fields: [usuarioId], references: [id])
  @@unique([usuarioId, semana])
}
```

---

## 4. Plan — Servicios y reglas

### 4.1 Balance de gotas (tabla canónica)

| Acción | Motivo | Gotas | Tope diario |
|---|---|---|---|
| Completar lección | `leccion` | 10 | — (idempotente por lección) |
| Aprobar evaluación | `evaluacion` | 20 | — (idempotente por evaluación) |
| Completar curso | `curso` | 50 | — (idempotente por curso) |
| Completar misión diaria | `mision` | según misión (10–20) | 3 misiones/día |
| Publicar post | `social_post` | 5 | 2/día |
| Recibir un like | `social_like` | 1 | 10/día |
| Comentar | `social_comment` | 2 | 5/día |
| Seguir a alguien | `social_follow` | 3 | 3/día |
| Top del ranking semanal | `ranking_semanal` | 50 | 1/semana |

- **Idempotencia (aprendizaje):** un mismo `(usuarioId, motivo, refId)` otorga gotas **una sola vez** (la lección X no paga dos veces).
- **Anti-farmeo (social):** cada motivo social tiene un tope diario; al alcanzarlo, la acción sigue funcionando pero no otorga más gotas ese día.
- Otorgar gotas **incrementa `gotasSaldo` y `gotasTotal`** y escribe un `MovimientoGota`.

### 4.2 `services/gotas.service.js` (nuevo)

- `otorgarGotas(usuarioId, motivo, { refId, cantidad })` → aplica idempotencia/topes, escribe `MovimientoGota`, actualiza `Usuario`. Devuelve `{ otorgadas, saldo, total }`. **Nunca rompe** el flujo principal (try/catch que loguea).
- `gotasDeLaSemana(usuarioId, semanaISO)` → suma `MovimientoGota` de esa semana.
- `topeAlcanzado(usuarioId, motivo, fecha)` → helper de cap diario.

### 4.3 `services/mision.service.js` (nuevo)

- `asignarMisionesDelDia(usuarioId)` → idempotente: si no hay `MisionUsuario` para hoy, elige 3 misiones activas al azar y las asigna.
- `avanzarMisiones(usuarioId, evento, n = 1)` → suma `progreso` a las misiones de hoy cuyo `evento` matchea; al llegar a `meta`, marca `completada` y otorga `recompensa` vía `gotas.service`.
- `misionesDeHoy(usuarioId)` → asigna si faltan y devuelve las 3 con progreso.

### 4.4 `services/ranking.service.js` (nuevo)

- `rankingAmigos(usuarioId, semanaISO)` → toma los seguidos desde Neo4j (`MATCH (me)-[:SIGUIO]->(amigo)`), mapea a `Usuario` de Postgres por `neoId`, suma gotas de la semana de cada uno + las mías, ordena DESC. Devuelve lista + mi posición.
- `cerrarSemanaYPremiar(usuarioId)` → **lazy**: al primer acceso en una semana nueva, calcula mi puesto en el ranking de **la semana pasada**; si fui #1 de mi grupo, escribe `InsigniaSemanal` + otorga `ranking_semanal` (idempotente por `@@unique([usuarioId, semana])`).

> **"Top de su grupo de amigos":** cada usuario compite contra la gente que sigue. Ser #1 de tu propio círculo es el premio — coherente con "solo amigos" y computable sin cohortes globales.

---

## 5. Plan — Integración en triggers existentes

| Trigger existente | Qué agrego |
|---|---|
| `POST /api/lessons/:id/complete` | `otorgarGotas('leccion', refId=leccionId)` + `avanzarMisiones('leccion')` |
| `POST /api/evaluations/:id/attempt` (aprobado) | `otorgarGotas('evaluacion', refId=evalId)` + `avanzarMisiones('evaluacion')`; si curso completo → `otorgarGotas('curso', refId=cursoId)` |
| `POST /api/posts` | `otorgarGotas('social_post', refId=postId)` + `avanzarMisiones('post')` |
| `POST /api/posts/:id/like` (al dar like) | `otorgarGotas(ownerId, 'social_like', refId=postId)` (gana el dueño del post) |
| `POST /api/comments` | `otorgarGotas('social_comment')` + `avanzarMisiones('comentario')` |
| `POST /api/users/:username/follow` | `otorgarGotas('social_follow')` + `avanzarMisiones('follow')` |

Todas las llamadas a gotas/misiones van **después** de la operación principal y **nunca la bloquean** (try/catch).

---

## 6. Plan — Endpoints nuevos

```
GET  /api/gotas                  → { saldo, total, semana }
GET  /api/gotas/history          → movimientos paginados (cursor por createdAt)
GET  /api/missions/today         → 3 misiones de hoy con progreso (asigna si faltan)
GET  /api/ranking/friends        → leaderboard semanal de amigos + mi posición (dispara premio lazy)
```

---

## 7. Plan — Frontend

- **Dep:** `framer-motion`.
- **`components/titi/TitiSvg.jsx` (nuevo):** SVG de Titi por capas (cuerpo, cabeza, orejas, ojos, hocico, brazos, cola), con `ref`/ids por parte.
- **`TitiMascot.jsx` (re-hecho):** prop `state` (`idle`|`celebra`|`triste`|`racha`|`nivel`) → variants de Framer Motion sobre las partes. Respeta `useReducedMotion`. Mantiene props `message`/`size`.
- **Gamificación (Framer):** `GotasCounter`, `GotaToast` (sobre la cola de `AchievementToast`), `DailyMissions` (panel), `FriendsLeaderboard` (página/sección), `LevelUp`/celebración.
- **Context:** extender `ProgressContext` con `gotas` + un emisor de eventos para que Titi reaccione.
- **Surface:** contador de gotas + racha visibles en `Navbar` (principio de diseño §1.3 "progreso a la vista").
- **Doc:** extender `motion.md` con una sección de Framer (o `motion-react.md`): patrones, variants por estado, reduced-motion.

---

## 8. Decisiones tomadas

| Decisión | Razón |
|---|---|
| Gotas en **Postgres**, no Neo4j | Es dato estructurado del usuario; el ledger y las sumas semanales son SQL natural |
| **Ledger** `MovimientoGota` + denormalizado en `Usuario` | El ledger audita y permite sumar por semana; el denormalizado da lecturas rápidas |
| Gotas "**para ambos**" (saldo + total), **sin tienda** | Modelo listo para la tienda de Etapa 7; esta etapa solo acumula |
| Racha **separada** de gotas | Son dos sistemas; la racha ya existe y funciona, no la mezclo |
| Ranking **solo amigos**, premio = #1 de tu círculo | Fiel a "cálido, sin presión de extraños"; computable sin cohortes globales |
| Premio semanal **lazy** (sin scheduler) | No hay cron; se calcula al primer acceso de la semana nueva. Cron opcional en Railway si hace falta |
| **Framer Motion** solo mascota + gamificación | Aislar el cambio; no migrar GSAP (riesgo/tiempo) |
| **SVG propio** de Titi (lo armo yo) | Rive es de pago; un SVG por capas se anima con Framer y no depende de un artista externo |

### Pendiente de confirmar (no bloquea; defino en ejecución)

1. **Pool inicial de misiones** — propuesta: `completar_2_lecciones`, `aprobar_1_evaluacion`, `publicar_1_post`, `comentar_1_leccion`, `seguir_1_persona`. Se siembran en `seed.js`.
2. **Niveles a partir de `gotasTotal`** — fuera de alcance; las gotas quedan listas para habilitarlos en Etapa 7.

---

## 9. Subfases — pasos de acción con verificación

Seis subfases en orden de dependencia. **Cada paso tiene su `✅ Verificar`**; no se pasa al siguiente sin que pase. Cada subfase cierra como **commit + tag de subversión** (un MINOR), para que el historial documente el avance. El cierre de la etapa corta el MAJOR `v2.0.0`.

```
6.1 (Gotas) ─► 6.2 (Misiones) ─► 6.3 (Ranking) ─► 6.5 (UI gamif.) ─► 6.6 (Tests+docs+cierre)
                                                      ▲
6.4 (Titi vivo) ──────────────────────────────────────┘   (paraleliza; lo consume 6.5)
```

### Versionado de la etapa (subversiones)

Cada subfase, al cerrar con su checkpoint verificado, se mergea a `main` y se taggea con un **MINOR**. El número de MINOR sigue el **orden de cierre real** (si 6.4 se mergea antes que 6.3, toma el MINOR anterior). El cierre de la etapa (6.6) corta el **MAJOR `v2.0.0`**.

| Subfase | Tag | Qué documenta |
|---|---|---|
| 6.1 Gotas | `v1.1.0` | Economía de gotas (ledger + service + triggers) |
| 6.2 Misiones | `v1.2.0` | Misiones diarias con recompensa |
| 6.3 Ranking | `v1.3.0` | Ranking de amigos semanal + premio |
| 6.4 Titi vivo | `v1.4.0` | Mascota SVG animada (Framer Motion) |
| 6.5 UI gamif. | `v1.5.0` | Contadores, toasts, panel, leaderboard |
| 6.6 Cierre | `v2.0.0` | Tests + docs + cierre de etapa (MAJOR) |

**Por tag:** `git tag -a vX.Y.0 -m "Etapa 6.N — <título>"` con identidad `abdair-coca <cocaabdair@gmail.com>`, luego `git push origin main --follow-tags`. Un bugfix dentro de una subversión ya taggeada → patch (`v1.1.1`…).

---

### 🔄 Subfase 6.1 — Economía de gotas

**Objetivo:** completar una lección/evaluación/curso y la actividad social otorgan gotas, con idempotencia y topes.

**Archivos:** `prisma/schema.prisma` (+ migración), `services/gotas.service.js` (nuevo), `routes/gotas.js` (nuevo), `routes/lessons.js`, `routes/evaluations.js` (o `progress.service.js`), `routes/posts.js`, `routes/comments.js`, `routes/users.js`, `index.js`/`app.js`, `test/services/gotas.service.test.js` (nuevo).

**Pasos:**
1. Agregar a `schema.prisma`: `Usuario.gotasSaldo`, `Usuario.gotasTotal`, modelo `MovimientoGota`. Migración `gotas`.
   - **✅ Verificar:** `npx prisma migrate dev --name gotas` aplica sin error; en Prisma Studio el `Usuario` muestra `gotasSaldo=0`/`gotasTotal=0` y existe la tabla `MovimientoGota`.
2. `gotas.service.js`: `otorgarGotas` (idempotencia por `(usuarioId, motivo, refId)`, topes diarios sociales), `gotasDeLaSemana`, `topeAlcanzado`. Todo en try/catch.
   - **✅ Verificar:** unit test `gotas.service.test.js` (mock prisma) cubre: otorga learning una vez (segunda llamada no duplica), social respeta tope diario, suma semanal. `npm test` verde.
3. Montar `GET /api/gotas` y `GET /api/gotas/history`.
   - **✅ Verificar:** `curl -H "Authorization: Bearer <token>" localhost:3001/api/gotas` → `{ success, data: { saldo, total, semana } }`.
4. Integrar en triggers de **aprendizaje**: lección complete (+10), evaluación aprobada (+20), curso completo (+50).
   - **✅ Verificar:** completar una lección desde la UI local → `GET /api/gotas` sube +10; repetir la misma lección no vuelve a sumar.
5. Integrar en triggers **sociales** con topes: post (+5, máx 2/día), like recibido (+1, máx 10/día), comentario (+2, máx 5/día), follow (+3, máx 3/día).
   - **✅ Verificar:** crear 3 posts → solo los 2 primeros suman (tope); el `MovimientoGota` lo confirma en Prisma Studio.

**Checkpoint 6.1:** las gotas suben por aprender y por social; idempotencia y topes funcionan; `npm test` verde; commit `feat(gotas): economía de gotas (ledger + service + triggers)` → **tag `v1.1.0`**.

---

### 🔄 Subfase 6.2 — Misiones diarias

**Objetivo:** 3 misiones por día que resetean y otorgan gotas al completarse.

**Depende de:** 6.1 (las misiones pagan gotas).

**Archivos:** `prisma/schema.prisma` (+ migración), `prisma/seed.js` (pool de misiones), `services/mision.service.js` (nuevo), `routes/missions.js` (nuevo), integración en triggers (reusar los de 6.1), `test/services/mision.service.test.js` (nuevo).

**Pasos:**
6. Modelos `Mision` + `MisionUsuario`. Migración `misiones`. Sembrar el pool en `seed.js` (idempotente por `codigo`).
   - **✅ Verificar:** `npm run seed` crea las misiones; Prisma Studio las muestra; re-correr el seed no duplica.
7. `mision.service.js`: `asignarMisionesDelDia` (idempotente), `avanzarMisiones`, `misionesDeHoy`.
   - **✅ Verificar:** unit test cubre asignación idempotente (no re-asigna el mismo día), avance hasta `meta` marca `completada` y otorga gotas. `npm test` verde.
8. `GET /api/missions/today` (asigna si faltan).
   - **✅ Verificar:** `curl .../api/missions/today` devuelve 3 misiones con `progreso`/`completada`; segunda llamada el mismo día devuelve las mismas.
9. Conectar `avanzarMisiones` a los triggers (lección, evaluación, post, comentario, follow).
   - **✅ Verificar:** completar la acción de una misión sube su `progreso`; al llegar a `meta`, `completada=true` y `GET /api/gotas` refleja la recompensa.

**Checkpoint 6.2:** hay 3 misiones diarias que avanzan con eventos reales y pagan gotas al completarse; reset por día verificado; commit `feat(misiones): misiones diarias con recompensa en gotas` → **tag `v1.2.0`**.

---

### 🔄 Subfase 6.3 — Ranking de amigos semanal + premio

**Objetivo:** leaderboard semanal de gotas entre amigos, con premio al top al cerrar la semana.

**Depende de:** 6.1 (gotas) y el follow-graph de Neo4j (ya existe).

**Archivos:** `prisma/schema.prisma` (+ migración `InsigniaSemanal`), `services/ranking.service.js` (nuevo), `routes/ranking.js` (nuevo), `test/services/ranking.service.test.js` (nuevo).

**Pasos:**
10. Modelo `InsigniaSemanal`. Migración `insignia_semanal`.
    - **✅ Verificar:** migración aplica; tabla visible en Prisma Studio.
11. `ranking.service.js`: `rankingAmigos` (cruce Neo4j seguidos ↔ Postgres gotas de la semana, ordenado).
    - **✅ Verificar:** unit test con prisma+Neo4j mockeados arma un ranking ordenado e incluye al usuario; `npm test` verde.
12. `cerrarSemanaYPremiar` (lazy): al entrar en semana nueva, si fui #1 de mi grupo la semana pasada → `InsigniaSemanal` + `otorgarGotas('ranking_semanal', +50)`, idempotente por semana.
    - **✅ Verificar:** unit test simula "semana pasada" con un ganador → escribe insignia una sola vez (segunda llamada no duplica).
13. `GET /api/ranking/friends` (devuelve leaderboard + mi posición; dispara el premio lazy).
    - **✅ Verificar:** `curl .../api/ranking/friends` devuelve lista ordenada con `gotasSemana` y `miPosicion`.

**Checkpoint 6.3:** el ranking compara solo amigos por gotas de la semana; el premio al top se otorga una vez por semana; commit `feat(ranking): ranking de amigos semanal + premio al top` → **tag `v1.3.0`**.

---

### 🔄 Subfase 6.4 — Titi vivo (SVG + Framer Motion)

**Objetivo:** Titi pasa de PNG a SVG por capas animado por estado, reactivo a eventos.

**Depende de:** nada (paraleliza con 6.1–6.3). Lo consume 6.5.

**Archivos:** `package.json` (+ `framer-motion`), `components/titi/TitiSvg.jsx` (nuevo), `components/TitiMascot.jsx` (re-hecho), `motion.md` (o `motion-react.md`).

**Pasos:**
14. `npm i framer-motion`.
    - **✅ Verificar:** `npm run build` del frontend sigue verde con la dep nueva.
15. `TitiSvg.jsx`: SVG de Titi por capas (cuerpo, cabeza, orejas, ojos, hocico, brazos, cola), paleta `titi-*`.
    - **✅ Verificar:** renderizar `<TitiSvg/>` en una página de prueba se ve como Titi (mono amarillo, on-brand) y es nítido a cualquier tamaño.
16. `TitiMascot.jsx`: prop `state` con variants Framer por parte (idle bob, celebra rebote, triste caída, racha). Respeta `useReducedMotion`.
    - **✅ Verificar:** cambiar `state` cambia la animación; con `prefers-reduced-motion` activado Titi queda quieto (sin animación).
17. Reemplazar usos de `TitiMascot` que hoy muestran el PNG; el PNG queda solo de favicon/fallback. Doc de Framer en `motion.md`.
    - **✅ Verificar:** grep de `Titi.png` no aparece en componentes de UI (solo favicon/manifest); las pantallas que usaban TitiMascot muestran el SVG animado.

**Checkpoint 6.4:** Titi es un SVG animado por estado, reactivo y accesible; commit `feat(titi): mascota SVG animada con Framer Motion` → **tag `v1.4.0`**.

---

### 🔄 Subfase 6.5 — UI de gamificación

**Objetivo:** mostrar gotas, misiones y ranking en la app, con Titi reaccionando.

**Depende de:** 6.1–6.4.

**Archivos:** `context/ProgressContext.jsx` (extender), `components/GotasCounter.jsx`, `components/GotaToast.jsx`, `components/DailyMissions.jsx`, `pages/Leaderboard.jsx` (o sección), `components/Navbar.jsx`, `App.jsx` (ruta), integración en `Feed`/`LearnCourse`/`Profile`.

**Pasos:**
18. Extender `ProgressContext` con `gotas` (fetch `/api/gotas`) + emisor de eventos para Titi.
    - **✅ Verificar:** un componente consume `gotas` del context y muestra el saldo real.
19. `GotasCounter` + racha en `Navbar` (desktop y bottom nav móvil).
    - **✅ Verificar:** el contador refleja el saldo y sube al ganar gotas sin recargar.
20. `GotaToast`: al ganar gotas (lección/misión), toast con Titi en `state="celebra"`.
    - **✅ Verificar:** completar una lección dispara el toast con la cantidad correcta; no bloquea la UI.
21. `DailyMissions` (panel en Feed o Home) + `Leaderboard` (página/sección con ruta).
    - **✅ Verificar:** el panel muestra las 3 misiones de hoy con su progreso; el leaderboard lista a los amigos por gotas de la semana con mi posición resaltada.
22. Celebración de premio semanal (`LevelUp`/overlay) cuando hay insignia nueva.
    - **✅ Verificar:** simular ser top de la semana → al entrar, aparece la celebración con Titi.

**Checkpoint 6.5:** gotas/misiones/ranking visibles y reactivos; Titi celebra los eventos; commit `feat(gamif): UI de gotas, misiones, ranking y celebraciones` → **tag `v1.5.0`**.

---

### 🔄 Subfase 6.6 — Tests, docs y cierre

**Objetivo:** cerrar cobertura, documentar y cortar `v2.0.0`.

**Depende de:** 6.1–6.5.

**Archivos:** `test/routes/*` (gotas, missions, ranking), `README.md`, `AGENTSGoal.md` (§9/§16), `motion.md`, este doc (§12 cierre).

**Pasos:**
23. Integration tests (supertest, mocks) de `/api/gotas`, `/api/missions`, `/api/ranking/friends` con guards 401.
    - **✅ Verificar:** `npm run test:coverage` verde, cobertura **≥30%** en `routes/` + `services/`.
24. README: sección de gamificación (gotas, misiones, ranking) + nota de Framer Motion; `motion.md` con la sección React.
    - **✅ Verificar:** alguien nuevo entiende cómo se ganan gotas leyendo el README.
25. Smoke E2E en local/prod: completar lección → gotas + toast Titi → misión avanza → ranking refleja → (simular) premio semanal.
    - **✅ Verificar:** los 9 ítems del DoD (§10) tildados.
26. Cerrar Etapa 6 en `AGENTSGoal.md` §9/§16 (✅, `v2.0.0`), llenar §12 de este doc, tag `v2.0.0`.
    - **✅ Verificar:** `git tag -l` muestra `v2.0.0` sobre `main` con árbol limpio y CI verde.

**Checkpoint 6.6:** DoD tildado, docs al día, tag `v2.0.0` publicado.

---

## 10. Definition of Done — Etapa 6

- [ ] Completar una lección otorga gotas y dispara una animación de Titi.
- [ ] Las gotas por actividad social tienen tope diario (anti-farmeo) y el aprendizaje es idempotente.
- [ ] Hay 3 misiones diarias que resetean cada día y otorgan gotas al completarse.
- [ ] El ranking de amigos muestra gotas de la semana, solo de gente que sigo.
- [ ] Al cerrar la semana, el top de su grupo recibe gotas + insignia (idempotente).
- [ ] Titi es un SVG animado por partes (Framer Motion), reactivo a eventos, que respeta `prefers-reduced-motion`.
- [ ] La economía guarda saldo gastable (listo para la tienda futura) aunque no haya tienda.
- [ ] Contador de gotas + racha visibles en la navegación principal.
- [ ] `npm test` verde, cobertura ≥30% en `routes/` + `services/`.

---

## 11. Convenciones (actualizadas para Etapa 6)

- **Diseño**: todo componente nuevo pasa checklist de `frontend/design.md` §12.
- **Motion**: GSAP (`lib/motion.js`, `motion.md`) para UI; **Framer Motion** para mascota + gamificación. Ambos respetan `prefers-reduced-motion`.
- **UI plana**: sin `bg-gradient-*` ni `blur-*` en componentes nuevos.
- **Mascota Titi**: **SVG animado** vía `TitiMascot` (Framer). El `/Titi.png` queda solo de favicon/fallback. Nunca emoji 🐒.
- **Respuesta API**: `{ success, data }` éxito; `{ success: false, message }` error.
- **Gotas/misiones/ranking**: las llamadas a `gotas.service`/`mision.service` van **después** de la operación principal y **nunca la bloquean** (try/catch que loguea).
- **Nombres**: modelos Prisma, nodos/relaciones Neo4j y campos en **español**. Código en **inglés**.
- **Commits**: prefijos en español (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, `test:`).
- **Tests**: cada subfase de backend agrega sus tests (CI verde por subfase). Suite hermética (prisma/Neo4j mockeados).
- **Versionado**: cada subfase cierra con un **MINOR** (`v1.1.0`…`v1.5.0`, ver §9) y la etapa corta el **MAJOR `v2.0.0`** al cerrar (`AGENTSGoal.md` §16). Bugfix sobre una subversión ya taggeada → patch (`v1.1.1`…).

---

## 12. Cierre — Etapa 6

> _Se llena al cerrar la etapa (mismo formato que Etapa 5 §11): changelog de commits por subfase, desvíos/deuda técnica, y tag `v2.0.0`._
