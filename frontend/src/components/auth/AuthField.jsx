// AuthField — campo de login/registro con label flotante e ícono.
//
// - El label vive dentro del campo y sube al enfocar o al tener valor
//   (placeholder=" " + :placeholder-shown, sin JS).
// - Error: borde rojo, mensaje con ícono y "shake" corto (CSS, 300ms). El shake
//   se re-dispara cada vez que cambia `shakeKey` sin re-montar el input (no pierde foco).
// - `trailing` acepta un botón (ej. mostrar contraseña) a la derecha.
import { useEffect, useState } from 'react';
import { AlertIcon } from '../icons.jsx';

export default function AuthField({
  id,
  label,
  icon: Icon,
  error,
  hint,
  shakeKey = 0,
  trailing,
  inputRef,
  className = '',
  ...inputProps
}) {
  const [shaking, setShaking] = useState(false);

  useEffect(() => {
    if (shakeKey > 0 && error) setShaking(true);
    // Solo reacciona a un nuevo intento de envío, no a cada cambio del error.
  }, [shakeKey]);

  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={className}>
      <div
        className={`group relative ${shaking ? 'titi-shake' : ''}`}
        onAnimationEnd={() => setShaking(false)}
      >
        {Icon && (
          <span
            className={`pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-150 ${
              error ? 'text-red-500' : 'text-gray-400 group-focus-within:text-titi-dark'
            }`}
          >
            <Icon className="w-5 h-5" />
          </span>
        )}
        <input
          id={id}
          ref={inputRef}
          placeholder=" "
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
          className={`peer block h-14 w-full rounded-xl border-2 bg-white pb-2 pt-6 text-base font-semibold text-titi-dark transition-all duration-150 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 ${
            Icon ? 'pl-12' : 'pl-4'
          } ${trailing ? 'pr-12' : 'pr-4'} ${
            error
              ? 'border-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-500/15'
              : 'border-gray-200 hover:border-gray-300 focus:border-titi-yellow focus:ring-4 focus:ring-titi-yellow/30'
          }`}
          {...inputProps}
        />
        <label
          htmlFor={id}
          className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-base font-semibold text-gray-400 transition-all duration-150
            peer-focus:top-[15px] peer-focus:text-xs peer-focus:font-bold peer-focus:uppercase peer-focus:tracking-wide
            peer-[:not(:placeholder-shown)]:top-[15px] peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:font-bold peer-[:not(:placeholder-shown)]:uppercase peer-[:not(:placeholder-shown)]:tracking-wide
            ${Icon ? 'left-12' : 'left-4'} ${error ? 'peer-focus:text-red-500' : 'peer-focus:text-titi-dark'}`}
        >
          {label}
        </label>
        {trailing && <div className="absolute right-2 top-1/2 -translate-y-1/2">{trailing}</div>}
      </div>

      {error ? (
        <p id={`${id}-error`} className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-red-500">
          <AlertIcon className="w-4 h-4 shrink-0" />
          {error}
        </p>
      ) : (
        hint && (
          <div id={`${id}-hint`} className="mt-2">
            {hint}
          </div>
        )
      )}
    </div>
  );
}
