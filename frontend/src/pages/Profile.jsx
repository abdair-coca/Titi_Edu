import { useCallback, useEffect, useState } from 'react';
import TitiSvg from '../components/titi/TitiSvg.jsx';
import { useParams } from 'react-router-dom';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { formatDate, relativeTime, resolveMediaUrl } from '../lib/format.js';
import { useStaggerReveal, usePopIn } from '../lib/motion.js';
import OptionsPosts from '../components/OptionsPosts.jsx';
import PostCard from '../components/PostCard.jsx';
import StreakBadge from '../components/StreakBadge.jsx';
import AchievementsSection from '../components/AchievementsSection.jsx';
import useStreak from '../hooks/useStreak.js';

export default function Profile() {
  const { username } = useParams();
  const { isAuthenticated } = useAuth();
  const [profileStreak, setProfileStreak] = useState(null);
  const streak = useStreak();

  const [profile, setProfile] = useState(null);
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [following, setFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followBusy, setFollowBusy] = useState(false);
  const [isSelf, setIsSelf] = useState(false);

  const [tab, setTab] = useState('posts'); // 'posts' | 'saved' | 'liked'

  // El header entra con pop cuando llegan los datos (la página ya hizo su
  // PageTransition mientras cargaba, así que el contenido async necesita el suyo).
  // Dep por valor estable (username del perfil), no por referencia de `profile`:
  // así no re-anima cuando cambian stats/followers y el objeto se reemplaza.
  const headerRef = usePopIn([profile?.user?.username]);

  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsError, setPostsError] = useState(null);

  const [saved, setSaved] = useState([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [savedError, setSavedError] = useState(null);
  const [savedLoaded, setSavedLoaded] = useState(false);

  const [liked, setLiked] = useState([]);
  const [likedLoading, setLikedLoading] = useState(false);
  const [likedError, setLikedError] = useState(null);
  const [likedLoaded, setLikedLoaded] = useState(false);

  const fetchUserPosts = useCallback(async () => {
    setPostsLoading(true); setPostsError(null);
    try {
      const { data } = await client.get('/api/posts/explore');
      if (data?.success) {
        const own = (data.data.posts || [])
          .filter((p) => p.author === username)
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setPosts(own);
      } else {
        setPostsError(data?.message || 'No se pudieron cargar los posts');
      }
    } catch (err) {
      setPostsError(err.response?.data?.message || err.message || 'Error de red');
    } finally {
      setPostsLoading(false);
    }
  }, [username]);

  const fetchSaved = useCallback(async () => {
    setSavedLoading(true); setSavedError(null);
    try {
      const { data } = await client.get('/api/posts/me/saved');
      if (data?.success) {
        setSaved(data.data.posts || []);
      } else {
        setSavedError(data?.message || 'No se pudieron cargar los guardados');
      }
    } catch (err) {
      setSavedError(err.response?.data?.message || err.message || 'Error de red');
    } finally {
      setSavedLoading(false);
      setSavedLoaded(true);
    }
  }, []);

  const fetchLiked = useCallback(async () => {
    setLikedLoading(true); setLikedError(null);
    try {
      const { data } = await client.get('/api/posts/me/liked');
      if (data?.success) {
        setLiked(data.data.posts || []);
      } else {
        setLikedError(data?.message || 'No se pudieron cargar los likes');
      }
    } catch (err) {
      setLikedError(err.response?.data?.message || err.message || 'Error de red');
    } finally {
      setLikedLoading(false);
      setLikedLoaded(true);
    }
  }, []);

  useEffect(() => { fetchUserPosts(); }, [fetchUserPosts]);

  useEffect(() => {
    if (!isSelf) return;
    if (!savedLoaded && !savedLoading) fetchSaved();
    if (!likedLoaded && !likedLoading) fetchLiked();
  }, [isSelf, savedLoaded, savedLoading, likedLoaded, likedLoading, fetchSaved, fetchLiked]);

  // Reset tabs cache cuando cambia de perfil
  useEffect(() => {
    setTab('posts');
    setSaved([]); setSavedLoaded(false); setSavedError(null);
    setLiked([]); setLikedLoaded(false); setLikedError(null);
  }, [username]);

  const fetchProfile = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data } = await client.get(`/api/users/${username}`);
      if (data?.success) {
        const { user, stats, isFollowing, isSelf, location } = data.data;
        setProfile({ user, stats });
        setLocation(location || null);
        setFollowing(Boolean(isFollowing));
        setFollowerCount(stats?.followerCount ?? 0);
        setIsSelf(Boolean(isSelf));
      } else {
        setError(data?.message || 'Usuario no encontrado');
      }
    } catch (err) {
      const status = err.response?.status;
      setError(status === 404 ? 'Usuario no encontrado' : (err.response?.data?.message || err.message || 'Error de red'));
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  async function toggleFollow() {
    if (!isAuthenticated || isSelf || followBusy) return;
    const wasFollowing = following;
    setFollowing(!wasFollowing);
    setFollowerCount((c) => c + (wasFollowing ? -1 : 1));
    setFollowBusy(true);
    try {
      const url = wasFollowing
        ? `/api/users/${username}/unfollow`
        : `/api/users/${username}/follow`;
      const { data } = await client.post(url);
      if (!data?.success) {
        setFollowing(wasFollowing);
        setFollowerCount((c) => c + (wasFollowing ? 1 : -1));
      }
    } catch {
      setFollowing(wasFollowing);
      setFollowerCount((c) => c + (wasFollowing ? 1 : -1));
    } finally {
      setFollowBusy(false);
    }
  }

  const [rachaError, setRachaError] = useState(null);

  const streakToast = useCallback(async () => {
    if (isSelf) return;

    try {
      const { data } = await client.get(`/api/progress/${username}/streak`);

      if (data?.success) {
        setProfileStreak(data.data);
      } else {
        setRachaError(data?.message || 'No se pudo cargar la racha.');
      }
    } catch (err) {
      setRachaError(
        err.response?.data?.message ||
        err.message ||
        'Error de red'
      );
    }
  }, [username, isSelf]);

  useEffect(() => {
    if (!isSelf) {
      streakToast();
    }
  }, [isSelf, streakToast]);
  if (loading) return <ProfileSkeleton />;

  if (error) {
    return (
      <div className="bg-white border-2 border-titi-red/40 rounded-2xl p-8 text-center shadow-titi">
        <h2 className="text-xl font-extrabold mb-2 text-titi-red">¡Ups!</h2>
        <p className="text-titi-muted mb-4">{error}</p>
        <button onClick={fetchProfile} className="titi-btn-primary">Reintentar</button>
      </div>
    );
  }

  if (!profile) return null;

  const { user, stats } = profile;

  function handleDeletePost(postId) {
    setPosts(prev => prev.filter(p => p.id !== postId));
    setSaved(prev => prev.filter(p => p.id !== postId));
    setLiked(prev => prev.filter(p => p.id !== postId));
    setProfile(prev => ({
      ...prev,
      stats: { ...prev.stats, postCount: Math.max(0, prev.stats.postCount - 1) },
    }));
  }

  function handleEditPost(updated) {
    const apply = (p) => (p.id === updated.id ? { ...p, ...updated } : p);
    setPosts(prev => prev.map(apply));
    setSaved(prev => prev.map(apply));
    setLiked(prev => prev.map(apply));
  }

  function handlePostChange(change) {
    if (!change) return;
    // Si se desguarda un post desde la lista de guardados, lo sacamos
    if (change.saved === false) {
      setSaved(prev => prev.filter(p => p.id !== change.id));
    }
    // Si se quita el like desde la lista de likes, lo sacamos
    if (change.liked === false) {
      setLiked(prev => prev.filter(p => p.id !== change.id));
    }
  }

  return (
    <div>
      {/* Header del perfil */}
      <div ref={headerRef} className="titi-card p-6 mb-6 border-t-4 border-t-titi-yellow">
        <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start text-center sm:text-left">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.username}
              className="w-28 h-28 rounded-full bg-titi-bg border-4 border-titi-yellow shrink-0 shadow-titi"
            />
          ) : (
            <div className="w-28 h-28 rounded-full bg-titi-yellow text-titi-dark grid place-items-center text-4xl font-extrabold shrink-0 border-4 border-titi-yellow shadow-titi">
              {user.username?.[0]?.toUpperCase() ?? '?'}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mb-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-titi-text">@{user.username}</h1>
              {!isSelf && isAuthenticated && (
                <button
                  type="button"
                  onClick={toggleFollow}
                  disabled={followBusy}
                  className={
                    following
                      ? 'titi-btn-ghost text-sm disabled:opacity-50'
                      : 'titi-btn-primary text-sm disabled:opacity-50'
                  }
                >
                  {followBusy ? '…' : following ? 'Siguiendo' : 'Seguir'}
                </button>
              )}
              {isSelf && (
                <span className="inline-block text-xs font-extrabold text-titi-dark bg-titi-yellow px-3 py-1 rounded-full">Vos</span>
              )}
            </div>

            {user.bio ? (
              <p className="text-titi-text whitespace-pre-wrap mb-2 font-semibold">{user.bio}</p>
            ) : (
              <p className="text-titi-muted italic mb-2">Sin biografía.</p>
            )}

            {location && (
              <p className="text-sm text-titi-muted flex items-center gap-1.5 justify-center sm:justify-start mb-1 font-semibold">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-titi-green" aria-hidden="true">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span>{location.city}, {location.country}</span>
              </p>
            )}

            {user.createdAt && (
              <p className="text-xs text-titi-muted font-semibold">
                Se unió el {formatDate(user.createdAt)}
              </p>
            )}
          </div>
        </div>

        {/* Racha — solo para mi propio perfil */}

        <div className="mt-6">
          <StreakBadge
            variant="hero"
            racha={isSelf ? streak.racha : profileStreak?.racha}
            estaActiva={isSelf ? streak.estaActiva : profileStreak?.estaActiva}
            ultimaActividad={isSelf ? streak.ultimaActividad : profileStreak?.ultimaActividad}
            isSelf={isSelf}
          />
        </div>


        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t-2 border-titi-border">
          <Stat label="Posts" value={stats.postCount} color="text-titi-yellow" />
          <Stat label="Seguidores" value={followerCount} color="text-titi-blue" />
          <Stat label="Seguidos" value={stats.followingCount} color="text-titi-green" />
        </div>
      </div>

      {/* Logros */}
      <AchievementsSection username={username} isSelf={isSelf} />

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Secciones del perfil"
        className="flex gap-1 mb-5 border-b-2 border-titi-border px-1 overflow-x-auto scrollbar-none"
      >
        <TabButton
          active={tab === 'posts'}
          onClick={() => setTab('posts')}
          icon={<GridIcon className="w-4 h-4" />}
          label="Posts"
          count={stats.postCount}
        />
        {isSelf && (
          <>
            <TabButton
              active={tab === 'saved'}
              onClick={() => setTab('saved')}
              icon={<BookmarkIcon className="w-4 h-4" filled={tab === 'saved'} />}
              label="Guardados"
              count={savedLoaded ? saved.length : null}
            />
            <TabButton
              active={tab === 'liked'}
              onClick={() => setTab('liked')}
              icon={<HeartIcon className="w-4 h-4" filled={tab === 'liked'} />}
              label="Likes"
              count={likedLoaded ? liked.length : null}
            />
          </>
        )}
      </div>

      {/* Contenido del tab activo */}
      {tab === 'posts' && (
        <section aria-label={`Posts de @${user.username}`} role="tabpanel">
          <PostsList
            loading={postsLoading}
            error={postsError}
            posts={posts}
            onRetry={fetchUserPosts}
            emptyTitle={isSelf ? 'Todavía no publicaste nada' : `@${user.username} no ha publicado nada todavía`}
            emptyDescription={isSelf ? '¡Comparte tu primer post para que aparezca aquí!' : 'Vuelve más tarde para ver novedades.'}
            handleDelete={handleDeletePost}
            handleEdit={handleEditPost}
            onChange={handlePostChange}
          />
        </section>
      )}

      {tab === 'saved' && isSelf && (
        <section aria-label="Posts guardados" role="tabpanel">
          <PostsList
            loading={savedLoading}
            error={savedError}
            posts={saved}
            onRetry={fetchSaved}
            emptyTitle="No tienes posts guardados"
            emptyDescription="Cuando guardes un post aparecerá aquí para que lo encuentres rápido."
            handleDelete={handleDeletePost}
            handleEdit={handleEditPost}
            onChange={handlePostChange}
          />
        </section>
      )}

      {tab === 'liked' && isSelf && (
        <section aria-label="Posts con like" role="tabpanel">
          <PostsList
            loading={likedLoading}
            error={likedError}
            posts={liked}
            onRetry={fetchLiked}
            emptyTitle="Aún no diste like a ningún post"
            emptyDescription="Los posts a los que des like aparecerán aquí, ordenados por fecha."
            handleDelete={handleDeletePost}
            handleEdit={handleEditPost}
            onChange={handlePostChange}
          />
        </section>
      )}
    </div>
  );
}

function TabButton({ active, onClick, icon, label, count }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 sm:px-4 py-2.5 -mb-0.5 font-bold text-sm rounded-t-xl transition-all flex-shrink-0 ${active
        ? 'text-titi-dark bg-titi-yellow-light border-b-2 border-titi-yellow'
        : 'text-titi-muted hover:text-titi-dark hover:bg-titi-bg'
        }`}
    >
      {icon}
      <span>{label}</span>
      {typeof count === 'number' && (
        <span className={`text-xs tabular-nums px-2 py-0.5 rounded-full font-extrabold ${active ? 'bg-titi-yellow text-titi-dark' : 'bg-titi-border text-titi-muted'
          }`}>
          {count}
        </span>
      )}
    </button>
  );
}

function PostsList({ loading, error, posts, onRetry, emptyTitle, emptyDescription, handleDelete, handleEdit, onChange }) {
  const listRef = useStaggerReveal([posts.length]);
  if (loading) {
    return (
      <div className="titi-card p-6 text-center text-titi-muted font-semibold">Cargando…</div>
    );
  }
  if (error) {
    return (
      <div className="bg-white border-2 border-titi-red/40 rounded-2xl p-6 text-center shadow-titi">
        <p className="text-sm text-titi-red font-bold mb-3">{error}</p>
        <button onClick={onRetry} className="titi-btn-primary">Reintentar</button>
      </div>
    );
  }
  if (posts.length === 0) {
    return (
      <div className="titi-card p-8 text-center flex flex-col items-center">
        <TitiSvg className="w-24 h-24 mb-4 drop-shadow-sm select-none" />
        <h3 className="text-xl font-bold text-titi-dark mb-2">{emptyTitle}</h3>
        <p className="text-sm text-titi-muted max-w-xs">{emptyDescription}</p>
      </div>
    );
  }
  return (
    <div ref={listRef} className="space-y-4">
      {posts.map((p) => (
        <PostCard
          key={p.id}
          post={p}
          onDelete={handleDelete}
          onEdit={handleEdit}
          onChange={onChange}
        />
      ))}
    </div>
  );
}

const HeartIcon = ({ filled, className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

const BookmarkIcon = ({ filled, className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </svg>
);

const GridIcon = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
  </svg>
);

function Stat({ label, value, color = 'text-titi-text' }) {
  return (
    <div className="text-center">
      <p className={`text-2xl sm:text-3xl font-extrabold tabular-nums ${color}`}>{value ?? 0}</p>
      <p className="text-xs uppercase tracking-wide text-titi-muted font-extrabold">{label}</p>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="titi-card p-6 animate-pulse">
      <div className="flex gap-6">
        <div className="w-28 h-28 rounded-full bg-titi-border shrink-0" />
        <div className="flex-1 space-y-3 pt-3">
          <div className="h-5 w-40 bg-titi-border rounded" />
          <div className="h-3 w-3/4 bg-titi-border rounded" />
          <div className="h-3 w-1/2 bg-titi-border rounded" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t-2 border-titi-border">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-2 text-center">
            <div className="h-6 w-12 bg-titi-border rounded mx-auto" />
            <div className="h-2 w-16 bg-titi-border rounded mx-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
