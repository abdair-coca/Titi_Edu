import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client.js';
import PostCard from '../components/PostCard.jsx';
import TitiMascot from '../components/TitiMascot.jsx';
import { useStaggerReveal } from '../lib/motion.js';
import { relativeTime, resolveMediaUrl } from '../lib/format.js';

export default function Explore() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  return (
    <div className="max-w-xl mx-auto">
      <header className="mb-6">
        <h1 className="text-3xl sm:text-4xl font-black text-titi-text mb-1">Explorar</h1>
        <p className="text-base text-titi-muted font-medium">
          Descubrí usuarios, posts y hashtags en Titi
        </p>
      </header>

      <SearchBar value={query} onChange={setQuery} />

      {debouncedQuery ? <SearchResults q={debouncedQuery} /> : <ExploreFeed />}
    </div>
  );
}

function SearchBar({ value, onChange }) {
  return (
    <div className="relative mb-6">
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Buscá usuarios, posts o #hashtags…"
        className="titi-input pl-12"
        aria-label="Buscar"
      />
      <svg
        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round"
        className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-titi-muted pointer-events-none"
      >
        <circle cx="11" cy="11" r="7" />
        <line x1="21" y1="21" x2="16.5" y2="16.5" />
      </svg>
    </div>
  );
}

function ExploreFeed() {
  const [posts, setPosts] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  // Trae una página: si hay cursor, anexa; si no, reemplaza (carga inicial).
  const fetchPage = useCallback(async (cursor) => {
    const { data } = await client.get('/api/posts/explore', {
      params: { cursor: cursor || undefined, limit: 20 },
    });
    if (!data?.success) throw new Error(data?.message || 'No se pudo cargar');
    setPosts((prev) => (cursor ? [...prev, ...(data.data.posts || [])] : data.data.posts || []));
    setNextCursor(data.data.nextCursor ?? null);
  }, []);

  const fetchFirst = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      await fetchPage(null);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error de red');
    } finally {
      setLoading(false);
    }
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      await fetchPage(nextCursor);
    } catch { /* mantenemos lo cargado; el sentinel reintenta al volver a verse */ }
    finally { setLoadingMore(false); }
  }, [nextCursor, loadingMore, fetchPage]);

  useEffect(() => { fetchFirst(); }, [fetchFirst]);

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

  // Anima una sola vez al terminar la carga inicial (no al anexar páginas).
  const listRef = useStaggerReveal([loading]);

  if (loading) {
    return <div className="titi-card p-8 text-center text-titi-muted font-semibold">Cargando…</div>;
  }
  if (error) {
    return (
      <div className="bg-white border-2 border-titi-red/40 rounded-2xl p-6 text-center shadow-titi">
        <p className="text-titi-red font-bold mb-2">Error</p>
        <p className="text-sm text-titi-muted mb-4">{error}</p>
        <button onClick={fetchFirst} className="titi-btn-primary">Reintentar</button>
      </div>
    );
  }
  if (posts.length === 0) {
    return (
      <div className="titi-card p-10 text-center">
        <TitiMascot mood="idle" message="Aún no hay publicaciones, ¡sé el primero!" size="lg" />
      </div>
    );
  }
  return (
    <>
      <div ref={listRef}>
        {posts.map((p) => (
          <PostCard
            key={p.id}
            post={p}
            onDelete={handleDelete}
            onEdit={handleEdit}
          />
        ))}
      </div>
      {nextCursor && <div ref={sentinelRef} aria-hidden className="h-1" />}
      {loadingMore && (
        <div className="py-6 text-center text-sm text-titi-muted font-semibold">Cargando más…</div>
      )}
    </>
  );
}

function SearchResults({ q }) {
  const [data, setData] = useState({ users: [], posts: [], hashtags: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    client.get('/api/search', { params: { q } })
      .then(({ data }) => {
        if (cancelled) return;
        if (data?.success) {
          setData({
            users: data.data.users || [],
            posts: data.data.posts || [],
            hashtags: data.data.hashtags || [],
          });
        } else {
          setError(data?.message || 'No se pudo buscar');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.response?.data?.message || err.message || 'Error de red');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [q]);

  if (loading) {
    return <div className="titi-card p-6 text-center text-titi-muted font-semibold">Buscando "{q}"…</div>;
  }
  if (error) {
    return (
      <div className="bg-white border-2 border-titi-red/40 rounded-2xl p-6 text-center shadow-titi">
        <p className="text-sm text-titi-red font-bold">{error}</p>
      </div>
    );
  }

  const { users, posts, hashtags } = data;
  const totalResults = users.length + posts.length + hashtags.length;

  if (totalResults === 0) {
    return (
      <div className="titi-card p-10 text-center">
        <TitiMascot mood="sad" message="No encontré nada... intenta con otro término" size="lg" />
        <p className="text-titi-muted text-sm mt-4">
          Sin resultados para <span className="text-titi-text font-extrabold">"{q}"</span>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {hashtags.length > 0 && (
        <Section title="Hashtags">
          <div className="flex flex-wrap gap-2">
            {hashtags.map((h) => (
              <Link
                key={h.name}
                to={`/hashtag/${h.name}`}
                className="inline-flex items-center gap-2 text-sm font-extrabold text-titi-dark bg-titi-yellow/40 hover:bg-titi-yellow/70 px-3 py-1.5 rounded-full transition-colors"
                title={`${h.postCount} post${h.postCount === 1 ? '' : 's'}`}
              >
                #{h.name}
                <span className="text-titi-muted text-xs">{h.postCount}</span>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {users.length > 0 && (
        <Section title="Usuarios">
          <ul className="space-y-3">
            {users.map((u) => <UserResult key={u.id} user={u} />)}
          </ul>
        </Section>
      )}

      {posts.length > 0 && (
        <Section title="Posts">
          <ul className="space-y-3">
            {posts.map((p) => <PostResult key={p.id} post={p} />)}
          </ul>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="titi-card p-5">
      <h3 className="text-xs uppercase tracking-wide text-titi-muted font-extrabold mb-3">{title}</h3>
      {children}
    </section>
  );
}

function UserResult({ user }) {
  return (
    <li>
      <Link
        to={`/profile/${user.username}`}
        className="flex items-center gap-3 p-2 rounded-xl hover:bg-titi-bg transition-colors"
      >
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt={user.username} className="w-12 h-12 rounded-full bg-titi-bg border-2 border-titi-yellow" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-titi-yellow text-titi-dark grid place-items-center font-extrabold border-2 border-titi-yellow">
            {user.username?.[0]?.toUpperCase() ?? '?'}
          </div>
        )}
        <div className="min-w-0">
          <p className="font-extrabold text-titi-text">@{user.username}</p>
          {user.bio && <p className="text-sm text-titi-muted truncate">{user.bio}</p>}
        </div>
      </Link>
    </li>
  );
}

function PostResult({ post }) {
  const imageUrl = resolveMediaUrl(post.imageUrl);
  return (
    <li className="flex gap-3 p-2 rounded-xl hover:bg-titi-bg transition-colors">
      {imageUrl ? (
        <img src={imageUrl} alt="" className="w-16 h-16 rounded-lg object-cover bg-titi-bg border border-titi-border shrink-0" />
      ) : (
        <div className="w-16 h-16 rounded-lg bg-titi-yellow/20 border border-titi-border shrink-0 grid place-items-center text-titi-muted text-xs font-bold">
          texto
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <Link to={`/profile/${post.author}`} className="font-extrabold text-sm text-titi-text hover:text-titi-blue">
            @{post.author}
          </Link>
          <span className="text-xs text-titi-muted font-semibold">{relativeTime(post.createdAt)}</span>
        </div>
        <p className="text-sm text-titi-text line-clamp-2 break-words">{post.content}</p>
      </div>
    </li>
  );
}
