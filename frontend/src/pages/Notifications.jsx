import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client.js';
import { relativeTime } from '../lib/format.js';

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchNotifs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await client.get('/api/notifications');
      if (data?.success) {
        setItems(data.data.notifications || []);
      } else {
        setError(data?.message || 'No se pudieron cargar');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error de red');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifs();
  }, [fetchNotifs]);

  async function markAllRead() {
    try {
      await client.post('/api/notifications/read-all');
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      /* swallow */
    }
  }

  async function markOneRead(id) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await client.post(`/api/notifications/${id}/read`);
    } catch {
      /* swallow */
    }
  }

  const hasUnread = items.some((n) => !n.read);

  return (
    <div>
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-extrabold">Notificaciones</h1>
          <p className="text-sm text-neo-muted">Actividad reciente</p>
        </div>
        {hasUnread && (
          <button onClick={markAllRead} className="neo-btn-ghost text-sm">
            Marcar todo como leído
          </button>
        )}
      </header>

      {loading && (
        <div className="neo-card p-8 text-center text-neo-muted">Cargando…</div>
      )}

      {error && (
        <div className="neo-card p-6 text-center border border-neo-accent/40">
          <p className="text-sm text-neo-accent mb-3">{error}</p>
          <button onClick={fetchNotifs} className="neo-btn-primary">Reintentar</button>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="neo-card p-8 text-center">
          <p className="text-neo-muted">No tenés notificaciones todavía.</p>
        </div>
      )}

      {items.length > 0 && (
        <ul className="space-y-2">
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
    notif.type === 'like'
      ? 'le dio like a tu post'
      : notif.type === 'comment'
      ? 'comentó tu post'
      : notif.type === 'follow'
      ? 'empezó a seguirte'
      : 'interactuó contigo';

  // Destino del click
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
        className={`flex items-start gap-3 p-4 rounded-xl border transition-colors ${
          notif.read
            ? 'bg-neo-card/60 border-neo-border hover:bg-neo-card'
            : 'bg-neo-accent/10 border-neo-accent/30 hover:bg-neo-accent/20'
        }`}
      >
        {notif.actor?.avatarUrl ? (
          <img
            src={notif.actor.avatarUrl}
            alt=""
            className="w-10 h-10 rounded-full bg-neo-bg border border-neo-border shrink-0"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-neo-accent/20 text-neo-accent grid place-items-center font-bold shrink-0">
            {notif.actor?.username?.[0]?.toUpperCase() ?? '?'}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm">
            <span className="font-semibold">@{notif.actor?.username ?? 'alguien'}</span>{' '}
            <span className="text-white/80">{verb}</span>
          </p>
          {notif.post?.content && (
            <p className="text-xs text-neo-muted mt-1 line-clamp-2 break-words">
              "{notif.post.content}"
            </p>
          )}
          <p className="text-xs text-neo-muted mt-1">{relativeTime(notif.createdAt)}</p>
        </div>
        {!notif.read && (
          <span
            aria-label="No leída"
            className="w-2 h-2 rounded-full bg-neo-accent shrink-0 mt-2"
          />
        )}
      </Link>
    </li>
  );
}
