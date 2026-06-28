import { GotaIcon } from './icons.jsx';
import { useGamification } from '../context/GamificationContext.jsx';

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
      <GotaIcon className={iconClass} />
      <span className="font-black tabular-nums leading-none">{gotas.saldo}</span>
    </span>
  );
}
