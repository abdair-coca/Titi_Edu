import { useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { useAuth } from '../context/AuthContext.jsx';
import { MOTION, usePopIn } from '../lib/motion.js';
import AuthField from '../components/auth/AuthField.jsx';
import AuthScene from '../components/auth/AuthScene.jsx';
import {
  AlertIcon,
  ArrowRightIcon,
  BookIcon,
  EyeIcon,
  EyeOffIcon,
  GotaIcon,
  LightbulbIcon,
  LockIcon,
  MailIcon,
  SparklesIcon,
  StarIcon,
} from '../components/icons.jsx';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function greeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Buenos días';
  if (h >= 12 && h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

// Titi reacciona a lo que pasa en el formulario.
function mascotFor({ loading, error, focus, showPassword, emailValid, hasPassword }) {
  if (loading) return { state: 'pensando', bubble: 'Buscando tu cuenta…' };
  if (error) return { state: 'triste', bubble: 'Algo no coincide. ¡Probemos de nuevo!' };
  if (focus === 'password' && showPassword) return { state: 'pensando', bubble: 'Ojo, tu contraseña está a la vista' };
  if (focus === 'password' && hasPassword) return { state: 'pensando', bubble: 'Tranqui, no estoy mirando' };
  if (focus === 'password') return { state: 'pensando', bubble: 'Ahora tu contraseña. Cierro los ojos' };
  if (focus === 'email' && emailValid) return { state: 'idle', bubble: '¡Ese email se ve bien!' };
  if (focus === 'email') return { state: 'idle', bubble: 'Escribí tu email y seguimos' };
  return { state: 'saludo', bubble: '¡Hola de nuevo! Tocame' };
}

// Fondo único de la página: formas planas, grilla de puntos y doodles que flotan.
// Todo vive en la misma superficie que Titi y el formulario (no hay paneles).
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
          <pattern id="login-dots" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.4" fill="currentColor" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#login-dots)" />
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

function PasswordToggle({ visible, onToggle }) {
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

function ErrorBanner({ message, attempt }) {
  const ref = usePopIn([attempt], { scale: 0.92 });
  return (
    <div ref={ref} role="alert" className="flex items-start gap-3 rounded-2xl border-2 border-red-300 bg-red-50 p-3.5">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-red-500 text-white">
        <AlertIcon className="h-5 w-5" />
      </span>
      <div className="pt-0.5">
        <p className="text-sm font-extrabold text-red-700">No pudimos iniciar sesión</p>
        <p className="mt-0.5 text-sm font-medium text-red-600">{message}</p>
      </div>
    </div>
  );
}

export default function Login() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from || '/feed';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [focus, setFocus] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [typingTick, setTypingTick] = useState(0);
  const [hello] = useState(greeting);

  const scope = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const submitRef = useRef(null);

  const emailValid = EMAIL_RE.test(email.trim());

  // Entrada coreografiada sobre una sola superficie: Titi y su disco → chips →
  // titular → formulario escalonado. Cada tramo ≤ 400ms; stagger acotado.
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

  const mascot = mascotFor({ loading, error, focus, showPassword, emailValid, hasPassword: Boolean(password) });

  function validate() {
    const next = {};
    if (!email.trim()) next.email = 'Escribí tu email';
    else if (!emailValid) next.email = 'Ese email no parece válido';
    if (!password) next.password = 'Escribí tu contraseña';
    return next;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setAttempt((n) => n + 1);
    const next = validate();
    setFieldErrors(next);
    if (next.email) return emailRef.current?.focus();
    if (next.password) return passwordRef.current?.focus();

    try {
      await login(email.trim(), password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Revisá tu conexión e intentá de nuevo.');
      if (!prefersReducedMotion() && submitRef.current) {
        gsap.fromTo(submitRef.current, { x: 0 }, { keyframes: { x: [-6, 5, -3, 2, 0] }, duration: 0.3, ease: 'none' });
      }
    }
  }

  function onField(setter, key) {
    return (e) => {
      setter(e.target.value);
      setTypingTick((t) => t + 1);
      if (fieldErrors[key]) setFieldErrors((f) => ({ ...f, [key]: undefined }));
      if (error) setError(null);
    };
  }

  function updateCaps(e) {
    if (typeof e.getModifierState === 'function') setCapsLock(e.getModifierState('CapsLock'));
  }

  return (
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
            <h2 className="mb-8 hidden text-center text-4xl font-black leading-[1.1] text-titi-dark lg:block xl:text-5xl">
              Aprender es mejor
              <br />
              con tus{' '}
              <span className="relative inline-block">
                amigos
                <svg aria-hidden="true" viewBox="0 0 160 14" preserveAspectRatio="none" className="absolute -bottom-2.5 left-0 h-3.5 w-full text-titi-yellow-dark">
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
            <AuthScene
              className="auth-scene mt-6 w-[min(13.5rem,56vw)] sm:w-[16rem] lg:mt-6 lg:w-[clamp(17rem,calc(100vh-26rem),25rem)]"
              state={mascot.state}
              bubble={mascot.bubble}
              typingTick={typingTick}
            />
          </section>

          {/* Formulario sobre el mismo fondo. */}
          <section className="mx-auto mt-6 w-full max-w-md lg:mt-0">
            <div className="text-center lg:text-left">
              <span className="auth-form-item inline-flex items-center gap-2 rounded-full bg-titi-dark px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-white">
                <span className="relative flex h-2 w-2" aria-hidden="true">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-titi-yellow opacity-75 motion-reduce:animate-none" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-titi-yellow" />
                </span>
                {hello}
              </span>
              <h1 className="auth-form-item mt-3 text-4xl font-black leading-tight text-titi-dark sm:text-5xl">
                Entrá a tu cuenta
              </h1>
              <p className="auth-form-item mt-2 text-base font-semibold text-gray-500">
                Tus cursos, tu racha y tus amigos te están esperando.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-7 space-y-4" noValidate>
              <AuthField
                className="auth-form-item"
                id="email"
                label="Email"
                icon={MailIcon}
                type="email"
                autoComplete="email"
                inputMode="email"
                inputRef={emailRef}
                value={email}
                valid={emailValid}
                onChange={onField(setEmail, 'email')}
                onFocus={() => setFocus('email')}
                onBlur={() => setFocus(null)}
                error={fieldErrors.email}
                shakeKey={attempt}
                disabled={loading}
              />

              <AuthField
                className="auth-form-item"
                id="password"
                label="Contraseña"
                icon={LockIcon}
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                inputRef={passwordRef}
                value={password}
                onChange={onField(setPassword, 'password')}
                onFocus={() => setFocus('password')}
                onBlur={() => {
                  setFocus(null);
                  setCapsLock(false);
                }}
                onKeyDown={updateCaps}
                onKeyUp={updateCaps}
                error={fieldErrors.password}
                shakeKey={attempt}
                disabled={loading}
                trailing={<PasswordToggle visible={showPassword} onToggle={() => setShowPassword((v) => !v)} />}
                hint={
                  capsLock && (
                    <span className="titi-pop-in inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">
                      <ArrowRightIcon className="h-3.5 w-3.5 -rotate-90" />
                      Bloq Mayús está activado
                    </span>
                  )
                }
              />

              {error && <ErrorBanner message={error} attempt={attempt} />}

              <div className="auth-form-item pt-1">
                <button
                  ref={submitRef}
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
                        Entrando
                      </>
                    ) : (
                      <>
                        Entrar
                        <ArrowRightIcon className="h-5 w-5 transition-transform duration-150 group-hover:translate-x-1" />
                      </>
                    )}
                  </span>
                </button>
              </div>
            </form>

            <p className="auth-form-item mt-7 text-center text-sm font-semibold text-gray-500 lg:text-left">
              ¿Primera vez en Titi?{' '}
              <Link
                to="/register"
                state={location.state}
                className="group relative inline-block font-extrabold text-titi-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-titi-yellow-dark"
              >
                Creá tu cuenta gratis
                <span
                  aria-hidden="true"
                  className="absolute -bottom-0.5 left-0 h-[3px] w-full origin-left scale-x-100 rounded-full bg-titi-yellow transition-transform duration-300 group-hover:scale-x-0 group-hover:origin-right"
                />
              </Link>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
