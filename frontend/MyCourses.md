# MyCourses.md — Rediseño de "Mis cursos"

Plan vivo del rediseño de `src/pages/MyCourses.jsx` a un dashboard estilo
Duolingo (mockup del usuario). Se ejecuta **etapa por etapa**, esperando
feedback antes de seguir con la próxima. Sigue [`design.md`](./design.md).

---

## Decisiones confirmadas (no volver a preguntar)

- **Progreso general** = promedio simple de `porcentaje` entre TODOS los
  cursos inscritos (completados cuentan 100%).
- **Terminología**: en toda la página se dice "Gotas", nunca "EXP".
- **Ruta de aprendizaje**: cursos inscritos ordenados por `fechaInscripcion`
  ascendente (más viejo primero). Colapsada muestra **4**. Toggle "Ver toda
  la ruta" ↔ "Ver menos".
- **Nodo "+N"**: círculo gris con el número, mismo estilo que el resto de la
  timeline. Clickearlo dispara el mismo toggle que el link de arriba.
- **Ícono de cada nodo de la ruta**: relacionado a la categoría del curso
  (Programación → `</>`, Ciencia de datos → chip, Matemáticas → Σ, Idiomas →
  globo, Ciencias → matraz, Diseño → paleta, Negocios → gráfico, Música →
  nota; fallback libro). Gris por default, **amarillo en hover** del curso
  asociado (no es posicional).
- **"Continuar"** en cada fila → siempre `/courses/:id/learn`.
- **Cursos completados en la ruta**: siguen siendo clickeables (van al
  detalle/certificado).
- **Desafíos del día**: el `DailyMissions` real, movido de `Feed.jsx` a
  `MyCourses.jsx` (no duplicado). Título pasa a **"Desafíos del día"**.
- **Explorar categorías**: "Ver todas" y cada chip navegan a `/courses` ya
  filtrado por esa categoría (requiere `?categoria=` en `Courses.jsx`).
- **Actividad reciente**: solo eventos académicos (`leccion`/`evaluacion`/
  `curso`), sin gotas sociales. Sin links, solo texto. "Ver toda la
  actividad" expande inline la misma lista ya traída (sin segundo fetch).
  Estado vacío: `TitiMascot` animado + "Aún no tenés actividad".
- **Cards de la ruta**: todas del mismo alto (`sm:h-44` fijo), portada al ras
  del contenedor (sin padding, esquinas recortadas por `overflow-hidden` del
  card).

---

## Etapas

### ✅ Etapa 1 — Backend: endpoint de actividad reciente

`GET /api/gotas/activity?limit=10` (clamp 1-30) en `backend/src/routes/gotas.js`.
Solo motivos académicos, resuelve títulos con 3 queries `IN` batched (máx 4
round-trips), fallback `"Contenido eliminado"` si el `refId` está borrado.
Tests en `backend/test/routes/gotas.test.js` (401, resolución por tipo,
fallback). Suite completa: 97 tests verdes.

### ✅ Etapa 2 — Header + 3 stat cards + barra de progreso

Una sola card blanca con 3 columnas separadas por líneas divisorias
(`divide-x`): "Tu progreso" (con label arriba + barra propia), "Gotas
totales", "Racha actual" (+ "¡Sigue así!" si está activa). Círculo de ícono
`bg-titi-yellow` sólido + `shadow-sm`, alineado al centro del bloque de
texto. Nuevo `TargetIcon`/`BoltIcon` en `icons.jsx`.

### ✅ Etapa 3 — Ruta de aprendizaje (timeline vertical)

Reemplaza el grid de cursos por `LearningPathSection`. Cada curso es una
card horizontal (portada al ras a la izquierda, info a la derecha: categoría,
título, estado, lecciones/% arriba de la barra). Columna de íconos por
categoría conectados por línea, altura de card estandarizada (`sm:h-44`),
hover del card colorea su nodo. Nodo "+N" para los cursos ocultos.

### ✅ Etapa 4 — Desafíos del día (reubicado) + Explorar categorías

`DailyMissions` recibe prop `title` (default "Misiones de hoy") y se sacó de
`Feed.jsx`; se monta en `MyCourses.jsx` como "Desafíos del día". Nueva sección
`CategoriesExplorer`: fetch `GET /api/categories`, filtra las que tienen cursos
(máx 8), grid con ícono de trazo por materia (`categoryIcon`) + nombre +
conteo, tinte plano rotado por índice. Cada chip y "Ver todas" navegan a
`/courses` (chips con `?categoria=<id>`). `Courses.jsx` lee `?categoria=` con
`useSearchParams`, aplica el filtro, baja a Trending y limpia el param.
Quedan full-width apilados; Etapa 5 los reacomoda en 2 columnas con Actividad.

### ✅ Etapa 5 — Actividad reciente + banner de cierre

`RecentActivity` fetchea `GET /api/gotas/activity?limit=20` una sola vez;
toggle inline "Ver toda la actividad" ↔ "Ver menos" sobre la misma lista
(primeros 4 / las 20). Ícono por `tipo` (`CheckIcon` verde para lección,
`AwardIcon` púrpura para evaluación, `GraduationIcon` amarillo para curso),
texto (`Completaste "X"` / `Aprobaste "X"` / `Completaste el curso "X"`),
`relativeTime`, `+N gotas` en verde. Empty state con `TitiMascot` +
"Aún no tenés actividad"; si el fetch falla, la sección no se muestra
(no bloquea la página). `BottomBanner`: card `bg-titi-yellow-light` +
`TrophyIcon`, "¡Sigue aprendiendo!" / "La constancia es la clave del éxito."
+ botón "Explorar cursos" → `/courses`. Layout final: grid 2 columnas
(izq: Desafíos del día + Explorar categorías apilados; der: Actividad
reciente) y el banner full-width debajo — así queda igual al mockup.

### ⬜ Etapa 6 — Pulido, responsive y documentación final

- Responsive de las 2 columnas inferiores y de la fila de stats en mobile.
- Reemplazar `formatDateEs` local por `formatDate`/`relativeTime` de
  `lib/format.js` si hace falta en algún componente nuevo.
- A11y: `aria-label` en toggles, `role="progressbar"` en barras (ya hecho en
  las agregadas hasta ahora, revisar el resto).
- Documentar en `design.md` los patrones nuevos: stat card de 3 columnas,
  nodo de ruta con ícono de categoría, card horizontal con portada al ras.
- Checklist manual: 0 cursos (empty state), 1-4 cursos (sin toggles), 6+
  cursos (toggles de ruta y actividad independientes), sin hex hardcodeado,
  cero "EXP" en el diff, navegación por teclado, mobile.

---

## Archivos tocados por etapa

| Etapa | Archivos |
|---|---|
| 1 | `backend/src/routes/gotas.js`, `backend/test/routes/gotas.test.js` |
| 2 | `frontend/src/pages/MyCourses.jsx`, `frontend/src/components/icons.jsx` |
| 3 | `frontend/src/pages/MyCourses.jsx`, `frontend/src/components/icons.jsx` |
| 4 | `frontend/src/pages/Feed.jsx`, `frontend/src/components/DailyMissions.jsx`, `frontend/src/pages/MyCourses.jsx`, `frontend/src/pages/Courses.jsx` |
| 5 | `frontend/src/pages/MyCourses.jsx`, `frontend/src/components/icons.jsx` |
| 6 | `frontend/src/pages/MyCourses.jsx`, `frontend/design.md` |
