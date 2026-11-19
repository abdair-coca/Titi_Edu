// AuthLayout — superficie compartida de login y registro.
//
// Todo vive sobre el mismo fondo crema: grilla de puntos, doodles que flotan, la
// escena con Titi interactivo (AuthScene) y el formulario, sin paneles ni
// tarjetas que dividan la página. También exporta las piezas comunes del
// formulario (encabezado, botón de envío, mostrar contraseña, banner de error).
//
// La entrada se coreografía acá: Titi → chips → doodles, el subrayado del
// titular que se dibuja y el formulario en paralelo (ganchos `.auth-*`).
import { forwardRef, useRef } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { MOTION, usePopIn } from '../../lib/motion.js';
import AuthScene from './AuthScene.jsx';
import {
  AlertIcon,
  ArrowRightIcon,
  BookIcon,
  EyeIcon,
  EyeOffIcon,
  GotaIcon,
  LightbulbIcon,
  SparklesIcon,
  StarIcon,
} from '../icons.jsx';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Shake horizontal corto (300ms) del botón de envío cuando falla el servidor.
export function shake(el) {
  if (!el || prefersReducedMotion()) return;
  gsap.fromTo(el, { x: 0 }, { keyframes: { x: [-6, 5, -3, 2, 0] }, duration: 0.3, ease: 'none' });
}

const DOODLES = [
  { Icon: SparklesIcon, cls: 'left-[6%] top-[14%] h-7 w-7 text-titi-yellow-dark', delay: '0s' },
  { Icon: StarIcon, cls: 'right-[8%] top-[10%] h-6 w-6 text-titi-dark/20', delay: '-1s' },
  { Icon: GotaIcon, cls: 'left-[10%] top-[40%] h-5 w-5 text-titi-yellow-dark/70 hidden sm:block', delay: '-2s' },
  { Icon: BookIcon, cls: 'right-[5%] bottom-[22%] h-9 w-9 text-titi-dark/10 hidden lg:block', delay: '-3s' },
  { Icon: LightbulbIcon, cls: 'left-[44%] bottom-[8%] h-7 w-7 text-titi-dark/15 hidden lg:block', delay: '-1.5s' },
  { Icon: StarIcon, cls: 'left-[46%] top-[18%] h-4 w-4 text-titi-yellow-dark hidden lg:block', delay: '-2.5s' },
];

function Backdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg className="absolute inset-0 h-full w-full text-titi-dark/[0.05]">
        <defs>
          <pattern id="auth-dots" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.4" fill="currentColor" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#auth-dots)" />
      </svg>
      <span className="absolute -bottom-40 -right-40 hidden h-96 w-96 rounded-full border-[48px] border-titi-yellow-light sm:block" />
      {DOODLES.map(({ Icon, cls, delay }, i) => (
        <span key={i} className={`auth-doodle absolute ${cls}`}>
          <span className="titi-float block h-full w-full" style={{ animationDelay: delay, animationDuration: '6s' }}>
            <Icon className="h-full w-full" />
          </span>
        </span>
      ))}
    </div>
  );
}

function Wordmark() {
  return (
    <Link
      to="/"
      className="group inline-flex items-center gap-2 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-titi-yellow-dark"
    >
      <span className="grid h-10 w-10 place-items-center rounded-xl border-2 border-titi-dark bg-titi-yellow shadow-[0_3px_0px_#1A1A2E] transition-transform duration-150 group-hover:-rotate-6 group-active:scale-90">
        <img src="/Titi.png" alt="" className="h-7 w-7 object-contain" draggable={false} />
      </span>
      <span className="text-2xl font-black lowercase tracking-tight text-titi-dark">titi</span>
    </Link>
  );
}

// Titular de desktop: dos líneas con subrayado dibujado en la palabra destacada.
function Tagline({ first, lead, highlight }) {
  return (
    <h2 className="mb-8 hidden text-center text-4xl font-black leading-[1.1] text-titi-dark lg:block xl:text-5xl">
      {first}
      <br />
      {lead}{' '}
      <span className="relative inline-block">
        {highlight}
        <svg
          aria-hidden="true"
          viewBox="0 0 160 14"
          preserveAspectRatio="none"
          className="absolute -bottom-2.5 left-0 h-3.5 w-full text-titi-yellow-dark"
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
    </h2>
  );
}

export default function AuthLayout({ tagline, mascot, typingTick, children }) {
  const scope = useRef(null);

  // Entrada coreografiada sobre una sola superficie. Cada tramo ≤ 400ms; stagger acotado.
  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      const q = gsap.utils.selector(scope);
      const clear = 'transform,opacity,visibility';
      const tl = gsap.timeline({ defaults: { ease: MOTION.ease.pop, duration: MOTION.dur.base } });

      tl.fromTo(q('.auth-scene'), { scale: 0.85, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, clearProps: clear })
        .fromTo(q('.auth-chip'), { scale: 0.5, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, stagger: 0.09, clearProps: clear }, '-=0.15')
        .fromTo(q('.auth-doodle'), { scale: 0, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, stagger: { amount: 0.3 }, clearProps: clear }, '-=0.2');

      if (q('.auth-underline').length) {
        tl.fromTo(
          q('.auth-underline'),
          { strokeDashoffset: 1 },
          { strokeDashoffset: 0, duration: MOTION.dur.slow, ease: MOTION.ease.out },
          0.35,
        );
      }

      gsap.fromTo(
        q('.auth-form-item'),
        { y: 18, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: MOTION.dur.base, ease: MOTION.ease.pop, stagger: { amount: 0.35 }, delay: 0.15, clearProps: clear },
      );
    },
    { scope },
  );

  return (
    // isolate: el disco de la escena usa -z-10 y debe pintarse sobre el fondo crema.
    <div ref={scope} className="relative isolate min-h-screen overflow-hidden bg-titi-cream">
      <Backdrop />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-5 sm:px-8">
        <header className="auth-form-item flex items-center justify-between py-5">
          <Wordmark />
          <Link
            to="/courses"
            className="group inline-flex items-center gap-1.5 rounded-full border-2 border-titi-dark bg-white px-3.5 py-1.5 text-sm font-extrabold text-titi-dark shadow-[0_3px_0px_#1A1A2E] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_5px_0px_#1A1A2E] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-titi-yellow/60 active:translate-y-0.5 active:shadow-none"
          >
            Explorar cursos
            <ArrowRightIcon className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" />
          </Link>
        </header>

        <div className="grid flex-1 content-start items-center gap-y-2 pb-10 sm:content-center lg:grid-cols-2 lg:gap-x-16 lg:pb-16">
          {/* Escena: Titi + su red. Misma superficie que el formulario. */}
          <section className="flex flex-col items-center">
            <Tagline {...tagline} />
            <AuthScene
              className="auth-scene mt-6 w-[min(13.5rem,56vw)] sm:w-[16rem] lg:mt-6 lg:w-[clamp(17rem,calc(100vh-26rem),25rem)]"
              state={mascot.state}
              bubble={mascot.bubble}
              typingTick={typingTick}
            />
          </section>

          {/* Formulario sobre el mismo fondo. */}
          <section className="mx-auto mt-6 w-full max-w-md lg:mt-0">{children}</section>
        </div>
      </div>
    </div>
  );
}

// Encabezado del formulario: pastilla con punto "en vivo", título y subtítulo.
export function AuthHeading({ eyebrow, title, subtitle }) {
  return (
    <div className="text-center lg:text-left">
      <span className="auth-form-item inline-flex items-center gap-2 rounded-full bg-titi-dark px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-white">
        <span className="relative flex h-2 w-2" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-titi-yellow opacity-75 motion-reduce:animate-none" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-titi-yellow" />
        </span>
        {eyebrow}
      </span>
      <h1 className="auth-form-item mt-3 text-4xl font-black leading-tight text-titi-dark sm:text-5xl">{title}</h1>
      <p className="auth-form-item mt-2 text-base font-semibold text-gray-500">{subtitle}</p>
    </div>
  );
}

function GotaLoader() {
  return (
    <span className="flex items-end gap-1" aria-hidden="true">
      {[0, 0.15, 0.3].map((d) => (
        <span key={d} className="titi-hop" style={{ animationDelay: `${d}s` }}>
          <GotaIcon className="h-4 w-4" />
        </span>
      ))}
    </span>
  );
}

// Botón de envío: barrido sólido al hover, se hunde al press, loader de gotas al esperar.
export const AuthSubmitButton = forwardRef(function AuthSubmitButton({ loading, label, loadingLabel }, ref) {
  return (
    <button
      ref={ref}
      type="submit"
      disabled={loading}
      className="group relative flex h-14 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl border-2 border-titi-dark bg-titi-yellow text-lg font-extrabold text-titi-dark shadow-[0_5px_0px_#1A1A2E] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_7px_0px_#1A1A2E] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-titi-yellow-dark/40 active:translate-y-1 active:shadow-none disabled:cursor-wait disabled:hover:translate-y-0 disabled:hover:shadow-[0_5px_0px_#1A1A2E]"
    >
      {/* Barrido plano al hover (sólido, sin gradiente). */}
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-full origin-left scale-x-0 bg-titi-yellow-hover transition-transform duration-300 ease-out group-hover:scale-x-100 motion-reduce:transition-none"
      />
      <span className="relative flex items-center gap-2">
        {loading ? (
          <>
            <GotaLoader />
            {loadingLabel}
          </>
        ) : (
          <>
            {label}
            <ArrowRightIcon className="h-5 w-5 transition-transform duration-150 group-hover:translate-x-1" />
          </>
        )}
      </span>
    </button>
  );
});

export function PasswordToggle({ visible, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      aria-pressed={visible}
      className="relative grid h-10 w-10 place-items-center rounded-xl text-gray-400 transition-colors duration-150 hover:bg-titi-yellow-light hover:text-titi-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-titi-yellow-dark active:scale-[0.88]"
    >
      <EyeIcon
        className={`absolute h-5 w-5 transition-all duration-200 ${visible ? 'rotate-90 scale-50 opacity-0' : 'rotate-0 scale-100 opacity-100'}`}
      />
      <EyeOffIcon
        className={`absolute h-5 w-5 transition-all duration-200 ${visible ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-50 opacity-0'}`}
      />
    </button>
  );
}

export function ErrorBanner({ title, message, attempt }) {
  const ref = usePopIn([attempt], { scale: 0.92 });
  return (
    <div ref={ref} role="alert" className="flex items-start gap-3 rounded-2xl border-2 border-red-300 bg-red-50 p-3.5">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-red-500 text-white">
        <AlertIcon className="h-5 w-5" />
      </span>
      <div className="pt-0.5">
        <p className="text-sm font-extrabold text-red-700">{title}</p>
        <p className="mt-0.5 text-sm font-medium text-red-600">{message}</p>
      </div>
    </div>
  );
}

// Link inferior para pasar entre login y registro.
export function AuthSwitchLink({ prompt, to, label, state }) {
  return (
    <p className="auth-form-item mt-7 text-center text-sm font-semibold text-gray-500 lg:text-left">
      {prompt}{' '}
      <Link
        to={to}
        state={state}
        className="group relative inline-block font-extrabold text-titi-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-titi-yellow-dark"
      >
        {label}
        <span
          aria-hidden="true"
          className="absolute -bottom-0.5 left-0 h-[3px] w-full origin-left scale-x-100 rounded-full bg-titi-yellow transition-transform duration-300 group-hover:origin-right group-hover:scale-x-0"
        />
      </Link>
    </p>
  );
}

// Aviso de Bloq Mayús (va en el `hint` del campo de contraseña).
export function CapsLockHint() {
  return (
    <span className="titi-pop-in inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">
      <ArrowRightIcon className="h-3.5 w-3.5 -rotate-90" />
      Bloq Mayús está activado
    </span>
  );
}

// Lee el estado de Bloq Mayús desde un evento de teclado.
export function capsLockFrom(e) {
  return typeof e.getModifierState === 'function' ? e.getModifierState('CapsLock') : false;
}
