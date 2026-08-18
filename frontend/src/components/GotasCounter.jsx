import { useEffect, useRef, useState } from 'react';
import { GotaIcon } from './icons.jsx';
import { useGamification } from '../context/GamificationContext.jsx';

// Anima entre valores (no desde 0 al montar) — mismo patrón que StreakBadge/HeroStat.
function useCountUp(target, duration = 500) {
  const [value, setValue] = useState(target);

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setValue(target);
      return undefined;
    }
    const from = value;
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return value;
}

/**
 * GotasValue — el número de gotas solo (sin ícono), con count-up y un bump
 * al cambiar. Existe separado de GotasCounter para el número que se ve solo
 * en el rail colapsado del sidebar (sin la gota al lado).
 */
export function GotasValue({ className = '' }) {
  const { gotas } = useGamification();
  const display = useCountUp(gotas.saldo);
  const [bump, setBump] = useState(false);
  const prevRef = useRef(gotas.saldo);

  useEffect(() => {
    if (gotas.saldo === prevRef.current) return;
    prevRef.current = gotas.saldo;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    setBump(true);
    const id = setTimeout(() => setBump(false), 500);
    return () => clearTimeout(id);
  }, [gotas.saldo]);

  return (
    <span
      className={`font-black tabular-nums leading-none ${bump ? 'titi-gota-bump' : ''} ${className}`}
    >
      {display}
    </span>
  );
}

/**
 * GotasCounter — muestra el saldo de gotas del usuario (gota + número).
 * Pensado para la barra de navegación. El color lo define el padre vía
 * `text-*` sobre el wrapper; por defecto usa el amarillo de marca.
 */
export default function GotasCounter({ className = '', iconClass = 'w-4 h-4' }) {
  const { gotas } = useGamification();
  return (
    <span
      className={`inline-flex items-center gap-1 text-titi-yellow ${className}`}
      aria-label={`${gotas.saldo} gotas`}
    >
      <GotaIcon className={`${iconClass} titi-gota-glow`} />
      <GotasValue />
    </span>
  );
}
