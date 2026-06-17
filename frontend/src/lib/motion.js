// Sistema de motion de Titi — ver frontend/motion.md (fuente de verdad).
// Feel: juguetón con rebote leve. GSAP para entradas/secuencias; CSS para hover/press.
// Reglas: tope 400ms, y SIEMPRE respetar prefers-reduced-motion (desactiva todo).
import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

// Tokens de motion.
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
