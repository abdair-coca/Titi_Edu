# agent.md (frontend) — Titi

Guía de trabajo específica del frontend. Para el sistema visual ver
`frontend/design.md`; para animación `frontend/motion.md`; para el plan de etapa
ver el `AGENTS.md` de la raíz.

---

## Rediseño — Sección Learn (`pages/LearnCourse.jsx`)

> **Estado:** propuesta a implementar. Objetivo: que la pantalla de aprendizaje de
> un curso quede igual a la imagen de referencia (layout 3 columnas estilo
> "classroom"). Hoy `LearnCourse.jsx` es de 2 columnas (sidebar de lecciones +
> contenido); falta toda la columna derecha y varias features.

### Objetivo visual (imagen de referencia)

Layout de **3 columnas** dentro del shell de la app:

```
┌──────────────┬───────────────────────────────┬──────────────────┐
│  IZQUIERDA   │           CENTRO              │     DERECHA      │
│  (nav curso) │   (video + lección + acción)  │  (paneles)       │
├──────────────┼───────────────────────────────┼──────────────────┤
│ ← Volver     │  ┌─────────────────────────┐  │ ▸ Notas      [^] │
│ Título curso │  │      Video (16:9)       │  │ ▸ Materiales [^] │
│ 2 de 2 lecc. │  └─────────────────────────┘  │ ▸ Comentarios[^] │
│              │  Título lección  [Guardar nota]│                  │
│ PROGRESO DEL │                                │                  │
│ CURSO ▓▓▓100%│  ┌── Profundiza en este tema ─┐│                  │
│              │  │ [chip][chip][chip][chip]   ││                  │
│ BEGINNING    │  └────────────────────────────┘│                  │
│ ✓ Lección 1  │  👍  👎  🚩                     │                  │
│ ✓ Lección 2  │                                │                  │
│ ✦ Eval Final │  [Siguiente lección →] [✓ Lec.]│                  │
└──────────────┴───────────────────────────────┴──────────────────┘
```

### Cambios por zona

#### 1. Columna izquierda (nav del curso) — ajustes

Hoy ya existe (el `<aside>` de lecciones). Cambios:

- **Mover la barra de progreso acá** (hoy está arriba del centro). Bajo el título
  del curso: label `PROGRESO DEL CURSO` (xs, `text-gray-400`, uppercase), barra
  `bg-titi-yellow` y `%` a la derecha. Reutiliza el markup de barra que ya está en
  `LearnCourse.jsx:450`.
- El nombre del módulo ya se muestra como label uppercase (`LearnCourse.jsx:337`);
  mantener (en la imagen dice "BEGINNING").
- Lecciones completadas con ✓ verde y activa resaltada — **ya implementado**, no
  cambia (`LearnCourse.jsx:341-376`).
- Evaluación en púrpura con ícono — **ya implementado** (`:377-413`).
- Quitar del centro el botón "✕" de cerrar y el toggle de progreso; "← Volver"
  ya vive en el sidebar.

#### 2. Columna central — contenido de la lección

- **Video** arriba (iframe 16:9) — ya existe (`LessonView`, `:534`). Sin cambios.
- **Fila de título**: título de la lección a la izquierda + botón **"Guardar nota"**
  (ícono bookmark) a la derecha. → feature NUEVA (ver §Notas).
- **Card "Profundiza en este tema"** (NUEVA): fondo destacado
  (`bg-titi-yellow-light` o `bg-titi-cream`), título con ✨, y 4 chips de prompt:
  - "Quiero preguntas de práctica"
  - "Explica este tema de forma sencilla"
  - "Hazme un resumen"
  - "Dame ejemplos de la vida real"
  → feature NUEVA de IA (ver §Profundiza/IA).
- **Fila like / dislike / flag** (NUEVA): tres íconos (`👍 👎 🚩`) para reacción y
  reporte de la lección. (Definir si persiste en backend o es local — ver decisiones.)
- **Fila de acción al pie** (cambia): dos botones lado a lado:
  - **"Siguiente lección →"** (NUEVO, estilo secundario/outline): navega a la
    siguiente lección del curso (siguiente en el módulo o primera del módulo
    siguiente; si es la última, ir a la evaluación final).
  - **"✓ Lección completada"** (verde) — reutiliza el botón actual de completar
    (`LessonView`, `:592-612`), movido a esta fila.
- El texto de `contenido` de la lección sigue renderizándose (entre video y la
  card de Profundiza, o debajo del título). Mantener.
- **Mover Materiales y Comentarios fuera del centro** → van a la columna derecha.

#### 3. Columna derecha (paneles colapsables) — NUEVA

Tres tarjetas tipo acordeón (chevron que colapsa/expande), estilo `titi-card`:

- **Notas** — "Tus apuntes personales de esta lección". Textarea + autosave o
  botón guardar. Sincroniza con el botón "Guardar nota" del centro. (Ver §Notas.)
- **Materiales** — "Recursos descargables de la lección". Reutiliza
  `MaterialChip` (`LearnCourse.jsx:502`) y el estado `materialsByLesson`. Empty
  state: "No hay materiales disponibles por el momento".
- **Comentarios (N)** — mueve `<LessonComments>` (`components/LessonComments.jsx`)
  acá dentro. El contador (N) sale de la cantidad de comentarios. El empty state
  con Titi ("Sé el primero en comentar / Tu duda puede ser la duda de otro.
  ¡Anímate!") debería vivir en `LessonComments` usando `<TitiMascot>`.

### Features nuevas que tocan backend / requieren decisión

1. **Notas por lección** (`Nota` / apuntes): persistir el texto por
   `(usuarioId, leccionId)`. Decisión: ¿modelo Prisma nuevo `NotaLeccion` con
   endpoints `GET/PUT /api/lessons/:id/note`, o `localStorage` por ahora?
   Recomendación: backend (Postgres) por ser dato del alumno; sigue patrón de
   `titi-backend-patterns` y `titi-dual-db` (vive en Postgres, no en Neo4j).
2. **"Profundiza en este tema" (IA)**: cada chip manda el contenido/título de la
   lección a un endpoint que responde con texto generado. Integrar vía **Claude
   API (Anthropic)** desde el backend — la API key **nunca** en el frontend.
   Endpoint nuevo `POST /api/lessons/:id/ai` con `{ prompt }` → `{ respuesta }`.
   Mostrar la respuesta en un panel/modal. **Decisión pendiente:** confirmar que
   se quiere IA real (costo por request) y dónde se muestra la respuesta.
3. **like / dislike / flag de lección**: ¿persistir (modelo + endpoints) o es
   feedback efímero? Si persiste: Postgres `(usuarioId, leccionId, tipo)`.
   `flag` = reporte → cola de moderación admin. **Decisión pendiente.**
4. **"Siguiente lección"**: solo frontend (navegación entre `activeId`); no toca
   backend. Calcular la siguiente lección a partir de `curso.modulos`.

### Componentes nuevos / a modificar

- `pages/LearnCourse.jsx` — reestructurar a grid de 3 columnas; mover progreso al
  sidebar; mover Materiales/Comentarios a la derecha; agregar fila de acción.
- `components/learn/DeepenCard.jsx` (NUEVO) — card "Profundiza" + chips de IA.
- `components/learn/LessonNotes.jsx` (NUEVO) — panel de notas (textarea + guardar).
- `components/learn/Accordion.jsx` (NUEVO, opcional) — tarjeta colapsable
  reutilizable para los 3 paneles de la derecha.
- `components/LessonComments.jsx` — agregar empty state con `<TitiMascot>` y
  exponer el conteo para el título "Comentarios (N)".
- `LessonView` (dentro de `LearnCourse.jsx`) — separar acción de completar +
  "siguiente lección"; quitar Materiales/Comentarios inline.

### Responsive

- Desktop (lg+): 3 columnas. Izquierda ya es `sticky`. Derecha también `sticky`,
  ancho fijo (~320px).
- Tablet/móvil: una sola columna. Izquierda → drawer (ya existe). Derecha (Notas/
  Materiales/Comentarios) → debajo del contenido, colapsadas por defecto.

### Convenciones a respetar

- **Paleta y componentes**: `frontend/design.md` (botones, cards, inputs, empty
  states). Checklist §12 antes de cerrar.
- **UI plana**: sin gradientes ni blur (raíz `AGENTS.md` §10). Ojo: el video y las
  portadas no necesitan el `bg-gradient`/`blur-xl` que arrastran otras vistas.
- **Mascota Titi**: siempre `<img src="/Titi.png">` / `<TitiMascot>`, nunca 🐒.
- **Motion**: paneles y card de Profundiza entran con `usePopIn`; listas con
  `useStaggerReveal` (deps por valor, ver `motion.md` §5). Acordeón abre/cierra con
  transición ≤400ms, respeta `prefers-reduced-motion`.
- **API**: `{ success, data }` / `{ success:false, message }`. Servicios externos
  (Claude API) en `try/catch` que loguea y no rompe la respuesta.

### Decisiones pendientes (confirmar con el usuario antes de implementar)

1. Notas: ¿Postgres (recomendado) o `localStorage`?
2. "Profundiza": ¿IA real con Claude API (tiene costo) o stub/placeholder por ahora?
3. like/dislike/flag: ¿se persiste? ¿el flag entra a moderación admin?
4. ¿Esto entra en la Etapa 5 (que está enfocada en deploy) o es una etapa propia?
   La raíz `AGENTS.md` no lo contempla; conviene definir su lugar en el roadmap.
