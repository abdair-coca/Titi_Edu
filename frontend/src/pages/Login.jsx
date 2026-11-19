import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { useAuth } from '../context/AuthContext.jsx';
import { MOTION, usePopIn } from '../lib/motion.js';
import AuthField from '../components/auth/AuthField.jsx';
import { AuthBrandPanel, AuthMobileHeader } from '../components/auth/AuthBrandPanel.jsx';
import { AlertIcon, ArrowRightIcon, EyeIcon, EyeOffIcon, LockIcon, MailIcon } from '../components/icons.jsx';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Solo un Titi montado a la vez: panel en desktop, cabecera en móvil.
function useIsDesktop() {
  const query = '(min-width: 1024px)';
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return matches;
}

// Titi reacciona a lo que pasa en el formulario.
function mascotFor({ loading, error, focus, showPassword }) {
  if (loading) return { state: 'pensando', bubble: 'Buscando tu cuenta…' };
  if (error) return { state: 'triste', bubble: 'Algo no coincide. ¡Probemos de nuevo!' };
  if (focus === 'password' && showPassword) return { state: 'pensando', bubble: 'Ojo, tu contraseña está a la vista' };
  if (focus === 'password') return { state: 'pensando', bubble: 'Tranqui, no estoy mirando' };
  if (focus === 'email') return { state: 'idle', bubble: 'Escribí tu email y seguimos' };
  return { state: 'saludo', bubble: '¡Hola de nuevo!' };
}

function Spinner() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function PasswordToggle({ visible, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      aria-pressed={visible}
      className="relative grid h-10 w-10 place-items-center rounded-xl text-gray-400 transition-colors duration-150 hover:bg-titi-cream hover:text-titi-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-titi-yellow active:scale-[0.92]"
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
  const ref = usePopIn([attempt], { scale: 0.95 });
  return (
    <div ref={ref} role="alert" className="flex items-start gap-3 rounded-2xl border-2 border-red-200 bg-red-50 p-4">
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
  const isDesktop = useIsDesktop();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [focus, setFocus] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);

  const scope = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  // Entrada coreografiada: panel → titular → subrayado → chips, y el formulario
  // escalonado en paralelo. Cada tramo ≤ 400ms; stagger acotado.
  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      const q = gsap.utils.selector(scope);
      const tl = gsap.timeline({ defaults: { ease: MOTION.ease.pop, duration: MOTION.dur.base } });
      const clear = 'transform,opacity,visibility';

      tl.fromTo(q('.auth-panel'), { scale: 0.97, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, clearProps: clear });
      if (q('.auth-headline-line').length) {
        tl.fromTo(
          q('.auth-headline-line'),
          { y: 18, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, stagger: 0.08, clearProps: clear },
          '-=0.15',
        );
        tl.fromTo(
          q('.auth-underline'),
          { strokeDashoffset: 1 },
          { strokeDashoffset: 0, duration: MOTION.dur.slow, ease: MOTION.ease.out },
          '-=0.1',
        );
        tl.fromTo(
          q('.auth-chip'),
          { scale: 0.6, autoAlpha: 0 },
          { scale: 1, autoAlpha: 1, stagger: 0.1, clearProps: clear },
          '-=0.25',
        );
        tl.fromTo(
          q('.auth-feature'),
          { y: 12, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, stagger: 0.06, ease: MOTION.ease.out, clearProps: clear },
          '-=0.2',
        );
      }
      gsap.fromTo(
        q('.auth-form-item'),
        { y: 16, autoAlpha: 0 },
        {
          y: 0,
          autoAlpha: 1,
          duration: MOTION.dur.base,
          ease: MOTION.ease.pop,
          stagger: { amount: 0.3 },
          delay: 0.1,
          clearProps: clear,
        },
      );
    },
    { scope, dependencies: [isDesktop] },
  );

  const mascot = mascotFor({ loading, error, focus, showPassword });

  function validate() {
    const next = {};
    if (!email.trim()) next.email = 'Escribí tu email';
    else if (!EMAIL_RE.test(email.trim())) next.email = 'Ese email no parece válido';
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
    }
  }

  function updateCaps(e) {
    if (typeof e.getModifierState === 'function') setCapsLock(e.getModifierState('CapsLock'));
  }

  return (
    <div ref={scope} className="min-h-screen bg-titi-cream lg:grid lg:h-screen lg:grid-cols-[minmax(0,46fr)_minmax(0,54fr)]">
      {isDesktop && (
        <div className="hidden p-4 lg:block">
          <AuthBrandPanel mascotState={mascot.state} bubble={mascot.bubble} />
        </div>
      )}

      <main className="flex min-h-screen flex-col px-4 py-6 sm:px-8 lg:min-h-0 lg:overflow-y-auto lg:px-12">
        {!isDesktop && (
          <div className="mx-auto w-full max-w-md">
            <AuthMobileHeader mascotState={mascot.state} bubble={mascot.bubble} />
          </div>
        )}

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-8 lg:py-12">
          <Link
            to="/courses"
            className="auth-form-item group mb-10 hidden items-center gap-2 self-start rounded-lg text-sm font-bold text-gray-500 transition-colors hover:text-titi-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-titi-yellow lg:inline-flex"
          >
            <ArrowRightIcon className="h-4 w-4 rotate-180 transition-transform duration-150 group-hover:-translate-x-1" />
            Volver al catálogo
          </Link>

          <span className="auth-form-item inline-flex items-center gap-2 self-start rounded-full bg-titi-yellow-light px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-titi-dark">
            <span className="h-2 w-2 rounded-full bg-titi-yellow-dark" aria-hidden="true" />
            Bienvenido de vuelta
          </span>
          <h1 className="auth-form-item mt-4 text-4xl font-black leading-tight text-titi-dark sm:text-5xl">
            Entrá a tu cuenta
          </h1>
          <p className="auth-form-item mt-3 text-base font-semibold text-gray-500">
            Tus cursos, tu racha y tus amigos te están esperando.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
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
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) setFieldErrors((f) => ({ ...f, email: undefined }));
                if (error) setError(null);
              }}
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
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) setFieldErrors((f) => ({ ...f, password: undefined }));
                if (error) setError(null);
              }}
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
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">
                    <ArrowRightIcon className="h-3.5 w-3.5 -rotate-90" />
                    Bloq Mayús está activado
                  </span>
                )
              }
            />

            {error && <ErrorBanner message={error} attempt={attempt} />}

            <div className="auth-form-item pt-1">
              <button
                type="submit"
                disabled={loading}
                className="group titi-btn-primary h-14 w-full text-lg font-extrabold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-titi-yellow/40 disabled:hover:translate-y-0"
              >
                {loading ? (
                  <>
                    <Spinner />
                    Entrando…
                  </>
                ) : (
                  <>
                    Entrar
                    <ArrowRightIcon className="h-5 w-5 transition-transform duration-150 group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="auth-form-item mt-8 flex items-center gap-4" aria-hidden="true">
            <span className="h-px flex-1 bg-gray-200" />
            <span className="text-xs font-extrabold uppercase tracking-wide text-gray-400">¿Primera vez en Titi?</span>
            <span className="h-px flex-1 bg-gray-200" />
          </div>

          <Link
            to="/register"
            state={location.state}
            className="auth-form-item titi-btn-ghost mt-5 h-12 w-full text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-titi-yellow"
          >
            Crear mi cuenta gratis
          </Link>
        </div>
      </main>
    </div>
  );
}
