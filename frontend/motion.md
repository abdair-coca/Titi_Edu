# MOTION.md — Sistema de animación de Titi

Fuente de verdad de **movimiento** del proyecto. Complementa `design.md` §10
(que queda como resumen y apunta acá). Lee este archivo antes de agregar
cualquier animación que no sea una transición CSS trivial.

---

## 1. Filosofía de motion

El feel de Titi es **juguetón con rebote leve**: cálido y con vida, sin marear ni
hacer esperar. Coherente con `design.md` §1 (UI plana, cálida).

- El motion **confirma** acciones y **da vida** a la entrada de contenido.
- Rebote **leve** (`back.out(1.5)`), nunca exagerado.
- **Snappy**: todo entra rápido. Tope duro **400ms**.
- **No** scroll cinematográfico, **no** parallax, **no** timelines de landing.
  Micro-interacciones, no show.

### Reglas duras

- Duración máxima **400ms** (`MOTION.dur.slow`). Default de entradas: 300ms.
- Nunca animar simultáneamente más de **3 elementos** (el stagger es secuencia, no
  simultáneo).
- **Siempre** respetar `prefers-reduced-motion` → **desactivar todo** (entradas,
  hover, press, transición de página, fade de modal).
- Nada de gradientes ni blur decorativos animados.

---

## 2. Tokens de motion

Definidos en `frontend/src/lib/motion.js` (`MOTION`). Usar estos, no valores sueltos.

| Token | Valor | Uso |
|---|---|---|
| `dur.fast` | `0.15s` | micro-feedback |
| `dur.base` | `0.30s` | entradas (default) |
| `dur.slow` | `0.40s` | tope; casos puntuales |
| `ease.pop` | `back.out(1.5)` | **entradas con rebote** (el feel Titi) |
| `ease.out` | `power2.out` | movimiento neutro |
| `ease.in` | `power2.in` | salidas |

> GSAP usa **segundos**, no milisegundos. `dur.slow = 0.4` = 400ms.
> Hover de cards (CSS): `cubic-bezier(0.34, 1.56, 0.64, 1)` (mismo rebote).
> Transición de página: rebote más leve (`back.out(1.2)`), es toda la pantalla.

---

## 3. Reparto GSAP vs CSS

- **GSAP** → entradas y secuencias: montaje de listas, transición de página,
  entrada de modal, mascota Titi.
- **CSS** → estados de interacción: hover de cards, press de botones, fade del
  backdrop. Más liviano, sin listeners JS por elemento.

Regla: si CSS lo resuelve con una transición o keyframe simple, **es CSS**.

---

## 4. Catálogo de interacciones (estado actual)

| Interacción | Cómo | Implementación |
|---|---|---|
| Entrada de listas | pop por escala (0.9→1) + fade, escalonado | `useStaggerReveal` en Courses/Feed |
| Entrada de un elemento | pop por escala + fade | `usePopIn` |
| Transición de página | zoom-in pop (scale 0.98) al cambiar de ruta | `PageTransition` + `key={location.pathname}` en `App.jsx` |
| Hover de card | lift (-4px) + escala (1.03) + sombra amarilla, con rebote | clase CSS `.titi-card-pop` |
| Press de botón | se hunde (`active:scale-0.96`) | clase `.titi-btn` |
| Modal | panel con pop + backdrop con fade | `usePopIn` + `.titi-backdrop-in` |
| Cambio de lección (Learn) | pop del contenido al cambiar de lección + pop del panel lateral y de la respuesta de "Profundiza" | `usePopIn` en `LearnCourse` (`LessonView`, `LessonSidePanels`, `DeepenCard`) |
| Mascota Titi | pop al montar | `usePopIn` en `TitiMascot` |
| Toasts (racha/logros/flama) | keyframes CSS existentes | `index.css` — **no tocar** |

### Cobertura — `useStaggerReveal` en toda lista/grid

Toda lista o grid que se llena desde la API entra escalonada. Aplicado en:
`Feed`, `Courses` (catálogo + recomendados), `MyCourses`, `MyTeaching`,
`Explore`, `Notifications`, `HashtagFeed`, `Certificates`, `Profile` (posts),
`CourseDetail` (las dos columnas al entrar — contenido + inscripción — y los
módulos), `LearnCourse` (módulos del índice lateral; ver además el pop de
contenido abajo), `AchievementsSection`, `AdminDashboard` (stats + paneles),
`AdminCourses`, `AdminCategories`.

**Regla**: cuando agregues una página/sección con una lista, ponele
`useStaggerReveal([data])` al contenedor. **Nada suelto** — sin entrada = inconsistente.

### Excepciones (decisiones, no olvidos)

- **Hover pop (lift+escala) en tiles de curso/navegación**: `CourseCard`,
  `RecommendedCourseCard`, `EnrolledCard` (Mis cursos), mini-card de
  `AcademicActivityCard`, paneles de `AdminDashboard`. Son grids de tiles y deben
  sentirse iguales en toda la app.
- **`PostCard` NO escala**: es full-width en el feed y hovering para dar
  like/comentar no debe mover el post. `TeachingCard` tampoco (varios botones de
  acción internos).
- **Tabla de `AdminUsers` (`<tbody><tr>`)**: sin stagger. `transform/scale` sobre
  `table-row` renderiza inconsistente entre navegadores.
- **Landing (`Home`) y `VerifyCertificate`**: fuera del shell de la app (no hay
  navegación in-app hacia ellas) → sin `PageTransition`.
- **Salida de modales**: `if(!open) return null` desmonta al instante, así que la
  salida no anima. Aceptable; animarla requiere mantener montado.

---

## 5. Patrón React obligatorio

**Siempre** `useGSAP()` (de `@gsap/react`) con un `scope` ref. Nunca `gsap.to`
suelto en `useEffect` sin cleanup — rompe en StrictMode.

**Siempre** chequear `prefers-reduced-motion` y, si está activo, no animar (el
elemento queda en su estado final).

Preferí `gsap.fromTo` (estado inicial **y** final explícitos) sobre `gsap.from`,
que infiere el final del DOM y es frágil con re-render / StrictMode (deja cards
congeladas a media opacidad). Usá `autoAlpha` (opacity + visibility) y `clearProps`
al terminar para no dejar estilos inline que estorben al hover.

**Dependencias por valor, no por referencia.** Pasale a los hooks una señal
**primitiva y estable** (`items.length`, un id, un booleano), nunca el array/objeto
crudo. Si pasás la referencia, cualquier `setState` que la reemplace (churn de
stats, doble fetch de StrictMode en dev) cuenta como cambio de dep y **re-dispara
la animación** → la entrada se ve dos veces. Ej: `useStaggerReveal([items.length])`,
`usePopIn([perfil?.user?.username])`. (Excepción: modales → `usePopIn([open])`,
querés que re-anime en cada apertura.)

Los hooks de `src/lib/motion.js` ya encapsulan todo esto — usalos:

```jsx
import { useStaggerReveal, usePopIn } from '../lib/motion.js';

// Lista: entrada escalonada de los hijos directos. Dep = length (primitivo).
function Grid({ items }) {
  const ref = useStaggerReveal([items.length]);
  return <div ref={ref} className="grid ...">{items.map(...)}</div>;
}

// Elemento único: pop al montar / cambiar deps.
function Panel({ open }) {
  const ref = usePopIn([open]);   // re-anima cada vez que abre
  return <div ref={ref}>…</div>;
}
```

Si necesitás algo a mano:

```jsx
import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { MOTION } from '../lib/motion.js';

function Componente() {
  const scope = useRef(null);
  useGSAP(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(
      '.target',
      { scale: 0.9, autoAlpha: 0 },
      { scale: 1, autoAlpha: 1, duration: MOTION.dur.base, ease: MOTION.ease.pop, clearProps: 'transform,opacity,visibility' },
    );
  }, { scope });
  return <div ref={scope}>…</div>;
}
```

---

## 6. Checklist de motion (espejo de design.md §12)

Antes de dar por terminada una animación:

- [ ] ¿Respeta `prefers-reduced-motion` (`window.matchMedia` en GSAP, `@media` en CSS)?
- [ ] ¿Duración ≤ 400ms?
- [ ] ¿≤ 3 elementos simultáneos (stagger acotado)?
- [ ] ¿Entradas con `ease.pop` (rebote leve, no exagerado)?
- [ ] ¿GSAP con `useGSAP` + `scope` (cleanup automático, seguro en StrictMode)?
- [ ] ¿`fromTo` + `autoAlpha` + `clearProps` (no `gsap.from`)?
- [ ] ¿Usa los tokens de `MOTION`, no valores hardcodeados?
- [ ] ¿Hover pop solo en tiles de navegación, no en posts ni botones?
- [ ] ¿GSAP solo en entradas/secuencias; hover/press en CSS?
- [ ] ¿No tocó los toasts CSS que ya funcionan?
