import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from || '/feed';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Email y contraseña son requeridos');
      return;
    }

    try {
      await login(email.trim(), password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Error al iniciar sesión';
      setError(msg);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="neo-card w-full max-w-md p-8">
        <div className="text-center mb-8">
          <Link to="/" className="inline-block">
            <h1 className="text-3xl font-extrabold">
              Neo<span className="text-neo-accent">Social</span>
            </h1>
          </Link>
          <p className="text-neo-muted mt-2 text-sm">Iniciá sesión para continuar</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
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
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="neo-input"
              placeholder="••••••••"
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
            {loading ? 'Ingresando…' : 'Iniciar sesión'}
          </button>
        </form>

        <p className="text-center text-sm text-neo-muted mt-6">
          ¿No tenés cuenta?{' '}
          <Link to="/register" className="text-neo-accent hover:underline font-medium">
            Registrate
          </Link>
        </p>
      </div>
    </div>
  );
}
