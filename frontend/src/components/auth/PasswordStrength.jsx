// PasswordStrength — medidor de fuerza + checklist de la contraseña (registro).
//
// El único requisito real es el mínimo de 6 caracteres (lo valida el backend);
// los otros dos ítems son sugerencias. Los segmentos se llenan con transición
// y cada ítem cumplido muestra su check con pop.
import { CheckIcon } from '../icons.jsx';

export const MIN_PASSWORD = 6;

export function passwordScore(pw) {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= MIN_PASSWORD) score += 1;
  if (pw.length >= 10) score += 1;
  if (/[a-zA-Z]/.test(pw) && /\d/.test(pw)) score += 1;
  if (/[A-Z]/.test(pw) || /[^a-zA-Z0-9]/.test(pw)) score += 1;
  // Sin el mínimo no pasa de "débil", aunque sume por otros lados.
  return pw.length < MIN_PASSWORD ? Math.min(score, 1) : score;
}

const LEVELS = [
  { label: '', bar: 'bg-gray-200', text: 'text-gray-400' },
  { label: 'Débil', bar: 'bg-red-500', text: 'text-red-500' },
  { label: 'Aceptable', bar: 'bg-titi-streak', text: 'text-titi-streak' },
  { label: 'Buena', bar: 'bg-titi-yellow-dark', text: 'text-titi-yellow-dark' },
  { label: 'Fuerte', bar: 'bg-green-500', text: 'text-green-600' },
];

function Rule({ ok, children }) {
  return (
    <li className={`flex items-center gap-1.5 text-xs font-bold transition-colors duration-150 ${ok ? 'text-green-600' : 'text-gray-400'}`}>
      <span
        className={`grid h-4 w-4 place-items-center rounded-full border-2 transition-colors duration-150 ${
          ok ? 'border-green-500 bg-green-500 text-white' : 'border-gray-300 bg-white'
        }`}
      >
        {ok && <CheckIcon key="ok" className="titi-pop-in h-2.5 w-2.5" />}
      </span>
      {children}
    </li>
  );
}

export default function PasswordStrength({ password }) {
  const score = passwordScore(password);
  const short = Boolean(password) && password.length < MIN_PASSWORD;
  const level = short ? 1 : score;
  const { bar, text } = LEVELS[level];
  const label = short ? 'Muy corta' : LEVELS[level].label;

  return (
    <div>
      <div className="flex items-center gap-3">
        <div
          className="flex flex-1 gap-1.5"
          role="progressbar"
          aria-label="Fuerza de la contraseña"
          aria-valuemin={0}
          aria-valuemax={4}
          aria-valuenow={level}
          aria-valuetext={label}
        >
          {[1, 2, 3, 4].map((i) => (
            <span key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200">
              <span
                className={`block h-full origin-left rounded-full transition-transform duration-300 ease-out motion-reduce:transition-none ${bar} ${
                  i <= level ? 'scale-x-100' : 'scale-x-0'
                }`}
              />
            </span>
          ))}
        </div>
        <span className={`w-20 text-right text-xs font-extrabold uppercase tracking-wide ${text}`}>{label}</span>
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        <Rule ok={password.length >= MIN_PASSWORD}>{MIN_PASSWORD} o más caracteres</Rule>
        <Rule ok={/[a-zA-Z]/.test(password) && /\d/.test(password)}>Letras y números</Rule>
        <Rule ok={/[A-Z]/.test(password) || /[^a-zA-Z0-9]/.test(password)}>Mayúscula o símbolo</Rule>
      </ul>
    </div>
  );
}
