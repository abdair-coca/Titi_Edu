import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client.js';
import { useStaggerReveal } from '../lib/motion.js';
import PostCard from '../components/PostCard.jsx';
import CreatePost from '../components/CreatePost.jsx';
import AcademicActivityCard from '../components/AcademicActivityCard.jsx';
import TitiMascot from '../components/TitiMascot.jsx';

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
    <div className="max-w-xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-titi-text">Inicio</h1>
          <p className="text-sm text-titi-muted font-semibold">Lo que está pasando con quienes seguís</p>
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
        <div className="bg-white border-2 border-titi-red/40 rounded-2xl p-6 text-center shadow-titi">
          <p className="text-titi-red font-extrabold mb-2">¡Ups!</p>
          <p className="text-sm text-titi-muted mb-4">{error}</p>
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
        <div className="py-6 text-center text-sm text-titi-muted font-semibold">Cargando más…</div>
      )}
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="space-y-6">
      {[0, 1, 2].map((i) => (
        <div key={i} className="bg-white rounded-2xl border border-titi-border p-5 animate-pulse shadow-titi">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-full bg-titi-border" />
            <div className="space-y-2">
              <div className="h-3 w-24 bg-titi-border rounded" />
              <div className="h-2 w-16 bg-titi-border rounded" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-3 w-full bg-titi-border rounded" />
            <div className="h-3 w-4/5 bg-titi-border rounded" />
            <div className="h-3 w-3/5 bg-titi-border rounded" />
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
      <p className="text-titi-muted mb-6 max-w-md mx-auto">
        Cuando sigas a otras personas, sus publicaciones aparecerán acá. Mientras tanto,
        descubrí qué se está compartiendo en Titi.
      </p>
      <Link to="/explore" className="titi-btn-primary">Ir a Explorar</Link>
    </div>
  );
}
