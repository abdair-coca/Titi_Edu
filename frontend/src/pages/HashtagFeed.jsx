import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import client from '../api/client.js';
import PostCard from '../components/PostCard.jsx';
import { useStaggerReveal } from '../lib/motion.js';

export default function HashtagFeed() {
  const { tag } = useParams();

  // Normalizamos: minúsculas y sin "#" inicial por si llegó así desde una URL pegada
  const normalized = useMemo(
    () => (tag ?? '').toLowerCase().replace(/^#/, ''),
    [tag]
  );

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await client.get('/api/posts/explore');
      if (data?.success) {
        const filtered = (data.data.posts || []).filter((p) =>
          (p.hashtags || []).map((h) => String(h).toLowerCase()).includes(normalized)
        );
        setPosts(filtered);
      } else {
        setError(data?.message || 'No se pudo cargar');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error de red');
    } finally {
      setLoading(false);
    }
  }, [normalized]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleDelete = useCallback((id) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handleEdit = useCallback((updated) => {
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
  }, []);

  const listRef = useStaggerReveal([posts.length]);

  return (
    <div>
      <header className="mb-6">
        <Link to="/explore" className="text-sm text-neo-muted hover:text-white inline-flex items-center gap-1">
          ← Explorar
        </Link>
        <h1 className="text-3xl sm:text-4xl font-black mt-2 break-all">
          <span className="text-neo-accent">#</span>{normalized}
        </h1>
        <p className="text-sm text-neo-muted mt-1">
          {loading
            ? 'Cargando…'
            : `${posts.length} ${posts.length === 1 ? 'post' : 'posts'}`}
        </p>
      </header>

      {loading && posts.length === 0 && (
        <div className="neo-card p-8 text-center text-neo-muted">Cargando…</div>
      )}

      {error && (
        <div className="neo-card p-6 text-center border border-neo-accent/40">
          <p className="text-neo-accent font-semibold mb-2">Error</p>
          <p className="text-sm text-neo-muted mb-4">{error}</p>
          <button onClick={fetchPosts} className="neo-btn-primary">Reintentar</button>
        </div>
      )}

      {!loading && !error && posts.length === 0 && (
        <div className="neo-card p-8 text-center">
          <h2 className="text-xl font-bold mb-2">Sin posts con #{normalized}</h2>
          <p className="text-neo-muted mb-6">
            Nadie ha usado este hashtag todavía. ¡Sé el primero!
          </p>
          <Link to="/feed" className="neo-btn-primary">Crear un post</Link>
        </div>
      )}

      {posts.length > 0 && (
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
      )}
    </div>
  );
}
