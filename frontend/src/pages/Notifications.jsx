import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client.js';
import { relativeTime } from '../lib/format.js';
import { useStaggerReveal } from '../lib/motion.js';
import { Pill } from '../components/catalog/CatalogFilters.jsx';
import Avatar from '../components/social/Avatar.jsx';
import { ErrorBox } from '../components/social/StateBlocks.jsx';
import { SuggestionsPanel } from '../components/social/Suggestions.jsx';
import { useSuggestions } from '../components/social/useSocialData.js';
import CategoriesExplorer from '../components/CategoriesExplorer.jsx';
import { BTN_SECONDARY, EmptyState, PageHeader } from '../components/ui/v3.jsx';
import { AwardIcon, BellIcon, BooksIcon, CheckIcon, CommentIcon, HeartIcon, SparklesIcon, UserIcon } from '../components/icons.jsx';

// Notificaciones v3 (rediseno-plataforma-v3 R3): filas como tiles compactos
// con el avatar y una insignia sólida por tipo; pestañas Todas / Sin leer.

const TYPES = {
  like: { Icon: HeartIcon, solid: 'bg-red-500', label: 'Like' },
  comment: { Icon: CommentIcon, solid: 'bg-blue-500', label: 'Comentario' },
  follow: { Icon: UserIcon, solid: 'bg-titi-yellow text-titi-dark', label: 'Nuevo seguidor' },
  logro: { Icon: AwardIcon, solid: 'bg-titi-achievement', label: 'Logro' },
  lesson_comment_reply: { Icon: CommentIcon, solid: 'bg-blue-500', label: 'Respuesta' },
  new_lesson: { Icon: BooksIcon, solid: 'bg-green-500', label: 'Lección nueva' },
};
const FALLBACK = { Icon: BellIcon, solid: 'bg-titi-dark', label: 'Aviso' };

const TABS = [
  { id: 'all', label: 'Todas', Icon: SparklesIcon, solid: 'bg-titi-dark' },
  { id: 'unread', label: 'Sin leer', Icon: BellIcon, solid: 'bg-red-500' },
];

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('all');
  const suggestions = useSuggestions(6);

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

  const unread = items.filter((n) => !n.read).length;
  const visible = tab === 'unread' ? items.filter((n) => !n.read) : items;
  const counts = { all: items.length, unread };
  const listRef = useStaggerReveal([loading, tab]);

  return (
    <div className="max-w-6xl mx-auto lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6 lg:items-start">
      <div className="max-w-2xl w-full mx-auto lg:max-w-none lg:mx-0 min-w-0">
        <PageHeader title="Tus" accent="notificaciones" subtitle="Lo que pasó mientras no estabas.">
          {unread > 0 && (
            <button type="button" onClick={markAllRead} className={BTN_SECONDARY}>
              <CheckIcon className="w-4 h-4" />
              Marcar todo como leído
            </button>
          )}
        </PageHeader>

        {!loading && !error && items.length > 0 && (
          <div role="group" aria-label="Filtrar notificaciones" className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-4 px-4 sm:mx-0 sm:px-0 py-1 mb-4">
            {TABS.map(({ id, label, Icon, solid }) => (
              <Pill key={id} active={tab === id} onClick={() => setTab(id)}>
                <span className={`w-7 h-7 rounded-full grid place-items-center text-white ${solid}`}>
                  <Icon className="w-4 h-4" />
                </span>
                {label}
                <span className="text-xs font-extrabold tabular-nums text-gray-500">{counts[id]}</span>
              </Pill>
            ))}
          </div>
        )}

        {loading && <NotificationsSkeleton />}

        {error && <ErrorBox title="No pudimos cargar tus notificaciones" message={error} onRetry={fetchNotifs} />}

        {!loading && !error && items.length === 0 && (
          <EmptyState
            state="idle"
            message="Todo tranquilo por aquí."
            title="Nada"
            accent="nuevo"
            text="Cuando alguien te dé like, te siga o comente tus posts, lo vas a ver acá."
          >
            <Link to="/explore" className="titi-btn-primary">
              Buscar gente en Explorar
            </Link>
          </EmptyState>
        )}

        {!loading && !error && items.length > 0 && visible.length === 0 && (
          <div className="bg-white rounded-2xl border-2 border-dashed border-gray-300 py-10 px-6 text-center">
            <span className="mx-auto w-12 h-12 rounded-xl border-2 border-titi-dark bg-green-500 text-white grid place-items-center -rotate-6 mb-3">
              <CheckIcon className="w-6 h-6" />
            </span>
            <h2 className="text-lg font-extrabold text-titi-dark">¡Estás al día!</h2>
            <p className="text-sm font-medium text-gray-500 mt-1 mb-4">No te queda nada sin leer.</p>
            <button type="button" onClick={() => setTab('all')} className={BTN_SECONDARY}>
              Ver todas
            </button>
          </div>
        )}

        {!loading && visible.length > 0 && (
          <ul ref={listRef} className="flex flex-col gap-3">
            {visible.map((n) => (
              <NotificationItem key={n.id} notif={n} onClick={() => markOneRead(n.id)} />
            ))}
          </ul>
        )}
      </div>

      {/* Rail (solo desktop) */}
      <aside className="hidden lg:flex flex-col gap-5 sticky top-8">
        <SuggestionsPanel suggestions={suggestions} />
        <CategoriesExplorer layout="rail" />
      </aside>
    </div>
  );
}

function NotificationItem({ notif, onClick }) {
  const isLessonReply = notif.type === 'lesson_comment_reply';
  const isNewLesson = notif.type === 'new_lesson';
  const meta = TYPES[notif.type] || FALLBACK;

  const verb =
    notif.type === 'like' ? 'le dio like a tu post'
    : notif.type === 'comment' ? 'comentó tu post'
    : notif.type === 'follow' ? 'empezó a seguirte'
    : notif.type === 'logro' ? `desbloqueó el logro ${notif.logroNombre ?? ''}`
    : isLessonReply ? `respondió a tu comentario en la lección "${notif.leccionTitulo || 'del curso'}"`
    : isNewLesson ? `publicó una nueva lección: "${notif.leccionTitulo || 'Nueva lección'}"`
    : 'interactuó con vos';

  let linkTo = '#';
  if (isLessonReply || isNewLesson) {
    if (notif.cursoId) {
      linkTo = `/courses/${notif.cursoId}/learn?lessonId=${notif.leccionId || ''}${isLessonReply ? '&comments=true' : ''}`;
    }
  } else if (notif.user) {
    linkTo = `/profile/${notif.user.username}`;
  } else if (notif.actor) {
    linkTo = `/profile/${notif.actor.username}`;
  }

  const solidText = meta.solid.includes('text-') ? '' : 'text-white';

  return (
    <li>
      <Link
        to={linkTo}
        onClick={onClick}
        className={[
          'group flex items-start gap-3 p-3 sm:p-4 rounded-2xl border-2 border-titi-dark',
          'transition-all duration-150 ease-out hover:-translate-y-0.5 active:translate-y-0.5 motion-reduce:transition-none',
          'focus:outline-none focus-visible:ring-4 focus-visible:ring-titi-yellow',
          notif.read
            ? 'bg-white shadow-[0_3px_0_#1A1A2E] hover:shadow-[0_5px_0_#1A1A2E] active:shadow-[0_1px_0_#1A1A2E]'
            : 'bg-titi-yellow-light shadow-[0_3px_0_#1A1A2E] hover:shadow-[0_5px_0_#1A1A2E] active:shadow-[0_1px_0_#1A1A2E]',
        ].join(' ')}
      >
        <span className="relative shrink-0">
          <Avatar username={notif.actor?.username} src={notif.actor?.avatarUrl} size="md" />
          <span
            title={meta.label}
            className={`absolute -bottom-1 -right-1.5 w-6 h-6 rounded-lg border-2 border-titi-dark grid place-items-center -rotate-6 transition-transform duration-200 group-hover:rotate-6 motion-reduce:transition-none ${meta.solid} ${solidText}`}
          >
            <meta.Icon className="w-3.5 h-3.5" />
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-titi-dark leading-snug break-words">
            <span className="font-extrabold">@{notif.actor?.username ?? 'alguien'}</span>{' '}
            <span className="font-semibold text-gray-600">{verb}</span>
          </p>
          {notif.cursoTitulo && (
            <p className="mt-1 inline-flex items-center gap-1 max-w-full text-xs font-bold text-titi-dark">
              <BooksIcon className="w-3.5 h-3.5 shrink-0 text-green-600" />
              <span className="truncate">{notif.cursoTitulo}</span>
            </p>
          )}
          {notif.post?.content && (
            <p className="mt-1.5 text-sm font-medium text-gray-600 line-clamp-2 break-words bg-white/70 border-l-4 border-gray-200 rounded-r-lg pl-2.5 py-1">
              {notif.post.content}
            </p>
          )}
          <p className="text-xs text-gray-400 font-semibold mt-1">{relativeTime(notif.createdAt)}</p>
        </div>
        {!notif.read && <span aria-label="Sin leer" className="w-3 h-3 rounded-full bg-red-500 border-2 border-titi-dark shrink-0 mt-1.5" />}
      </Link>
    </li>
  );
}

function NotificationsSkeleton() {
  return (
    <ul aria-busy="true" aria-label="Cargando notificaciones" className="flex flex-col gap-3 animate-pulse motion-reduce:animate-none">
      {[0, 1, 2, 3].map((i) => (
        <li key={i} className="flex items-start gap-3 p-3 sm:p-4 rounded-2xl border-2 border-gray-200 bg-white">
          <span className="w-11 h-11 rounded-full bg-gray-100 shrink-0" />
          <span className="flex-1 flex flex-col gap-2 pt-1">
            <span className="h-3 w-3/4 bg-gray-100 rounded-full" />
            <span className="h-3 w-1/2 bg-gray-100 rounded-full" />
            <span className="h-2.5 w-16 bg-gray-100 rounded-full" />
          </span>
        </li>
      ))}
    </ul>
  );
}
