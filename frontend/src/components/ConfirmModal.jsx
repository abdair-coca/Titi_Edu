import { usePopIn } from '../lib/motion.js';
import { BTN_DANGER_SM, BTN_SECONDARY } from './ui/v3.jsx';

export default function ConfirmModal({
  open,
  title,
  message,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  onConfirm,
  onCancel,
  danger = false,
  busy = false,
}) {
  const panelRef = usePopIn([open]);

  if (!open) return null;

  return (
    <div className="titi-backdrop-in fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div ref={panelRef} role="dialog" aria-modal="true" className="w-full max-w-md mx-4 bg-white rounded-2xl border-2 border-titi-dark shadow-[0_8px_0_#1A1A2E] p-5 sm:p-6">
        <h2 className="text-xl font-extrabold text-titi-dark mb-2">
          {title}
        </h2>

        <p className="text-base font-medium text-gray-500 mb-6">
          {message}
        </p>

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={busy}
            className={BTN_SECONDARY}
          >
            {cancelText}
          </button>

          <button
            onClick={onConfirm}
            disabled={busy}
            aria-busy={busy}
            className={
              danger
                ? `${BTN_DANGER_SM} h-11 px-4`
                : "titi-btn-primary text-sm"
            }
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
