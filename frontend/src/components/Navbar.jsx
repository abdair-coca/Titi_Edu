import { useEffect, useState } from 'react';
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import client from '../api/client.js';

// ---- Iconos inline ----
const Icon = {
  Home: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 9.5 12 3l9 6.5V21a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1V9.5Z" />
    </svg>
  ),
  Compass: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="9" />
      <polygon points="15 9 13 13 9 15 11 11 15 9" />
    </svg>
  ),
  User: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  ),
  Logout: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  Bell: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  ),
  Books: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
    </svg>
  ),
  Target: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" />
    </svg>
  ),
};

function useUnreadNotifications() {
  const { isAuthenticated } = useAuth();
  const [count, setCount] = useState(0);
  const location = useLocation();
  useEffect(() => {
    if (!isAuthenticated) { setCount(0); return; }
    let cancelled = false;
    client.get('/api/notifications/unread/count')
      .then(({ data }) => { if (!cancelled && data?.success) setCount(data.data.unreadCount ?? 0); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isAuthenticated, location.pathname]);
  return count;
}

function NotifBadge({ count }) {
  if (!count) return null;
  return (
    <span
      aria-label={`${count} notificaciones no leídas`}
      className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full bg-titi-red text-white text-[10px] font-extrabold leading-none tabular-nums shadow"
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

// ---- Logo Titi ----
function TitiLogo({ size = 'md' }) {
  const s = size === 'lg' ? 'w-10 h-10' : size === 'sm' ? 'w-7 h-7' : 'w-9 h-9';
  const text = size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-xl' : 'text-2xl';
  return (
    <span className="inline-flex items-center gap-2">
      <img
        src="/favicon.png"
        alt=""
        className={`${s} object-contain select-none`}
        draggable={false}
        onError={(e) => (e.currentTarget.style.display = 'none')}
      />
      <span className={`${text} font-extrabold lowercase tracking-tight`}>titi</span>
    </span>
  );
}

// ---- Sidebar desktop ----
function sidebarItemClass({ isActive }) {
  const base = 'flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all';
  return isActive
    ? `${base} bg-titi-yellow text-titi-dark shadow-titi`
    : `${base} text-white/85 hover:bg-white/10 hover:text-white`;
}

function Sidebar({ user, onLogout, unread }) {
  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-screen w-64 bg-titi-dark border-r border-titi-dark flex-col z-20 text-white">
      <Link to="/feed" className="block px-6 py-6 border-b border-white/10">
        <TitiLogo size="lg" />
      </Link>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <NavLink to="/feed" className={sidebarItemClass} end>
          <Icon.Home className="w-5 h-5" />
          <span>Inicio</span>
        </NavLink>
        <NavLink to="/explore" className={sidebarItemClass}>
          <Icon.Compass className="w-5 h-5" />
          <span>Explorar</span>
        </NavLink>
        <NavLink to="/courses" className={sidebarItemClass}>
          <Icon.Books className="w-5 h-5" />
          <span>Cursos</span>
        </NavLink>
        <NavLink to="/my-courses" className={sidebarItemClass}>
          <Icon.Target className="w-5 h-5" />
          <span>Mis cursos</span>
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

      <div className="border-t border-white/10 p-3 space-y-2">
        {user && (
          <Link
            to={`/profile/${user.username}`}
            className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/10 transition-colors"
          >
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.username}
                className="w-9 h-9 rounded-full bg-titi-dark border-2 border-titi-yellow"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-titi-yellow text-titi-dark grid place-items-center font-extrabold">
                {user.username?.[0]?.toUpperCase() ?? '?'}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-bold truncate">@{user.username}</p>
              <p className="text-xs text-white/60 truncate">Ver perfil</p>
            </div>
          </Link>
        )}
        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-2 rounded-xl text-white/85 hover:bg-titi-red/20 hover:text-titi-red transition-colors font-bold"
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
    <header className="md:hidden fixed top-0 left-0 right-0 z-30 h-14 bg-titi-dark text-white border-b border-titi-dark shadow-titi">
      <div className="h-full px-4 flex items-center justify-between gap-2">
        <Link to="/feed">
          <TitiLogo size="md" />
        </Link>
        <div className="flex items-center gap-1">
          <Link
            to="/notifications"
            aria-label="Notificaciones"
            className="relative p-2 rounded-full text-white/85 hover:text-titi-yellow hover:bg-white/10 transition-colors"
          >
            <Icon.Bell className="w-5 h-5" />
            <NotifBadge count={unread} />
          </Link>
          <button
            type="button"
            onClick={onLogout}
            aria-label="Cerrar sesión"
            className="-mr-2 p-2 rounded-full text-white/85 hover:text-titi-red hover:bg-white/10 transition-colors"
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
  const base = 'flex flex-col items-center justify-center gap-0.5 h-full text-xs font-bold transition-colors';
  return isActive
    ? `${base} text-titi-yellow`
    : `${base} text-white/70 hover:text-white`;
}

function MobileBottomNav({ user, unread }) {
  return (
    <nav
      aria-label="Navegación principal"
      className="md:hidden fixed bottom-0 left-0 right-0 z-30 h-16 bg-titi-dark text-white border-t border-titi-dark shadow-titi-lg"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="grid grid-cols-5 h-full">
        <NavLink to="/feed" className={bottomItemClass} end>
          <Icon.Home className="w-6 h-6" />
          <span>Inicio</span>
        </NavLink>
        <NavLink to="/explore" className={bottomItemClass}>
          <Icon.Compass className="w-6 h-6" />
          <span>Explorar</span>
        </NavLink>
        <NavLink to="/courses" className={bottomItemClass}>
          <Icon.Books className="w-6 h-6" />
          <span>Cursos</span>
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
