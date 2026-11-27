import { useState } from 'react';
import client from '../../api/client.js';
import { useGamification } from '../../context/GamificationContext.jsx';
import { CheckIcon, PlusIcon } from '../icons.jsx';

// Seguir / Siguiendo (rediseno-inicio-explorar R6). Optimista: cambia al
// instante y, si el servidor falla, vuelve atrás y lo avisa en el botón.

export default function FollowButton({ username, initialFollowing = false, onChange, size = 'md', className = '' }) {
  const { refreshGotas } = useGamification();
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function toggle(e) {
    // Vive dentro de tarjetas que son enlace: el toque no navega.
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    const was = following;
    setFollowing(!was);
    setFailed(false);
    setBusy(true);
    try {
      const { data } = await client.post(`/api/users/${encodeURIComponent(username)}/${was ? 'unfollow' : 'follow'}`);
      if (!data?.success) throw new Error(data?.message);
      onChange?.(!was);
      // Seguir suma gotas (con tope diario): refresco silencioso del contador.
      if (!was) refreshGotas?.();
    } catch {
      setFollowing(was);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const small = size === 'sm';
  const label = failed ? 'Reintentar' : following ? 'Siguiendo' : 'Seguir';
  const Icon = following ? CheckIcon : PlusIcon;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={following}
      aria-label={following ? `Dejar de seguir a @${username}` : `Seguir a @${username}`}
      title={failed ? 'No se pudo, probá de nuevo' : undefined}
      className={[
        'relative z-10 inline-flex items-center justify-center gap-1.5 rounded-xl border-2 font-extrabold whitespace-nowrap select-none',
        'transition-all duration-150 active:translate-y-0.5 active:shadow-none motion-reduce:transition-none',
        'focus:outline-none focus-visible:ring-4 focus-visible:ring-titi-yellow/60',
        small ? 'h-8 px-3 text-xs' : 'h-10 px-4 text-sm',
        failed
          ? 'bg-red-50 border-red-500 text-red-600 shadow-[0_3px_0_#EF4444]'
          : following
            ? 'bg-white border-gray-200 text-titi-dark shadow-[0_3px_0_#E5E7EB] hover:border-titi-dark'
            : 'bg-titi-yellow border-titi-dark text-titi-dark shadow-[0_3px_0_#1A1A2E] hover:-translate-y-0.5 hover:shadow-[0_4px_0_#1A1A2E]',
        className,
      ].join(' ')}
    >
      <Icon className={small ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
      {label}
    </button>
  );
}
