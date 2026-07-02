import { useEffect, useState } from 'react';

/**
 * AchievementToast — aparece desde la derecha al desbloquear logros.
 * Muestra los logros de a uno (cola interna), se cierra solo y nunca bloquea la UI.
 *
 * Props:
 *  - logros (array):  [{ id, nombre, descripcion, icono }] recién desbloqueados.
 *  - onDone (fn):     callback cuando se mostró el último (el padre limpia el array).
 *  - durationMs:      tiempo visible por logro (default 3200).
 */
export default function AchievementToast({ logros = [], onDone, durationMs = 3200 }) {
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState('hidden'); // hidden | in | out

  // Nueva tanda de logros → arrancar desde el primero
  useEffect(() => {
    if (logros.length > 0) {
      setIdx(0);
      setPhase('in');
    } else {
      setPhase('hidden');
    }
  }, [logros]);

  // Visible → programar salida
  useEffect(() => {
    if (phase !== 'in') return;
    const t = setTimeout(() => setPhase('out'), durationMs);
    return () => clearTimeout(t);
  }, [phase, idx, durationMs]);

  // Saliendo → avanzar al siguiente o terminar
  useEffect(() => {
    if (phase !== 'out') return;
    const t = setTimeout(() => {
      if (idx + 1 < logros.length) {
        setIdx((i) => i + 1);
        setPhase('in');
      } else {
        setPhase('hidden');
        onDone?.();
      }
    }, 320);
    return () => clearTimeout(t);
  }, [phase, idx, logros.length, onDone]);

  const logro = logros[idx];
  if (phase === 'hidden' || !logro) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-4 right-4 left-4 sm:left-auto z-50 sm:max-w-xs ${
        phase === 'in' ? 'titi-achievement-toast-in' : 'titi-achievement-toast-out'
      }`}
    >
      <div className="flex items-center gap-3 p-3 sm:p-4 bg-purple-50 border border-purple-200 rounded-2xl shadow-lg">
        <span className="text-3xl shrink-0 select-none" aria-hidden="true">
          {logro.icono}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-purple-500 uppercase tracking-wide">
            ¡Logro desbloqueado!
          </p>
          <p className="text-sm font-bold text-purple-900">{logro.nombre}</p>
          {logro.descripcion && (
            <p className="text-xs text-purple-500 line-clamp-2">{logro.descripcion}</p>
          )}
          {logros.length > 1 && (
            <p className="text-xs font-semibold text-purple-400 mt-0.5 tabular-nums">
              {idx + 1} de {logros.length}
            </p>
          )}
        </div>

        <img
          src="/Titi.png"
          alt="Titi"
          className="w-7 h-7 ml-auto object-contain shrink-0 select-none"
          draggable={false}
        />
      </div>
    </div>
  );
}
