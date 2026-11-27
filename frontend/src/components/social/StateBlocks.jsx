import { RefreshIcon } from '../icons.jsx';

// Piezas de estado compartidas por Inicio y Explorar (rediseno-inicio-explorar R9).

/** Error recuperable en el lugar: qué pasó + Reintentar. */
export function ErrorBox({ title, message, onRetry }) {
  return (
    <div role="alert" className="bg-red-50 border-2 border-red-500 rounded-2xl p-4 flex items-start gap-3 mb-5">
      <span aria-hidden="true" className="w-8 h-8 rounded-full bg-red-500 grid place-items-center shrink-0 text-white text-sm font-black">
        !
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-extrabold text-red-700">{title}</p>
        {message && <p className="text-sm font-medium text-red-600 mt-0.5">{message}</p>}
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-white border-2 border-titi-dark text-sm font-extrabold text-titi-dark shadow-[0_3px_0_#1A1A2E] hover:bg-titi-yellow active:translate-y-0.5 active:shadow-none transition-all duration-150 shrink-0 focus:outline-none focus-visible:ring-4 focus-visible:ring-titi-yellow/60"
        >
          <RefreshIcon className="w-4 h-4" />
          Reintentar
        </button>
      )}
    </div>
  );
}

/** Título de sección v3 con palabra de acento. */
export function SectionHeading({ title, accent, children, className = '' }) {
  return (
    <div className={`flex items-end gap-3 mb-3 ${className}`}>
      <h2 className="text-xl sm:text-2xl font-extrabold text-titi-dark leading-tight">
        {title} {accent && <span className="text-titi-streak">{accent}</span>}
      </h2>
      {children && <div className="ml-auto flex items-center gap-2 shrink-0">{children}</div>}
    </div>
  );
}
