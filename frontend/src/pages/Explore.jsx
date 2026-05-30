import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client.js';
import PostCard from '../components/PostCard.jsx';
import { relativeTime, resolveMediaUrl } from '../lib/format.js';

export default function Explore() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounce 300ms para no spamear /api/search en cada tecla
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-3xl font-extrabold mb-1">Explorar</h1>
        <p className="text-sm text-neo-muted">
          Descubrí usuarios, posts y hashtags en NeoSocial
        </p>
      </header>

      <SearchBar value={query} onChange={setQuery} />

      {debouncedQuery ? (
        <SearchResults q={debouncedQuery} />
      ) : (
        <ExploreFeed />
      )}
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
        className="neo-input pl-11"
        aria-label="Buscar"
      />
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-neo-muted pointer-events-none"
      >
        <circle cx="11" cy="11" r="7" />
        <line x1="21" y1="21" x2="16.5" y2="16.5" />
      </svg>
    </div>
  );
}

// ---- Feed default cuando no hay query ----

function ExploreFeed() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchExplore = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await client.get('/api/posts/explore');
      if (data?.success) setPosts(data.data.posts || []);
      else setError(data?.message || 'No se pudo cargar');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error de red');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExplore();
  }, [fetchExplore]);

  if (loading) {
    return (
      <div className="neo-card p-8 text-center text-neo-muted">Cargando…</div>
    );
  }
  if (error) {
    return (
      <div className="neo-card p-6 text-center border border-neo-accent/40">
        <p className="text-neo-accent font-semibold mb-2">Error</p>
        <p className="text-sm text-neo-muted mb-4">{error}</p>
        <button onClick={fetchExplore} className="neo-btn-primary">Reintentar</button>
      </div>
    );
  }
  if (posts.length === 0) {
    return (
      <div className="neo-card p-8 text-center">
        <p className="text-neo-muted">Todavía no hay posts en la red.</p>
      </div>
    );
  }
  return (
    <div>
      {posts.map((p) => (
        <PostCard key={p.id} post={p} />
      ))}
    </div>
  );
}

// ---- Resultados de búsqueda ----

function SearchResults({ q }) {
  const [data, setData] = useState({ users: [], posts: [], hashtags: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    client
      .get('/api/search', { params: { q } })
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
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [q]);

  if (loading) {
    return <div className="neo-card p-6 text-center text-neo-muted">Buscando "{q}"…</div>;
  }
  if (error) {
    return (
      <div className="neo-card p-6 text-center border border-neo-accent/40">
        <p className="text-sm text-neo-accent">{error}</p>
      </div>
    );
  }

  const { users, posts, hashtags } = data;
  const totalResults = users.length + posts.length + hashtags.length;

  if (totalResults === 0) {
    return (
      <div className="neo-card p-8 text-center">
        <p className="text-neo-muted">
          Sin resultados para <span className="text-white font-semibold">"{q}"</span>
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
              <button
                key={h.name}
                type="button"
                className="neo-chip text-sm"
                title={`${h.postCount} post${h.postCount === 1 ? '' : 's'}`}
              >
                #{h.name}
                <span className="ml-2 text-neo-muted">{h.postCount}</span>
              </button>
            ))}
          </div>
        </Section>
      )}

      {users.length > 0 && (
        <Section title="Usuarios">
          <ul className="space-y-3">
            {users.map((u) => (
              <UserResult key={u.id} user={u} />
            ))}
          </ul>
        </Section>
      )}

      {posts.length > 0 && (
        <Section title="Posts">
          <ul className="space-y-3">
            {posts.map((p) => (
              <PostResult key={p.id} post={p} />
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="neo-card p-5">
      <h3 className="text-xs uppercase tracking-wide text-neo-muted mb-3">{title}</h3>
      {children}
    </section>
  );
}

function UserResult({ user }) {
  return (
    <li>
      <Link
        to={`/profile/${user.username}`}
        className="flex items-center gap-3 p-2 rounded-xl hover:bg-neo-bg/60 transition-colors"
      >
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.username}
            className="w-12 h-12 rounded-full bg-neo-bg border border-neo-border"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-neo-accent/20 text-neo-accent grid place-items-center font-bold">
            {user.username?.[0]?.toUpperCase() ?? '?'}
          </div>
        )}
        <div className="min-w-0">
          <p className="font-semibold">@{user.username}</p>
          {user.bio && (
            <p className="text-sm text-neo-muted truncate">{user.bio}</p>
          )}
        </div>
      </Link>
    </li>
  );
}

function PostResult({ post }) {
  const imageUrl = resolveMediaUrl(post.imageUrl);
  return (
    <li className="flex gap-3 p-2 rounded-xl">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          className="w-16 h-16 rounded-lg object-cover bg-neo-bg border border-neo-border shrink-0"
        />
      ) : (
        <div className="w-16 h-16 rounded-lg bg-neo-bg border border-neo-border shrink-0 grid place-items-center text-neo-muted text-xs">
          texto
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <Link
            to={`/profile/${post.author}`}
            className="font-semibold text-sm hover:text-neo-accent"
          >
            @{post.author}
          </Link>
          <span className="text-xs text-neo-muted">{relativeTime(post.createdAt)}</span>
        </div>
        <p className="text-sm text-white/90 line-clamp-2 break-words">{post.content}</p>
      </div>
    </li>
  );
}
