import { useEffect, useState } from 'react';

/**
 * PurchaseToast — confirma o rechaza una compra de la tienda. Sigue el mismo
 * patrón visual/temporal de GotaToast y AchievementToast (entra, se queda
 * `durationMs`, sale sola). `toast` es `{ ok, message } | null`; el padre lo
 * limpia con `onDone` cuando termina de mostrarse.
 */
export default function PurchaseToast({ toast, onDone, durationMs = 2400 }) {
  const [phase, setPhase] = useState('hidden'); // hidden | in | out

  useEffect(() => {
    if (!toast) {
      setPhase('hidden');
      return;
    }
    setPhase('in');
    const tOut = setTimeout(() => setPhase('out'), durationMs);
    const tDone = setTimeout(() => onDone?.(), durationMs + 320);
    return () => {
      clearTimeout(tOut);
      clearTimeout(tDone);
    };
  }, [toast, durationMs, onDone]);

  if (!toast || phase === 'hidden') return null;

  const ok = toast.ok;
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-4 right-4 left-4 sm:left-auto z-50 sm:max-w-xs ${
        phase === 'in' ? 'titi-achievement-toast-in' : 'titi-achievement-toast-out'
      }`}
    >
      <div
        className={`flex items-center gap-3 p-3 sm:p-4 border rounded-2xl shadow-lg ${
          ok ? 'bg-titi-yellow-light border-titi-yellow' : 'bg-red-50 border-red-200'
        }`}
      >
        <span className="text-2xl shrink-0 select-none" aria-hidden="true">
          {ok ? '🛍️' : '⚠️'}
        </span>
        <p className={`text-sm font-bold ${ok ? 'text-titi-dark' : 'text-red-700'}`}>
          {toast.message}
        </p>
      </div>
    </div>
  );
}
