import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// Iconos inline para no agregar dependencias
const Icon = {
  Home: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 9.5 12 3l9 6.5V21a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1V9.5Z" />
    </svg>
  ),
  Compass: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="9" />
      <polygon points="15 9 13 13 9 15 11 11 15 9" />
    </svg>
  ),
  User: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  ),
  Logout: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
};

function navItemClass({ isActive }) {
  const base =
    'flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors';
  return isActive
    ? `${base} bg-neo-accent/15 text-neo-accent`
    : `${base} text-white/80 hover:bg-neo-card hover:text-white`;
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-neo-card/40 border-r border-neo-border flex flex-col z-20">
      {/* Logo */}
      <Link to="/feed" className="block px-6 py-6 border-b border-neo-border">
        <h1 className="text-2xl font-extrabold tracking-tight">
          Neo<span className="text-neo-accent">Social</span>
        </h1>
      </Link>

      {/* Navegación */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <NavLink to="/feed" className={navItemClass} end>
          <Icon.Home className="w-5 h-5" />
          <span>Feed</span>
        </NavLink>

        <NavLink to="/explore" className={navItemClass}>
          <Icon.Compass className="w-5 h-5" />
          <span>Explorar</span>
        </NavLink>

        {user?.username && (
          <NavLink to={`/profile/${user.username}`} className={navItemClass}>
            <Icon.User className="w-5 h-5" />
            <span>Mi perfil</span>
          </NavLink>
        )}
      </nav>

      {/* Usuario + logout */}
      <div className="border-t border-neo-border p-3 space-y-2">
        {user && (
          <Link
            to={`/profile/${user.username}`}
            className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-neo-card transition-colors"
          >
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.username}
                className="w-9 h-9 rounded-full bg-neo-bg border border-neo-border"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-neo-accent/20 text-neo-accent grid place-items-center font-bold">
                {user.username?.[0]?.toUpperCase() ?? '?'}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">@{user.username}</p>
              <p className="text-xs text-neo-muted truncate">Ver perfil</p>
            </div>
          </Link>
        )}

        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-2 rounded-xl text-white/80 hover:bg-neo-accent/10 hover:text-neo-accent transition-colors"
        >
          <Icon.Logout className="w-5 h-5" />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
}
