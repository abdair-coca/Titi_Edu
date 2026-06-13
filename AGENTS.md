# AGENTS.md — Titi | Etapa 4: Integración Social + Admin

Lee este archivo completo antes de tocar cualquier código.
Este documento describe **qué falta para cerrar la Etapa 4** del proyecto.
La fuente de verdad del producto sigue siendo `AGENTSGoal.md`.

> **Etapas 1, 2 y 3 ya están cerradas.** Ver `AGENTSGoal.md` §9 para el resumen de lo entregado.

---

## 1. Objetivo de la etapa

> **Convertir a Titi en una red social donde el aprendizaje es visible y descubrible.**
> Los amigos ven qué cursos toman otros, las recomendaciones salen de la red, y un admin puede gobernar el catálogo sin tocar la base de datos.

Definition of Done en una línea: si para verificar a un profesor, cambiar un rol, recomendar un curso o ver qué hicieron mis amigos esta semana todavía tengo que abrir Prisma Studio o `curl`, la Etapa 4 **no** está cerrada.

---

## 2. Estado actual (auditoría)

### Backend — lo que ya hay

| Área | Estado | Detalle |
|---|---|---|
| Auth + espejo Neo4j↔Postgres | ✅ | `auth.js`, helper `loadCurrentUser` en cada ruta Postgres |
| Cursos / Módulos / Lecciones / Materiales | ✅ | CRUDs completos con guard de autor y rol |
| Evaluaciones + Intentos | ✅ | `routes/evaluations.js` con grading server-side |
| Servicios | ✅ | `progress.service.js` (racha + completion), `achievement.service.js` (catálogo + checkers) |
| `POST /api/auth/become-teacher` | 🟡 | Autoascenso de dev — **a eliminar en esta etapa** |
| `routes/admin.js` | 🔴 | No existe |
| Propagación de eventos sociales a Neo4j | 🔴 | `INSCRITO_EN` y `COMPLETO_CURSO` no se crean al inscribirse / completar |
| Feed académico | 🔴 | `posts.js` solo devuelve posts, no actividad de cursos / logros |
| Recomendaciones por amigos | 🔴 | Sin endpoint |

### Frontend — lo que ya hay

| Área | Estado | Detalle |
|---|---|---|
| Navbar con guard `PROFESOR/ADMIN` | ✅ | Entrada "Enseñar" condicional en sidebar desktop |
| Bottom nav contextual por rol en mobile | ✅ | Slot "Mis cursos" → "Enseñar" cuando es PROFESOR/ADMIN |
| Pantallas `pages/admin/*` | 🔴 | No existen |
| Tarjeta de "Actividad académica" en Feed | 🔴 | No existe |
| Sección "Recomendados por tus amigos" en Cursos | 🔴 | No existe |
| Acceso a /teacher en mobile | ✅ | El bottom nav muestra "Enseñar" en lugar de "Mis cursos" para profes |

---

## 3. Plan — Backend

### 3.1 Propagación a Neo4j (hacer primero — alimenta todo lo demás)

Cuando una operación Postgres deba aparecer en queries sociales, replicar a Neo4j en un `try/catch` que **nunca rompa la respuesta principal** (patrón documentado en `titi-backend-patterns.md` §9).

**En `POST /api/courses/:id/enroll`** (`routes/courses.js`) — después de crear la `Inscripcion`:

```cypher
MATCH (u:Usuario {id: $neoId})
MERGE (ref:CursoRef {cursoId: $cursoId})
MERGE (u)-[r:INSCRITO_EN]->(ref)
ON CREATE SET r.fechaInscripcion = datetime()
```

**En `checkCursoCompletado`** (`services/progress.service.js`) — cuando `nuevo === true`, además de emitir el certificado:

```cypher
MATCH (u:Usuario {id: $neoId})
MERGE (ref:CursoRef {cursoId: $cursoId})
MERGE (u)-[r:COMPLETO_CURSO]->(ref)
ON CREATE SET r.fechaCompletado = datetime()
```

Para llegar al `neoId` desde `usuarioId` de Postgres, leer `Usuario.neoId` con un `findUnique`.

**En logros** (`services/achievement.service.js` `otorgarLogro`) — al desbloquear, crear notificación en Neo4j para los seguidores:

```cypher
MATCH (autor:Usuario {id: $neoId})<-[:SIGUIO]-(follower:Usuario)
WITH autor, follower
MERGE (follower)<-[:RECIBIO]-(n:Notificacion {
  type: 'logro', actorId: $neoId, logroNombre: $nombre
})
ON CREATE SET n.id = randomUUID(), n.read = false, n.createdAt = datetime()
MERGE (n)-[:SOBRE]->(autor)
```

Tipo de notificación nuevo: `'logro'`. Manejarlo en el render del frontend.

### 3.2 Feed académico — `routes/posts.js`

Nuevo endpoint **`GET /api/posts/feed/academic`** (autenticado): actividad reciente de gente que sigo.

Mezcla en una sola lista, ordenada por timestamp DESC:
- `(yo)-[:SIGUIO]->(amigo)-[r:INSCRITO_EN]->(:CursoRef)` → tipo `inscripcion`
- `(yo)-[:SIGUIO]->(amigo)-[r:COMPLETO_CURSO]->(:CursoRef)` → tipo `curso_completado`
- `(yo)-[:SIGUIO]->(amigo)<-[:SOBRE]-(:Notificacion {type:'logro'})` → tipo `logro`

Devolver `{ actorUsername, actorAvatarUrl, type, cursoId?, logroNombre?, createdAt }`. Resolver `cursoId` → `{ titulo, categoria }` con un `prisma.curso.findMany({ where: { id: { in: cursoIds } } })` y mergear.

**Privacidad:** solo gente que sigo. Nunca actividad pública.

### 3.3 Recomendaciones — `routes/courses.js`

Nuevo endpoint **`GET /api/courses/recommended`** (autenticado): cursos publicados que **mis amigos ya tomaron**, en los que yo aún no estoy inscrito.

```cypher
MATCH (yo:Usuario {id: $neoId})-[:SIGUIO]->(amigo:Usuario)-[:INSCRITO_EN]->(ref:CursoRef)
WHERE NOT EXISTS { (yo)-[:INSCRITO_EN]->(ref) }
RETURN ref.cursoId as cursoId, count(DISTINCT amigo) as friendCount,
       collect(DISTINCT amigo.username)[0..3] as sampleFriends
ORDER BY friendCount DESC
LIMIT 12
```

Hidratar contra Postgres (solo `publicado: true`) y devolver `{ curso, friendCount, sampleFriends }`.

### 3.4 Admin — `routes/admin.js` (todo nuevo)

Middleware: `requireAuth + requireRole('ADMIN')`.

| Método | Ruta | Notas |
|---|---|---|
| `GET` | `/api/admin/users` | Lista paginada con `rol`, `verificado`, `racha`, conteo de cursos |
| `PUT` | `/api/admin/users/:id/verify` | `verificado=true`, solo si `rol=PROFESOR` |
| `PUT` | `/api/admin/users/:id/role` | Body: `{ rol: 'ESTUDIANTE'\|'PROFESOR'\|'ADMIN' }`. Validar enum |
| `GET` | `/api/admin/courses` | Incluye borradores. Filtros `?publicado=` |
| `PUT` | `/api/admin/courses/:id/approve` | Marca como `publicado` (acción de admin, opcional) |
| `DELETE` | `/api/admin/courses/:id` | Override del 409 — borra incluso con inscripciones. Cascada completa |
| `GET` | `/api/admin/stats` | Totales: usuarios, profesores verificados, cursos publicados, inscripciones, certificados |
| `POST` | `/api/admin/categories` | CRUD movido aquí desde `categories.js` (donde ya estaba con `requireRole('ADMIN')`) |
| `PUT` | `/api/admin/categories/:id` | Editar nombre / icono |
| `DELETE` | `/api/admin/categories/:id` | 409 si tiene cursos asociados |

Registrar en `src/index.js`. Sembrar **al menos un ADMIN demo** en `prisma/seed.js` (`admin_demo@titi.local`) con el mismo password del seed.

### 3.5 Eliminar el endpoint temporal

Borrar `POST /api/auth/become-teacher` de `routes/auth.js`. En el frontend de `MyTeaching.jsx` ya no debe aparecer el botón "Convertirme en profesor (dev)" — reemplazarlo por una nota "Pedile a un admin que te active el rol".

---

## 4. Plan — Frontend (estudiante)

### 4.1 Feed académico mezclado

En `pages/Feed.jsx`, al montar fetchear en paralelo `/api/posts/feed` y `/api/posts/feed/academic`, mezclarlos por `createdAt` DESC.

Componente nuevo `components/AcademicActivityCard.jsx` (basado en design.md §5.4):

- Header: avatar + nombre + verbo según tipo
  - `inscripcion` → "{user} se inscribió en" + 📚
  - `curso_completado` → "{user} completó" + 🎓
  - `logro` → "{user} desbloqueó el logro" + 🏅
- Para tipos de curso: tarjeta compacta del curso con CTA "Ver este curso →"
- Para `logro`: chip del logro (icono + nombre)

Respetar la regla de UI plana (sin gradientes / blur) — ya cumplida en Etapa 3.

### 4.2 Recomendaciones por amigos en Cursos

En `pages/Courses.jsx`, debajo del header y antes del catálogo:

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

`RecommendedCourseCard` reusa el `CourseCard` actual pero agrega un chip "🤝 N amigos" con tooltip mostrando los `sampleFriends`.

Solo se muestra para `isAuthenticated`. No bloquea el catálogo si está vacío.

### 4.3 Notificación de logros de amigos

En `pages/Notifications.jsx`, manejar `type: 'logro'`. Render: "@{user} desbloqueó el logro {nombre} 🏅".

---

## 5. Plan — Frontend (admin)

### 5.1 Estructura

Crear `frontend/src/pages/admin/` con:

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

Guard nuevo `AdminOnly` (paralelo al `TeacherOnly` existente): si `user.rol !== 'ADMIN'`, redirect a `/feed`.

### 5.2 Entrada en Navbar

Agregar `NavLink to="/admin"` al sidebar desktop **solo si `user.rol === 'ADMIN'`** (mismo patrón que la entrada "Enseñar" — ver [Navbar.jsx:138-143](frontend/src/components/Navbar.jsx:138)).

### 5.3 Acceso a /admin desde mobile

El acceso a `/teacher` en mobile ya está resuelto: el slot "Mis cursos" del bottom nav se transforma en "Enseñar" para `rol ∈ {PROFESOR, ADMIN}` (ver [Navbar.jsx](frontend/src/components/Navbar.jsx) `MobileBottomNav`).

Para `/admin` aplicar el mismo patrón: si `rol === 'ADMIN'`, el slot "Cursos" puede transformarse en "Admin", o reusar el mismo slot que ya muestra "Enseñar" pero apuntando a `/admin`. **Decisión recomendada:** mantener "Enseñar" y agregar acceso a `/admin` desde el menú del avatar en `MobileTopBar` (admin es un rol mucho menos frecuente que profesor).

Mantener el bottom nav en 5 columnas como manda design.md.

---

## 6. Decisiones tomadas

| Decisión | Razón |
|---|---|
| Propagación a Neo4j **no bloquea** la operación Postgres | Postgres es fuente de verdad para datos educativos. Si Neo4j falla, queremos loguear pero responder OK |
| Nodos `:CursoRef` con `cursoId` en Neo4j | Evita duplicar `Curso` en ambas DBs. `cursoId` referencia Postgres |
| Notificaciones de logros via Neo4j | Mismo grafo que likes/follows. El `:RECIBIO`/`:SOBRE` ya existe |
| Admin override del 409 de borrar curso | Es la única forma de limpiar cursos abusivos sin tocar SQL |
| Eliminar `become-teacher` en esta etapa | Tener admin lo hace innecesario y peligroso (cualquier usuario podía autoascenderse) |
| Sin paginación pesada en feed académico | Limit 50 alcanza. La paginación real llega en Etapa 5 |

### Pendiente de confirmar antes de codear

1. **Aprobación de cursos** — ¿el admin debe aprobar antes de que aparezca en el catálogo, o el `publicado` que pone el profesor es suficiente? Default: el `publicado` del profesor alcanza, el endpoint `/approve` queda como fallback opcional.
2. **Override de inscripciones al borrar curso** — al borrar un curso con admin override, ¿qué pasa con las inscripciones / progreso / certificados? Propuesta: borrar inscripciones + progresos, **preservar certificados** (el estudiante ya se ganó esa credencial).

---

## 7. Orden de ejecución sugerido

**Bloque A — Backend foundation**
1. Helper `replicateToNeo4j` en `services/` para concentrar el patrón.
2. Propagación en `POST /enroll` y en `checkCursoCompletado`.
3. Notificación social al otorgar logros.
4. Seed del usuario `admin_demo`.

**Bloque B — Endpoints sociales**
5. `GET /api/posts/feed/academic`
6. `GET /api/courses/recommended`

**Bloque C — Admin**
7. `routes/admin.js` completo
8. Eliminar `POST /api/auth/become-teacher` y la UI relacionada
9. Mover endpoints de categorías a admin

**Bloque D — Frontend estudiante**
10. `AcademicActivityCard` + integración en `Feed`
11. Sección "Recomendados" en `Courses`
12. Manejo de `type: 'logro'` en `Notifications`

**Bloque E — Frontend admin**
13. `pages/admin/*` (4 páginas) + guard `AdminOnly`
14. Entrada "Admin" en sidebar
15. Menú-avatar en `MobileTopBar` para acceso a /teacher y /admin

**Bloque F — Cierre**
16. Smoke test E2E:
    - Login admin_demo → verificar a un nuevo profesor → ese profesor crea curso → publica
    - Estudiante se inscribe → ver el evento en el feed de un amigo
    - Estudiante completa curso → certificado + evento en feed
    - Admin borra curso con inscripciones → confirma cascada
17. Tachar checkboxes de §8

---

## 8. Definition of Done — Etapa 4

- [ ] Al inscribirme en un curso, mis seguidores ven la actividad en su feed
- [ ] Al completar un curso, mis seguidores ven "X completó el curso Y"
- [ ] Al desbloquear un logro, mis seguidores reciben notificación
- [ ] Sección "Tus amigos están aprendiendo" aparece en `/courses` para usuarios autenticados con amigos inscritos
- [ ] El admin verifica un profesor desde la UI y ese profesor ya puede crear cursos
- [ ] El admin cambia el rol de cualquier usuario desde la UI
- [ ] El admin borra un curso con inscritos (cascada confirmada)
- [ ] `GET /api/admin/stats` devuelve totales consistentes
- [ ] Categorías se crean/editan/borran desde la UI del admin
- [ ] `POST /api/auth/become-teacher` ya no existe ni en backend ni en frontend
- [ ] La propagación Neo4j↔Postgres falla con log pero **no bloquea** ningún flujo del usuario
- [ ] El profesor en mobile puede llegar a `/teacher` sin tipear la URL

---

## 9. Convenciones a respetar

- **Diseño**: todo componente nuevo debe pasar la checklist de `frontend/design.md` §12.
- **UI plana**: sin `bg-gradient-*` ni `blur-*` decorativos en componentes nuevos (regla aprendida en Etapa 3).
- **Mascota Titi**: siempre `<img src="/Titi.png" />`, nunca emoji 🐒.
- **Respuesta API**: `{ success, data }` éxito, `{ success: false, message }` error.
- **Nombres**: modelos Prisma, nodos/relaciones Neo4j y campos visibles en **español**. Código (variables, funciones, archivos) en **inglés**.
- **Commits**: prefijos en español (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`).
- **CodeGraph**: usar `codegraph_*` antes de grep para preguntas estructurales.
- **Propagación a Neo4j**: siempre dentro de `try/catch` que loguea pero no rompe la respuesta principal.
