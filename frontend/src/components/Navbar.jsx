import { useEffect, useState } from 'react';
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import client from '../api/client.js';

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
  Bell: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  ),
};

// Hook que mantiene contador de no-leídas. Refresca al montar y cuando cambia la ruta.
function useUnreadNotifications() {
  const { isAuthenticated } = useAuth();
  const [count, setCount] = useState(0);
  const location = useLocation();

  useEffect(() => {
    if (!isAuthenticated) {
      setCount(0);
      return;
    }
    let cancelled = false;
    client
      .get('/api/notifications/unread/count')
      .then(({ data }) => {
        if (!cancelled && data?.success) setCount(data.data.unreadCount ?? 0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, location.pathname]);

  return count;
}

function NotifBadge({ count }) {
  if (!count) return null;
  return (
    <span
      aria-label={`${count} notificaciones no leídas`}
      className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full bg-neo-accent text-white text-[10px] font-bold leading-none tabular-nums"
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

// ---- Sidebar desktop (md+) ----

function sidebarItemClass({ isActive }) {
  const base = 'flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors';
  return isActive
    ? `${base} bg-neo-accent/15 text-neo-accent`
    : `${base} text-white/80 hover:bg-neo-card hover:text-white`;
}

function Sidebar({ user, onLogout, unread }) {
  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-screen w-64 bg-neo-card/40 border-r border-neo-border flex-col z-20">
      <Link to="/feed" className="block px-6 py-6 border-b border-neo-border">
        <h1 className="text-2xl font-extrabold tracking-tight">
          Neo<span className="text-neo-accent">Social</span>
        </h1>
      </Link>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <NavLink to="/feed" className={sidebarItemClass} end>
          <Icon.Home className="w-5 h-5" />
          <span>Feed</span>
        </NavLink>
        <NavLink to="/explore" className={sidebarItemClass}>
          <Icon.Compass className="w-5 h-5" />
          <span>Explorar</span>
        </NavLink>
        <NavLink to="/notifications" className={sidebarItemClass}>
          <span className="relative inline-flex">
            <Icon.Bell className="w-5 h-5" />
            <NotifBadge count={unread} />
          </span>
          <span>Notificaciones</span>
        </NavLink>
        {user?.username && (
          <NavLink to={`/profile/${user.username}`} className={sidebarItemClass}>
            <Icon.User className="w-5 h-5" />
            <span>Mi perfil</span>
          </NavLink>
        )}
      </nav>

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
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-2 rounded-xl text-white/80 hover:bg-neo-accent/10 hover:text-neo-accent transition-colors"
        >
          <Icon.Logout className="w-5 h-5" />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
}

// ---- Top bar móvil ----

function MobileTopBar({ onLogout, unread }) {
  return (
    <header
      className="md:hidden fixed top-0 left-0 right-0 z-30 h-14 bg-neo-card/95 backdrop-blur border-b border-neo-border"
    >
      <div className="h-full px-4 flex items-center justify-between gap-2">
        <Link to="/feed" className="font-extrabold text-xl tracking-tight">
          Neo<span className="text-neo-accent">Social</span>
        </Link>
        <div className="flex items-center gap-1">
          <Link
            to="/notifications"
            aria-label="Notificaciones"
            className="relative p-2 rounded-full text-white/80 hover:text-neo-accent hover:bg-neo-accent/10 transition-colors"
          >
            <Icon.Bell className="w-5 h-5" />
            <NotifBadge count={unread} />
          </Link>
          <button
            type="button"
            onClick={onLogout}
            aria-label="Cerrar sesión"
            className="-mr-2 p-2 rounded-full text-white/80 hover:text-neo-accent hover:bg-neo-accent/10 transition-colors"
          >
            <Icon.Logout className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}

// ---- Bottom nav móvil ----

function bottomItemClass({ isActive }) {
  const base =
    'flex flex-col items-center justify-center gap-0.5 h-full text-xs font-medium transition-colors';
  return isActive
    ? `${base} text-neo-accent`
    : `${base} text-white/70 hover:text-white`;
}

function MobileBottomNav({ user, unread }) {
  return (
    <nav
      aria-label="Navegación principal"
      className="md:hidden fixed bottom-0 left-0 right-0 z-30 h-16 bg-neo-card/95 backdrop-blur border-t border-neo-border"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="grid grid-cols-4 h-full">
        <NavLink to="/feed" className={bottomItemClass} end>
          <Icon.Home className="w-6 h-6" />
          <span>Feed</span>
        </NavLink>
        <NavLink to="/explore" className={bottomItemClass}>
          <Icon.Compass className="w-6 h-6" />
          <span>Explorar</span>
        </NavLink>
        <NavLink to="/notifications" className={bottomItemClass}>
          <span className="relative inline-flex">
            <Icon.Bell className="w-6 h-6" />
            <NotifBadge count={unread} />
          </span>
          <span>Alertas</span>
        </NavLink>
        <NavLink
          to={user?.username ? `/profile/${user.username}` : '/feed'}
          className={bottomItemClass}
        >
          <Icon.User className="w-6 h-6" />
          <span>Perfil</span>
        </NavLink>
      </div>
    </nav>
  );
}

// ---- Componente principal ----

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const unread = useUnreadNotifications();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <>
      <Sidebar user={user} onLogout={handleLogout} unread={unread} />
      <MobileTopBar onLogout={handleLogout} unread={unread} />
      <MobileBottomNav user={user} unread={unread} />
    </>
  );
}
