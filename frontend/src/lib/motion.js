// Sistema de motion de Titi — ver frontend/motion.md (fuente de verdad).
// GSAP solo donde el CSS no alcanza. Reglas: ≤500ms, stagger total acotado,
// y SIEMPRE respetar prefers-reduced-motion vía gsap.matchMedia().
import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

// Tokens de motion — alineados con design.md §10 e index.css.
export const MOTION = {
  // Duraciones en segundos (GSAP usa segundos, no ms).
  dur: { fast: 0.15, base: 0.3, slow: 0.5 },
  ease: {
    in: 'power2.in', // salidas
    out: 'power2.out', // entradas
    pop: 'back.out(1.7)', // celebraciones (equivale al cubic-bezier de los toasts)
  },
};

/**
 * useStaggerReveal — entrada escalonada de los hijos directos de un contenedor.
 *
 * Devuelve un ref para poner en el contenedor (grid, timeline). Anima cada hijo
 * directo con un fade + desplazamiento vertical sutil, escalonado. El total del
 * stagger se acota para que la secuencia complete dentro del presupuesto de motion.
 *
 * - Respeta prefers-reduced-motion: si el usuario pide menos movimiento, no anima
 *   (los elementos quedan en su estado final).
 * - useGSAP limpia las animaciones al desmontar / re-ejecutar (seguro en StrictMode).
 *
 * @param {Array} dependencies  Re-ejecuta la animación cuando cambian (ej: [cursos]).
 * @param {Object} options      y, duration, stagger, maxStagger.
 * @returns ref para el contenedor.
 */
export function useStaggerReveal(dependencies = [], options = {}) {
  const scope = useRef(null);
  const {
    y = 12,
    duration = MOTION.dur.slow,
    stagger = 0.06,
    maxStagger = 0.4, // techo del spread total para no pasar el presupuesto
  } = options;

  useGSAP(
    () => {
      const el = scope.current;
      if (!el) return;
      const items = gsap.utils.toArray(el.children);
      if (items.length === 0) return;

      // Reduced-motion: no animar, dejar los elementos en su estado final.
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      // fromTo (no from) para que el estado final sea explícito y robusto frente
      // a re-render / StrictMode. autoAlpha = opacity + visibility. clearProps al
      // terminar deja los estilos inline limpios (no estorba al hover de la card).
      gsap.fromTo(
        items,
        { y, autoAlpha: 0 },
        {
          y: 0,
          autoAlpha: 1,
          duration,
          ease: MOTION.ease.out,
          // amount = tiempo total repartido entre todos; acotado por maxStagger.
          stagger: { amount: Math.min(items.length * stagger, maxStagger) },
          clearProps: 'transform,opacity,visibility',
        },
      );
    },
    { scope, dependencies },
  );

  return scope;
}
