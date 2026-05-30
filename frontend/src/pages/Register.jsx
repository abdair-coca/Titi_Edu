import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export default function Register() {
  const { register, loading } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);

  function validate() {
    if (!username.trim() || !email.trim() || !password) {
      return 'Todos los campos son requeridos';
    }
    if (!USERNAME_RE.test(username.trim())) {
      return 'Username: 3-20 caracteres, solo letras, números y _';
    }
    if (password.length < 6) {
      return 'La contraseña debe tener al menos 6 caracteres';
    }
    if (password !== confirm) {
      return 'Las contraseñas no coinciden';
    }
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    const v = validate();
    if (v) {
      setError(v);
      return;
    }

    try {
      await register(username.trim(), email.trim(), password);
      navigate('/feed', { replace: true });
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Error al crear cuenta';
      setError(msg);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="neo-card w-full max-w-md p-8">
        <div className="text-center mb-8">
          <Link to="/" className="inline-block">
            <h1 className="text-3xl font-extrabold">
              Neo<span className="text-neo-accent">Social</span>
            </h1>
          </Link>
          <p className="text-neo-muted mt-2 text-sm">Creá tu cuenta gratis</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="username" className="block text-sm font-medium mb-1">
              Usuario
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="neo-input"
              placeholder="tu_usuario"
              disabled={loading}
              required
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="neo-input"
              placeholder="tu@email.com"
              disabled={loading}
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="neo-input"
              placeholder="Mínimo 6 caracteres"
              disabled={loading}
              required
            />
          </div>

          <div>
            <label htmlFor="confirm" className="block text-sm font-medium mb-1">
              Confirmar contraseña
            </label>
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="neo-input"
              placeholder="Repetí la contraseña"
              disabled={loading}
              required
            />
          </div>

          {error && (
            <div
              role="alert"
              className="text-sm bg-neo-accent/10 border border-neo-accent/40 text-neo-accent rounded-xl px-3 py-2"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="neo-btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creando cuenta…' : 'Crear cuenta'}
          </button>
        </form>

        <p className="text-center text-sm text-neo-muted mt-6">
          ¿Ya tenés cuenta?{' '}
          <Link to="/login" className="text-neo-accent hover:underline font-medium">
            Iniciá sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
