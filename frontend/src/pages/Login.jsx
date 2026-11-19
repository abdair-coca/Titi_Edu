import { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import AuthField from '../components/auth/AuthField.jsx';
import AuthLayout, {
  AuthHeading,
  AuthSubmitButton,
  AuthSwitchLink,
  CapsLockHint,
  EMAIL_RE,
  ErrorBanner,
  PasswordToggle,
  capsLockFrom,
  shake,
} from '../components/auth/AuthLayout.jsx';
import { LockIcon, MailIcon } from '../components/icons.jsx';

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

  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const submitRef = useRef(null);

  const emailValid = EMAIL_RE.test(email.trim());
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
      shake(submitRef.current);
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

  const updateCaps = (e) => setCapsLock(capsLockFrom(e));

  return (
    <AuthLayout
      tagline={{ first: 'Aprender es mejor', lead: 'con tus', highlight: 'amigos' }}
      mascot={mascot}
      typingTick={typingTick}
    >
      <AuthHeading
        eyebrow={hello}
        title="Entrá a tu cuenta"
        subtitle="Tus cursos, tu racha y tus amigos te están esperando."
      />

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
          hint={capsLock && <CapsLockHint />}
        />

        {error && <ErrorBanner title="No pudimos iniciar sesión" message={error} attempt={attempt} />}

        <div className="auth-form-item pt-1">
          <AuthSubmitButton ref={submitRef} loading={loading} label="Entrar" loadingLabel="Entrando" />
        </div>
      </form>

      <AuthSwitchLink prompt="¿Primera vez en Titi?" to="/register" label="Creá tu cuenta gratis" state={location.state} />
    </AuthLayout>
  );
}
