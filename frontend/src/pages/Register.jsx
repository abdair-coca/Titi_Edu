import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import TitiMascot from '../components/TitiMascot.jsx';

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
    if (!username.trim() || !email.trim() || !password) return 'Todos los campos son requeridos';
    if (!USERNAME_RE.test(username.trim())) return 'Username: 3-20 caracteres, solo letras, números y _';
    if (password.length < 6) return 'La contraseña debe tener al menos 6 caracteres';
    if (password !== confirm) return 'Las contraseñas no coinciden';
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    const v = validate();
    if (v) { setError(v); return; }
    try {
      await register(username.trim(), email.trim(), password);
      navigate('/feed', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error al crear cuenta');
    }
  }

  return (
    <div className="min-h-screen bg-titi-bg flex items-center justify-center px-4 py-10">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 max-w-5xl w-full items-center">
        {/* Form */}
        <div className="titi-card p-8 sm:p-10 order-2 lg:order-1">
          <div className="mb-6">
            <h1 className="text-3xl sm:text-4xl font-black mb-2 inline-flex items-center gap-2 flex-wrap">
              <span>¡Únete a Titi!</span>
              <img
                src="/Titi.png"
                alt=""
                aria-hidden="true"
                className="w-9 h-9 sm:w-10 sm:h-10 object-contain inline-block align-middle select-none"
                draggable={false}
                onError={(e) => (e.currentTarget.style.display = 'none')}
              />
            </h1>
            <p className="text-titi-muted">Empezá a compartir lo que te apasiona.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="username" className="block text-sm font-bold mb-1.5">Usuario</label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="titi-input"
                placeholder="tu_usuario"
                disabled={loading}
                required
              />
            </div>

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
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="titi-input"
                placeholder="Mínimo 6 caracteres"
                disabled={loading}
                required
              />
            </div>

            <div>
              <label htmlFor="confirm" className="block text-sm font-bold mb-1.5">Confirmar contraseña</label>
              <input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="titi-input"
                placeholder="Repetí la contraseña"
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
              {loading ? 'Creando cuenta…' : 'Crear cuenta'}
            </button>
          </form>

          <p className="text-center text-sm text-titi-muted mt-6">
            ¿Ya tenés cuenta?{' '}
            <Link to="/login" className="text-titi-blue hover:underline font-bold">
              Entrá
            </Link>
          </p>
        </div>

        {/* Titi mascot */}
        <div className="order-1 lg:order-2 flex justify-center">
          <TitiMascot
            mood="happy"
            message="¡Estoy emocionado de conocerte! 🚀"
            size="xl"
          />
        </div>
      </div>
    </div>
  );
}
