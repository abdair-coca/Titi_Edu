// AuthField — campo de login/registro con label flotante e ícono.
//
// Microinteracciones:
// - El label vive dentro del campo y sube al enfocar o al tener valor
//   (placeholder=" " + :placeholder-shown, sin JS).
// - Al enfocar, el ícono hace un "wiggle" corto y una barra amarilla crece
//   desde la izquierda en la base del campo.
// - `valid`: aparece un check verde con pop (si no hay `trailing`).
// - Error: borde rojo, mensaje con ícono y "shake" de 300ms. El shake se
//   re-dispara cuando cambia `shakeKey`, sin re-montar el input (no pierde foco).
import { useEffect, useState } from 'react';
import { AlertIcon, CheckIcon } from '../icons.jsx';

export default function AuthField({
  id,
  label,
  icon: Icon,
  error,
  hint,
  valid = false,
  shakeKey = 0,
  trailing,
  inputRef,
  className = '',
  ...inputProps
}) {
  const [shaking, setShaking] = useState(false);

  useEffect(() => {
    // Solo reacciona a un nuevo intento de envío, no a cada cambio del error.
    if (shakeKey > 0 && error) setShaking(true);
  }, [shakeKey]);

  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  const showCheck = valid && !error && !trailing;
  const hasRight = Boolean(trailing) || valid;

  return (
    <div className={className}>
      <div
        className={`group relative ${shaking ? 'titi-shake' : ''}`}
        onAnimationEnd={(e) => {
          if (e.animationName === 'titi-shake') setShaking(false);
        }}
      >
        {Icon && (
          <span
            className={`pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-150 ${
              error
                ? 'text-red-500'
                : showCheck
                  ? 'text-green-600'
                  : 'text-gray-400 group-focus-within:text-titi-dark'
            }`}
          >
            <span className="block group-focus-within:animate-[titi-wiggle_0.35s_ease-in-out] motion-reduce:animate-none">
              <Icon className="h-5 w-5" />
            </span>
          </span>
        )}
        <input
          id={id}
          ref={inputRef}
          placeholder=" "
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
          className={`peer block h-14 w-full rounded-2xl border-2 bg-white pb-2 pt-6 text-base font-semibold text-titi-dark shadow-[0_3px_0px_#E5E7EB] transition-all duration-150 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 ${
            Icon ? 'pl-12' : 'pl-4'
          } ${hasRight ? 'pr-12' : 'pr-4'} ${
            error
              ? 'border-red-400 shadow-[0_3px_0px_#FCA5A5] focus:border-red-500'
              : 'border-gray-200 hover:border-gray-300 focus:border-titi-dark focus:shadow-[0_3px_0px_#1A1A2E]'
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

        {/* Barra de foco: crece desde la izquierda. */}
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-x-4 bottom-1.5 h-[3px] origin-left scale-x-0 rounded-full transition-transform duration-300 ease-out group-focus-within:scale-x-100 motion-reduce:transition-none ${
            error ? 'bg-red-400' : 'bg-titi-yellow'
          }`}
        />

        {trailing && <div className="absolute right-2 top-1/2 -translate-y-1/2">{trailing}</div>}
        {showCheck && (
          <span
            aria-hidden="true"
            className="titi-pop-in absolute right-3.5 top-1/2 -mt-3.5 grid h-7 w-7 place-items-center rounded-full bg-green-500 text-white"
          >
            <CheckIcon className="h-4 w-4" />
          </span>
        )}
      </div>

      {error ? (
        <p id={`${id}-error`} className="titi-pop-in mt-2 flex items-center gap-1.5 text-sm font-semibold text-red-500">
          <AlertIcon className="h-4 w-4 shrink-0" />
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
