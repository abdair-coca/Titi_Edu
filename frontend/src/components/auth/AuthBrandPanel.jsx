// AuthBrandPanel — panel de marca de las pantallas de auth.
//
// Desktop: panel oscuro con titular, Titi reactivo sobre un disco amarillo y
// chips flotantes que muestran el lado social de Titi (amigos, racha, gotas).
// Móvil: cabecera compacta con Titi y su burbuja (AuthMobileHeader).
//
// UI plana: sólidos + bordes, sin gradientes ni blur. Las clases `auth-*` son
// los ganchos que anima la página (entrada GSAP); los chips flotan con CSS
// (`titi-float`) y todo se apaga con prefers-reduced-motion.
import { Link } from 'react-router-dom';
import TitiMascot from '../TitiMascot.jsx';
import { FlameIcon } from '../StreakBadge.jsx';
import { usePopIn } from '../../lib/motion.js';
import { GotaIcon, SparklesIcon, UsersIcon } from '../icons.jsx';

const FEATURES = [
  { icon: UsersIcon, label: 'Cursos con tus amigos', tone: 'bg-blue-500 text-white' },
  { icon: SparklesIcon, label: 'Tutor IA por lección', tone: 'bg-titi-achievement text-white' },
  { icon: GotaIcon, label: 'Gotas y rachas', tone: 'bg-titi-yellow text-titi-dark' },
];

function Wordmark({ inverse = false }) {
  return (
    <Link
      to="/"
      className="inline-flex items-center gap-2 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-titi-yellow"
    >
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-titi-yellow">
        <img src="/Titi.png" alt="" className="h-8 w-8 object-contain" draggable={false} />
      </span>
      <span className={`text-2xl font-black lowercase tracking-tight ${inverse ? 'text-white' : 'text-titi-dark'}`}>
        titi
      </span>
    </Link>
  );
}

// Burbuja de diálogo de Titi. Re-hace el pop cada vez que cambia el texto.
function TitiBubble({ text, tail = 'bottom-left', className = '' }) {
  const ref = usePopIn([text], { scale: 0.85 });
  // Cuadrado rotado 45°: los dos bordes visibles forman la punta de la cola.
  const tailClass = {
    'bottom-left': '-bottom-[7px] left-6 border-b-2 border-r-2',
    left: 'top-1/2 -left-[7px] -mt-1.5 border-b-2 border-l-2',
  }[tail];
  return (
    <div
      ref={ref}
      // Decorativa: los errores reales se anuncian con role="alert" en el formulario.
      aria-hidden="true"
      className={`relative rounded-2xl border-2 border-titi-dark bg-white px-4 py-2.5 text-sm font-extrabold leading-snug text-titi-dark shadow-[0_4px_0px_#1A1A2E] ${className}`}
    >
      {text}
      <span
        aria-hidden="true"
        className={`absolute h-3 w-3 rotate-45 border-titi-dark bg-white ${tailClass}`}
      />
    </div>
  );
}

// Chip flotante: el wrapper externo recibe la entrada GSAP y el interno flota
// con CSS, así los dos transforms no se pisan.
function FloatingChip({ className = '', delay = '0s', children }) {
  return (
    <div className={`auth-chip absolute [@media(max-height:760px)]:hidden ${className}`}>
      <div
        className="titi-float flex items-center gap-3 rounded-2xl border border-white/10 bg-white px-3.5 py-2.5 shadow-[0_6px_0px_rgba(0,0,0,0.25)]"
        style={{ animationDelay: delay }}
      >
        {children}
      </div>
    </div>
  );
}

// Grilla de puntos muy sutil para dar textura al panel (SVG plano).
function DotGrid() {
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full text-white/[0.06]">
      <defs>
        <pattern id="auth-dots" width="22" height="22" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.5" fill="currentColor" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#auth-dots)" />
    </svg>
  );
}

export function AuthBrandPanel({ mascotState, bubble }) {
  return (
    <aside className="auth-panel relative flex h-full flex-col overflow-hidden rounded-3xl bg-titi-dark p-10 xl:p-12">
      <DotGrid />
      {/* Formas planas de fondo */}
      <span aria-hidden="true" className="absolute -right-24 -top-24 h-64 w-64 rounded-full border-[28px] border-titi-dark-mid" />
      <span aria-hidden="true" className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-titi-dark-mid" />

      <div className="relative">
        <Wordmark inverse />
      </div>

      <div className="relative mt-10">
        <h2 className="text-4xl font-black leading-[1.1] text-white xl:text-5xl">
          <span className="auth-headline-line block">Aprender es mejor</span>
          <span className="auth-headline-line block">
            con tus{' '}
            <span className="relative inline-block text-titi-yellow">
              amigos
              <svg
                aria-hidden="true"
                viewBox="0 0 160 14"
                preserveAspectRatio="none"
                className="absolute -bottom-2.5 left-0 h-3.5 w-full"
              >
                <path
                  className="auth-underline"
                  d="M3 10 C 45 3, 105 3, 157 8"
                  pathLength="1"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="5"
                  strokeLinecap="round"
                  style={{ strokeDasharray: 1, strokeDashoffset: 0 }}
                />
              </svg>
            </span>
          </span>
        </h2>
        <p className="auth-headline-line mt-5 max-w-sm text-base font-semibold leading-relaxed text-gray-300">
          Mirá qué estudian tus amigos, aprendé a tu ritmo y celebrá cada avance juntos.
        </p>
      </div>

      {/* Escenario de Titi */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center py-6">
        <div className="relative aspect-square h-[clamp(14rem,calc(100vh-30rem),25rem)]">
          <span aria-hidden="true" className="absolute inset-0 rounded-full border border-white/10" />
          <span aria-hidden="true" className="titi-spin-slow absolute inset-[5%] rounded-full border-2 border-dashed border-white/15" />
          <span aria-hidden="true" className="absolute inset-[12%] rounded-full bg-titi-yellow" />
          {/* Titi escala con el escenario (que depende del alto de la pantalla). */}
          <div className="absolute inset-[17%] grid translate-y-[6%] place-items-center [&>div]:h-full [&>div]:w-full [&_img]:h-full [&_img]:w-full">
            <TitiMascot state={mascotState} message="" size="2xl" />
          </div>

          <div className="absolute -right-6 top-2 z-10 max-w-[13rem] xl:-right-10">
            <TitiBubble text={bubble} />
          </div>

          <FloatingChip className="-left-10 top-24 xl:-left-14" delay="0s">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-500 text-xs font-black text-white">
              AM
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-extrabold text-titi-dark">Ana empezó Cálculo I</span>
              <span className="block text-xs font-semibold text-gray-500">Tu amiga, hace 5 min</span>
            </span>
          </FloatingChip>

          <FloatingChip className="-right-8 bottom-24 xl:-right-12" delay="-1.6s">
            <FlameIcon size={30} animated={false} />
            <span className="leading-tight">
              <span className="block text-sm font-extrabold tabular-nums text-titi-dark">12 días</span>
              <span className="block text-xs font-semibold text-gray-500">de racha</span>
            </span>
          </FloatingChip>

          <FloatingChip className="-left-4 bottom-4" delay="-3.2s">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-titi-yellow text-titi-dark">
              <GotaIcon className="h-5 w-5" />
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-extrabold tabular-nums text-titi-dark">+20 gotas</span>
              <span className="block text-xs font-semibold text-gray-500">Lección completada</span>
            </span>
          </FloatingChip>
        </div>
      </div>

      <ul className="relative grid grid-cols-3 gap-3 [@media(max-height:700px)]:hidden">
        {FEATURES.map(({ icon: Icon, label, tone }) => (
          <li
            key={label}
            className="auth-feature flex items-center gap-2.5 rounded-2xl border border-white/10 bg-titi-dark-mid px-3 py-3"
          >
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${tone}`}>
              <Icon className="h-4 w-4" />
            </span>
            <span className="text-xs font-bold leading-tight text-white">{label}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export function AuthMobileHeader({ mascotState, bubble }) {
  return (
    <div className="auth-panel relative overflow-hidden rounded-3xl bg-titi-dark px-5 pb-5 pt-5">
      <DotGrid />
      <div className="relative">
        <Wordmark inverse />
      </div>
      <div className="relative mt-4 flex items-end gap-3">
        <div className="relative shrink-0">
          <span aria-hidden="true" className="absolute inset-2 rounded-full bg-titi-yellow" />
          <TitiMascot state={mascotState} message="" size="md" className="relative" />
        </div>
        <TitiBubble text={bubble} tail="left" className="mb-6" />
      </div>
    </div>
  );
}
