import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import client from '../api/client.js';
import PostCard, { PostCardSkeleton } from '../components/PostCard.jsx';
import { ErrorBox } from '../components/social/StateBlocks.jsx';
import { TrendingPanel } from '../components/social/TrendingHashtags.jsx';
import { useTrending } from '../components/social/useSocialData.js';
import { BackLink, EmptyState, RoleBadge } from '../components/ui/v3.jsx';
import { HashIcon } from '../components/icons.jsx';
import { useStaggerReveal } from '../lib/motion.js';

// Hashtag v3 (rediseno-plataforma-v3 R2): cabecera con el tema, posts y, en
// desktop, el rail de tendencias para saltar a otros temas.

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

  const trending = useTrending(8);
  const listRef = useStaggerReveal([loading, normalized]);

  return (
    <div className="max-w-6xl mx-auto lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6 lg:items-start">
      <div className="max-w-2xl w-full mx-auto lg:max-w-none lg:mx-0 min-w-0">
        <BackLink to="/explore">Explorar</BackLink>
        <header className="flex items-center gap-3 mb-5">
          <RoleBadge Icon={HashIcon} solid="bg-titi-yellow" size="lg" />
          <div className="min-w-0">
            <h1 className="text-3xl sm:text-4xl font-black text-titi-dark leading-tight break-all">
              <span className="text-titi-streak">#</span>
              {normalized}
            </h1>
            <p className="text-base font-medium text-gray-500 tabular-nums">
              {loading ? 'Buscando posts…' : `${posts.length} ${posts.length === 1 ? 'post' : 'posts'} con este tema`}
            </p>
          </div>
        </header>

        {loading && posts.length === 0 && (
          <div aria-busy="true" aria-label="Cargando posts">
            <PostCardSkeleton />
            <PostCardSkeleton withImage />
          </div>
        )}

        {error && <ErrorBox title="No pudimos cargar este tema" message={error} onRetry={fetchPosts} />}

        {!loading && !error && posts.length === 0 && (
          <EmptyState
            state="pensando"
            title={`Nadie usó #${normalized}`}
            accent="todavía"
            text="Estrená el tema con una publicación en tu inicio."
          >
            <Link to="/feed" className="titi-btn-primary">
              Publicar en Inicio
            </Link>
          </EmptyState>
        )}

        {posts.length > 0 && (
          <div ref={listRef}>
            {posts.map((p) => (
              <PostCard key={p.id} post={p} onDelete={handleDelete} onEdit={handleEdit} />
            ))}
          </div>
        )}
      </div>

      {/* Rail (solo desktop): otros temas */}
      <aside className="hidden lg:flex flex-col gap-5 sticky top-8">
        <TrendingPanel trending={trending} />
      </aside>
    </div>
  );
}
