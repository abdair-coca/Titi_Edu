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
│ PROGRESO DEL │  Descripción de la lección…    │                  │
│ CURSO ▓▓▓100%│  ┌── Profundiza en este tema ─┐│                  │
│              │  │ [chip][chip][chip][chip]   ││                  │
│ BEGINNING    │  └────────────────────────────┘│                  │
│ ✓ Lección 1  │                                │                  │
│ ✓ Lección 2  │  [Siguiente lección →] [✓ Lec.]│                  │
│ ✦ Eval Final │                                │                  │
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
- **Descripción debajo del título** (pedido explícito): justo abajo del título,
  mostrar la descripción/contenido de la lección (`leccion.contenido`) como texto
  de apoyo (`text-gray-600`, leading relajado). Mantener el render que ya existe
  en `LessonView` (`:551-559`), reposicionado debajo del título.
- **Card "Profundiza en este tema"** (NUEVA — **STUB por ahora**): fondo destacado
  (`bg-titi-yellow-light` o `bg-titi-cream`), título con ✨, y 4 chips de prompt:
  - "Quiero preguntas de práctica"
  - "Explica este tema de forma sencilla"
  - "Hazme un resumen"
  - "Dame ejemplos de la vida real"
  La UI va completa; al tocar un chip muestra una respuesta **placeholder/mock**
  (sin IA real todavía). Dejar el punto de conexión listo para enchufar Claude API
  después (ver §Features #2).
- **Fila de acción al pie** (cambia): dos botones lado a lado:
  - **"Siguiente lección →"** (NUEVO, estilo secundario/outline): navega a la
    siguiente lección del curso (siguiente en el módulo o primera del módulo
    siguiente; si es la última, ir a la evaluación final).
  - **"✓ Lección completada"** (verde) — reutiliza el botón actual de completar
    (`LessonView`, `:592-612`), movido a esta fila.
- **like / dislike / flag**: **OMITIDO en esta iteración** (no se incluye por ahora).
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

1. **Notas por lección** (`NotaLeccion`) — **DECIDIDO: Postgres**. Modelo Prisma
   nuevo con `(usuarioId, leccionId)` único + endpoints `GET/PUT
   /api/lessons/:id/note`. Sigue `titi-backend-patterns` y `titi-dual-db` (vive en
   Postgres, no en Neo4j). El botón "Guardar nota" del centro y el panel "Notas" de
   la derecha comparten el mismo estado/endpoint.
2. **"Profundiza en este tema" (IA)** — **DECIDIDO: STUB por ahora**. La UI y los 4
   chips van completos; la respuesta es placeholder/mock en el frontend (o un
   endpoint que devuelve texto fijo). Dejar el contrato listo para enchufar luego
   **Claude API (Anthropic)** desde el backend (`POST /api/lessons/:id/ai` con
   `{ prompt }` → `{ respuesta }`, key **nunca** en el frontend). No hay costo de IA
   mientras sea stub.
3. **like / dislike / flag de lección** — **DECIDIDO: OMITIR** en esta iteración.
4. **"Siguiente lección"**: solo frontend (navegación entre `activeId`); no toca
   backend. Calcular la siguiente lección a partir de `curso.modulos`.

### Componentes nuevos / a modificar

- `pages/LearnCourse.jsx` — reestructurar a grid de 3 columnas; mover progreso al
  sidebar; mover Materiales/Comentarios a la derecha; agregar fila de acción.
- `components/learn/DeepenCard.jsx` (NUEVO) — card "Profundiza" + chips. Respuesta
  STUB (mock) por ahora; contrato listo para Claude API después.
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

### Decisiones tomadas

1. **Notas** → Postgres (modelo `NotaLeccion` + endpoints).
2. **"Profundiza" (IA)** → STUB por ahora (UI completa, respuesta mock; Claude API
   queda para después).
3. **like / dislike / flag** → OMITIR en esta iteración.
4. **Descripción de la lección** → mostrarla debajo del título (centro).
5. **Estado** → por ahora solo este spec; **no implementar** hasta que el usuario lo pida.

### Pendiente de confirmar

- Lugar en el roadmap: la raíz `AGENTS.md` está enfocada en deploy (Etapa 5) y no
  contempla este rediseño. Definir si es una subfase aparte o una etapa propia
  antes de arrancar la implementación.
