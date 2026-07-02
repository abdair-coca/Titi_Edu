import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client.js';
import { relativeTime } from '../lib/format.js';
import TitiMascot from '../components/TitiMascot.jsx';
import { useStaggerReveal } from '../lib/motion.js';

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchNotifs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await client.get('/api/notifications');
      if (data?.success) setItems(data.data.notifications || []);
      else setError(data?.message || 'No se pudieron cargar');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error de red');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNotifs(); }, [fetchNotifs]);

  async function markAllRead() {
    try {
      await client.post('/api/notifications/read-all');
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch { /* swallow */ }
  }

  async function markOneRead(id) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try { await client.post(`/api/notifications/${id}/read`); } catch { /* swallow */ }
  }

  const hasUnread = items.some((n) => !n.read);

  const listRef = useStaggerReveal([items.length]);

  return (
    <div>
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-titi-text">Notificaciones</h1>
          <p className="text-base text-titi-muted font-medium">Lo que pasó mientras no estabas</p>
        </div>
        {hasUnread && (
          <button onClick={markAllRead} className="titi-btn-ghost text-sm">
            Marcar todo como leído
          </button>
        )}
      </header>

      {loading && (
        <div className="titi-card p-8 text-center text-titi-muted font-semibold">Cargando…</div>
      )}

      {error && (
        <div className="bg-white border-2 border-titi-red/40 rounded-2xl p-6 text-center shadow-titi">
          <p className="text-sm text-titi-red font-bold mb-3">{error}</p>
          <button onClick={fetchNotifs} className="titi-btn-primary">Reintentar</button>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="titi-card p-10 text-center">
          <TitiMascot mood="idle" message="Todo tranquilo por aquí" size="lg" />
          <p className="text-titi-muted mt-4 max-w-md mx-auto">
            Cuando alguien te dé like, te siga o comente tus posts, lo vas a ver acá.
          </p>
        </div>
      )}

      {items.length > 0 && (
        <ul ref={listRef} className="space-y-2">
          {items.map((n) => (
            <NotificationItem key={n.id} notif={n} onClick={() => markOneRead(n.id)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function NotificationItem({ notif, onClick }) {
  const verb =
    notif.type === 'like' ? 'le dio ❤️ a tu post'
    : notif.type === 'comment' ? 'comentó tu post'
    : notif.type === 'follow' ? 'empezó a seguirte'
    : notif.type === 'logro' ? `desbloqueó el logro ${notif.logroNombre ?? ''} 🏅`
    : 'interactuó contigo';

  const linkTo = notif.user
    ? `/profile/${notif.user.username}`
    : notif.actor
    ? `/profile/${notif.actor.username}`
    : '#';

  return (
    <li>
      <Link
        to={linkTo}
        onClick={onClick}
        className={`flex items-start gap-3 p-4 rounded-2xl border-2 transition-all ${
          notif.read
            ? 'bg-white border-titi-border hover:border-titi-yellow'
            : 'bg-titi-yellow/10 border-titi-yellow hover:bg-titi-yellow/20'
        }`}
      >
        {notif.actor?.avatarUrl ? (
          <img
            src={notif.actor.avatarUrl}
            alt=""
            className="w-11 h-11 rounded-full bg-titi-bg border-2 border-titi-yellow shrink-0"
          />
        ) : (
          <div className="w-11 h-11 rounded-full bg-titi-yellow text-titi-dark grid place-items-center font-extrabold shrink-0">
            {notif.actor?.username?.[0]?.toUpperCase() ?? '?'}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm text-titi-text">
            <span className="font-extrabold">@{notif.actor?.username ?? 'alguien'}</span>{' '}
            <span className="font-semibold text-titi-muted">{verb}</span>
          </p>
          {notif.post?.content && (
            <p className="text-xs text-titi-muted mt-1 line-clamp-2 break-words italic">
              "{notif.post.content}"
            </p>
          )}
          <p className="text-xs text-titi-muted font-semibold mt-1">{relativeTime(notif.createdAt)}</p>
        </div>
        {!notif.read && (
          <span aria-label="No leída" className="w-2.5 h-2.5 rounded-full bg-titi-red shrink-0 mt-2" />
        )}
      </Link>
    </li>
  );
}
