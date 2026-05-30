import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client.js';
import PostCard from '../components/PostCard.jsx';
import CreatePost from '../components/CreatePost.jsx';

export default function Feed() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await client.get('/api/posts/feed');
      if (data?.success) {
        setPosts(data.data.posts || []);
      } else {
        setError(data?.message || 'No se pudo cargar el feed');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Error de red';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  return (
    <div>
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-extrabold">Feed</h1>
          <p className="text-sm text-neo-muted">Posts de las personas que seguís</p>
        </div>
        <button
          type="button"
          onClick={fetchFeed}
          disabled={loading}
          className="neo-btn-ghost text-sm disabled:opacity-50"
        >
          {loading ? 'Actualizando…' : 'Refrescar'}
        </button>
      </header>

      {/* Composer */}
      <CreatePost onCreated={fetchFeed} />

      {/* Estados */}
      {loading && posts.length === 0 && <FeedSkeleton />}

      {error && (
        <div className="neo-card p-6 text-center border border-neo-accent/40">
          <p className="text-neo-accent font-semibold mb-2">Error</p>
          <p className="text-sm text-neo-muted mb-4">{error}</p>
          <button onClick={fetchFeed} className="neo-btn-primary">Reintentar</button>
        </div>
      )}

      {!loading && !error && posts.length === 0 && <EmptyFeed />}

      {/* Lista de posts */}
      {posts.length > 0 && (
        <div>
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="space-y-6">
      {[0, 1, 2].map((i) => (
        <div key={i} className="neo-card p-5 animate-pulse">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-neo-border" />
            <div className="space-y-2">
              <div className="h-3 w-24 bg-neo-border rounded" />
              <div className="h-2 w-16 bg-neo-border rounded" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-3 w-full bg-neo-border rounded" />
            <div className="h-3 w-4/5 bg-neo-border rounded" />
            <div className="h-3 w-3/5 bg-neo-border rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyFeed() {
  return (
    <div className="neo-card p-8 text-center">
      <h2 className="text-xl font-bold mb-2">Tu feed está vacío</h2>
      <p className="text-neo-muted mb-6">
        Empezá a seguir gente para ver sus posts acá. Mientras tanto, mirá lo que se está
        publicando en toda la red.
      </p>
      <Link to="/explore" className="neo-btn-primary">Ir a Explorar</Link>
    </div>
  );
}
