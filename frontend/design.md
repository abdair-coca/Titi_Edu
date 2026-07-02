# DESIGN.md — Titi Platform

Lee este archivo antes de generar cualquier componente de UI.
Es la fuente de verdad visual del proyecto. Todo lo que generes debe ser consistente con estas reglas.

> **v2 — "vivo y premium"**: misma paleta y esencia de siempre, pero el color
> ahora se usa **sólido y con confianza** (como Duolingo), las superficies
> clickeables se sienten **táctiles** (borde grueso + sombra dura), el motion
> es **de primera clase** (§10 y [`motion.md`](./motion.md)), la tipografía es
> **más grande y gruesa** (§3), el layout es **denso — aire sí, vacío no**
> (§4) y las imágenes que comparta el usuario se interpretan como propuesta
> de diseño con el protocolo de §13.

---

## 1. Filosofía de diseño

Titi no es Duolingo ni Udemy. Es **lo que pasa cuando ambos se juntan en Bolivia**.

| Dimensión | Duolingo | Udemy | **Titi** |
|---|---|---|---|
| Tono | Agresivo, gamificado | Profesional, denso | **Cálido, motivador, universitario** |
| Color dominante | Verde brillante | Púrpura | **Amarillo vibrante** |
| Tipografía | Redondeada custom | Sans-serif neutro | **Nunito — redondeada y amigable** |
| Mascota | Duolingo owl omnipresente | Sin mascota | **Titi el mono, presente en momentos clave** |
| Sensación | App de juego | Plataforma de trabajo | **Red social donde aprendes con tus amigos** |

### Principios de diseño

1. **Cálido antes que agresivo** — El amarillo de Titi invita, no grita.
2. **Color sólido con propósito** — Los acentos usan color **pleno** de la
   paleta (círculo púrpura sólido, badge verde sólido), nunca lavado. Pero cada
   color significa un rol (§2); el color nunca es decoración aleatoria.
3. **Plano siempre** — Cero gradientes, cero blur. La viveza sale de la
   saturación de la paleta y del motion, no de efectos.
4. **Táctil donde se toca** — Lo clickeable se ve clickeable: borde grueso,
   sombra dura inferior que se aplana al presionar (§5.2). Lo informativo se
   queda liviano y suave. Esa dualidad es el look "juego premium".
5. **El motion es parte del diseño** — Un componente sin su animación de
   entrada/feedback está **incompleto** (§10). No es un extra que se agrega
   después.
6. **Social primero** — El aprendizaje aparece integrado en el feed social.
7. **Progreso visible y vivo** — Rachas, gotas y logros siempre a la vista;
   los números cuentan hacia arriba, las barras se llenan (§10).
8. **Titi aparece en momentos que importan** — Celebrar, motivar, explicar —
   y ahora también en banners/headers clave, siempre animado (§7).
9. **Consistencia sobre creatividad** — Claude Code debe reproducir exactamente
   estos patrones, no inventar variaciones.

### El estándar de experiencia — "espectacular" en concreto

La UX de Titi se mide con estas 8 reglas. Si una página falla una, no está
terminada:

1. **Respuesta percibida instantánea** — optimistic updates en toda mutación
   (like, inscribirse, completar); feedback de press ≤150ms en todo clickeable.
2. **Nada salta** — skeletons que replican la silueta exacta del contenido
   real; alturas reservadas para imágenes y bloques async. Cero layout shift.
3. **Máximo 2 clicks** hasta la acción principal de cada página ("Continuar
   lección" desde Mis cursos = 1 click).
4. **Los estados vacíos venden el siguiente paso** — Titi + CTA concreto,
   nunca un callejón sin salida.
5. **Todo error es recuperable inline** — mensaje claro + botón "Reintentar"
   en el lugar, sin recargar la página.
6. **Teclado y lectores de pantalla** — focus visible amarillo
   (`focus-visible:ring-titi-yellow`), `aria-label` en toggles e íconos
   accionables, `role="progressbar"` en barras.
7. **Mobile con paridad total** — bottom nav por rol, nada que solo funcione
   con hover.
8. **Cada viewport muestra contenido útil** — densidad §4: el usuario nunca
   scrollea a través de aire.

---

## 2. Paleta de colores

> La paleta **no cambió** en v2. Lo que cambió es **cómo se aplica**: sólido
> pleno en acentos, tinte claro en fondos. Ver "Duotono por rol" abajo.

### Colores primarios

```css
:root {
  /* === PRIMARIOS === */
  --color-primary: #FFD93D;          /* Amarillo Titi — acción principal */
  --color-primary-hover: #FFC107;    /* Amarillo más profundo — hover */
  --color-primary-light: #FFF3B0;    /* Amarillo suave — fondos destacados */
  --color-primary-dark: #E6B800;     /* Amarillo oscuro — texto sobre fondo amarillo */

  /* === FONDOS === */
  --color-bg-base: #FFFBF0;          /* Fondo cálido principal */
  --color-bg-card: #FFFFFF;          /* Fondo de tarjetas */
  --color-bg-input: #F9F5E7;         /* Fondo de inputs */
  --color-bg-sidebar: #1A1A2E;       /* Sidebar oscuro */
  --color-bg-sidebar-hover: #16213E; /* Hover en sidebar */
  --color-bg-sidebar-active: #0F3460;/* Item activo en sidebar */

  /* === TEXTO === */
  --color-text-primary: #1A1A2E;     /* Texto principal — casi negro */
  --color-text-secondary: #6B7280;   /* Texto secundario — gris medio */
  --color-text-muted: #9CA3AF;       /* Texto deshabilitado / placeholder */
  --color-text-inverse: #FFFFFF;     /* Texto sobre fondos oscuros */
  --color-text-on-primary: #1A1A2E;  /* Texto sobre fondo amarillo */

  /* === SEMÁNTICOS (estados) === */
  --color-success: #22C55E;          /* Verde — lección completada, aprobado */
  --color-success-light: #DCFCE7;    /* Fondo verde suave */
  --color-error: #EF4444;            /* Rojo — error, intento fallido */
  --color-error-light: #FEE2E2;      /* Fondo rojo suave */
  --color-warning: #F59E0B;          /* Naranja — advertencia, racha en riesgo */
  --color-warning-light: #FEF3C7;    /* Fondo naranja suave */
  --color-info: #3B82F6;             /* Azul — info neutral, links de sección */
  --color-info-light: #DBEAFE;       /* Fondo azul suave */

  /* === GAMIFICACIÓN === */
  --color-streak: #FF6B35;           /* Naranja fuego — racha activa */
  --color-streak-broken: #9CA3AF;    /* Gris — racha rota */
  --color-xp: #FFD93D;               /* Amarillo — gotas / XP */
  --color-achievement: #A855F7;      /* Púrpura — logros desbloqueados */
  --color-certificate: #F59E0B;      /* Dorado — certificados */

  /* === BORDES === */
  --color-border: #E5E7EB;           /* Borde estándar */
  --color-border-focus: #FFD93D;     /* Borde en foco — amarillo Titi */
  --color-border-card: #F3F4F6;      /* Borde de tarjetas */
}
```

### Tailwind config — colores custom

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        titi: {
          yellow:       '#FFD93D',
          'yellow-hover':'#FFC107',
          'yellow-light':'#FFF3B0',
          'yellow-dark': '#E6B800',
          cream:        '#FFFBF0',
          dark:         '#1A1A2E',
          'dark-mid':   '#16213E',
          'dark-deep':  '#0F3460',
          streak:       '#FF6B35',
          achievement:  '#A855F7',
          certificate:  '#F59E0B',
        }
      }
    }
  }
}
```

### Duotono por rol — cómo se aplica cada color

Cada rol tiene un **sólido** (acentos: círculos de ícono, badges, chips) y un
**tinte** (fondos grandes: paneles, filas destacadas). El ícono sobre sólido es
**blanco**, salvo sobre amarillo que es **oscuro** (contraste).

| Rol | Sólido (Tailwind) | Tinte de fondo | Ícono sobre sólido |
|---|---|---|---|
| Acción / gotas / XP | `bg-titi-yellow` | `bg-titi-yellow-light` | `text-titi-dark` |
| Éxito / completado | `bg-green-500` | `bg-green-100` | `text-white` |
| Logro | `bg-titi-achievement` | `bg-purple-100` | `text-white` |
| Info / links de sección | `bg-blue-500` | `bg-blue-100` | `text-white` |
| Racha | `bg-titi-streak` | `bg-orange-100` | `text-white` |
| Certificado | `bg-titi-certificate` | `bg-titi-yellow-light` | `text-white` |
| Error | `bg-red-500` | `bg-red-50` | `text-white` |

```jsx
// ✅ Chip de rol v2 — color PLENO + ícono blanco (como los nodos de Duolingo)
<span className="w-11 h-11 rounded-full bg-titi-achievement shadow-sm grid place-items-center">
  <AwardIcon className="w-5 h-5 text-white" />
</span>

// ❌ v1 — tinte pastel con ícono de color (ya no; solo para fondos grandes)
<span className="w-11 h-11 rounded-full bg-purple-100 ...">
  <AwardIcon className="w-5 h-5 text-titi-achievement" />
</span>
```

### Reglas de armonía (lo que hace que se vea premium y no carnaval)

- **Un rol dominante por componente.** Una card tiene UN color de acento
  protagonista + neutrales (blanco, cream, grises). Máximo **3 roles** visibles
  dentro de una misma card.
- **Proporción 60/30/10**: ~60% superficies neutras (blanco/cream), ~30%
  amarillo Titi (marca), ~10% acentos semánticos (verde/púrpura/azul/naranja).
- **El sólido se gana el lugar**: badges, círculos de ícono, barras llenas,
  CTAs. Los fondos grandes siempre en tinte o neutro — nunca un panel entero
  en color sólido saturado (excepción: botón primario y sidebar oscuro).
- **Links de sección** ("Ver todo", "Ver más"): siempre `text-blue-500`
  (`--color-info`), `text-sm font-bold uppercase tracking-wide`.

### Regla de uso de color

| Contexto | Color a usar |
|---|---|
| Botón de acción principal | `bg-titi-yellow` sólido + texto `text-titi-dark` |
| Botón secundario / outline | Blanco, `border-2` gris, sombra dura gris (§5.1) |
| Botón destructivo | `bg-red-500` con texto blanco |
| Círculo/chip de ícono | **Sólido del rol** + ícono blanco (oscuro sobre amarillo) |
| Badge de estado ("Completado") | Sólido del rol + texto blanco (`bg-green-500 text-white`) |
| Badge de nivel sobre portada | `bg-titi-dark text-white` (pill oscuro, look mockup) |
| Lección completada (fila/panel) | Fondo `bg-green-100`, acentos `green-600` |
| Racha activa | `bg-titi-streak` sólido con ícono blanco |
| Logro desbloqueado | `bg-titi-achievement` sólido |
| Sidebar | Fondo `bg-titi-dark`, texto blanco |
| Input focus | Borde `--color-border-focus` + ring amarillo suave |

---

## 3. Tipografía

### Fuente principal: Nunito

```html
<!-- En index.html -->
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
```

```css
:root {
  --font-primary: 'Nunito', sans-serif;

  /* === ESCALA TIPOGRÁFICA === */
  --text-xs:   0.75rem;   /* 12px — labels, badges */
  --text-sm:   0.875rem;  /* 14px — texto secundario, subtítulos */
  --text-base: 1rem;      /* 16px — cuerpo de texto */
  --text-lg:   1.125rem;  /* 18px — texto destacado */
  --text-xl:   1.25rem;   /* 20px — títulos de card */
  --text-2xl:  1.5rem;    /* 24px — títulos de sección */
  --text-3xl:  1.875rem;  /* 30px — títulos de página */
  --text-4xl:  2.25rem;   /* 36px — hero / onboarding */

  /* === PESOS === */
  --font-regular:    400;
  --font-medium:     500;
  --font-semibold:   600;
  --font-bold:       700;
  --font-extrabold:  800;
  --font-black:      900;   /* Solo para números de racha y gotas */

  /* === LEADING (line-height) === */
  --leading-tight:  1.25;
  --leading-normal: 1.5;
  --leading-relaxed:1.625;
}
```

### Jerarquía tipográfica — cuándo usar qué (v2: un paso más grande y más gruesa)

| Elemento | Tamaño | Peso | Ejemplo |
|---|---|---|---|
| Título de página | `text-3xl sm:text-4xl` | `font-black` | "Catálogo de Cursos" |
| Título de sección | `text-xl sm:text-2xl` | `font-extrabold` | "Cursos populares" |
| Título de card | `text-lg` (destacadas `text-xl`) | `font-bold` | "Introducción a Python" |
| Subtítulo / descripción | `text-base` | `font-medium` | "12 lecciones · Principiante" |
| Cuerpo de texto | `text-base` | `font-medium` | Descripción de lección |
| Label / badge | `text-xs` | `font-bold` | "NUEVO", "COMPLETADO" |
| Número de racha / gotas | `text-4xl` | `font-black` | "🔥 14" |
| Número de stat card | `text-3xl` | `font-extrabold` + `tabular-nums` | "63%" |
| Botón primario | `text-base` | `font-bold` | "Inscribirse" |
| Botón secundario | `text-sm` | `font-bold` | "Ver detalles" |
| Link de sección | `text-sm` | `font-bold uppercase tracking-wide` | "VER TODO" |

**Números que animan** (count-up, §10) siempre con `tabular-nums` para que no
bailen de ancho mientras cuentan.

### Mínimos de legibilidad (reglas duras v2)

- **Nada más chico que `text-xs`** — prohibidos `text-[11px]`, `text-[10px]` y
  similares. Si no entra, sobra contenido, no falta tamaño.
- **Nada más flaco que `font-medium`** en UI — `font-normal` queda solo para
  párrafos largos de contenido de lección.
- **Texto que se lee usa `text-gray-500` o más oscuro** — `text-gray-400` solo
  para metadata terciaria (timestamps); `text-gray-300` solo placeholders.
- Todo texto interactivo (links, toggles) mínimo `font-bold`.

---

## 4. Espaciado y layout

```css
:root {
  /* === ESPACIADO BASE (múltiplos de 4px) === */
  --space-1:  0.25rem;  /* 4px */
  --space-2:  0.5rem;   /* 8px */
  --space-3:  0.75rem;  /* 12px */
  --space-4:  1rem;     /* 16px */
  --space-5:  1.25rem;  /* 20px */
  --space-6:  1.5rem;   /* 24px */
  --space-8:  2rem;     /* 32px */
  --space-10: 2.5rem;   /* 40px */
  --space-12: 3rem;     /* 48px */
  --space-16: 4rem;     /* 64px */

  /* === LAYOUT === */
  --sidebar-width:    240px;
  --content-max-width: 1200px;
  --card-gap:          1.25rem;  /* Gap entre cards en grid (v2: era 1.5rem) */
  --section-gap:       1.5rem;   /* Espacio entre secciones (v2: era 2.5rem) */

  /* === BORDER RADIUS === */
  --radius-sm:   0.375rem;  /* 6px — badges, chips */
  --radius-md:   0.5rem;    /* 8px — inputs, botones pequeños */
  --radius-lg:   0.75rem;   /* 12px — cards */
  --radius-xl:   1rem;      /* 16px — modales, panels */
  --radius-2xl:  1.5rem;    /* 24px — cards destacadas */
  --radius-full: 9999px;    /* Círculos — avatares, badges */

  /* === SOMBRAS === */
  --shadow-sm:  0 1px 2px 0 rgba(0,0,0,0.05);
  --shadow-card: 0 2px 8px rgba(0,0,0,0.06);           /* Card informativa */
  --shadow-hover: 0 8px 24px rgba(255,217,61,0.2);     /* Glow amarillo — hover de card informativa */
  --shadow-button: 0 4px 0px #E6B800;                  /* Sombra dura — botón primario */
  --shadow-button-success: 0 4px 0px #16A34A;          /* Sombra dura — botón de éxito */
  --shadow-tile: 0 4px 0px #E5E7EB;                    /* Sombra dura gris — card clickeable / botón secundario */
  --shadow-tile-hover: 0 6px 0px #E5E7EB;              /* Tile levantado en hover */
}
```

**Dos familias de sombra, dos significados:**

- **Dura inferior (`0 Npx 0`)** = "esto se presiona". Botones y **cards
  clickeables** (tiles). Se aplana al `active`.
- **Difusa** = "esto es una superficie". Cards informativas. Nunca se aplana.

### Densidad — aire sí, vacío no (v2)

El aire separa; el vacío aburre. Reglas:

- **Entre secciones**: `mb-6` (`sm:mb-8` máximo en desktop). Nunca `mb-10`+.
- **Gap de grids**: `gap-4 sm:gap-5`. `gap-6` solo en grids de tiles grandes.
- **Padding de cards**: `p-4 sm:p-5` estándar; `p-5 sm:p-6` destacadas.
  `p-8`+ solo en hero y empty states de página completa.
- **Header de página**: compacto — título + subtítulo de una línea + acción,
  `mb-5 sm:mb-6`. Sin párrafos introductorios.
- **Filas de lista**: `py-2.5` – `py-3`. Densas, separadas por `border-b`
  sutil, no por espacio.
- **Sin columnas muertas**: en desktop toda fila del layout usa su ancho. Dos
  secciones cortas se emparejan en `grid lg:grid-cols-2` (patrón Mis cursos:
  Desafíos + Categorías | Actividad) en vez de apilarse full-width con flancos
  vacíos.
- **Imágenes al ras**: portadas pegadas al borde del card
  (`overflow-hidden`, sin marco interior).
- **Empty states**: `py-10` (no `py-16`) — presentes pero no un desierto.
- **Nada de max-w chico centrado** dejando media pantalla vacía en desktop; si
  el contenido es angosto, acompañarlo con una columna secundaria útil (stats,
  actividad, sugerencias).

### Layout principal

```jsx
// Estructura base de todas las páginas autenticadas
<div className="flex min-h-screen bg-titi-cream">
  {/* Sidebar fijo */}
  <aside className="w-60 bg-titi-dark fixed h-full flex flex-col">
    {/* Navbar vertical */}
  </aside>

  {/* Contenido principal */}
  <main className="ml-60 flex-1 p-8 max-w-screen-xl">
    {/* Contenido de la página */}
  </main>
</div>
```

---

## 5. Componentes — patrones de referencia

### 5.1 Botones

#### Botón primario (acción principal)

**Descripción:** Fondo amarillo sólido, texto oscuro, sombra inferior dura que
se aplana al hacer clic. Siempre `font-bold`.

```jsx
// Botón primario — usar para: Inscribirse, Continuar lección, Enviar evaluación
<button className="
  bg-titi-yellow text-titi-dark
  font-bold text-base
  px-6 py-3 rounded-xl
  shadow-[0_4px_0px_#E6B800]
  hover:shadow-[0_2px_0px_#E6B800] hover:-translate-y-0.5
  active:shadow-none active:translate-y-0
  transition-all duration-150
  disabled:opacity-50 disabled:cursor-not-allowed
">
  Inscribirse al curso
</button>
```

#### Botón secundario (acción secundaria) — v2 táctil

**Descripción:** Blanco con **borde grueso** (`border-2`) y **sombra dura
gris** que se aplana al press. Misma mecánica que el primario, sin el color.
(El "ghost" plano de v1 solo sobrevive como link de sección, §2.)

```jsx
// Botón secundario — usar para: Ver detalles, Cancelar, Volver
<button className="
  bg-white text-titi-dark
  font-semibold text-sm
  px-5 py-2.5 rounded-xl
  border-2 border-gray-200
  shadow-[0_4px_0px_#E5E7EB]
  hover:border-titi-yellow hover:-translate-y-0.5 hover:shadow-[0_6px_0px_#E5E7EB]
  active:translate-y-0.5 active:shadow-none
  transition-all duration-150
  disabled:opacity-50 disabled:cursor-not-allowed
">
  Ver detalles
</button>
```

#### Botón de éxito (lección completada)

```jsx
<button className="
  bg-green-500 text-white
  font-bold text-base
  px-6 py-3 rounded-xl
  shadow-[0_4px_0px_#16A34A]
  hover:shadow-[0_2px_0px_#16A34A] hover:-translate-y-0.5
  active:shadow-none active:translate-y-0
  transition-all duration-150
">
  ✓ Lección completada
</button>
```

#### Micro-feedback universal (regla, no opción)

**Todo** elemento clickeable — botones, chips, links de sección, íconos
accionables, nodos de ruta — tiene feedback al press: se hunde
(`active:scale-[0.96]` o el aplanado de sombra dura) y transiciona en ≤150ms.
Un clickeable sin feedback es un bug de diseño. Ver `.titi-btn` en `motion.md`.

---

### 5.2 Card clickeable (tile) vs card informativa — la regla híbrida

**La distinción central de v2.** Antes de estilar una card, preguntate:
¿navega o dispara acción al clickearla entera?

| | Card clickeable ("tile") | Card informativa |
|---|---|---|
| Ejemplos | CourseCard, chip de categoría, nodo de ruta, panel de admin que navega | Stat card, Actividad reciente, Desafíos del día, banner |
| Borde | `border-2 border-gray-200` | `border border-gray-100` |
| Sombra | dura: `shadow-[0_4px_0px_#E5E7EB]` | difusa: `shadow-[0_2px_8px_rgba(0,0,0,0.06)]` |
| Hover | levanta + sombra crece + borde amarillo | glow amarillo suave (si tiene hover) |
| Active | se hunde: `active:translate-y-0.5 active:shadow-none` | — |
| Cursor | `cursor-pointer` | default |

```jsx
// Tile — card clickeable (mecánica de botón)
<div className="
  bg-white rounded-2xl border-2 border-gray-200
  shadow-[0_4px_0px_#E5E7EB]
  hover:border-titi-yellow hover:-translate-y-1 hover:shadow-[0_6px_0px_#E5E7EB]
  active:translate-y-0.5 active:shadow-none
  transition-all duration-150
  overflow-hidden cursor-pointer
">
  …
</div>

// Card informativa (superficie)
<div className="
  bg-white rounded-2xl border border-gray-100
  shadow-[0_2px_8px_rgba(0,0,0,0.06)]
  p-4 sm:p-5
">
  …
</div>
```

### 5.3 CourseCard — Tarjeta de curso (tile)

**Descripción:** Tile blanco (spec §5.2), imagen de portada arriba. Badge de
nivel **oscuro sólido** sobre la portada. Badges de estado en **sólido pleno**.

```jsx
// CourseCard — usada en: Courses.jsx (catálogo), Feed.jsx (actividad)
<div className="
  bg-white rounded-2xl border-2 border-gray-200
  shadow-[0_4px_0px_#E5E7EB]
  hover:border-titi-yellow hover:-translate-y-1 hover:shadow-[0_6px_0px_#E5E7EB]
  active:translate-y-0.5 active:shadow-none
  transition-all duration-150
  overflow-hidden cursor-pointer
  flex flex-col
">
  {/* Imagen de portada */}
  <div className="relative h-44 bg-titi-yellow-light">
    <img src={portadaUrl} alt={titulo} className="w-full h-full object-cover" />
    {/* Badge de nivel — pill oscuro */}
    <span className="
      absolute top-3 left-3
      bg-titi-dark text-white text-xs font-semibold capitalize
      px-2.5 py-1 rounded-full shadow-sm
    ">
      {nivel}
    </span>
    {/* Badge si está inscrito — sólido pleno */}
    {inscrito && (
      <span className="
        absolute top-3 right-3
        bg-titi-yellow text-titi-dark text-xs font-bold
        px-2.5 py-1 rounded-full
      ">
        En progreso
      </span>
    )}
  </div>

  {/* Contenido */}
  <div className="p-4 flex flex-col gap-2 flex-1">
    {/* Categoría */}
    <span className="text-xs font-semibold text-titi-streak uppercase tracking-wide">
      {categoria}
    </span>
    {/* Título */}
    <h3 className="text-base font-bold text-titi-dark leading-snug line-clamp-2">
      {titulo}
    </h3>
    {/* Meta info */}
    <p className="text-sm text-gray-500 font-medium">
      {cantidadLecciones} lecciones · Por {profesor}
    </p>

    {/* Barra de progreso (solo si está inscrito) — SIEMPRE animada (§10) */}
    {inscrito && (
      <div className="mt-auto pt-2">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>Progreso</span>
          <span className="tabular-nums font-bold text-titi-yellow-dark">{porcentaje}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-titi-yellow rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none"
            style={{ width: `${porcentaje}%` }}
          />
        </div>
      </div>
    )}
  </div>
</div>
```

**Grid de CourseCards** (con entrada escalonada obligatoria, §10):
```jsx
// En Courses.jsx — catálogo
const gridRef = useStaggerReveal([cursos.length]);
<div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
  {cursos.map(curso => <CourseCard key={curso.id} {...curso} />)}
</div>
```

### 5.4 Navbar (Sidebar vertical) — íconos SVG

**Descripción:** Sidebar fijo, fondo oscuro (#1A1A2E), 240px. Los ítems usan
**íconos SVG de `icons.jsx`** — nunca emoji (§5.6). Ítem activo: fondo
azul-oscuro + ícono y texto amarillos.

```jsx
// Navbar.jsx — sidebar vertical
<aside className="w-60 bg-titi-dark fixed h-full flex flex-col py-6 z-40">
  {/* Logo */}
  <div className="px-6 mb-8 flex items-center gap-2">
    <img src="/Titi.png" alt="Titi" className="w-8 h-8 object-contain select-none" draggable={false} />
    <span className="text-white font-extrabold text-xl tracking-tight">titi</span>
  </div>

  {/* Navegación */}
  <nav className="flex-1 px-3 flex flex-col gap-1">
    {navItems.map(({ path, Icon, label }) => (
      <NavLink
        key={path}
        to={path}
        className={({ isActive }) => `
          flex items-center gap-3 px-3 py-2.5 rounded-xl
          font-semibold text-sm transition-all duration-150
          ${isActive
            ? 'bg-titi-dark-deep text-titi-yellow border-l-2 border-titi-yellow pl-[10px]'
            : 'text-gray-400 hover:bg-titi-dark-mid hover:text-white'
          }
        `}
      >
        <Icon className="w-5 h-5" />
        {label}
      </NavLink>
    ))}
  </nav>

  {/* Racha del usuario — siempre visible, chip sólido si está activa */}
  <div className="px-4 py-3 mx-3 mb-4 bg-titi-dark-mid rounded-xl flex items-center gap-3">
    <span className={`w-9 h-9 rounded-full grid place-items-center ${rachaActiva ? 'bg-titi-streak' : 'bg-gray-600'}`}>
      <BoltIcon className="w-5 h-5 text-white" />
    </span>
    <div>
      <p className="text-white font-black text-lg leading-none">{racha}</p>
      <p className="text-gray-400 text-xs font-medium">días seguidos</p>
    </div>
  </div>

  {/* Avatar usuario */}
  <div className="px-4 flex items-center gap-3 border-t border-white/10 pt-4">
    <img src={avatarUrl} className="w-9 h-9 rounded-full object-cover" alt={username} />
    <div className="flex-1 min-w-0">
      <p className="text-white font-semibold text-sm truncate">{username}</p>
      <p className="text-gray-400 text-xs capitalize">{rol}</p>
    </div>
  </div>
</aside>
```

**Ítems del navbar** (los íconos Home/Search/Bell/User todavía no existen en
`icons.jsx` — agregarlos ahí al migrar, mismo estilo de trazo que los
existentes):

```js
const navItems = [
  { path: '/feed',          Icon: HomeIcon,       label: 'Inicio' },
  { path: '/explore',       Icon: SearchIcon,     label: 'Explorar' },
  { path: '/courses',       Icon: BookIcon,       label: 'Cursos' },
  { path: '/my-courses',    Icon: TargetIcon,     label: 'Mis cursos' },
  { path: '/notifications', Icon: BellIcon,       label: 'Notificaciones' },
  { path: '/profile',       Icon: UserIcon,       label: 'Mi perfil' },
]
```

### 5.5 Feed — Tarjeta de actividad académica

**Descripción:** El feed mezcla posts sociales con actividad de cursos. El
ícono de tipo de actividad es un **chip sólido** con SVG blanco (§2), no un
emoji suelto.

```jsx
// Tarjeta de actividad académica en Feed.jsx
<div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
  {/* Header: quién hizo qué */}
  <div className="flex items-center gap-3">
    <img src={amigoAvatar} className="w-10 h-10 rounded-full object-cover" alt={amigoUsername} />
    <div>
      <p className="text-sm text-titi-dark">
        <span className="font-bold">{amigoUsername}</span>
        <span className="text-gray-500"> se inscribió en</span>
      </p>
      <p className="text-xs text-gray-400">{timeAgo}</p>
    </div>
    {/* Chip de tipo de actividad — sólido del rol */}
    <span className="ml-auto w-9 h-9 rounded-full bg-blue-500 grid place-items-center">
      <BookIcon className="w-4 h-4 text-white" />
    </span>
  </div>

  {/* CourseCard compacta */}
  <div className="flex gap-3 bg-titi-cream rounded-xl p-3 cursor-pointer hover:bg-titi-yellow-light transition-colors">
    <div className="w-16 h-16 rounded-lg overflow-hidden bg-titi-yellow-light flex-shrink-0">
      <img src={portadaUrl} className="w-full h-full object-cover" alt={cursoTitulo} />
    </div>
    <div className="flex flex-col justify-center gap-1">
      <span className="text-xs font-semibold text-titi-streak uppercase">{categoria}</span>
      <p className="text-sm font-bold text-titi-dark leading-snug line-clamp-2">{cursoTitulo}</p>
      <p className="text-xs text-gray-400">{cantidadLecciones} lecciones</p>
    </div>
  </div>

  {/* Acción */}
  <button className="text-sm font-semibold text-titi-dark bg-titi-yellow-light hover:bg-titi-yellow px-4 py-2 rounded-xl transition-colors text-left active:scale-[0.98]">
    Ver este curso →
  </button>
</div>
```

**Tipos de actividad en el feed y su chip:**

| Tipo | Chip (sólido + SVG blanco) | Texto |
|---|---|---|
| `inscripcion_amigo` | `bg-blue-500` + `BookIcon` | "{usuario} se inscribió en" |
| `curso_completado` | `bg-green-500` + `GraduationIcon` | "{usuario} completó" |
| `logro_desbloqueado` | `bg-titi-achievement` + `AwardIcon` | "{usuario} desbloqueó el logro" |
| `post_normal` | — | Post social estándar (PostCard) |

### 5.6 Íconos — SVG en el chrome, emoji solo en la voz de Titi

- **Fuente única:** `src/components/icons.jsx` (trazo `stroke`, redondeado).
  Categorías de curso via `categoryIcon(nombre)`.
- **Tamaños:** `w-4 h-4` inline/badges · `w-5 h-5` navegación y chips ·
  `w-6 h-6` stat cards.
- **En chips siempre dentro de círculo sólido del rol** (§2). Nunca un SVG
  gris flotando sin contenedor en zonas de acento.
- **Prohibido emoji como ícono de UI**: navbar, botones, badges, chips,
  headers. Se ve distinto en cada OS y rompe el look premium.
- **Emoji permitido solo en**: mensajes hablados de Titi ("¡Lo lograste! 🏆"),
  contenido generado por usuarios, y el 🔥 histórico junto a números de racha
  en texto.
- Si falta un ícono, se **agrega a `icons.jsx`** con el mismo estilo de trazo —
  no se importa otra librería ni se usa emoji de relleno.

---

## 6. Gamificación — componentes de progreso

### StreakBadge

**Descripción:** Racha activa = chip **sólido naranja** con texto blanco (el
fuego es protagonista). Racha rota = gris.

```jsx
// StreakBadge — versión compacta para usar dentro de cards
<div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${activa ? 'bg-titi-streak' : 'bg-gray-200'}`}>
  <BoltIcon className={`w-4 h-4 ${activa ? 'text-white' : 'text-gray-500'}`} />
  <span className={`font-black text-sm ${activa ? 'text-white' : 'text-gray-500'}`}>{racha}</span>
  <span className={`text-xs font-medium ${activa ? 'text-white/80' : 'text-gray-400'}`}>días</span>
</div>
```

### AchievementToast

**Descripción:** Aparece desde arriba al desbloquear un logro. Ícono en chip
**púrpura sólido**. Titi celebra (WebP animado). Se cierra solo en 4s.

```jsx
// AchievementToast — posición: top-4 right-4, z-50
<div className="
  fixed top-4 right-4 z-50
  bg-white border-2 border-purple-200
  rounded-2xl shadow-lg p-4
  flex items-center gap-3
  animate-slide-in-right
  max-w-xs
">
  <span className="w-11 h-11 rounded-full bg-titi-achievement grid place-items-center shrink-0">
    <AwardIcon className="w-5 h-5 text-white" />
  </span>
  <div>
    <p className="text-xs font-semibold text-titi-achievement uppercase tracking-wide">
      ¡Logro desbloqueado!
    </p>
    <p className="text-sm font-bold text-titi-dark">{logro.nombre}</p>
    <p className="text-xs text-gray-500">{logro.descripcion}</p>
  </div>
  <TitiMascot state="celebra" size="xs" className="ml-auto" />
</div>
```

### ProgressBar de lección

Las barras **siempre** montan en 0 y se llenan hasta el % real (§10). El
número acompaña con count-up.

```jsx
// ProgressBar — usada en LearnCourse.jsx arriba del contenido
<div className="flex items-center gap-3 mb-6">
  <button onClick={onClose} className="text-gray-400 hover:text-gray-600 active:scale-95">✕</button>
  <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
    <div
      className="h-full bg-titi-yellow rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none"
      style={{ width: `${porcentaje}%` }}
    />
  </div>
  <span className="text-sm font-bold text-titi-yellow-dark tabular-nums">{porcentaje}%</span>
</div>
```

---

## 7. Titi la mascota — reglas de uso

### Activo visual de Titi

**Regla absoluta:** la mascota Titi siempre se representa con la imagen
`/Titi.png` o el componente `<TitiMascot />` (WebP animado por estado —
`idle`, `celebra`, `triste`, `racha`, `saludo`, `pensando`; ver
`animationTiti.md`). **Nunca** el emoji 🐒 — ni como placeholder, ni en
logos, ni en estados vacíos, ni en toasts, ni dentro de mensajes.

```jsx
// ✅ Correcto
<img src="/Titi.png" alt="Titi" className="w-24 h-24 object-contain drop-shadow-sm select-none" draggable={false} />
<TitiMascot state="celebra" size="md" message="¡Lo lograste! 🏆" />

// ❌ Incorrecto — nunca usar el emoji para representar a Titi
<span className="text-6xl">🐒</span>
```

**Preferí el WebP animado** (`<TitiMascot />`) sobre el PNG estático siempre
que Titi sea protagonista del bloque (empty states, banners, celebraciones).
El PNG estático queda para usos "logo" (navbar, tamaños ≤ `w-8`). Con
`prefers-reduced-motion`, `TitiMascot` ya cae solo al PNG.

### Cuándo aparece Titi

| Momento | Estado | Mensaje de referencia |
|---|---|---|
| Lección completada | `celebra` | "¡Excelente trabajo! 🎉" / "¡Sigue así, campeón! 💪" |
| Evaluación aprobada | `celebra` | "¡Lo lograste! 🏆" / "¡Sabía que podías! ⭐" |
| Evaluación fallida | `triste` | "No te rindas, tienes más intentos 💙" |
| Racha activa | `racha` | "¡{N} días seguidos! ¡Imparable! 🔥" |
| Racha rota | `triste` | "Tu racha se rompió... ¡Pero hoy es un nuevo comienzo!" |
| Logro desbloqueado | `celebra` | "¡Nuevo logro: {nombre}! 🏅" |
| Feed vacío | `pensando` | "¡Sigue a alguien para ver su actividad! 👀" |
| Sin notificaciones | `idle` | "Todo tranquilo por aquí" |
| Curso completado | `celebra` | "¡Curso completado! Tu certificado está listo 🎓" |
| **Banner motivacional** (v2) | `saludo`/`idle` | "¡Sigue aprendiendo!" — banners de cierre de página |
| **Header de momento clave** (v2) | según contexto | ej. resumen de racha semanal, onboarding |

**Regla v2:** Titi animado también vive en **banners y headers clave** (máx
**uno por página**) — no solo en empty states y toasts. Sigue sin aparecer en
cada pantalla: si el bloque no celebra, motiva o explica, no lleva mascota.

### Cuándo NO aparece Titi

- En pantallas de auth (login / register) — solo el logo
- En el catálogo de cursos navegando normalmente
- En el perfil de otros usuarios
- En el panel admin
- Más de una vez por página (el banner O el empty state, no ambos)

---

## 8. Estados de UI

### Estado vacío (empty state)

```jsx
// Siempre incluir: Titi ANIMADO, título, descripción, CTA
<div className="flex flex-col items-center justify-center py-10 px-8 text-center">
  <TitiMascot state="idle" size="md" className="mb-4" />
  <h3 className="text-xl font-bold text-titi-dark mb-2">{titulo}</h3>
  <p className="text-sm text-gray-400 mb-6 max-w-xs">{descripcion}</p>
  <button className="bg-titi-yellow ...botón primario...">
    {cta}
  </button>
</div>
```

### Estado de carga (skeleton)

```jsx
// Skeleton de CourseCard — replica la silueta del componente real
<div className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
  <div className="h-44 bg-gray-100" />
  <div className="p-4 flex flex-col gap-3">
    <div className="h-3 bg-gray-100 rounded w-1/3" />
    <div className="h-4 bg-gray-100 rounded w-3/4" />
    <div className="h-3 bg-gray-100 rounded w-1/2" />
  </div>
</div>
```

### Estado de error

```jsx
<div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
  <span className="w-8 h-8 rounded-full bg-red-500 grid place-items-center shrink-0 text-white text-sm font-black">!</span>
  <div>
    <p className="text-sm font-semibold text-red-700">{titulo}</p>
    <p className="text-xs text-red-500 mt-0.5">{mensaje}</p>
  </div>
</div>
```

### Estado de éxito (inline)

```jsx
<div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
  <span className="w-8 h-8 rounded-full bg-green-500 grid place-items-center shrink-0">
    <CheckIcon className="w-4 h-4 text-white" />
  </span>
  <p className="text-sm font-semibold text-green-700">{mensaje}</p>
</div>
```

---

## 9. Inputs y formularios

```jsx
// Input estándar
<div className="flex flex-col gap-1.5">
  <label className="text-sm font-semibold text-titi-dark">{label}</label>
  <input
    className="
      w-full bg-titi-cream border border-gray-200 rounded-xl
      px-4 py-3 text-sm font-medium text-titi-dark
      placeholder:text-gray-300
      focus:outline-none focus:border-titi-yellow focus:ring-2 focus:ring-titi-yellow/20
      transition-all duration-150
    "
    placeholder={placeholder}
  />
  {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
</div>
```

---

## 10. Motion — de primera clase

> Implementación completa (tokens GSAP, hooks, patrón `useGSAP`, checklist) →
> **[`motion.md`](./motion.md)**, la fuente de verdad de CÓMO. Esta sección
> define QUÉ es obligatorio. El feel: **juguetón con rebote leve**
> (`back.out(1.5)`), snappy (≤400ms), plano (sin gradientes/blur animados).

### Patrones OBLIGATORIOS (un componente sin esto está incompleto)

| # | Patrón | Dónde | Cómo |
|---|---|---|---|
| 1 | **Entrada escalonada** | Toda lista/grid que se llena de la API | `useStaggerReveal([items.length])` |
| 2 | **Pop de entrada** | Bloques sueltos destacados, modales, mascota | `usePopIn` |
| 3 | **Transición de página** | Todas las rutas del shell | `PageTransition` (ya en `App.jsx`) |
| 4 | **Barra de progreso animada** | TODA barra de progreso, sin excepción | monta en 0 → `transition-[width] duration-700` hasta el % real |
| 5 | **Count-up de números** | Stats clave: gotas, racha, % de progreso | de 0 al valor al entrar, ~700ms, `tabular-nums` (hook `useCountUp` en `lib/motion.js`; si no existe aún, crearlo ahí) |
| 6 | **Micro-feedback universal** | TODO clickeable: botones, chips, links, íconos, nodos | press hundido (sombra dura aplanada o `active:scale-[0.96]`) + transición ≤150ms |
| 7 | **Hover pop de tiles** | Tiles de navegación (§5.2) | lift + sombra crece + borde amarillo (CSS, rebote `cubic-bezier(0.34,1.56,0.64,1)`) |
| 8 | **Titi animado** | Empty states, banners, celebraciones | `<TitiMascot state=…>` (WebP), nunca PNG estático si es protagonista |

### Keyframes CSS existentes (se quedan)

```css
@keyframes slide-in-right {
  from { transform: translateX(100%); opacity: 0; }
  to   { transform: translateX(0);    opacity: 1; }
}

@keyframes bounce-in {
  0%   { transform: scale(0.3); opacity: 0; }
  50%  { transform: scale(1.05); }
  70%  { transform: scale(0.9); }
  100% { transform: scale(1); opacity: 1; }
}

@keyframes fade-up {
  from { transform: translateY(8px); opacity: 0; }
  to   { transform: translateY(0);   opacity: 1; }
}

.animate-slide-in-right { animation: slide-in-right 0.3s ease-out; }
.animate-bounce-in      { animation: bounce-in 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97); }
.animate-fade-up        { animation: fade-up 0.4s ease-out; }
```

### Reglas duras (espejo de motion.md)

- Entradas ≤ **400ms**. Excepción: llenado de barras y count-up (~700ms) — son
  visualización de dato, no entrada.
- Nunca más de **3 elementos** animando simultáneo (stagger = secuencia).
- **Siempre** respetar `prefers-reduced-motion` → todo desactivado, valores
  finales al instante.
- GSAP para entradas/secuencias; CSS para hover/press. Si CSS alcanza, es CSS.
- Nada de scroll cinematográfico, parallax ni timelines de landing.
- `slide-in-right` solo toasts · `bounce-in` solo logros/celebraciones de Titi
  · `fade-up` solo cards al cargar.

---

## 11. Convenciones de código CSS/Tailwind

### Orden de clases Tailwind (siempre este orden)

```
1. Layout      → flex, grid, flex-col, items-center, justify-between
2. Dimensiones → w-*, h-*, max-w-*, min-h-*
3. Espaciado   → p-*, px-*, py-*, m-*, gap-*
4. Fondo       → bg-*
5. Borde       → border, border-*, rounded-*
6. Sombra      → shadow-*
7. Tipografía  → text-*, font-*, leading-*, tracking-*
8. Estado      → hover:*, focus:*, active:*, disabled:*
9. Transición  → transition-*, duration-*, ease-*
10. Animación  → animate-*
```

### Reglas absolutas

- **Nunca** colores hardcodeados como `#FFD93D` en JSX. Siempre `bg-titi-yellow`.
  (Única excepción: los literales de sombra sancionados en §4.)
- **Nunca** gradientes ni blur — el color de Titi es **plano y saturado**.
- **Nunca** emoji como ícono de UI (navbar, botones, chips, badges) — SVG de
  `icons.jsx` (§5.6). Emoji solo en la voz de Titi y contenido de usuarios.
- **Nunca** inventar variantes de botón que no estén en este documento.
- **Nunca** usar `font-family` inline. Solo `font-sans` (que ya es Nunito).
- **Nunca** la mascota con el emoji 🐒 — siempre `/Titi.png` o `<TitiMascot />` (§7).
- **Siempre** decidir primero: ¿tile o card informativa? (§5.2) — y aplicar la
  familia de borde/sombra que corresponde.
- **Siempre** acentos en **sólido pleno del rol** con ícono blanco (oscuro
  sobre amarillo); tintes solo para fondos grandes (§2).
- **Siempre** `rounded-xl` o `rounded-2xl` para cards — nunca `rounded` solo.
- **Siempre** estado `disabled` en botones y feedback de press en clickeables.
- **Siempre** estado vacío en listas (con Titi animado si es zona de aprendizaje).
- **Siempre** las animaciones obligatorias de §10 al crear una página/sección.

---

## 12. Checklist antes de entregar un componente

Claude Code debe verificar esto antes de dar un componente por terminado:

- [ ] ¿Usa colores de la paleta Titi (no hardcodeados, sin gradientes/blur)?
- [ ] ¿Acentos en sólido pleno del rol + ícono blanco (oscuro sobre amarillo)?
- [ ] ¿Un solo rol de color dominante (máx 3 roles por card)?
- [ ] ¿Clasificó la card: tile (border-2 + sombra dura) o informativa (fina + difusa)?
- [ ] ¿Íconos SVG de `icons.jsx` — cero emoji en el chrome?
- [ ] ¿Usa Nunito con el peso correcto para el contexto?
- [ ] ¿Listas con `useStaggerReveal`, bloques con `usePopIn` (§10)?
- [ ] ¿Barras de progreso animadas y números clave con count-up (`tabular-nums`)?
- [ ] ¿Todo clickeable tiene press hundido + hover correspondiente?
- [ ] ¿Respeta `prefers-reduced-motion`?
- [ ] ¿Tiene estado de carga (skeleton que replica la silueta)?
- [ ] ¿Tiene estado vacío con `<TitiMascot />` animado si aplica?
- [ ] ¿La mascota es `/Titi.png` / `<TitiMascot />` y nunca 🐒?
- [ ] ¿El botón principal tiene la sombra inferior dura?
- [ ] ¿Los bordes usan `rounded-xl` o `rounded-2xl`?
- [ ] ¿Las transiciones de interacción son ≤ 300ms (entradas ≤ 400ms)?
- [ ] ¿Es consistente con el layout sidebar + contenido principal?
- [ ] ¿Cumple los mínimos de legibilidad (≥`text-xs`, ≥`font-medium`, gris legible)?
- [ ] ¿Sin vacíos muertos: secciones a `mb-6`, cards `p-4/p-5`, columnas emparejadas (§4 Densidad)?
- [ ] ¿Cumple las 8 reglas del estándar de experiencia (§1)?

---

## 13. Protocolo — interpretar imágenes como propuesta de diseño

Cuando el usuario comparte una imagen (mockup, captura de otra app, boceto),
se trata como **propuesta de diseño** y se procesa así. Este protocolo es
parte del sistema: no se improvisa.

### Qué se toma de la imagen y qué se traduce

| La imagen muestra | Cómo se traduce a Titi |
|---|---|
| **Layout, jerarquía, densidad, orden de bloques** | Se respeta **fiel** — es el valor de la propuesta |
| Paleta ajena (verde Duolingo, dark mode, etc.) | Rol equivalente de la paleta Titi (§2): primario ajeno → amarillo Titi; éxito → verde; links → azul info… La paleta **nunca** se importa |
| Tipografía ajena | Nunito + jerarquía §3, sin excepción |
| Gradientes, blur, glow | Se adapta a plano (§1) y se **avisa** de la adaptación |
| Emoji como íconos de UI | SVG de `icons.jsx` (§5.6) |
| Componentes que Titi ya tiene | Se reusa el componente existente, restileado — no se duplica |
| Componentes que no existen | Se diseñan con los tokens de este documento (¿tile o informativa? ¿qué rol de color?) |
| Copy / textos | Se conservan los de la app salvo pedido explícito ("no cambies el contenido") |
| Mascota ajena (búho, etc.) | Titi (`<TitiMascot />`) en los momentos de §7, o nada |

### Proceso

1. **Inventario** — listar los bloques de la imagen de arriba hacia abajo
   (header, stats, lista, side panel…) y su intención (navegar, informar,
   celebrar).
2. **Mapa** — por cada bloque: ¿existe componente en el repo? (`src/pages/`,
   `src/components/`) → restilear; ¿no existe? → crear con los patrones §5.
3. **Preguntar solo lo ambiguo** — si la imagen contradice una decisión ya
   confirmada o una regla dura, plantear la duda antes de codear; lo demás se
   resuelve con este documento.
4. **Plan por etapas** — para una página completa, plan escrito en un `.md`
   junto al código (patrón `MyCourses.md`) con etapas chicas, feedback entre
   etapas y tabla de archivos tocados. Para un cambio puntual, directo.
5. **Commits por etapa** — un commit por etapa/grupo lógico.
6. **Checklist §12** sobre el resultado, siempre — la imagen inspira, el
   sistema manda.

### Regla de oro

> La imagen define **QUÉ** se ve y **DÓNDE**. Este documento define **CÓMO**
> se ve. Si chocan, gana el documento — y se le explica al usuario qué se
> adaptó y por qué.
