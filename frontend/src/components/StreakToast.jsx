import { useEffect, useState } from 'react';
import TitiSvg from './titi/TitiSvg.jsx';

/**
 * StreakToast — aparece desde arriba cuando la racha sube.
 * Sigue el patrón de AchievementToast de design.md §6: top-center, autoclose,
 * cubicbezier de bounce-in. Usa el color streak (#FF6B35).
 *
 * Props:
 *  - racha (number): el nuevo valor.
 *  - shown (bool):   controla visibilidad. El padre lo pone en true al detectar subida.
 *  - onDone (fn):    callback al cerrarse.
 *  - durationMs:     tiempo visible antes de cerrar (default 3500).
 */
export default function StreakToast({ racha, shown, onDone, durationMs = 3500 }) {
  const [phase, setPhase] = useState('hidden'); // hidden | in | out

  useEffect(() => {
    if (!shown) return;
    setPhase('in');
    const t1 = setTimeout(() => setPhase('out'), durationMs);
    const t2 = setTimeout(() => {
      setPhase('hidden');
      onDone?.();
    }, durationMs + 350);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [shown, durationMs, onDone]);

  if (phase === 'hidden') return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-4 left-1/2 z-50 ${
        phase === 'in' ? 'titi-streak-toast-in' : 'titi-streak-toast-out'
      }`}
      style={{ transform: 'translateX(-50%)' }}
    >
      <div className="relative overflow-hidden bg-gradient-to-br from-orange-50 via-orange-50 to-amber-50 border-2 border-titi-streak/40 rounded-2xl shadow-[0_10px_30px_rgba(255,107,53,0.25)] px-5 py-4 flex items-center gap-4 min-w-[280px] max-w-md">
        {/* Decoración */}
        <span
          aria-hidden="true"
          className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-titi-streak/15 blur-2xl"
        />

        <FlameBigIcon />

        <div className="relative min-w-0 flex-1">
          <p className="text-xs font-extrabold uppercase tracking-wide text-titi-streak">
            ¡Racha en llamas!
          </p>
          <p className="text-xl font-black text-titi-dark leading-tight">
            {racha} {racha === 1 ? 'día' : 'días'} seguidos
          </p>
          <p className="text-xs font-semibold text-gray-500 mt-0.5">
            {racha === 1
              ? '¡Empezaste tu racha! Volvé mañana para mantenerla.'
              : '¡Seguí así, no la pierdas!'}
          </p>
        </div>

        <TitiSvg className="w-12 h-12 shrink-0 drop-shadow-sm select-none" />
      </div>
    </div>
  );
}

function FlameBigIcon() {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" aria-hidden="true" className="titi-flame-flicker shrink-0">
      <defs>
        <linearGradient id="streak-toast-flame-outer" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FF9A3C" />
          <stop offset="55%" stopColor="#FF6B35" />
          <stop offset="100%" stopColor="#D9480F" />
        </linearGradient>
        <linearGradient id="streak-toast-flame-inner" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFE08A" />
          <stop offset="100%" stopColor="#FFD93D" />
        </linearGradient>
      </defs>
      <path
        d="M12 2c.6 3.4 3.5 4.8 3.5 8.5 0 1.6-.6 2.8-1.5 3.6.4-1.5.1-3-1-4.3 0 2.2-1 3.6-2 4.5-1.8 1.6-2.5 3.3-2.5 5 0 3.3 2.5 4.7 5.5 4.7s5.5-1.4 5.5-4.7c0-5.6-7.5-7.4-7.5-17.3z"
        fill="url(#streak-toast-flame-outer)"
      />
      <path
        d="M12 11c0 1.8-.7 2.8-1.4 3.7-.8 1-1.3 2-1.3 3.3 0 1.9 1.4 2.8 2.7 2.8s2.7-.9 2.7-2.8c0-2.4-2.7-3.8-2.7-7z"
        fill="url(#streak-toast-flame-inner)"
      />
    </svg>
  );
}
