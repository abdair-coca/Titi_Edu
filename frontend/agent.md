# agent.md (frontend) — Titi

Guía de trabajo específica del frontend. Para el sistema visual ver
`frontend/design.md`; para animación `frontend/motion.md`; para el plan de etapa
ver el `AGENTS.md` de la raíz.

---

## Rediseño — Catálogo de Cursos (`pages/Courses.jsx`)

> **Estado:** IMPLEMENTADO (pasos 1–5). Propuesta de diseño en
> `frontend/design-proposal/.../Catalogo de Cursos v2.dc.html`. `Courses.jsx` ya
> es la landing v2: promo bar, hero (search + stats reales), featured/popular
> categories (categorías reales), trending (tabs + CourseCard v2 sin
> rating/students), paneles de comunidad (dark promo + stat strip + logros),
> testimonios y learning paths (placeholder estático), y footer. Sin filtro de
> nivel. UI plana (sin gradientes/blur). Entradas por sección con
> `useStaggerReveal`.

### Objetivo visual

Convertir el catálogo (hoy: header + filtros + grid de cards) en una página tipo
landing de comunidad, con varias secciones apiladas dentro del shell de la app
(sidebar intacto). Secciones de la propuesta, de arriba a abajo:

1. **Promo bar** amarilla — "Cursos nuevos cada semana, creados por la comunidad".
2. **Hero** (2 columnas) — badge, título grande ("Aprendé algo nuevo, hoy."),
   subtítulo, **search grande**, y stats (N cursos / N categorías / N profes).
   Columna derecha: ilustración/hero (placeholder).
3. **Featured categories** — "Aprendé habilidades esenciales": 3 cards de área.
4. **Trending** — "Cursos en tendencia": **tabs de categoría** (pills) + grid de
   **cards de curso v2**.
5. **Dark promo panel** — "Reimaginá tu forma de aprender" + perks + CTA.
6. **Stat strip** — 4 stats de la comunidad.
7. **Testimonios** — "Historias de la comunidad" (4 quotes).
8. **Panel de logros** — "Sumá gotas y desbloqueá logros" + 3 badges + CTA.
9. **Learning paths** — "¿Listo para seguir aprendiendo?": 3 rutas.
10. **Popular categories** — columnas de links por categoría.
11. **Footer**.

### Adaptaciones a las convenciones de Titi (no copiar el HTML literal)

- **UI plana**: la propuesta usa gradientes, radiales y blur. **Se descartan**
  (design.md + memoria `no-gradients-no-blur`). Thumbs y paneles oscuros → color
  **sólido** (`titi-dark` para fondos oscuros, tinte de categoría/`titi-cream`
  para thumbs). Nada de `blur-*` ni `bg-gradient-*`.
- **Tipografía y paleta**: usar las del proyecto (`design.md`), no importar
  Poppins/Nunito ni los hex sueltos del HTML. Mapear: `#facc15`→`titi-yellow`,
  `#14213d`/`#0e1626`→`titi-dark`, `#fbf6e3`→`titi-cream`, `#dd5a2c`→acento.
- **Mascota**: `<img src="/Titi.png">` / `<TitiMascot>`, nunca emoji de mono.
- **Motion**: entradas por sección con `useStaggerReveal`/`usePopIn` (deps por
  valor, ver `motion.md` §5); hover de tiles con `.titi-card-pop`. Tope 400ms.

### Huecos de backend / decisiones (CONFIRMADAS)

El mock del HTML trae datos que **no existen** en la API actual. Decisiones:

- **Rating (estrellas) y nº de students** → **OMITIR** en las cards v2 (no
  inventar datos).
- **Testimonios** y **Learning paths** → **PLACEHOLDER ESTÁTICO**, claramente
  marcado como demo (contenido fijo en el front; sin backend).
- **Filtro de nivel** → **OMITIR**. El catálogo filtra solo por **search** (hero)
  + **tabs de categoría**. Se elimina el `<select>` de nivel.
- **Featured / Popular categories / tabs** → se derivan de `GET /api/categories`
  (reales). Los "perks", "badges" y copys de marketing son estáticos.
- **Stats del hero y strip** → derivados de data real (`cursos.length`,
  `categorias.length`, profes distintos). "valoración promedio" se **omite** (no
  hay rating).

### Plan de 5 pasos (cada uno: implementar → "qué testear" → esperar feedback)

**Paso 1 — Shell + Promo bar + Hero.**
Reestructurar `Courses.jsx` al nuevo layout (contenedor `max-w`, secciones
apiladas). Promo bar amarilla. Hero plano: badge, título, subtítulo, search
grande (reusa el estado/debounce actual), stats reales. Sin gradientes.
- *Qué testear:* el hero se ve bien en desktop y móvil; escribir en el search
  filtra (aunque el grid todavía sea el viejo o esté vacío); los números de stats
  coinciden con los datos; nada de gradientes/blur.

**Paso 2 — Trending: tabs de categoría + CourseCard v2.**
Reemplazar los `<select>` por **pills** (Todas + categorías reales) que filtran.
Nueva `CourseCard` v2 (thumb plano con tópico, badge de nivel, categoría, título,
autor con avatar/iniciales, texto de lecciones). Mantener `useStaggerReveal`,
empty/skeleton/error. Rating/students omitidos (según decisión).
- *Qué testear:* las pills filtran por categoría; las cards nuevas se ven y
  hacen hover-pop; click abre `/courses/:id`; buscar + tab combinan; empty state
  cuando no hay resultados.

**Paso 3 — Featured + Popular categories.**
"Aprendé habilidades esenciales" (3 cards de categoría destacada) y "Categorías
populares" (columnas de links). Click en una categoría filtra el Trending (o
navega con el filtro aplicado). Derivado de categorías reales.
- *Qué testear:* las 3 destacadas y las columnas reflejan categorías reales;
  click lleva al curso/filtra; responsive (columnas colapsan en móvil).

**Paso 4 — Paneles de comunidad (dark promo + stat strip + logros).**
Dark promo panel plano + perks + CTA "Empezar a aprender". Stat strip (4 stats
reales). Panel de logros + 3 badges + CTA a `/certificates`. Copys estáticos.
- *Qué testear:* paneles planos (sin gradiente), CTAs navegan a destinos reales,
  stats correctos, se ve bien apilado en móvil.

**Paso 5 — Testimonios + Learning paths + Footer + pulido.**
Testimonios y rutas según la decisión (placeholder marcado u omitidos). Footer.
Entradas por sección (`useStaggerReveal`), repaso responsive y
`prefers-reduced-motion`. Checklist `design.md` §12 + `motion.md`.
- *Qué testear:* scroll completo de la página; entradas suaves; reduced-motion
  desactiva animaciones; footer y secciones finales correctas en móvil/desktop.

---

## Pulido visual / UX — Catálogo de Cursos v2.1 (`pages/Courses.jsx`)

> **Estado:** IMPLEMENTADO (pasos 1–6). Hero con ilustración de comunidad,
> categorías destacadas con imágenes HQ, dificultad como etiqueta de texto color,
> rutas de aprendizaje curadas, dark-promo/empty/error con Titi animado, e
> iconografía SVG + microinteracciones (search clear, tabs sticky, back-to-top).
> Pendiente opcional: repaso fino de ritmo/responsive 375px y checklist
> `design.md` §12 (no bloqueante). Foco fue **calidad visual** con Titi
> protagonista, UI plana (memoria `no-gradients-no-blur`).

### Objetivo

Que el catálogo deje de verse "maquetado con cajas y emojis" y pase a verse
**profesional y terminado**: hero con una **imagen representativa real** de la
app, categorías destacadas con **imágenes de alta calidad** (no emoji), tarjetas
de curso con una **clasificación de dificultad fiel al estilo Titi**, y **rutas
de aprendizaje reales** que no se pisen con las áreas/categorías.

### Prioridades del usuario (lo que pidió, en orden)

1. **Hero → imagen representativa de la app.** Hoy es un `<div>` placeholder
   (`Courses.jsx:350-367`): caja oscura + círculos + texto. Quiere una **imagen**
   real que represente la app. Titi protagonista.
2. **Categorías destacadas → imágenes HQ.** Hoy `FeaturedCategoryCard`
   (`:781-818`) usa solo un **emoji gigante** (`categoria.icono`, `:790`) sobre
   `bg-titi-yellow-light`. Quiere que se vea **profesional**, con imágenes de alta
   calidad por categoría.
3. **CourseCard → rediseñar la dificultad.** No le gusta el badge de nivel actual
   (`:936-944`): punto de color + texto en una píldora blanca. Quiere algo **más
   fiel al estilo Titi**.
4. **Armar las Learning paths + resolver redundancia con Áreas.** Hoy las rutas
   son placeholder estático (`PATHS`, `:661-678`) y **se sienten redundantes** con
   las "categorías destacadas" (áreas). Hay que **diferenciarlas** y darles
   contenido real/curado.

### Diagnóstico (estado real hoy, con líneas)

| # | Punto | Dónde | Problema |
|---|---|---|---|
| A | **Hero visual** | `Courses.jsx:350-367` | Caja `bg-titi-dark` + círculos + texto. Placeholder, no imagen. `hidden lg:flex` → en móvil no se ve. |
| B | **Featured categories** | `FeaturedCategoryCard :781-818` (thumb `:789-793`) | Solo emoji gigante sobre `bg-titi-yellow-light`. Poco profesional. |
| C | **CourseCard dificultad** | `:936-944` (`nivelDotClass :881-892`) | Badge punto+texto poco fiel al estilo; querés rediseñarlo. |
| D | **Learning paths** | `PATHS const` + `:644-680` | Estático/demo, con `★ rating` inventado. Redundante con áreas. |
| E | Dark-promo visual | `:528-533` | Caja gris que dice "imagen / collage". Placeholder. |
| F | Empty / error states | `:1007, :1033, :1061` | Usan `Titi.png` estático; error con emoji `⚠️`. |
| G | Emoji hardcodeado | `:535 💧`, `:791/:931 📚`, `:1061 ⚠️` | Rompen la UI plana de SVG. (`categoria.icono` de data se respeta.) |
| H | Microint. / ritmo | search `:311`, tabs `:420`, toda la página | Sin clear en search, tabs no sticky, sin back-to-top; 11 secciones mismo `gap`. |

### Decisiones (TODAS CONFIRMADAS)

- **Titi protagonista** del hero (y empty states), animado (`TitiMascot` 6.4),
  respeta `prefers-reduced-motion` (cae a `Titi.png`).
- **UI plana**: sin `bg-gradient-*` ni `blur-*`. Paneles oscuros = color sólido.
- **Fuente de imágenes = IA generativa hosted** (Flux/Midjourney/DALL·E). El rig
  local (ComfyUI SD1.5/4GB) **no alcanza** calidad de hero/escena → se reserva
  solo para animar a Titi (subfase 6.4). El usuario genera el PNG hosted, se
  **optimiza a WebP** y los PNG fuente van a `frontend/.hero-src/` (gitignored)
  para no shippearlos en el build de Vite.
- **Concepto del hero = "comunidad aprendiendo"**: escena ilustrada de gente
  diversa aprendiendo con **Titi guiando** (protagonista). Cálida, plana, on-brand.
- **Dificultad en CourseCard = etiqueta de texto con color de marca por nivel**
  (sin forma/píldora): `PRINCIPIANTE` verde · `INTERMEDIO` ámbar · `AVANZADO`
  naranja · `SIN NIVEL` gris. Ultra plano. Se reusa el mapeo de `nivelDotClass`
  pero como **color de texto**, no punto.
- **Áreas ≠ Rutas, rutas curadas estáticas (frontend):**
  - **Áreas** (Featured/Popular categories) = *explorar por tema* (una categoría).
  - **Rutas** (Learning paths) = *secuencia ORDENADA de cursos reales hacia un
    objetivo* (ej. "De cero a programador"), curadas a mano en el front
    referenciando cursos reales del catálogo. **Sin backend nuevo.** Se quita el
    `★ rating` inventado.

### Plan de pasos (cada uno: implementar → "qué testear" → esperar feedback)

> El orden sigue las prioridades del usuario. Cada paso cierra con **commit**
> (identidad `abdair-coca`, conventional commit, ver memoria `git-commit-identity`).

**Paso 1 — Hero "comunidad aprendiendo" (Titi protagonista). ✅ HECHO.**
Imagen generada con modelo hosted (`community2.png`, elegida por el usuario),
optimizada a `public/hero/community.webp` (1448×1086, **122 KB**, de 1.6 MB PNG).
Reemplazado el `<div>` placeholder (`:349-367`) por la imagen, **visible en
móvil** (quitado `hidden lg:flex`). `loading="eager"` + `fetchpriority="high"`
(es LCP del hero) + `width/height` para evitar layout shift.
- **Desvío:** la ilustración **ya contiene a Titi** de protagonista → NO se
  superpone el `TitiMascot` animado (evita Titi doble). Cumple "Titi protagonista".
- *Qué testear:* el hero muestra la ilustración en desktop y móvil; nítida; sin
  gradiente/blur; search/stats siguen funcionando; peso 122 KB.

**Paso 2 — Categorías destacadas con imágenes IA. ✅ HECHO.**
8 imágenes HQ on-brand (modelo hosted, set cohesivo: fondo crema, navy+amarillo,
acento naranja) optimizadas a `public/categories/<slug>.webp` (~9–18 KB c/u, de
~950 KB PNG; PNG fuente en `.cat-src/` gitignored). Helper `categoriaImg(nombre)`
mapea nombre→slug vía `normalizeText` (sin acentos/ñ). `FeaturedCategoryCard`
(`:781+`) ahora muestra la imagen (thumb `h-40` `object-contain` sobre crema) con
**fallback a `categoria.icono`** si falta (`onError`+estado). Lazy-load, foco y
`titi-card-pop` intactos.
Las 3 destacadas se **curan** con `FEATURED_PREF` (primeras 3 que existan;
Programación/Idiomas/Matemáticas), no por orden crudo de la API. Thumb `h-52`
`object-cover` full-bleed (imágenes grandes/protagonistas).
- *Qué testear:* las 3 destacadas muestran imágenes HQ (no emoji); on-brand y
  cohesivas; si falta una imagen cae al emoji; hover-pop; click filtra el
  Trending; responsive; lazy-load.

**Paso 3 — CourseCard: dificultad = etiqueta de texto color. ✅ HECHO.**
Sacado el badge punto+píldora sobre el thumb. El nivel ahora es **etiqueta de
texto** en mayúsculas con **color de marca por nivel** (`PRINCIPIANTE` verde ·
`INTERMEDIO` ámbar · `AVANZADO` naranja · `SIN NIVEL` gris), sin forma, en la
fila de meta junto a la categoría (`ml-auto`, alineada a la derecha).
`nivelDotClass` (bg) → `nivelTextClass` (text), extraído a `lib/nivel.js` y
reusado en `CourseCard` y `RecommendedCourseCard` (consistencia).
- *Qué testear:* el nivel se lee claro y se siente Titi (plano); los 4 estados de
  nivel se ven bien; consistente entre CourseCard y RecommendedCourseCard.

**Paso 4 — Learning paths curadas + diferenciación de Áreas. ✅ HECHO.**
`PATHS` curado a mano (`{ title, objetivo, cursos: [títulos] }`) con 3 rutas: "De
cero a Programador", "Camino a Data Science", "Front-End Moderno". `learningPaths`
resuelve cada título contra el catálogo real (`allCursos`), omite cursos
inexistentes y rutas vacías. Sección rediseñada: cada ruta = card con badge
"Ruta" + objetivo + **lista ordenada (1,2,3…)** de cursos reales (título + nivel);
click en un paso → `/courses/:id`. Quitado el `★ rating`. Copy reencuadrado:
Rutas = caminos ordenados hacia un objetivo (vs Áreas = explorar un tema).
- *Qué testear:* rutas y áreas se entienden distintas; cada ruta muestra sus
  cursos reales en orden; sin `★`/datos inventados; clicks navegan; si una ruta
  referencia un curso inexistente, no rompe (se omite).

**Paso 5 — Dark-promo + empty/error con Titi. ✅ HECHO.**
Caja "imagen/collage" del dark-promo → `<TitiMascot state="idle" size="xl">`
animado (se mantiene la card flotante "+1 gota"). `EmptyState`: sin filtros →
`<TitiMascot state="idle">`; con filtros sin resultados → `state="triste"` (cae a
`Titi.png` hasta que exista el webp). `ErrorState`: emoji `⚠️` → SVG de alerta
inline. Todo respeta `prefers-reduced-motion` (TitiMascot cae a estático).
- *Qué testear:* no queda la caja "imagen/collage" (ahora Titi animado en el
  dark-promo); feed sin cursos → Titi idle animado; búsqueda sin match → Titi
  (triste/fallback) + "limpiar filtros"; error → SVG (no emoji); reduced-motion ok.

**Paso 6 — Iconografía SVG + microinteracciones. ✅ HECHO.**
`components/icons.jsx` (GotaIcon, BookIcon). Reemplazados los emoji decorativos
hardcodeados: `💧` (card +1 gota) → GotaIcon; `📚` fallbacks → BookIcon (cuando
no hay imagen ni `categoria.icono`); `⚠️` ya era SVG (Paso 5). Microint.: search
con botón **limpiar** (✕ cuando hay texto), **tabs sticky** (`top-14 md:top-2`,
bg-neo-bg) al scrollear el grid, botón **volver arriba** (aparece tras 600px,
`bottom-24 md:bottom-6` para no chocar el bottom-nav móvil).
- **Nota:** los emoji de `BADGES` (🔥💧🏅) se dejan a propósito — es un panel de
  marketing "contenido de ejemplo", set cohesivo. Los `categoria.icono` (data) se
  mantienen.
- *Qué testear:* gota/libro como SVG; limpiar search con un click; pills quedan
  fijas al scrollear; "volver arriba" aparece y funciona; no choca el bottom-nav
  en móvil; `npm run build` verde.

### Convenciones a respetar

- **Paleta/componentes**: `frontend/design.md` (§5 cards, §8 estados, §12
  checklist). **UI plana** (sin gradiente/blur, memoria `no-gradients-no-blur`).
- **Mascota**: `<TitiMascot>` (animado, subfase 6.4), nunca emoji de mono 🐒.
  Estados hoy: `idle`, `celebra` (los demás caen a `Titi.png`).
- **Motion**: entradas con `useStaggerReveal`/`usePopIn` (deps por valor,
  `motion.md` §5); tope 400ms; respeta `prefers-reduced-motion`.
- **Imágenes**: optimizadas (WebP/AVIF, lazy-load), peso controlado (el catálogo
  carga rápido). Si se generan con IA local, viven en `public/` ya optimizadas.
- **Commits**: uno por paso cerrado, identidad `abdair-coca` (memoria
  `git-commit-identity`), conventional commits en español.

### Preguntas resueltas (Q&A 2026-06-22)

1. Fuente de imágenes → **IA local (ComfyUI)**.
2. Concepto del hero → **comunidad aprendiendo con Titi guiando**.
3. Dificultad en CourseCard → **etiqueta de texto con color por nivel**.
4. Learning paths → **curadas estáticas (frontend)**, distintas de las áreas.

### Pendiente de definir en ejecución (no bloquea el plan)

- **Prompts/estilo ComfyUI** exactos para hero y categorías (se afinan al generar,
  vía skill `animate-comfyui` / rig en `C:\ComfyUI`).
- **Qué categorías reales** existen (de `GET /api/categories`) → para cuántas
  imágenes generar y el mapeo slug→imagen.
- **Qué rutas curadas** armar y con qué cursos reales (depende del catálogo
  actual en la DB).

---

## Rediseño — Sección Learn (`pages/LearnCourse.jsx`)

> **Estado:** IMPLEMENTADO (pasos 1–5). `LearnCourse.jsx` ya es de 3 columnas:
> sidebar con progreso, centro (video + descripción + Profundiza + acción), y
> columna derecha como riel de íconos (Notas/Archivos/Comentarios) con panel
> desplegable. Notas persisten en Postgres (`NotaLeccion`). "Profundiza" es STUB
> (sin IA real todavía). like/dislike/flag: omitido. Pendiente futuro: enchufar
> Claude API a "Profundiza" (ver §Features #2).

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

#### 3. Columna derecha (riel de íconos + panel desplegable) — NUEVA

Para no sobrecargar la vista: un **riel vertical de íconos** a la derecha (Notas /
Archivos / Comentarios). Por defecto **todo colapsado** (solo íconos). Al tocar un
ícono se abre, a su izquierda, un panel con el contenido de esa sección; tocar de
nuevo (o la ✕) lo cierra. Solo uno abierto a la vez. El link "Guardar nota" del
centro abre el panel de Notas. Las tres secciones son:

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
