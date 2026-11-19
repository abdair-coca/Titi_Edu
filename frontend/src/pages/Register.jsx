import { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import AuthField from '../components/auth/AuthField.jsx';
import PasswordStrength, { MIN_PASSWORD, passwordScore } from '../components/auth/PasswordStrength.jsx';
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
import { LockIcon, MailIcon, ShieldIcon, UserIcon } from '../components/icons.jsx';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

// Titi acompaña cada paso del registro.
function mascotFor({ loading, error, focus, showPassword, v }) {
  if (loading) return { state: 'pensando', bubble: 'Creando tu cuenta…' };
  if (error) return { state: 'triste', bubble: 'Algo salió mal. Revisemos juntos' };
  if (focus === 'username') {
    return v.usernameOk
      ? { state: 'idle', bubble: `@${v.username} suena genial` }
      : { state: 'idle', bubble: '¿Cómo te van a encontrar tus amigos?' };
  }
  if (focus === 'email') {
    return v.emailOk
      ? { state: 'idle', bubble: '¡Perfecto! Ahora una contraseña' }
      : { state: 'idle', bubble: 'Tu email, para entrar después' };
  }
  if (focus === 'password') {
    if (showPassword) return { state: 'pensando', bubble: 'Ojo, tu contraseña está a la vista' };
    if (v.score >= 4) return { state: 'celebra', bubble: '¡Esa contraseña es fuerte!' };
    if (v.score === 3) return { state: 'idle', bubble: '¡Buena! Un detalle más y es fuerte' };
    if (v.passwordOk) return { state: 'pensando', bubble: 'Sumale números o una mayúscula' };
    return { state: 'pensando', bubble: 'Elegí una contraseña. No miro' };
  }
  if (focus === 'confirm') {
    if (v.confirmOk) return { state: 'celebra', bubble: '¡Coinciden! Ya casi' };
    if (v.confirmMismatch) return { state: 'triste', bubble: 'Mmm, todavía no coinciden' };
    return { state: 'pensando', bubble: 'Repetila para estar seguros' };
  }
  if (v.allOk) return { state: 'celebra', bubble: '¡Todo listo! Dale a crear' };
  return { state: 'saludo', bubble: '¡Hola! Armemos tu cuenta' };
}

// Progreso del formulario: 4 segmentos que se llenan a medida que cada campo queda listo.
function FormProgress({ done }) {
  return (
    <div className="auth-form-item mt-5 flex items-center gap-3">
      <div
        className="flex flex-1 gap-1.5"
        role="progressbar"
        aria-label="Campos completos"
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuenow={done}
      >
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className="h-2 flex-1 overflow-hidden rounded-full border border-titi-dark/10 bg-white">
            <span
              className={`block h-full origin-left bg-titi-yellow transition-transform duration-300 ease-out motion-reduce:transition-none ${
                i <= done ? 'scale-x-100' : 'scale-x-0'
              }`}
            />
          </span>
        ))}
      </div>
      <span className="text-xs font-extrabold tabular-nums text-gray-500">
        {done === 4 ? '¡Listo!' : `${done} de 4`}
      </span>
    </div>
  );
}

export default function Register() {
  const { register, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from || '/feed';

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [focus, setFocus] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [typingTick, setTypingTick] = useState(0);

  const refs = {
    username: useRef(null),
    email: useRef(null),
    password: useRef(null),
    confirm: useRef(null),
  };
  const submitRef = useRef(null);

  const usernameOk = USERNAME_RE.test(username.trim());
  const emailOk = EMAIL_RE.test(email.trim());
  const passwordOk = password.length >= MIN_PASSWORD;
  const confirmOk = Boolean(confirm) && confirm === password;
  const v = {
    username: username.trim(),
    usernameOk,
    emailOk,
    passwordOk,
    score: passwordScore(password),
    confirmOk,
    confirmMismatch: Boolean(confirm) && confirm.length >= password.length && confirm !== password,
    allOk: usernameOk && emailOk && passwordOk && confirmOk,
  };
  const done = [usernameOk, emailOk, passwordOk, confirmOk].filter(Boolean).length;
  const mascot = mascotFor({ loading, error, focus, showPassword, v });

  function validate() {
    const next = {};
    if (!username.trim()) next.username = 'Elegí un nombre de usuario';
    else if (!usernameOk) next.username = 'De 3 a 20 caracteres: letras, números y _';
    if (!email.trim()) next.email = 'Escribí tu email';
    else if (!emailOk) next.email = 'Ese email no parece válido';
    if (!password) next.password = 'Elegí una contraseña';
    else if (!passwordOk) next.password = `Usá al menos ${MIN_PASSWORD} caracteres`;
    if (!confirm) next.confirm = 'Repetí tu contraseña';
    else if (!confirmOk) next.confirm = 'Las contraseñas no coinciden';
    return next;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setAttempt((n) => n + 1);
    const next = validate();
    setFieldErrors(next);
    const firstInvalid = ['username', 'email', 'password', 'confirm'].find((k) => next[k]);
    if (firstInvalid) return refs[firstInvalid].current?.focus();

    try {
      await register(username.trim(), email.trim(), password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Revisá tu conexión e intentá de nuevo.');
      shake(submitRef.current);
    }
  }

  function onField(setter, key, transform = (x) => x) {
    return (e) => {
      setter(transform(e.target.value));
      setTypingTick((t) => t + 1);
      if (fieldErrors[key]) setFieldErrors((f) => ({ ...f, [key]: undefined }));
      if (error) setError(null);
    };
  }

  const focusProps = (key) => ({
    onFocus: () => setFocus(key),
    onBlur: () => {
      setFocus(null);
      setCapsLock(false);
    },
  });
  const updateCaps = (e) => setCapsLock(capsLockFrom(e));
  const passwordType = showPassword ? 'text' : 'password';

  return (
    <AuthLayout
      tagline={{ first: 'Tu universidad,', lead: 'ahora en', highlight: 'red' }}
      mascot={mascot}
      typingTick={typingTick}
    >
      <AuthHeading
        eyebrow="Nuevo en Titi"
        title="Creá tu cuenta"
        subtitle="Seguí a tus amigos, sumá gotas y aprendé en compañía."
      />
      <FormProgress done={done} />

      <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
        <AuthField
          className="auth-form-item"
          id="username"
          label="Usuario"
          icon={UserIcon}
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={20}
          inputRef={refs.username}
          value={username}
          valid={usernameOk}
          // Los espacios se convierten en "_" al escribir: el usuario no puede tenerlos.
          onChange={onField(setUsername, 'username', (x) => x.replace(/\s/g, '_'))}
          {...focusProps('username')}
          error={fieldErrors.username}
          shakeKey={attempt}
          disabled={loading}
          hint={
            focus === 'username' &&
            !usernameOk && (
              <p className="titi-pop-in text-xs font-bold text-gray-500">
                De 3 a 20 caracteres: letras, números y _{' '}
                <span className="tabular-nums text-gray-400">({username.length}/20)</span>
              </p>
            )
          }
        />

        <AuthField
          className="auth-form-item"
          id="email"
          label="Email"
          icon={MailIcon}
          type="email"
          autoComplete="email"
          inputMode="email"
          inputRef={refs.email}
          value={email}
          valid={emailOk}
          onChange={onField(setEmail, 'email')}
          {...focusProps('email')}
          error={fieldErrors.email}
          shakeKey={attempt}
          disabled={loading}
        />

        <AuthField
          className="auth-form-item"
          id="password"
          label="Contraseña"
          icon={LockIcon}
          type={passwordType}
          autoComplete="new-password"
          inputRef={refs.password}
          value={password}
          onChange={onField(setPassword, 'password')}
          {...focusProps('password')}
          onKeyDown={updateCaps}
          onKeyUp={updateCaps}
          error={fieldErrors.password}
          shakeKey={attempt}
          disabled={loading}
          trailing={<PasswordToggle visible={showPassword} onToggle={() => setShowPassword((s) => !s)} />}
          hint={
            (password || focus === 'password') && (
              <div className="space-y-2">
                <PasswordStrength password={password} />
                {capsLock && <CapsLockHint />}
              </div>
            )
          }
        />

        <AuthField
          className="auth-form-item"
          id="confirm"
          label="Repetí la contraseña"
          icon={ShieldIcon}
          type={passwordType}
          autoComplete="new-password"
          inputRef={refs.confirm}
          value={confirm}
          valid={confirmOk}
          onChange={onField(setConfirm, 'confirm')}
          {...focusProps('confirm')}
          onKeyDown={updateCaps}
          onKeyUp={updateCaps}
          error={fieldErrors.confirm}
          shakeKey={attempt}
          disabled={loading}
          hint={
            v.confirmMismatch ? (
              <p className="titi-pop-in text-xs font-bold text-titi-streak">Todavía no coinciden</p>
            ) : (
              focus === 'confirm' && capsLock && <CapsLockHint />
            )
          }
        />

        {error && <ErrorBanner title="No pudimos crear tu cuenta" message={error} attempt={attempt} />}

        <div className="auth-form-item pt-1">
          <AuthSubmitButton ref={submitRef} loading={loading} label="Crear mi cuenta" loadingLabel="Creando tu cuenta" />
        </div>
      </form>

      <AuthSwitchLink prompt="¿Ya tenés cuenta?" to="/login" label="Entrá" state={location.state} />
    </AuthLayout>
  );
}
