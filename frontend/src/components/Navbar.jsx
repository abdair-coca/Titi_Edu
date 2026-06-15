import { useEffect, useState } from 'react';
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import client from '../api/client.js';
import StreakBadge, { FlameIcon } from './StreakBadge.jsx';
import useStreak from '../hooks/useStreak.js';

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
  Cap: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M22 10 12 4 2 10l10 6 10-6z" />
      <path d="M6 12v5c3 2 9 2 12 0v-5" />
    </svg>
  ),
  Shield: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
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
      .catch(() => { });
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
      <span className={`${text} font-extrabold lowercase tracking-tight`}>Titi</span>
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

// Las etiquetas del sidebar solo se ven cuando el rail está expandido (hover).
const sidebarLabel = 'whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200';

function Sidebar({ user, onLogout, unread, streak }) {
  return (
    <aside className="hidden md:flex group fixed left-0 top-0 h-screen w-20 hover:w-64 bg-titi-dark border-r border-white/10 flex-col z-20 text-white overflow-hidden transition-[width] duration-200 ease-out">
      <Link to="/feed" className="flex items-center gap-2 h-16 px-5 border-b border-white/10 shrink-0">
        <img
          src="/favicon.png"
          alt=""
          className="w-9 h-9 object-contain select-none shrink-0"
          draggable={false}
          onError={(e) => (e.currentTarget.style.display = 'none')}
        />
        <span className={`text-2xl font-extrabold lowercase tracking-tight ${sidebarLabel}`}>Titi</span>
      </Link>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto overflow-x-hidden">
        <NavLink to="/feed" className={sidebarItemClass} end>
          <Icon.Home className="w-5 h-5 shrink-0" />
          <span className={sidebarLabel}>Inicio</span>
        </NavLink>
        <NavLink to="/explore" className={sidebarItemClass}>
          <Icon.Compass className="w-5 h-5 shrink-0" />
          <span className={sidebarLabel}>Explorar</span>
        </NavLink>
        <NavLink to="/courses" className={sidebarItemClass}>
          <Icon.Books className="w-5 h-5 shrink-0" />
          <span className={sidebarLabel}>Cursos</span>
        </NavLink>
        <NavLink to="/my-courses" className={sidebarItemClass}>
          <Icon.Target className="w-5 h-5 shrink-0" />
          <span className={sidebarLabel}>Mis cursos</span>
        </NavLink>
        {(user?.rol === 'PROFESOR' || user?.rol === 'ADMIN') && (
          <NavLink to="/teacher" className={sidebarItemClass}>
            <Icon.Cap className="w-5 h-5 shrink-0" />
            <span className={sidebarLabel}>Enseñar</span>
          </NavLink>
        )}
        {user?.rol === 'ADMIN' && (
          <NavLink to="/admin" className={sidebarItemClass}>
            <Icon.Shield className="w-5 h-5 shrink-0" />
            <span className={sidebarLabel}>Admin</span>
          </NavLink>
        )}
        <NavLink to="/notifications" className={sidebarItemClass}>
          <span className="relative inline-flex shrink-0">
            <Icon.Bell className="w-5 h-5" />
            <NotifBadge count={unread} />
          </span>
          <span className={sidebarLabel}>Notificaciones</span>
        </NavLink>
        {user?.username && (
          <NavLink to={`/profile/${user.username}`} className={sidebarItemClass}>
            <Icon.User className="w-5 h-5 shrink-0" />
            <span className={sidebarLabel}>Mi perfil</span>
          </NavLink>
        )}
      </nav>

      {user && (
        <div className="px-3 pb-3 shrink-0">
          {/* Crossfade racha: colapsado = llama + número; expandido = badge completo.
              La llama y el número coinciden en tamaño y posición entre ambos estados,
              así que el badge (fondo + "días" + estado) se materializa alrededor sin salto. */}
          <div className="relative">
            {/* Colapsado: solo llama (más grande) + número */}
            <div className="flex items-center gap-1.5 px-2 py-2.5 opacity-100 group-hover:opacity-0 transition-opacity duration-200 ease-out pointer-events-none">
              <FlameIcon
                size={30}
                animated={streak.estaActiva && streak.racha > 0}
                dim={streak.racha === 0 || !streak.estaActiva}
              />
              <span className={`font-black text-xl leading-none tabular-nums ${streak.racha ? 'text-white' : 'text-gray-400'}`}>
                {streak.racha}
              </span>
            </div>
            {/* Expandido: badge completo a todo el ancho, se materializa con un leve crecimiento */}
            <div className="absolute inset-x-0 top-0 origin-left opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300 ease-out">
              <StreakBadge
                variant="sidebar"
                racha={streak.racha}
                estaActiva={streak.estaActiva}
                ultimaActividad={streak.ultimaActividad}
              />
            </div>
          </div>
        </div>
      )}
      <div className="border-t border-white/10 p-3 space-y-2 shrink-0">
        {user && (
          <Link
            to={`/profile/${user.username}`}
            className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/10 transition-colors"
          >
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.username}
                className="w-9 h-9 rounded-full object-cover bg-titi-dark border-2 border-titi-yellow shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-titi-yellow text-titi-dark grid place-items-center font-extrabold shrink-0">
                {user.username?.[0]?.toUpperCase() ?? '?'}
              </div>
            )}
            <div className={`min-w-0 ${sidebarLabel}`}>
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
          <Icon.Logout className="w-5 h-5 shrink-0" />
          <span className={sidebarLabel}>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
}

// ---- Top bar móvil ----
function MobileTopBar({ user, onLogout, unread, streak, showStreak }) {
  return (
    <header className="md:hidden fixed top-0 left-0 right-0 z-30 h-14 bg-titi-dark text-white border-b border-titi-dark shadow-titi">
      <div className="h-full px-4 flex items-center justify-between gap-2">
        <Link to="/feed">
          <TitiLogo size="md" />
        </Link>
        <div className="flex items-center gap-2">
          {user?.rol === 'ADMIN' && (
            <Link
              to="/admin"
              aria-label="Panel de administración"
              className="p-2 rounded-full text-white/85 hover:text-titi-yellow hover:bg-white/10 transition-colors"
            >
              <Icon.Shield className="w-5 h-5" />
            </Link>
          )}
          {showStreak && (
            <Link
              to="/my-courses"
              aria-label={`Racha de ${streak.racha} días`}
              className="inline-flex items-center gap-1 bg-titi-dark-mid border border-titi-streak/30 px-2.5 py-1 rounded-full"
            >
              <MiniFlame active={streak.estaActiva && streak.racha > 0} />
              <span className="text-sm font-black text-titi-streak tabular-nums leading-none">
                {streak.racha}
              </span>
            </Link>
          )}
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

function MiniFlame({ active }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" className={active ? 'titi-flame-flicker' : ''}>
      <defs>
        <linearGradient id="mini-flame-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={active ? '#FF9A3C' : '#9CA3AF'} />
          <stop offset="100%" stopColor={active ? '#D9480F' : '#4B5563'} />
        </linearGradient>
      </defs>
      <path
        d="M12 2c.6 3.4 3.5 4.8 3.5 8.5 0 1.6-.6 2.8-1.5 3.6.4-1.5.1-3-1-4.3 0 2.2-1 3.6-2 4.5-1.8 1.6-2.5 3.3-2.5 5 0 3.3 2.5 4.7 5.5 4.7s5.5-1.4 5.5-4.7c0-5.6-7.5-7.4-7.5-17.3z"
        fill="url(#mini-flame-g)"
      />
    </svg>
  );
}

// ---- Bottom nav móvil ----
function bottomItemClass({ isActive }) {
  const base = 'flex flex-col items-center justify-center gap-0.5 h-full text-xs font-bold transition-colors';
  return isActive
    ? `${base} text-titi-yellow`
    : `${base} text-white/70 hover:text-white`;
}

function MobileBottomNav({ user }) {
  // Un PROFESOR/ADMIN no se inscribe en cursos — ve directo su panel docente.
  const isTeacher = user?.rol === 'PROFESOR' || user?.rol === 'ADMIN';

  return (
    <nav
      aria-label="Navegación principal"
      className="md:hidden fixed bottom-0 left-0 right-0 z-30 h-16 bg-titi-dark text-white border-t border-titi-dark shadow-titi-lg"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="grid grid-cols-5 h-full">
        <NavLink to="/feed" className={bottomItemClass} aria-label="Inicio" end>
          <Icon.Home className="w-7 h-7" />
        </NavLink>
        <NavLink to="/explore" className={bottomItemClass} aria-label="Explorar">
          <Icon.Compass className="w-7 h-7" />
        </NavLink>
        <NavLink to="/courses" className={bottomItemClass} aria-label="Cursos">
          <Icon.Books className="w-7 h-7" />
        </NavLink>
        {isTeacher ? (
          <NavLink to="/teacher" className={bottomItemClass} aria-label="Enseñar">
            <Icon.Cap className="w-7 h-7" />
          </NavLink>
        ) : (
          <NavLink to="/my-courses" className={bottomItemClass} aria-label="Mis cursos">
            <Icon.Target className="w-7 h-7" />
          </NavLink>
        )}
        <NavLink
          to={user?.username ? `/profile/${user.username}` : '/feed'}
          className={bottomItemClass}
          aria-label="Perfil"
        >
          <Icon.User className="w-7 h-7" />
        </NavLink>
      </div>
    </nav>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const unread = useUnreadNotifications();
  const streak = useStreak();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <>
      <Sidebar user={user} onLogout={handleLogout} unread={unread} streak={streak} />
      <MobileTopBar
        user={user}
        onLogout={handleLogout}
        unread={unread}
        streak={streak}
        showStreak={Boolean(user)}
      />
      <MobileBottomNav user={user} />
    </>
  );
}
