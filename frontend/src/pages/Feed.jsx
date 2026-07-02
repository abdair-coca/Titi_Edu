import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client.js';
import { useStaggerReveal, useCountUp } from '../lib/motion.js';
import { useGamification } from '../context/GamificationContext.jsx';
import useStreak from '../hooks/useStreak.js';
import PostCard from '../components/PostCard.jsx';
import CreatePost from '../components/CreatePost.jsx';
import AcademicActivityCard from '../components/AcademicActivityCard.jsx';
import CategoriesExplorer from '../components/CategoriesExplorer.jsx';
import TitiMascot from '../components/TitiMascot.jsx';
import { BoltIcon, GotaIcon } from '../components/icons.jsx';

export default function Feed() {
  const [posts, setPosts] = useState([]);
  const [academic, setAcademic] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  // Carga inicial: primera página de posts sociales + actividad académica.
  // El académico es complementario (se carga una vez); la paginación es del social.
  const fetchFeed = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [postsRes, acadRes] = await Promise.allSettled([
        client.get('/api/posts/feed', { params: { limit: 20 } }),
        client.get('/api/posts/feed/academic'),
      ]);

      // El feed social es el principal: si falla, mostramos error.
      if (postsRes.status === 'rejected') throw postsRes.reason;
      const postsData = postsRes.value.data;
      if (postsData?.success) {
        setPosts(postsData.data.posts || []);
        setNextCursor(postsData.data.nextCursor ?? null);
      } else {
        setError(postsData?.message || 'No se pudo cargar el feed');
      }

      // El feed académico es complementario: si falla, no rompe el feed.
      if (acadRes.status === 'fulfilled' && acadRes.value.data?.success) {
        setAcademic(acadRes.value.data.data.activity || []);
      } else {
        setAcademic([]);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error de red');
    } finally {
      setLoading(false);
    }
  }, []);

  // Trae la siguiente página de posts sociales y la anexa.
  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const { data } = await client.get('/api/posts/feed', {
        params: { cursor: nextCursor, limit: 20 },
      });
      if (data?.success) {
        setPosts((prev) => [...prev, ...(data.data.posts || [])]);
        setNextCursor(data.data.nextCursor ?? null);
      }
    } catch { /* mantenemos lo cargado; el sentinel reintenta al volver a verse */ }
    finally { setLoadingMore(false); }
  }, [nextCursor, loadingMore]);

  useEffect(() => { fetchFeed(); }, [fetchFeed]);

  const handleDelete = useCallback((id) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }, []);
  const handleEdit = useCallback((updated) => {
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
  }, []);

  // Scroll infinito: el sentinel dispara loadMore al acercarse al viewport.
  const sentinelRef = useRef(null);
  useEffect(() => {
    if (!nextCursor) return;
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { rootMargin: '300px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [nextCursor, loadMore]);

  // Mezclar posts + actividad académica en una sola línea de tiempo (DESC).
  const timeline = [
    ...posts.map((p) => ({ kind: 'post', createdAt: p.createdAt, data: p })),
    ...academic.map((a, i) => ({ kind: 'academic', createdAt: a.createdAt, data: a, _i: i })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const isEmpty = timeline.length === 0;

  // Entrada escalonada de las tarjetas del feed (GSAP, respeta reduced-motion).
  // Atada a [loading] para animar solo en la carga inicial, no al anexar páginas.
  const timelineRef = useStaggerReveal([loading]);

  return (
    // Sin columnas muertas (design.md §4): en lg el feed va acompañado por un
    // rail lateral sticky con progreso + categorías.
    <div className="max-w-5xl mx-auto lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6 lg:items-start">
      <div className="max-w-xl mx-auto lg:max-w-none lg:mx-0 min-w-0">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-titi-dark">Inicio</h1>
          <p className="text-base text-gray-500 font-medium">Lo que está pasando con quienes seguís</p>
        </div>
        <button
          type="button"
          onClick={fetchFeed}
          disabled={loading}
          className="titi-btn-ghost text-sm disabled:opacity-50"
        >
          {loading ? 'Actualizando…' : 'Refrescar'}
        </button>
      </header>

      <CreatePost onCreated={fetchFeed} />

      {loading && isEmpty && <FeedSkeleton />}

      {error && (
        <div className="bg-white border-2 border-red-500/40 rounded-2xl p-6 text-center shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
          <p className="text-red-500 font-extrabold mb-2">¡Ups!</p>
          <p className="text-sm text-gray-500 mb-4">{error}</p>
          <button onClick={fetchFeed} className="titi-btn-primary">Reintentar</button>
        </div>
      )}

      {!loading && !error && isEmpty && <EmptyFeed />}

      {timeline.length > 0 && (
        <div ref={timelineRef}>
          {timeline.map((entry) =>
            entry.kind === 'post' ? (
              <PostCard
                key={entry.data.id}
                post={entry.data}
                onDelete={handleDelete}
                onEdit={handleEdit}
              />
            ) : (
              <AcademicActivityCard
                key={`acad-${entry.data.type}-${entry.data.actorUsername}-${entry.data.cursoId || entry.data.logroNombre}-${entry.data.createdAt}-${entry._i}`}
                item={entry.data}
              />
            )
          )}
        </div>
      )}

      {nextCursor && <div ref={sentinelRef} aria-hidden className="h-1" />}
      {loadingMore && (
        <div className="py-6 text-center text-sm text-gray-500 font-semibold">Cargando más…</div>
      )}
      </div>

      {/* Rail lateral (solo desktop) */}
      <aside className="hidden lg:flex flex-col gap-5 sticky top-8">
        <SideStats />
        <CategoriesExplorer />
      </aside>
    </div>
  );
}

// ---- Rail: progreso rápido (racha + gotas, con count-up) ----
function SideStats() {
  const { gotas } = useGamification();
  const streak = useStreak();
  const rachaActiva = streak.estaActiva && streak.racha > 0;
  const gotasAnim = useCountUp(gotas.total);
  const rachaAnim = useCountUp(streak.racha);

  return (
    <section className="titi-card p-4 sm:p-5">
      <h2 className="text-lg font-bold text-titi-dark mb-3">Tu progreso</h2>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span
            className={`w-10 h-10 rounded-full grid place-items-center shrink-0 shadow-sm ${
              rachaActiva ? 'bg-titi-streak' : 'bg-gray-200'
            }`}
          >
            <BoltIcon className={`w-5 h-5 ${rachaActiva ? 'text-white' : 'text-gray-500'}`} />
          </span>
          <div className="min-w-0">
            <p className="text-2xl font-extrabold text-titi-dark tabular-nums leading-tight">
              {rachaAnim}
            </p>
            <p className="text-xs font-semibold text-gray-500">Racha actual</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-full bg-blue-500 grid place-items-center shrink-0 shadow-sm">
            <GotaIcon className="w-5 h-5 text-white" />
          </span>
          <div className="min-w-0">
            <p className="text-2xl font-extrabold text-titi-dark tabular-nums leading-tight">
              {gotasAnim}
            </p>
            <p className="text-xs font-semibold text-gray-500">Gotas totales</p>
          </div>
        </div>
      </div>
      <Link
        to="/my-courses"
        className="inline-block mt-4 text-sm font-bold text-blue-500 hover:text-blue-600 uppercase tracking-wide transition-all duration-150 active:scale-95"
      >
        Ver mi progreso →
      </Link>
    </section>
  );
}

function FeedSkeleton() {
  return (
    <div className="space-y-6">
      {[0, 1, 2].map((i) => (
        <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-full bg-gray-100" />
            <div className="space-y-2">
              <div className="h-3 w-24 bg-gray-100 rounded" />
              <div className="h-2 w-16 bg-gray-100 rounded" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-3 w-full bg-gray-100 rounded" />
            <div className="h-3 w-4/5 bg-gray-100 rounded" />
            <div className="h-3 w-3/5 bg-gray-100 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyFeed() {
  return (
    <div className="titi-card p-10 text-center">
      <div className="mb-6">
        <TitiMascot
          mood="motivating"
          message="¡Sigue a alguien para ver su contenido!"
          size="lg"
        />
      </div>
      <h2 className="text-2xl font-extrabold mb-2">Tu inicio está vacío</h2>
      <p className="text-gray-500 mb-6 max-w-md mx-auto">
        Cuando sigas a otras personas, sus publicaciones aparecerán acá. Mientras tanto,
        descubrí qué se está compartiendo en Titi.
      </p>
      <Link to="/explore" className="titi-btn-primary">Ir a Explorar</Link>
    </div>
  );
}
