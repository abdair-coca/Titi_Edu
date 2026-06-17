import { usePopIn } from '../lib/motion.js';

export default function ConfirmModal({
  open,
  title,
  message,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  onConfirm,
  onCancel,
  danger = false,
}) {
  const panelRef = usePopIn([open]);

  if (!open) return null;

  return (
    <div className="titi-backdrop-in fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div ref={panelRef} className="neo-card w-full max-w-md p-6 mx-4">
        <h2 className="text-xl font-bold mb-2">
          {title}
        </h2>

        <p className="text-neo-muted mb-6">
          {message}
        </p>

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="neo-btn-ghost"
          >
            {cancelText}
          </button>

          <button
            onClick={onConfirm}
            className={
              danger
                ? "px-4 py-2 rounded bg-red-600 hover:bg-red-700"
                : "neo-btn-primary"
            }
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}