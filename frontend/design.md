# DESIGN.md — Titi Platform

Lee este archivo antes de generar cualquier componente de UI.
Es la fuente de verdad visual del proyecto. Todo lo que generes debe ser consistente con estas reglas.

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

1. **Cálido antes que agresivo** — El amarillo de Titi invita, no grita. Las sombras son suaves, no dramáticas.
2. **Social primero** — El aprendizaje aparece integrado en el feed social, no en una sección separada.
3. **Progreso visible** — Rachas, XP y logros siempre a la vista, nunca escondidos.
4. **Titi aparece en momentos que importan** — No en cada pantalla. Solo cuando hay algo que celebrar, motivar o explicar.
5. **Consistencia sobre creatividad** — Claude Code debe reproducir exactamente estos patrones, no inventar variaciones.

---

## 2. Paleta de colores

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
  --color-info: #3B82F6;             /* Azul — info neutral */
  --color-info-light: #DBEAFE;       /* Fondo azul suave */

  /* === GAMIFICACIÓN === */
  --color-streak: #FF6B35;           /* Naranja fuego — racha activa */
  --color-streak-broken: #9CA3AF;    /* Gris — racha rota */
  --color-xp: #FFD93D;               /* Amarillo — puntos XP */
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

### Regla de uso de color

| Contexto | Color a usar |
|---|---|
| Botón de acción principal | `--color-primary` (#FFD93D) con texto `--color-text-on-primary` |
| Botón secundario / outline | Borde `--color-border`, texto `--color-text-primary` |
| Botón destructivo | `--color-error` (#EF4444) con texto blanco |
| Lección completada | Ícono `--color-success`, fondo `--color-success-light` |
| Racha activa | `--color-streak` (#FF6B35) con ícono 🔥 |
| Logro desbloqueado | `--color-achievement` (#A855F7) |
| Sidebar | Fondo `--color-bg-sidebar`, texto `--color-text-inverse` |
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
  --font-black:      900;   /* Solo para números de racha y XP */

  /* === LEADING (line-height) === */
  --leading-tight:  1.25;
  --leading-normal: 1.5;
  --leading-relaxed:1.625;
}
```

### Tailwind config — tipografía

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      fontFamily: {
        sans: ['Nunito', 'sans-serif'],
      },
      fontWeight: {
        black: '900',
      }
    }
  }
}
```

### Jerarquía tipográfica — cuándo usar qué

| Elemento | Tamaño | Peso | Ejemplo |
|---|---|---|---|
| Título de página | `text-3xl` | `font-extrabold` | "Catálogo de Cursos" |
| Título de sección | `text-2xl` | `font-bold` | "Cursos populares" |
| Título de card | `text-xl` | `font-bold` | "Introducción a Python" |
| Subtítulo / descripción | `text-sm` | `font-medium` | "12 lecciones · Principiante" |
| Cuerpo de texto | `text-base` | `font-normal` | Descripción de lección |
| Label / badge | `text-xs` | `font-semibold` | "NUEVO", "COMPLETADO" |
| Número de racha / XP | `text-4xl` | `font-black` | "🔥 14" |
| Botón primario | `text-base` | `font-bold` | "Inscribirse" |
| Botón secundario | `text-sm` | `font-semibold` | "Ver detalles" |

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
  --card-gap:          1.5rem;   /* Gap entre cards en grid */
  --section-gap:       2.5rem;   /* Espacio entre secciones */

  /* === BORDER RADIUS === */
  --radius-sm:   0.375rem;  /* 6px — badges, chips */
  --radius-md:   0.5rem;    /* 8px — inputs, botones pequeños */
  --radius-lg:   0.75rem;   /* 12px — cards */
  --radius-xl:   1rem;      /* 16px — modales, panels */
  --radius-2xl:  1.5rem;    /* 24px — cards destacadas */
  --radius-full: 9999px;    /* Círculos — avatares, badges */

  /* === SOMBRAS === */
  --shadow-sm:  0 1px 2px 0 rgba(0,0,0,0.05);
  --shadow-md:  0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -1px rgba(0,0,0,0.04);
  --shadow-lg:  0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -2px rgba(0,0,0,0.03);
  --shadow-card: 0 2px 8px rgba(0,0,0,0.06);           /* Sombra estándar de cards */
  --shadow-hover: 0 8px 24px rgba(255,217,61,0.2);     /* Sombra amarilla en hover */
  --shadow-button: 0 4px 0px #E6B800;                  /* Sombra inferior botón primario — estilo Duolingo */
}
```

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

**Descripción:** Fondo amarillo (#FFD93D), texto oscuro, sombra inferior estilo Duolingo que se aplana al hacer clic. Bordes redondeados. Siempre `font-bold`. Al hacer hover sube ligeramente (transform).

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

#### Botón secundario (acción secundaria)

**Descripción:** Fondo blanco, borde gris, texto oscuro. Sin sombra fuerte. Para acciones que no son el CTA principal.

```jsx
// Botón secundario — usar para: Ver detalles, Cancelar, Volver
<button className="
  bg-white text-titi-dark
  font-semibold text-sm
  px-5 py-2.5 rounded-xl
  border border-gray-200
  hover:bg-gray-50 hover:border-gray-300
  transition-all duration-150
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

---

### 5.2 CourseCard — Tarjeta de curso

**Descripción:** Tarjeta blanca con borde sutil, sombra suave, imagen de portada arriba. Badge de nivel en esquina superior. Al hacer hover aparece sombra amarilla. Siempre mostrar: título, categoría, nivel, cantidad de lecciones, nombre del profesor.

```jsx
// CourseCard — usada en: Courses.jsx (catálogo), Feed.jsx (actividad)
<div className="
  bg-white rounded-2xl border border-gray-100
  shadow-[0_2px_8px_rgba(0,0,0,0.06)]
  hover:shadow-[0_8px_24px_rgba(255,217,61,0.2)]
  hover:-translate-y-1
  transition-all duration-200
  overflow-hidden cursor-pointer
  flex flex-col
">
  {/* Imagen de portada */}
  <div className="relative h-44 bg-titi-yellow-light">
    <img src={portadaUrl} alt={titulo} className="w-full h-full object-cover" />
    {/* Badge de nivel */}
    <span className="
      absolute top-3 left-3
      bg-white text-titi-dark text-xs font-semibold
      px-2.5 py-1 rounded-full shadow-sm
    ">
      {nivel}
    </span>
    {/* Badge si está inscrito */}
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

    {/* Barra de progreso (solo si está inscrito) */}
    {inscrito && (
      <div className="mt-auto pt-2">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>Progreso</span>
          <span>{porcentaje}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-titi-yellow rounded-full transition-all duration-500"
            style={{ width: `${porcentaje}%` }}
          />
        </div>
      </div>
    )}
  </div>
</div>
```

**Grid de CourseCards:**
```jsx
// En Courses.jsx — catálogo
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
  {cursos.map(curso => <CourseCard key={curso.id} {...curso} />)}
</div>
```

---

### 5.3 Navbar (Sidebar vertical)

**Descripción:** Sidebar fijo a la izquierda, fondo oscuro (#1A1A2E), 240px de ancho. Logo Titi arriba. Ítems de navegación con ícono + texto. El ítem activo tiene fondo azul-oscuro y acento amarillo. Racha del usuario siempre visible al fondo.

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
    {navItems.map(item => (
      <NavLink
        key={item.path}
        to={item.path}
        className={({ isActive }) => `
          flex items-center gap-3 px-3 py-2.5 rounded-xl
          font-semibold text-sm transition-all duration-150
          ${isActive
            ? 'bg-titi-dark-deep text-titi-yellow border-l-2 border-titi-yellow pl-[10px]'
            : 'text-gray-400 hover:bg-titi-dark-mid hover:text-white'
          }
        `}
      >
        <span className="text-lg">{item.icon}</span>
        {item.label}
      </NavLink>
    ))}
  </nav>

  {/* Racha del usuario — siempre visible */}
  <div className="px-4 py-3 mx-3 mb-4 bg-titi-dark-mid rounded-xl flex items-center gap-3">
    <span className="text-2xl">🔥</span>
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

**Ítems del navbar:**
```js
const navItems = [
  { path: '/feed',          icon: '🏠', label: 'Inicio' },
  { path: '/explore',       icon: '🔍', label: 'Explorar' },
  { path: '/courses',       icon: '📚', label: 'Cursos' },
  { path: '/my-courses',    icon: '🎯', label: 'Mis cursos' },
  { path: '/notifications', icon: '🔔', label: 'Notificaciones' },
  { path: '/profile',       icon: '👤', label: 'Mi perfil' },
]
```

---

### 5.4 Feed — Tarjeta de actividad académica

**Descripción:** El feed mezcla posts sociales con actividad de cursos. Una tarjeta de actividad académica muestra: avatar del amigo + acción (ej: "se inscribió en Python") + CourseCard compacta. Estilo más ligero que una CourseCard completa.

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
    {/* Ícono de tipo de actividad */}
    <span className="ml-auto text-xl">📚</span>
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

  {/* Acción: también quiero aprenderlo */}
  <button className="text-sm font-semibold text-titi-dark bg-titi-yellow-light hover:bg-titi-yellow px-4 py-2 rounded-xl transition-colors text-left">
    📖 Ver este curso →
  </button>
</div>
```

**Tipos de actividad en el feed y su ícono:**
| Tipo | Ícono | Texto |
|---|---|---|
| `inscripcion_amigo` | 📚 | "{usuario} se inscribió en" |
| `curso_completado` | 🎓 | "{usuario} completó" |
| `logro_desbloqueado` | 🏅 | "{usuario} desbloqueó el logro" |
| `post_normal` | — | Post social estándar (componente PostCard) |

---

## 6. Gamificación — componentes de progreso

### StreakBadge

**Descripción:** Siempre en el sidebar. También aparece como badge en perfil y como notificación cuando cambia.

```jsx
// StreakBadge — versión compacta para usar dentro de cards
<div className="flex items-center gap-1.5 bg-orange-50 px-3 py-1.5 rounded-full">
  <span className="text-lg">🔥</span>
  <span className="font-black text-orange-500 text-sm">{racha}</span>
  <span className="text-xs text-orange-400 font-medium">días</span>
</div>
```

### AchievementToast

**Descripción:** Aparece desde arriba al desbloquear un logro. Fondo púrpura suave. Titi celebra. Se cierra automáticamente en 4 segundos. Nunca bloquea la UI.

```jsx
// AchievementToast — posición: top-4 right-4, z-50
<div className="
  fixed top-4 right-4 z-50
  bg-purple-50 border border-purple-200
  rounded-2xl shadow-lg p-4
  flex items-center gap-3
  animate-slide-in-right
  max-w-xs
">
  <span className="text-3xl">{logro.icono}</span>
  <div>
    <p className="text-xs font-semibold text-purple-500 uppercase tracking-wide">
      ¡Logro desbloqueado!
    </p>
    <p className="text-sm font-bold text-purple-900">{logro.nombre}</p>
    <p className="text-xs text-purple-500">{logro.descripcion}</p>
  </div>
  <img src="/Titi.png" alt="Titi" className="w-7 h-7 ml-auto object-contain select-none" draggable={false} />
</div>
```

### ProgressBar de lección

```jsx
// ProgressBar — usada en LearnCourse.jsx arriba del contenido
<div className="flex items-center gap-3 mb-6">
  <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
  <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
    <div
      className="h-full bg-titi-yellow rounded-full transition-all duration-500 ease-out"
      style={{ width: `${porcentaje}%` }}
    />
  </div>
  <span className="text-sm font-bold text-gray-400">{porcentaje}%</span>
</div>
```

---

## 7. Titi la mascota — reglas de uso

### Activo visual de Titi

**Regla absoluta:** la mascota Titi siempre se representa con la imagen `/Titi.png` (servida desde `frontend/public/Titi.png`). **Nunca** uses el emoji 🐒 — ni como placeholder, ni en logos, ni en estados vacíos, ni en toasts, ni dentro de mensajes. Si necesitás mostrar a Titi en una UI, usá un `<img src="/Titi.png" alt="Titi" />` con el tamaño apropiado (`w-8 h-8` para logos, `w-24 h-24` para empty states, `w-7 h-7` para toasts) o el componente `<TitiMascot />` cuando se requiera variantes de mood y mensaje.

```jsx
// ✅ Correcto
<img src="/Titi.png" alt="Titi" className="w-24 h-24 object-contain drop-shadow-sm select-none" draggable={false} />

// ❌ Incorrecto — nunca usar el emoji para representar a Titi
<span className="text-6xl">🐒</span>
```

### Cuándo aparece Titi

| Momento | Mood de Titi | Mensaje de referencia |
|---|---|---|
| Lección completada | 😄 feliz | "¡Excelente trabajo! 🎉" / "¡Sigue así, campeón! 💪" |
| Evaluación aprobada | 🎉 celebrando | "¡Lo lograste! 🏆" / "¡Sabía que podías! ⭐" |
| Evaluación fallida | 😟 triste pero alentador | "No te rindas, tienes más intentos 💙" |
| Racha activa | 🔥 emocionado | "¡{N} días seguidos! ¡Imparable! 🔥" |
| Racha rota | 😔 consolador | "Tu racha se rompió... ¡Pero hoy es un nuevo comienzo!" |
| Logro desbloqueado | 🏅 orgulloso | "¡Nuevo logro: {nombre}! 🏅" |
| Feed vacío | 🤷 curioso | "¡Sigue a alguien para ver su actividad! 👀" |
| Sin notificaciones | 😌 tranquilo | "Todo tranquilo por aquí" (la imagen de Titi aparece como mascota, sin emoji adicional) |
| Curso completado | 🎓 ceremonioso | "¡Curso completado! Tu certificado está listo 🎓" |

### Cuándo NO aparece Titi

- En pantallas de auth (login / register) — solo el logo
- En el catálogo de cursos navegando normalmente
- En el perfil de otros usuarios
- En el panel admin

### Componente TitiMascot

```jsx
// TitiMascot.jsx — usar con mood prop
// moods: 'happy' | 'celebrating' | 'sad' | 'fire' | 'proud' | 'curious' | 'calm' | 'graduation'
<TitiMascot
  mood="celebrating"
  message="¡Lo lograste! 🏆"
  size="md"  // 'sm' | 'md' | 'lg'
/>
```

---

## 8. Estados de UI

### Estado vacío (empty state)

```jsx
// Siempre incluir: ilustración Titi, título, descripción, CTA
<div className="flex flex-col items-center justify-center py-16 px-8 text-center">
  <img src="/Titi.png" alt="Titi" className="w-24 h-24 mb-4 object-contain drop-shadow-sm select-none" draggable={false} />
  <h3 className="text-xl font-bold text-titi-dark mb-2">{titulo}</h3>
  <p className="text-sm text-gray-400 mb-6 max-w-xs">{descripcion}</p>
  <button className="bg-titi-yellow ...">
    {cta}
  </button>
</div>
```

### Estado de carga (skeleton)

```jsx
// Skeleton de CourseCard
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
  <span className="text-red-500 text-lg">⚠️</span>
  <div>
    <p className="text-sm font-semibold text-red-700">{titulo}</p>
    <p className="text-xs text-red-500 mt-0.5">{mensaje}</p>
  </div>
</div>
```

### Estado de éxito (inline)

```jsx
<div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
  <span className="text-green-500 text-lg">✅</span>
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

## 10. Animaciones

```css
/* En index.css o como plugin de Tailwind */

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

**Reglas de animación:**
- Solo `slide-in-right` para toasts y notificaciones emergentes
- Solo `bounce-in` para logros y celebraciones de Titi
- Solo `fade-up` para cards al cargar la página
- Duración máxima: 500ms. Si tarda más, el usuario pierde la sensación de respuesta
- Nunca animar simultáneamente más de 3 elementos
- Siempre respetar `prefers-reduced-motion`

> **Sistema completo de motion (tokens, GSAP, patrón `useGSAP`, checklist) → ver
> [`motion.md`](./motion.md).** Estas keyframes CSS se quedan como están; GSAP
> solo se usa para coreografías que CSS hace mal (stagger de listas, timelines).

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

- **Nunca** usar colores hardcodeados como `#FFD93D` en JSX. Siempre `bg-titi-yellow`.
- **Nunca** inventar variantes de botón que no estén en este documento.
- **Nunca** usar `font-family` inline. Solo `font-sans` (que ya es Nunito).
- **Nunca** representar a la mascota Titi con el emoji 🐒 — siempre usar `<img src="/Titi.png" alt="Titi" />` o el componente `<TitiMascot />` (ver sección 7).
- **Siempre** usar `rounded-xl` o `rounded-2xl` para cards — nunca `rounded` o `rounded-md` en contenedores grandes.
- **Siempre** incluir estado de `disabled` en botones.
- **Siempre** incluir estado vacío en listas.

---

## 12. Checklist antes de entregar un componente

Claude Code debe verificar esto antes de dar un componente por terminado:

- [ ] ¿Usa colores de la paleta Titi (no hardcodeados)?
- [ ] ¿Usa Nunito con el peso correcto para el contexto?
- [ ] ¿Tiene estado hover con la sombra amarilla correspondiente?
- [ ] ¿Tiene estado de carga (skeleton o spinner)?
- [ ] ¿Tiene estado vacío con mensaje de Titi si aplica?
- [ ] ¿La mascota Titi se representa siempre con `/Titi.png` y nunca con el emoji 🐒?
- [ ] ¿El botón principal tiene la sombra inferior estilo Duolingo?
- [ ] ¿Los bordes usan `rounded-xl` o `rounded-2xl`?
- [ ] ¿Las transiciones son ≤ 300ms?
- [ ] ¿Es consistente con el layout sidebar + contenido principal?