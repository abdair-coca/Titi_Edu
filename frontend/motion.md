# MOTION.md — Sistema de animación de Titi

Fuente de verdad de **movimiento** del proyecto. Complementa `design.md` §10
(que queda como resumen y apunta acá). Lee este archivo antes de agregar
cualquier animación que no sea una transición CSS trivial.

---

## 1. Filosofía de motion

El movimiento está al servicio de la **calidez**, no del espectáculo. Coherente
con `design.md` §1: "Cálido antes que agresivo", UI plana.

- El motion **confirma** acciones y **guía** la atención. No decora ni impresiona
  por impresionar.
- Sutil > llamativo. Si dudás entre dos intensidades, elegí la menor.
- **No** scroll cinematográfico, **no** parallax, **no** timelines de landing.
  El producto es una red social/educativa (sidebar + feed): importan las
  micro-interacciones, no el show.

### Reglas duras (heredadas de design.md §10)

- Duración máxima **500ms**. Si tarda más, se pierde la sensación de respuesta.
- Nunca animar simultáneamente más de **3 elementos** (el stagger cuenta como
  secuencia, no como simultáneo).
- **Siempre** respetar `prefers-reduced-motion`. Sin excepción.
- Nada de gradientes ni blur decorativos animados (memoria de diseño: rechazados).

---

## 2. Tokens de motion

Definidos en `frontend/src/lib/motion.js` (`MOTION`). Usar estos, no valores sueltos.

| Token | Valor | Uso |
|---|---|---|
| `dur.fast` | `0.15s` | hover, micro-feedback |
| `dur.base` | `0.30s` | transiciones estándar |
| `dur.slow` | `0.50s` | entradas de contenido (techo) |
| `ease.out` | `power2.out` | entradas (algo que aparece) |
| `ease.in` | `power2.in` | salidas (algo que se va) |
| `ease.pop` | `back.out(1.7)` | celebraciones (equivale al `cubic-bezier(0.34, 1.56, 0.64, 1)` de los toasts) |

> GSAP usa **segundos**, no milisegundos. `dur.slow = 0.5` = 500ms.

---

## 3. Qué se queda en CSS (NO migrar a GSAP)

Ya funciona, no usa JS, y respeta reduced-motion. **No tocar:**

- Toasts de racha y de logros (`titi-streak-toast-*`, `titi-achievement-toast-*`
  en `index.css`).
- Flama de racha (`titi-flame-flicker`).
- Animaciones utilitarias de `design.md` §10 (`animate-slide-in-right`,
  `animate-bounce-in`, `animate-fade-up`).
- `hover:-translate-y` / sombras de botones y cards (Tailwind).

Regla: si CSS lo resuelve con una keyframe simple o una transición, **es CSS**.

---

## 4. Qué usa GSAP (donde CSS no alcanza)

GSAP entra solo para coreografías que CSS hace mal: **stagger** de listas,
timelines compuestos, secuencias coordinadas.

- Entrada escalonada de cards en grids/timelines (Courses, Feed). ← implementado.
- (Futuro) hover compuesto en CourseCard más allá del `-translate-y` actual.
- (Futuro) transiciones de página entre rutas.

Librerías: `gsap` + `@gsap/react`.

---

## 5. Patrón React obligatorio

**Siempre** `useGSAP()` de `@gsap/react` con un `scope` ref. Nunca `gsap.to`
suelto en un `useEffect` sin cleanup — rompe en StrictMode (doble montaje).

**Siempre** envolver la animación en `gsap.matchMedia()` con
`(prefers-reduced-motion: no-preference)`. Si el usuario pide menos movimiento,
no se anima nada: el elemento queda en su estado final.

El hook reutilizable `useStaggerReveal` (`src/lib/motion.js`) ya encapsula ambas
reglas. Úsalo en vez de reescribir GSAP a mano:

```jsx
import { useStaggerReveal } from '../lib/motion.js';

function Lista({ items }) {
  // Re-anima cuando cambia la lista. Respeta reduced-motion y limpia solo.
  const ref = useStaggerReveal([items]);
  return (
    <div ref={ref} className="grid ...">
      {items.map((it) => <Card key={it.id} {...it} />)}
    </div>
  );
}
```

Si necesitás algo a mano (timeline custom), seguí el mismo esqueleto:

```jsx
import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { MOTION } from '../lib/motion.js';

function Componente() {
  const scope = useRef(null);
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.from('.target', { y: 12, opacity: 0, duration: MOTION.dur.slow, ease: MOTION.ease.out });
    });
    return () => mm.revert();
  }, { scope });
  return <div ref={scope}>…</div>;
}
```

---

## 6. Checklist de motion (espejo de design.md §12)

Antes de dar por terminada una animación:

- [ ] ¿Respeta `prefers-reduced-motion` (vía `gsap.matchMedia` o `@media` CSS)?
- [ ] ¿Duración ≤ 500ms?
- [ ] ¿≤ 3 elementos simultáneos (stagger acotado)?
- [ ] ¿Usa `useGSAP` con `scope` (cleanup automático, seguro en StrictMode)?
- [ ] ¿Usa los tokens de `MOTION`, no valores hardcodeados?
- [ ] ¿Es sutil y coherente con la UI plana/cálida — no choca con design.md §1?
- [ ] ¿GSAP solo donde CSS no alcanzaba (no reemplazó keyframes que ya andaban)?
