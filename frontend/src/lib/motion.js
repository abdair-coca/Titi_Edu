// Sistema de motion de Titi — ver frontend/motion.md (fuente de verdad).
// Feel: juguetón con rebote leve. GSAP para entradas/secuencias; CSS para hover/press.
// Reglas: tope 400ms, y SIEMPRE respetar prefers-reduced-motion (desactiva todo).
import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

// Tokens de motion. Snappy: rápido al entrar, rebote leve.
export const MOTION = {
  // Duraciones en segundos (GSAP usa segundos, no ms). Tope 0.4s = 400ms.
  dur: { fast: 0.15, base: 0.3, slow: 0.4 },
  ease: {
    in: 'power2.in', // salidas
    out: 'power2.out', // movimiento neutro
    pop: 'back.out(1.5)', // entradas con rebote leve (el feel de Titi)
  },
};

const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * useStaggerReveal — entrada escalonada (pop por escala) de los hijos directos.
 *
 * Cada hijo entra creciendo de scale 0.9 → 1 con fade y rebote leve, escalonado.
 * El total del stagger se acota para no pasar el presupuesto de motion.
 *
 * - Respeta prefers-reduced-motion: no anima (elementos en su estado final).
 * - useGSAP limpia al desmontar / re-ejecutar (seguro en StrictMode).
 *
 * @param {Array} dependencies  Re-ejecuta cuando cambian (ej: [cursos]).
 * @param {Object} options      scale, duration, stagger, maxStagger.
 * @returns ref para el contenedor.
 */
export function useStaggerReveal(dependencies = [], options = {}) {
  const scope = useRef(null);
  const {
    scale = 0.9,
    duration = MOTION.dur.base,
    stagger = 0.05,
    maxStagger = 0.3, // techo del spread total
  } = options;

  useGSAP(
    () => {
      const el = scope.current;
      if (!el) return;
      const items = gsap.utils.toArray(el.children);
      if (items.length === 0) return;
      if (prefersReducedMotion()) return;

      // fromTo (no from) → estado final explícito, robusto frente a StrictMode.
      // autoAlpha = opacity + visibility. clearProps deja los estilos inline
      // limpios al terminar (no estorba al hover de la card).
      gsap.fromTo(
        items,
        { scale, autoAlpha: 0 },
        {
          scale: 1,
          autoAlpha: 1,
          duration,
          ease: MOTION.ease.pop,
          stagger: { amount: Math.min(items.length * stagger, maxStagger) },
          clearProps: 'transform,opacity,visibility',
        },
      );
    },
    { scope, dependencies },
  );

  return scope;
}

/**
 * useCountUp — cuenta un número hasta su valor real (design.md §10, patrón 5).
 *
 * Es visualización de dato (como el llenado de barras): ~700ms, fuera del
 * tope de 400ms de las entradas. Anima desde el último valor mostrado (no
 * siempre desde 0), así un refetch no "rebobina" el número.
 *
 * - Respeta prefers-reduced-motion: valor final al instante.
 * - Renderizar SIEMPRE con `tabular-nums` para que el ancho no baile.
 *
 * @param {number} target   Valor final.
 * @param {Object} options  duration en segundos (default 0.7).
 * @returns número entero para renderizar.
 */
export function useCountUp(target, options = {}) {
  const { duration = 0.7 } = options;
  const to = Number(target) || 0;
  const [value, setValue] = useState(() => (prefersReducedMotion() ? to : 0));
  const shownRef = useRef(value);

  useEffect(() => {
    if (prefersReducedMotion()) {
      shownRef.current = to;
      setValue(to);
      return undefined;
    }
    const from = shownRef.current;
    if (from === to) return undefined;
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / (duration * 1000));
      const eased = 1 - Math.pow(1 - p, 3); // easeOut — mismo feel que las barras
      const next = Math.round(from + (to - from) * eased);
      shownRef.current = next;
      setValue(next);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, duration]);

  return value;
}

/**
 * usePopIn — entrada pop de un solo elemento (página, modal, mascota Titi).
 *
 * El elemento crece de `scale` → 1 con fade y rebote leve al montar / cambiar deps.
 * Respeta prefers-reduced-motion. useGSAP maneja el cleanup.
 *
 * @param {Array} dependencies  Re-ejecuta cuando cambian (ej: [location.pathname]).
 * @param {Object} options      scale, duration, ease.
 * @returns ref para el elemento a animar.
 */
export function usePopIn(dependencies = [], options = {}) {
  const scope = useRef(null);
  const {
    scale = 0.9,
    duration = MOTION.dur.base,
    ease = MOTION.ease.pop,
  } = options;

  useGSAP(
    () => {
      const el = scope.current;
      if (!el) return;
      if (prefersReducedMotion()) return;

      gsap.fromTo(
        el,
        { scale, autoAlpha: 0 },
        {
          scale: 1,
          autoAlpha: 1,
          duration,
          ease,
          clearProps: 'transform,opacity,visibility',
        },
      );
    },
    { scope, dependencies },
  );

  return scope;
}
