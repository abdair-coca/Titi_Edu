# AGENTS.md — Titi | Etapa 2: Módulo Educativo Base

Lee este archivo completo antes de tocar cualquier código.
Este documento describe **qué falta para cerrar la Etapa 2** del proyecto.
La fuente de verdad del producto sigue siendo `AGENTSGoal.md`.

> **Nota:** Etapa 1 (rediseño visual a Titi) ya está completada y su documento original quedó archivado. El estado actual del frontend ya usa la paleta Titi, Nunito y la mascota `/Titi.png` según `frontend/design.md`.

---

## 1. Objetivo de la etapa

Cerrar el módulo educativo base de forma que:

> **Un profesor pueda crear un curso completo (módulos + lecciones + materiales + publicación) desde la UI, y un estudiante pueda navegar el catálogo, inscribirse, consumir las lecciones, descargar materiales y dejar comentarios — todo sin tocar la API a mano.**

Esa frase es el Definition of Done. Si una parte de ese flujo todavía requiere llamar a la API directamente o editar la base de datos, la Etapa 2 **no** está terminada.

---

## 2. Estado actual (auditoría)

### Backend

| Área | Estado | Detalle |
|---|---|---|
| PostgreSQL + Prisma | ✅ | `prisma/schema.prisma` + migración `20260606200208_init` aplicada |
| Schema completo | ✅ | Modelos coinciden con AGENTSGoal §"Modelo de datos PostgreSQL" (incluye `Curso.creadorId`) |
| Sincronización Usuario Neo4j ↔ Postgres | ✅ | `routes/auth.js` crea espejo en `Usuario` (Postgres) con `neoId` |
| `routes/courses.js` | 🟡 | Hay `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `POST /:id/publish`, `POST /:id/enroll`, `GET /my/enrolled`, `GET /my/teaching`, `GET /:id/progress`. Faltan DELETE, despublicar, validación de profesor verificado |
| `routes/modules.js` | 🟡 | Solo `POST /api/courses/:courseId/modules` y `GET /api/modules/:id/lessons`. Faltan PUT, DELETE, GET por curso |
| `routes/lessons.js` | 🟡 | Hay POST, PUT, `POST /:id/complete`, `GET /:id/comments`, `POST /:id/comments`. Faltan DELETE y `GET /:id` individual con materiales |
| `routes/materials.js` | 🔴 | No existe. Modelo `Material` en Prisma sin endpoints |
| `routes/categories.js` | 🔴 | No existe. Modelo `Categoria` en Prisma sin endpoints **ni seed** → `categoriaId` es FK requerida en `Curso`, por lo que sin datos sembrados no se puede crear ningún curso |
| Seed | 🔴 | No hay `prisma/seed.js`. Hay que crear categorías y datos demo a mano |

### Frontend

| Área | Estado | Detalle |
|---|---|---|
| `pages/Courses.jsx` (catálogo) | 🟡 | Lista, búsqueda y filtro por nivel funcionan. Falta filtro por **categoría** |
| `pages/CourseDetail.jsx` | ✅ | Hero, módulos, sidebar de inscripción, manejo de roles |
| `pages/LearnCourse.jsx` | 🟡 | Player, sidebar de lecciones, progreso, marcar completada. Faltan **comentarios** y **materiales** |
| `pages/MyCourses.jsx` | ✅ | Lista de inscripciones con barras de progreso por curso |
| Panel del profesor | 🔴 | No existe ninguna pantalla para crear/editar curso, módulos o lecciones |
| Navbar | 🟡 | No tiene entrada condicional por rol (PROFESOR debería ver "Enseñar") |

### Conclusión

Para terminar Etapa 2 hay que cubrir tres frentes:
1. **Cerrar el backend** (categorías, materiales, deletes que faltan, seed).
2. **Completar la experiencia del estudiante** (comentarios y materiales en la lección, filtro de categoría en el catálogo).
3. **Construir el panel del profesor** (todo nuevo).

---

## 3. Plan — Backend

### 3.1 Categorías (bloqueante — hacer primero)

Crear `backend/src/routes/categories.js`:

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/api/categories` | público | Lista ordenada por nombre |
| `POST` | `/api/categories` | ADMIN | Reservado para Etapa 4 (panel admin) — implementar ya con `requireRole('ADMIN')` |

Registrar en `src/index.js` con `app.use('/api/categories', categoriesRoutes)`.

### 3.2 Seed (bloqueante — hacer junto con categorías)

Crear `backend/prisma/seed.js` y agregar al `package.json` del backend:

```json
"prisma": { "seed": "node prisma/seed.js" }
```

Contenido mínimo del seed:

- **Categorías** (6 mínimo, con `icono` emoji):
  - Programación 💻 · Matemáticas 🧮 · Idiomas 🌍 · Ciencias 🔬 · Diseño 🎨 · Negocios 📈 · Humanidades 📖 · Música 🎵
- **Usuario `profesor_demo`** con `rol: PROFESOR`, `verificado: true`, espejo en Neo4j (`(:Usuario {id, username, email, password: hashed})`) y en Postgres con el mismo `neoId`. Password sembrada bajo `process.env.SEED_PASSWORD || 'titi1234'`.
- **Un curso demo publicado** ("Introducción a Python") con 2 módulos, 3 lecciones cada uno, `videoUrl` de YouTube de ejemplo y al menos 1 material por lección.

Idempotente: usar `upsert` por slug/email para que correrlo dos veces no rompa.

### 3.3 Cursos — endpoints faltantes (`routes/courses.js`)

| Método | Ruta | Auth | Reglas |
|---|---|---|---|
| `DELETE` | `/api/courses/:id` | autor o ADMIN | **Rechazar con 409 si tiene inscripciones**. Exige despublicar primero |
| `POST` | `/api/courses/:id/unpublish` | autor | Marca `publicado = false`. No toca inscripciones ya existentes |

Adicionalmente, en los handlers existentes de `POST /` y `PUT /:id`:
- Cuando `req.dbUser.rol === 'PROFESOR'`, exigir `req.dbUser.verificado === true`. Si no, responder `403 "Tu cuenta de profesor aún no está verificada"`.
- El seed deja `profesor_demo` con `verificado: true` para desbloquear el flujo en dev.

### 3.4 Módulos — endpoints faltantes (`routes/modules.js`)

| Método | Ruta | Auth | Notas |
|---|---|---|---|
| `GET` | `/api/courses/:courseId/modules` | público | Devuelve módulos ordenados, sin lecciones (para el editor) |
| `PUT` | `/api/modules/:id` | autor del curso | Permite editar `titulo`, `descripcion`, `orden` |
| `DELETE` | `/api/modules/:id` | autor del curso | Cascada: borrar lecciones, materiales, progresos y evaluación asociadas |

### 3.5 Lecciones — endpoints faltantes (`routes/lessons.js`)

| Método | Ruta | Auth | Notas |
|---|---|---|---|
| `GET` | `/api/lessons/:id` | público | Devuelve la lección con `materiales` incluidos |
| `DELETE` | `/api/lessons/:id` | autor del curso | Cascada: progresos, materiales y comentarios de la lección |

### 3.6 Materiales (nuevo: `routes/materials.js`)

| Método | Ruta | Auth | Notas |
|---|---|---|---|
| `POST` | `/api/lessons/:lessonId/materials` | autor del curso | `multipart/form-data` con `file` + `nombre` + `tipo`. Reusar patrón multer de `posts.js`, guardar bajo `src/uploads/materials/` |
| `DELETE` | `/api/materials/:id` | autor del curso | Borrar archivo del disco con `fs.promises.unlink` antes de borrar el row |

Tipos aceptados: `pdf | word | imagen | codigo | otro`. Límite 10 MB. Validar mimetype contra el `tipo` declarado.

### 3.7 Lo que **no** entra en Etapa 2 (dejar como TODO)

- Sincronización `(:Usuario)-[:INSCRITO_EN]->(cursoId)` en Neo4j al inscribirse — corresponde a Etapa 4 (recomendaciones). Dejar comentario `// TODO Etapa 4` en `POST /:id/enroll`.
- Cloudinary para materiales — Etapa 5. Disco local es suficiente ahora.
- Evaluaciones, racha, logros, certificados — Etapa 3.

---

## 4. Plan — Frontend (estudiante)

### 4.1 Comentarios en lecciones (bloqueante)

Crear `frontend/src/components/LessonComments.jsx`:

- Espejo visual de `components/CommentSection.jsx` (avatar + bubble blanco con sombra suave Titi).
- `GET /api/lessons/:id/comments` al montar.
- `POST` con textarea + botón amarillo Titi.
- Estado vacío con `<img src="/Titi.png" />` (no usar 🐒 según design.md §7).
- Optimistic update al publicar.

Integración en `pages/LearnCourse.jsx` → `LessonView`, debajo del botón "Marcar como completada", separado por un `<hr className="border-titi-border my-8" />`.

### 4.2 Materiales en la lección

En `LessonView` (`pages/LearnCourse.jsx`), debajo de `leccion.contenido`:

- Sección titulada "Materiales" solo si `leccion.materiales?.length > 0`.
- Lista de chips con ícono por tipo (`📄 pdf`, `📝 word`, `🖼️ imagen`, `💻 codigo`, `📎 otro`) y link de descarga (`<a download>`).
- Como hoy se lazy-fetchea por módulo, agregar fetch a `GET /api/lessons/:id` cuando cambia `activeId` y cachear en `lessonsByModulo` o en un nuevo `materialsByLesson`.

### 4.3 Filtro por categoría en `pages/Courses.jsx`

- Al montar: `GET /api/categories` → `setCategorias(...)`.
- Segundo `<select>` a la derecha del de nivel con la misma clase visual.
- Estado `categoria` (string id o `'all'`), incluido en el `useEffect` que fetchea el catálogo.
- Si `categoria !== 'all'`, enviar `params.categoria = categoria` al backend (ya soportado en `GET /api/courses`).
- "Limpiar filtros" debe resetear los tres: `query`, `nivel`, `categoria`.

---

## 5. Plan — Frontend (profesor)

### 5.1 Estructura

Crear carpeta `frontend/src/pages/teacher/` con:

```
pages/teacher/
├── MyTeaching.jsx       ← lista de mis cursos como profesor + CTA "Crear curso"
├── CourseEditor.jsx     ← formulario crear/editar curso
└── ModulesEditor.jsx    ← edición inline de módulos + lecciones + materiales
```

Rutas (en `App.jsx`):

```
/teacher                          → MyTeaching
/teacher/courses/new              → CourseEditor (modo crear)
/teacher/courses/:id/edit         → CourseEditor (modo editar)
/teacher/courses/:id/modules      → ModulesEditor
```

Guard: todas requieren `isAuthenticated && user.rol === 'PROFESOR'`. Si no, redirect a `/courses`.

### 5.2 `MyTeaching.jsx`

- `GET /api/courses/my/teaching` al montar.
- Grid de tarjetas reutilizando el estilo de `CourseCard` pero con:
  - Badge "Borrador" / "Publicado" en esquina.
  - Acciones: "Editar curso" → `/teacher/courses/:id/edit`, "Editar contenido" → `/teacher/courses/:id/modules`, "Publicar"/"Despublicar", "Eliminar" (con `ConfirmModal`).
- CTA principal "Crear nuevo curso" → `/teacher/courses/new`.
- Estado vacío con Titi.

### 5.3 `CourseEditor.jsx`

Formulario con campos del modelo `Curso`:

- `titulo` (input)
- `descripcion` (textarea)
- `nivel` (select: principiante / intermedio / avanzado)
- `categoriaId` (select desde `GET /api/categories`)
- `portadaUrl` (input URL — Cloudinary va en Etapa 5)

Botones:
- "Guardar borrador" → `POST /api/courses` o `PUT /api/courses/:id`
- "Continuar al contenido →" navega a `/teacher/courses/:id/modules`

Estilo: respetar design.md §5.1 (botón primario amarillo con sombra inferior `#E6B800`, inputs `bg-titi-cream`, focus ring amarillo).

### 5.4 `ModulesEditor.jsx`

Vista de dos columnas:
- **Izquierda**: árbol de módulos con sus lecciones, drag-handle visual para el orden (sin DnD real — flechas ↑↓ que llaman a `PUT /api/modules/:id` o `PUT /api/lessons/:id` con `orden` ajustado). Botón "Agregar módulo" arriba.
- **Derecha**: editor de la lección seleccionada con `titulo`, `contenido` (textarea), `videoUrl` (input URL), y zona de **materiales** con drag&drop básico (`<input type="file">` clásico está OK para Etapa 2).

Acciones:
- Crear módulo: `POST /api/courses/:courseId/modules`
- Editar módulo: `PUT /api/modules/:id`
- Borrar módulo: `DELETE /api/modules/:id` con `ConfirmModal`
- Crear lección: `POST /api/modules/:moduleId/lessons`
- Editar lección: `PUT /api/lessons/:id`
- Borrar lección: `DELETE /api/lessons/:id`
- Subir material: `POST /api/lessons/:lessonId/materials`
- Borrar material: `DELETE /api/materials/:id`

Botón "Publicar curso" en el header, deshabilitado si el curso tiene 0 módulos o 0 lecciones.

### 5.5 Navbar — entrada condicional

En `components/Navbar.jsx`:

- Si `user?.rol === 'PROFESOR'`, agregar `NavLink to="/teacher"` con un nuevo `Icon.GraduationCap` (svg inline) y label "Enseñar".
- Posición: entre "Mis cursos" y "Notificaciones" en el sidebar desktop. En el bottom nav móvil, **no** se agrega para no romper el grid de 5 columnas — el profesor accede desde el sidebar o desde el avatar.

---

## 6. Riesgos y decisiones tomadas

| Decisión | Razón |
|---|---|
| Borrado de curso bloqueado si tiene inscripciones | Evitar perder progreso de estudiantes. Despublicar es el camino correcto |
| `verificado` requerido para crear cursos | Coherente con `Usuario.verificado` del schema. En dev el seed marca `profesor_demo` como verificado |
| Materiales a disco local (`src/uploads/materials/`) | Mismo patrón que `posts.js`. Cloudinary se mueve a Etapa 5 |
| `INSCRITO_EN` en Neo4j queda como TODO | No es necesario para la funcionalidad de Etapa 2; sí lo es para recomendaciones (Etapa 4) |
| Sin DnD real para orden de módulos/lecciones | Botones ↑↓ son suficientes y no agregan dependencia |
| Profesor no entra al bottom nav móvil | El grid de 5 columnas ya está apretado. El profesor accede desde sidebar/perfil |

### Pendiente de confirmar antes de codear

1. **Auto-verificación de profesores en dev** — ¿Agregamos un endpoint temporal `POST /api/auth/become-teacher` que cambie el rol del usuario logueado a PROFESOR y `verificado=true`? Útil mientras no exista el panel admin (Etapa 4). Si sí, marcarlo con `// TODO eliminar en Etapa 4`.
2. **Comportamiento al despublicar** — ¿Las inscripciones existentes siguen viendo el curso o se ocultan? Recomendación: lo siguen viendo en "Mis cursos" pero no aparece en el catálogo.

---

## 7. Orden de ejecución sugerido

Ejecutar de arriba hacia abajo. Cada bloque desbloquea al siguiente.

**Bloque A — Datos base (sin esto nada se puede probar)**
1. `routes/categories.js` con `GET` y `POST`
2. `prisma/seed.js` con categorías + `profesor_demo` + curso demo
3. Correr `npx prisma db seed`

**Bloque B — Backend completo**
4. Endpoints faltantes de `courses.js` (DELETE, unpublish, validación `verificado`)
5. Endpoints faltantes de `modules.js` (GET por curso, PUT, DELETE)
6. Endpoints faltantes de `lessons.js` (GET con materiales, DELETE)
7. `routes/materials.js` con upload multer + DELETE
8. Registrar todas las rutas nuevas en `src/index.js`

**Bloque C — Frontend del estudiante**
9. `components/LessonComments.jsx` + integración en `LearnCourse`
10. Sección "Materiales" en `LessonView`
11. Filtro de categoría en `Courses.jsx`

**Bloque D — Frontend del profesor**
12. `pages/teacher/MyTeaching.jsx` + ruta en `App.jsx` + guard por rol
13. `pages/teacher/CourseEditor.jsx`
14. `pages/teacher/ModulesEditor.jsx` (módulos + lecciones + materiales)
15. Entrada "Enseñar" en `Navbar.jsx` (sidebar desktop)

**Bloque E — Cierre**
16. Smoke test end-to-end manual:
    - Registrar `estudiante_test`
    - Login como `profesor_demo`
    - Crear curso → módulo → lección con video → subir material PDF → publicar
    - Logout → login como `estudiante_test`
    - Filtrar catálogo por categoría → abrir curso → inscribirse
    - Reproducir lección → descargar material → marcar completada → comentar
    - Verificar progreso en "Mis cursos"
17. Tachar todos los checkboxes de §8

---

## 8. Definition of Done — Etapa 2

- [ ] `GET /api/categories` devuelve al menos 6 categorías sembradas
- [ ] `npx prisma db seed` deja un curso publicado navegable y un profesor demo verificado
- [ ] Un PROFESOR verificado crea curso → módulo → lección → material → publica, todo desde la UI
- [ ] Un PROFESOR no verificado recibe 403 al intentar crear curso
- [ ] Eliminar un curso sin inscritos funciona; con inscritos responde 409 con mensaje claro
- [ ] El catálogo filtra por nivel **y** categoría
- [ ] Un ESTUDIANTE puede inscribirse, marcar lecciones completas, descargar materiales y comentar
- [ ] Los comentarios persisten y se muestran ordenados por fecha desc
- [ ] La barra de progreso del curso refleja los `Progreso.completada` reales
- [ ] El navbar muestra "Enseñar" solo a PROFESOR
- [ ] No queda ningún endpoint listado en AGENTSGoal §"Cursos/Módulos/Lecciones/Evaluaciones" (las primeras tres secciones) sin implementar
- [ ] No quedan flujos que requieran tocar la API a mano

---

## 9. Convenciones a respetar

- **Diseño**: todo componente nuevo debe pasar la checklist de `frontend/design.md` §12.
- **Mascota**: Titi se representa con `<img src="/Titi.png" />`, nunca con el emoji 🐒.
- **Respuesta API**: `{ success, data }` en éxito, `{ success: false, message }` en error (AGENTSGoal §"Patrones obligatorios").
- **Nombres**: nodos Neo4j, relaciones, modelos Prisma y campos visibles en UI en **español**. Variables, funciones, archivos y rutas técnicas en **inglés**.
- **Commits**: prefijos en español — `feat: agregar editor de módulos`, `fix: validar verificado al crear curso`.
- **CodeGraph**: usar `codegraph_*` antes de grep/read para preguntas estructurales (ver `~/.claude/CLAUDE.md`).
