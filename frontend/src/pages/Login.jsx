import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import TitiMascot from '../components/TitiMascot.jsx';

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
    <div className="min-h-screen bg-titi-bg flex items-center justify-center px-4 py-10">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 max-w-5xl w-full items-center">
        {/* Form */}
        <div className="titi-card p-8 sm:p-10 order-2 lg:order-1">
          <div className="mb-6">
            <Link to="/" className="inline-flex items-center gap-2 mb-6">
              <img src="/Titi.png" alt="" className="w-10 h-10 object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
              <span className="text-2xl font-extrabold lowercase tracking-tight">titi</span>
            </Link>
            <h1 className="text-3xl sm:text-4xl font-extrabold mb-2">
              ¡Hola de nuevo! <span aria-hidden="true">👋</span>
            </h1>
            <p className="text-titi-muted">Entrá a tu cuenta para seguir conectándote.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="email" className="block text-sm font-bold mb-1.5">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="titi-input"
                placeholder="tu@email.com"
                disabled={loading}
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-bold mb-1.5">Contraseña</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="titi-input"
                placeholder="••••••••"
                disabled={loading}
                required
              />
            </div>

            {error && (
              <div
                role="alert"
                className="text-sm bg-titi-red/10 border-2 border-titi-red/40 text-titi-red rounded-xl px-4 py-2.5 font-semibold"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="titi-btn-primary w-full text-lg py-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
          </form>

          <p className="text-center text-sm text-titi-muted mt-6">
            ¿Todavía no tenés cuenta?{' '}
            <Link to="/register" className="text-titi-blue hover:underline font-bold">
              Creá una
            </Link>
          </p>
        </div>

        {/* Titi mascot */}
        <div className="order-1 lg:order-2 flex justify-center">
          <TitiMascot
            mood="happy"
            message="¡Bienvenido a Titi! 🎉"
            size="xl"
          />
        </div>
      </div>
    </div>
  );
}
