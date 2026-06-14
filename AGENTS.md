# AGENTS.md — Titi | Etapa 4: Integración Social + Admin

> **✅ ETAPA 4 CERRADA.** Las 6 subfases entregadas y verificadas. Ver §10 (Cierre) para el changelog de commits. La fuente de verdad del producto sigue siendo `AGENTSGoal.md`.

Este documento ahora registra **qué se entregó** en la Etapa 4 (era el plan). Fuente de verdad del producto: `AGENTSGoal.md`.

> **Etapas 1, 2, 3 y 4 cerradas.** Ver `AGENTSGoal.md` §9 para el resumen de etapas.

---

## 1. Objetivo

> **Convertir Titi en red social donde aprendizaje es visible y descubrible.**
> Amigos ven qué cursos toman otros, recomendaciones salen de la red, admin gobierna catálogo sin tocar DB.

Done en una línea: si para verificar profesor, cambiar rol, recomendar curso o ver actividad de amigos esta semana hay que abrir Prisma Studio o `curl`, Etapa 4 **no** está cerrada.

---

## 2. Estado actual

### Backend

| Área | Estado | Detalle |
|---|---|---|
| Auth + espejo Neo4j↔Postgres | ✅ | `auth.js`, helper `loadCurrentUser` en cada ruta Postgres |
| Cursos / Módulos / Lecciones / Materiales | ✅ | CRUDs completos con guard de autor y rol |
| Evaluaciones + Intentos | ✅ | `routes/evaluations.js` con grading server-side |
| Servicios | ✅ | `progress.service.js` (racha + completion), `achievement.service.js` (catálogo + checkers) |
| `POST /api/auth/become-teacher` | ✅ eliminado | Removido de `auth.js`; el rol se asigna vía admin |
| `routes/admin.js` | ✅ | 10 endpoints con `requireRole('ADMIN')`, montado en `/api/admin` |
| Propagación eventos sociales Neo4j | ✅ | `neo4j-sync.service.js`: `INSCRITO_EN`, `COMPLETO_CURSO`, notif `logro` |
| Feed académico | ✅ | `GET /api/posts/feed/academic` |
| Recomendaciones por amigos | ✅ | `GET /api/courses/recommended` |

### Frontend

| Área | Estado | Detalle |
|---|---|---|
| Navbar con guard `PROFESOR/ADMIN` | ✅ | Entrada "Enseñar" condicional en sidebar desktop |
| Bottom nav contextual por rol en mobile | ✅ | Slot "Mis cursos" → "Enseñar" para PROFESOR/ADMIN |
| `pages/admin/*` | ✅ | Dashboard, Users, Courses, Categories + guard `AdminOnly` |
| Tarjeta "Actividad académica" en Feed | ✅ | `AcademicActivityCard` intercalada por fecha |
| Sección "Recomendados por amigos" en Cursos | ✅ | `RecommendedCourseCard` + sección en `Courses` |
| Acceso a /teacher en mobile | ✅ | Bottom nav muestra "Enseñar" para profes |
| Acceso a /admin (sidebar + mobile) | ✅ | Entrada "Admin" en sidebar y en `MobileTopBar` solo ADMIN |

---

## 3. Plan — Backend

### 3.1 Propagación a Neo4j (hacer primero)

Replicar a Neo4j en `try/catch` que **nunca rompa respuesta principal** (patrón en `titi-backend-patterns.md` §9).

**En `POST /api/courses/:id/enroll`** (`routes/courses.js`) — después de crear `Inscripcion`:

```cypher
MATCH (u:Usuario {id: $neoId})
MERGE (ref:CursoRef {cursoId: $cursoId})
MERGE (u)-[r:INSCRITO_EN]->(ref)
ON CREATE SET r.fechaInscripcion = datetime()
```

**En `checkCursoCompletado`** (`services/progress.service.js`) — cuando `nuevo === true`:

```cypher
MATCH (u:Usuario {id: $neoId})
MERGE (ref:CursoRef {cursoId: $cursoId})
MERGE (u)-[r:COMPLETO_CURSO]->(ref)
ON CREATE SET r.fechaCompletado = datetime()
```

Llegar al `neoId`: leer `Usuario.neoId` con `findUnique`.

**En logros** (`services/achievement.service.js` `otorgarLogro`) — al desbloquear:

```cypher
MATCH (autor:Usuario {id: $neoId})<-[:SIGUIO]-(follower:Usuario)
WITH autor, follower
MERGE (follower)<-[:RECIBIO]-(n:Notificacion {
  type: 'logro', actorId: $neoId, logroNombre: $nombre
})
ON CREATE SET n.id = randomUUID(), n.read = false, n.createdAt = datetime()
MERGE (n)-[:SOBRE]->(autor)
```

Tipo nuevo: `'logro'`. Manejar en render del frontend.

### 3.2 Feed académico — `routes/posts.js`

Endpoint **`GET /api/posts/feed/academic`** (autenticado): actividad reciente de gente que sigo.

Lista única ordenada por timestamp DESC:
- `(yo)-[:SIGUIO]->(amigo)-[r:INSCRITO_EN]->(:CursoRef)` → tipo `inscripcion`
- `(yo)-[:SIGUIO]->(amigo)-[r:COMPLETO_CURSO]->(:CursoRef)` → tipo `curso_completado`
- `(yo)-[:SIGUIO]->(amigo)<-[:SOBRE]-(:Notificacion {type:'logro'})` → tipo `logro`

Devolver `{ actorUsername, actorAvatarUrl, type, cursoId?, logroNombre?, createdAt }`. Resolver `cursoId` → `{ titulo, categoria }` con `prisma.curso.findMany({ where: { id: { in: cursoIds } } })`.

**Privacidad:** solo gente que sigo.

### 3.3 Recomendaciones — `routes/courses.js`

Endpoint **`GET /api/courses/recommended`** (autenticado): cursos publicados que amigos ya tomaron, donde yo no estoy inscrito.

```cypher
MATCH (yo:Usuario {id: $neoId})-[:SIGUIO]->(amigo:Usuario)-[:INSCRITO_EN]->(ref:CursoRef)
WHERE NOT EXISTS { (yo)-[:INSCRITO_EN]->(ref) }
RETURN ref.cursoId as cursoId, count(DISTINCT amigo) as friendCount,
       collect(DISTINCT amigo.username)[0..3] as sampleFriends
ORDER BY friendCount DESC
LIMIT 12
```

Hidratar contra Postgres (`publicado: true`). Devolver `{ curso, friendCount, sampleFriends }`.

### 3.4 Admin — `routes/admin.js` (todo nuevo)

Middleware: `requireAuth + requireRole('ADMIN')`.

| Método | Ruta | Notas |
|---|---|---|
| `GET` | `/api/admin/users` | Lista paginada con `rol`, `verificado`, `racha`, conteo de cursos |
| `PUT` | `/api/admin/users/:id/verify` | `verificado=true`, solo si `rol=PROFESOR` |
| `PUT` | `/api/admin/users/:id/role` | Body: `{ rol: 'ESTUDIANTE'\|'PROFESOR'\|'ADMIN' }`. Validar enum |
| `GET` | `/api/admin/courses` | Incluye borradores. Filtros `?publicado=` |
| `PUT` | `/api/admin/courses/:id/approve` | Marca como `publicado` (opcional) |
| `DELETE` | `/api/admin/courses/:id` | Override del 409 — borra con inscripciones. Cascada completa |
| `GET` | `/api/admin/stats` | Totales: usuarios, profes verificados, cursos publicados, inscripciones, certificados |
| `POST` | `/api/admin/categories` | CRUD movido desde `categories.js` |
| `PUT` | `/api/admin/categories/:id` | Editar nombre/icono |
| `DELETE` | `/api/admin/categories/:id` | 409 si tiene cursos asociados |

Registrar en `src/index.js`. Sembrar **al menos un ADMIN demo** en `prisma/seed.js` (`admin_demo@titi.local`).

### 3.5 Eliminar endpoint temporal

Borrar `POST /api/auth/become-teacher` de `routes/auth.js`. En `MyTeaching.jsx`: quitar botón "Convertirme en profesor (dev)", reemplazar con "Pedile a un admin que te active el rol".

---

## 4. Plan — Frontend (estudiante)

### 4.1 Feed académico mezclado

En `pages/Feed.jsx`: montar, fetchear en paralelo `/api/posts/feed` y `/api/posts/feed/academic`, mezclar por `createdAt` DESC.

Componente nuevo `components/AcademicActivityCard.jsx` (design.md §5.4):

- Header: avatar + nombre + verbo según tipo
  - `inscripcion` → "{user} se inscribió en" + 📚
  - `curso_completado` → "{user} completó" + 🎓
  - `logro` → "{user} desbloqueó el logro" + 🏅
- Tipos de curso: tarjeta compacta con CTA "Ver este curso →"
- `logro`: chip (icono + nombre)

UI plana — sin gradientes/blur.

### 4.2 Recomendaciones por amigos en Cursos

En `pages/Courses.jsx`, debajo del header, antes del catálogo:

```jsx
{recommended.length > 0 && (
  <section aria-label="Recomendados por tus amigos">
    <h2 className="text-lg font-bold text-titi-dark mb-3">
      Tus amigos están aprendiendo
    </h2>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {recommended.map(({ curso, friendCount, sampleFriends }) => (
        <RecommendedCourseCard ... />
      ))}
    </div>
  </section>
)}
```

`RecommendedCourseCard` reusa `CourseCard` + chip "🤝 N amigos" con tooltip de `sampleFriends`.

Solo para `isAuthenticated`. No bloquea catálogo si vacío.

### 4.3 Notificación de logros de amigos

En `pages/Notifications.jsx`, manejar `type: 'logro'`. Render: "@{user} desbloqueó el logro {nombre} 🏅".

---

## 5. Plan — Frontend (admin)

### 5.1 Estructura

```
pages/admin/
├── AdminDashboard.jsx   ← stats + entradas a sub-paneles
├── AdminUsers.jsx       ← tabla de usuarios, verificar profesor, cambiar rol
├── AdminCourses.jsx     ← todos los cursos (incl. borradores) + delete forzado
└── AdminCategories.jsx  ← CRUD categorías
```

Rutas en `App.jsx`:

```
/admin                → AdminDashboard
/admin/users          → AdminUsers
/admin/courses        → AdminCourses
/admin/categories     → AdminCategories
```

Guard nuevo `AdminOnly` (paralelo a `TeacherOnly`): si `user.rol !== 'ADMIN'`, redirect a `/feed`.

### 5.2 Entrada en Navbar

`NavLink to="/admin"` en sidebar desktop **solo si `user.rol === 'ADMIN'`** (mismo patrón que "Enseñar" — ver [Navbar.jsx:138-143](frontend/src/components/Navbar.jsx:138)).

### 5.3 Acceso a /admin desde mobile

Mantener "Enseñar" en bottom nav. Agregar acceso a `/admin` desde menú del avatar en `MobileTopBar` (admin es rol menos frecuente). Bottom nav: 5 columnas fijas.

---

## 6. Decisiones tomadas

| Decisión | Razón |
|---|---|
| Propagación Neo4j **no bloquea** Postgres | Postgres fuente de verdad educativa. Neo4j falla → loguear + responder OK |
| Nodos `:CursoRef` con `cursoId` en Neo4j | Evita duplicar `Curso` en ambas DBs |
| Notificaciones de logros via Neo4j | Mismo grafo que likes/follows. `:RECIBIO`/`:SOBRE` ya existe |
| Admin override del 409 borrar curso | Única forma de limpiar cursos abusivos sin SQL |
| Eliminar `become-teacher` en esta etapa | Admin lo hace innecesario y peligroso |
| Sin paginación pesada en feed académico | Limit 50 alcanza. Paginación real en Etapa 5 |

### Pendiente de confirmar

1. **Aprobación de cursos** — Default: `publicado` del profesor alcanza, `/approve` queda como fallback.
2. **Override inscripciones al borrar curso** — Propuesta: borrar inscripciones + progresos, **preservar certificados**.

---

## 7. Subfases de la Etapa 4

Seis subfases en orden de dependencia. Cada una es una **unidad commitable**: cierra con su checkpoint verificado antes de pasar a la siguiente. Mapa de dependencias:

```
4.1 (base Neo4j) ──┬─► 4.2 (endpoints sociales) ──► 4.4 (frontend estudiante)
                   └─► 4.3 (backend admin) ───────► 4.5 (frontend admin)
                                                          └─► 4.6 (cierre)
```

4.2 y 4.3 son paralelizables tras 4.1. 4.6 depende de todas.

---

### ✅ Subfase 4.1 — Base de propagación a Neo4j  ·  `7f2417a`

**Objetivo:** que toda operación educativa relevante quede reflejada en el grafo social. Alimenta 4.2 y las recomendaciones.

**Depende de:** nada (arranca aquí).

**Archivos:** `services/neo4j-sync.service.js` (nuevo), `routes/courses.js`, `services/progress.service.js`, `services/achievement.service.js`, `prisma/seed.js`.

**Pasos:**
1. Helper `replicateToNeo4j(fn)` en `services/` — concentra el patrón `try/catch` que loguea pero no rompe (ver §3.1).
2. `INSCRITO_EN` en `POST /api/courses/:id/enroll`, después de crear `Inscripcion`.
3. `COMPLETO_CURSO` en `checkCursoCompletado` cuando `nuevo === true`.
4. Notificación `type: 'logro'` a seguidores en `otorgarLogro`.
5. Seed `admin_demo@titi.local` (rol `ADMIN`, mismo `SEED_PASSWORD`).

**Checkpoint:** inscribirse y completar un curso crea las relaciones en Aura (verificar con `MATCH (u)-[r:INSCRITO_EN|COMPLETO_CURSO]->(ref) RETURN r`). Desbloquear logro crea `:Notificacion {type:'logro'}`. Cae Aura → la operación Postgres igual responde 200. Seed corre idempotente con admin presente.

---

### ✅ Subfase 4.2 — Endpoints sociales  ·  `46ab3e2`

**Objetivo:** exponer la actividad académica de la red y las recomendaciones por amigos.

**Depende de:** 4.1 (las relaciones deben existir para que las queries devuelvan algo).

**Archivos:** `routes/posts.js`, `routes/courses.js`.

**Pasos:**
6. `GET /api/posts/feed/academic` — mezcla `inscripcion` / `curso_completado` / `logro` de gente que sigo, ordenado por timestamp DESC, hidratado contra Postgres (ver §3.2).
7. `GET /api/courses/recommended` — cursos que mis amigos tomaron y yo no, con `friendCount` + `sampleFriends` (ver §3.3).

**Checkpoint:** con dos usuarios donde A sigue a B: el feed académico de A muestra la inscripción de B; `/recommended` de A lista el curso de B con `friendCount: 1`. **Privacidad:** ninguna actividad de gente que no sigo aparece.

---

### ✅ Subfase 4.3 — Backend admin  ·  `12e0565` + `bf86547`

**Objetivo:** gobernar usuarios, cursos y categorías sin tocar la DB. Elimina el autoascenso temporal.

**Depende de:** 4.1 (necesita el seed `admin_demo` para probar).

**Archivos:** `routes/admin.js` (nuevo), `src/index.js`, `routes/auth.js`, `routes/categories.js`.

**Pasos:**
8. `routes/admin.js` completo con `requireAuth + requireRole('ADMIN')` (10 endpoints, ver §3.4). Registrar en `src/index.js`.
9. Eliminar `POST /api/auth/become-teacher` de `routes/auth.js`.
10. Mover el CRUD de categorías a `/api/admin/categories` (sale de `categories.js`, que conserva solo el `GET` público).

**Checkpoint:** login como `admin_demo` → `GET /api/admin/stats` devuelve totales; `PUT .../verify` marca profesor; `PUT .../role` cambia rol validando el enum; `DELETE .../courses/:id` borra curso con inscripciones (cascada). `become-teacher` responde 404.

---

### ✅ Subfase 4.4 — Frontend estudiante (social)  ·  `9888412`

**Objetivo:** que el estudiante vea la actividad académica y las recomendaciones en la UI.

**Depende de:** 4.2 (consume sus endpoints).

**Archivos:** `components/AcademicActivityCard.jsx` (nuevo), `components/RecommendedCourseCard.jsx` (nuevo), `pages/Feed.jsx`, `pages/Courses.jsx`, `pages/Notifications.jsx`.

**Pasos:**
11. `AcademicActivityCard` + integración en `Feed` (fetch paralelo de los dos feeds, merge por `createdAt`, ver §4.1).
12. Sección "Tus amigos están aprendiendo" en `Courses` con `RecommendedCourseCard` (ver §4.2).
13. Manejar `type: 'logro'` en `Notifications` (ver §4.3).

**Checkpoint:** el feed intercala posts y tarjetas académicas; `/courses` muestra la sección de recomendados solo a autenticados con amigos inscritos; la notificación de logro de un amigo se renderiza. UI plana (sin gradientes/blur), pasa checklist `design.md` §12.

---

### ✅ Subfase 4.5 — Frontend admin  ·  `cd42270`

**Objetivo:** panel admin navegable y protegido por rol.

**Depende de:** 4.3 (consume sus endpoints).

**Archivos:** `pages/admin/AdminDashboard.jsx`, `pages/admin/AdminUsers.jsx`, `pages/admin/AdminCourses.jsx`, `pages/admin/AdminCategories.jsx` (nuevos), `App.jsx`, `components/Navbar.jsx`.

**Pasos:**
14. Las 4 páginas `pages/admin/*` + guard `AdminOnly` en `App.jsx` (redirect a `/feed` si no es ADMIN, ver §5.1).
15. Entrada "Admin" en el sidebar desktop solo si `rol === 'ADMIN'` (ver §5.2).
16. Acceso a `/admin` desde el menú del avatar en `MobileTopBar` (ver §5.3). Bottom nav se mantiene en 5 columnas.

**Checkpoint:** un ADMIN entra a `/admin` desde sidebar (desktop) y desde el menú del avatar (mobile); un no-ADMIN que tipea `/admin` es redirigido a `/feed`. Verificar profesor, cambiar rol y borrar curso funcionan desde la UI.

---

### ✅ Subfase 4.6 — Cierre  ·  `fb1be8a`

**Objetivo:** verificar el flujo completo y cerrar la etapa.

**Depende de:** 4.1–4.5.

**Hecho:**
17. Smoke E2E ejecutado contra Aura + Postgres reales:
    - Login `admin_demo` → `verify`/`role` cambian profesor (200). ✅
    - Feed académico de un seguidor muestra `inscripcion` / `curso_completado` / `logro`. ✅
    - `/recommended` lista cursos de amigos con `friendCount`. ✅
    - **Admin borra curso con inscritos + certificado + intento → 200, cascada completa.** ✅
18. §8 tildado.

**Bug encontrado y corregido en el smoke:** el borrado forzado de cursos rolleaba con `P2028` (timeout de transacción de 5s superado por la cascada contra DB remota). Fix: `$transaction(..., { timeout: 20000, maxWait: 10000 })` (`fb1be8a`).

**Checkpoint:** los 12 ítems de §8 tildados. La propagación a Neo4j falla con log pero nunca bloquea un flujo de usuario.

---

## 8. Definition of Done — Etapa 4

- [x] Al inscribirme en curso, seguidores ven actividad en feed
- [x] Al completar curso, seguidores ven "X completó curso Y"
- [x] Al desbloquear logro, seguidores reciben notificación
- [x] Sección "Tus amigos están aprendiendo" aparece en `/courses` para autenticados con amigos inscritos
- [x] Admin verifica profesor desde UI y ese profesor puede crear cursos
- [x] Admin cambia rol de cualquier usuario desde UI
- [x] Admin borra curso con inscritos (cascada confirmada)
- [x] `GET /api/admin/stats` devuelve totales consistentes
- [x] Categorías se crean/editan/borran desde UI del admin
- [x] `POST /api/auth/become-teacher` no existe en backend ni frontend
- [x] Propagación Neo4j falla con log pero **no bloquea** flujo del usuario
- [x] Profesor en mobile llega a `/teacher` sin tipear URL

---

## 9. Convenciones

- **Diseño**: todo componente nuevo pasa checklist de `frontend/design.md` §12.
- **UI plana**: sin `bg-gradient-*` ni `blur-*` en componentes nuevos.
- **Mascota Titi**: `<img src="/Titi.png" />`, nunca emoji 🐒.
- **Respuesta API**: `{ success, data }` éxito; `{ success: false, message }` error.
- **Nombres**: modelos Prisma, nodos/relaciones Neo4j y campos en **español**. Código (variables, funciones, archivos) en **inglés**.
- **Commits**: prefijos en español (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`).
- **CodeGraph**: usar `codegraph_*` antes de grep para preguntas estructurales.
- **Propagación Neo4j**: siempre en `try/catch` que loguea pero no rompe respuesta.

---

## 10. Cierre — Etapa 4

### Changelog (commits)

| Subfase | Commit(s) | Entregable |
|---|---|---|
| 4.1 Base Neo4j | `7f2417a` | `neo4j-sync.service.js` + propagación enroll/complete/logro + seed `admin_demo` |
| 4.2 Endpoints sociales | `46ab3e2` | `GET /feed/academic`, `GET /courses/recommended` |
| 4.3 Backend admin | `12e0565`, `bf86547` | `routes/admin.js` (10 endpoints), categorías movidas, `become-teacher` eliminado |
| 4.4 Frontend estudiante | `9888412` | `AcademicActivityCard`, `RecommendedCourseCard`, feed mezclado, notif logro |
| 4.5 Frontend admin | `cd42270` | `pages/admin/*`, guard `AdminOnly`, entradas Navbar, fix `MyTeaching` |
| 4.6 Cierre | `fb1be8a` | Smoke E2E + fix timeout de transacción en delete admin |

### Desvíos / deuda técnica

1. **Delete admin borra certificados.** `Certificado.cursoId` es `NOT NULL`, así que no se pueden preservar (propuesta §6.2) sin una migración que lo haga nullable + snapshot del título. Queda como deuda para Etapa 5.
2. **`PUT /courses/:id/approve`** quedó como fallback opcional: el `publicado` del profesor alcanza (decisión §6, pendiente 1).
3. **Datos demo de prueba**: las relaciones del feed académico de `abdair@demo.com` se sembraron a mano para demo (no afectan el código).

### Extras de UI (post-cierre, fuera del DoD)

Sidebar desktop colapsable estilo Instagram (rail de iconos ↔ expandido con hover), racha con crossfade mini↔badge, y columna centrada angosta en Inicio/Explorar (tipo Facebook). No forman parte de la Etapa 4 pero conviven con ella.

### Próximo

**Etapa 5 — Pulido y Deploy** (ver `AGENTSGoal.md` §9 → Etapa 5): Cloudinary, índices/paginación, tests automatizados, CI/CD, deploy. Tag de release sugerido al cerrar Etapa 4: `v0.4.0` (ver `AGENTSGoal.md` §16).
