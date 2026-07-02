import { useEffect, useState } from 'react';
import TitiMascot from './TitiMascot.jsx';
import { GotaIcon } from './icons.jsx';
import { useGamification } from '../context/GamificationContext.jsx';

/**
 * GotaToast — aparece desde la derecha al ganar gotas, con Titi celebrando.
 * Lee la cola del GamificationContext (la alimenta `pushGota`), muestra una de a
 * una, se cierra sola y nunca bloquea la UI. Sigue el patrón de AchievementToast.
 */
export default function GotaToast({ durationMs = 2600 }) {
  const { gotaQueue, shiftGota } = useGamification();
  const current = gotaQueue[0] || null;
  const [phase, setPhase] = useState('hidden'); // hidden | in | out

  useEffect(() => {
    if (!current) {
      setPhase('hidden');
      return;
    }
    setPhase('in');
    const tOut = setTimeout(() => setPhase('out'), durationMs);
    const tShift = setTimeout(() => shiftGota(), durationMs + 340);
    return () => {
      clearTimeout(tOut);
      clearTimeout(tShift);
    };
  }, [current, durationMs, shiftGota]);

  if (!current || phase === 'hidden') return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-4 right-4 left-4 sm:left-auto z-50 sm:max-w-xs ${
        phase === 'in' ? 'titi-achievement-toast-in' : 'titi-achievement-toast-out'
      }`}
    >
      <div className="flex items-center gap-3 p-3 sm:p-4 bg-titi-yellow-light border border-titi-yellow rounded-2xl shadow-lg">
        <TitiMascot state="celebra" size="sm" message="" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-titi-yellow-dark uppercase tracking-wide">
            ¡Ganaste gotas!
          </p>
          <p className="flex items-center gap-1 text-2xl font-black text-titi-dark tabular-nums">
            <GotaIcon className="w-6 h-6 text-titi-yellow-dark" />
            +{current.cantidad}
          </p>
          {gotaQueue.length > 1 && (
            <p className="text-xs font-semibold text-titi-yellow-dark/70 tabular-nums">
              +{gotaQueue.length - 1} más
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
