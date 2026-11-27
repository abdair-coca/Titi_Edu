import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { formatDate, resolveMediaUrl } from '../lib/format.js';
import { useCountUp, useStaggerReveal, usePopIn } from '../lib/motion.js';
import PostCard, { PostCardSkeleton } from '../components/PostCard.jsx';
import StreakBadge from '../components/StreakBadge.jsx';
import AchievementsSection from '../components/AchievementsSection.jsx';
import EditProfileModal from '../components/EditProfileModal.jsx';
import { Pill } from '../components/catalog/CatalogFilters.jsx';
import Avatar from '../components/social/Avatar.jsx';
import FollowButton from '../components/social/FollowButton.jsx';
import { ErrorBox } from '../components/social/StateBlocks.jsx';
import { BackLink, BTN_SECONDARY, EmptyState, SURFACE } from '../components/ui/v3.jsx';
import {
  BookmarkIcon,
  CalendarIcon,
  GridIcon,
  HeartIcon,
  PencilIcon,
  PinIcon,
  UserIcon,
  UsersIcon,
} from '../components/icons.jsx';
import useStreak from '../hooks/useStreak.js';

// Perfil v3 (rediseno-plataforma-v3 R1): cabecera como superficie con portada
// a sangre, stats con conteo, racha y logros en el rail, pestañas de pastillas.

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
  const [isSelf, setIsSelf] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);

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
    if (error === 'Usuario no encontrado') {
      return (
        <div className="max-w-2xl mx-auto">
          <BackLink to="/explore">Explorar</BackLink>
          <EmptyState
            state="triste"
            title="No encontramos a"
            accent={`@${username}`}
            text="Puede que haya cambiado su nombre de usuario. Buscalo en Explorar."
          >
            <Link to={`/explore?q=${encodeURIComponent(username || '')}`} className="titi-btn-primary">
              Buscar en Explorar
            </Link>
          </EmptyState>
        </div>
      );
    }
    return (
      <div className="max-w-2xl mx-auto">
        <ErrorBox title="No pudimos cargar el perfil" message={error} onRetry={fetchProfile} />
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

  const tabs = [
    { id: 'posts', label: 'Posts', Icon: GridIcon, solid: 'bg-titi-dark text-white', count: stats.postCount },
    ...(isSelf
      ? [
          { id: 'saved', label: 'Guardados', Icon: BookmarkIcon, solid: 'bg-titi-yellow text-titi-dark', count: savedLoaded ? saved.length : null },
          { id: 'liked', label: 'Likes', Icon: HeartIcon, solid: 'bg-red-500 text-white', count: likedLoaded ? liked.length : null },
        ]
      : []),
  ];

  return (
    <div className="max-w-6xl mx-auto">
      {/* Cabecera del perfil (superficie v3) */}
      <section ref={headerRef} aria-label={`Perfil de @${user.username}`} className={`${SURFACE} mb-6 overflow-hidden`}>
        {/* Portada a sangre */}
        <div className="relative w-full h-28 sm:h-40 bg-titi-yellow-light border-b-2 border-titi-dark overflow-hidden">
          {user.bannerUrl ? (
            <img src={resolveMediaUrl(user.bannerUrl)} alt="" className="w-full h-full object-cover" />
          ) : (
            <div aria-hidden="true" className="w-full h-full grid place-items-center">
              <img src="/Titi.png" alt="" draggable={false} className="absolute -right-4 -bottom-6 w-32 h-32 object-contain opacity-20 -rotate-12 select-none" />
              <span className="text-sm font-extrabold uppercase tracking-wide text-titi-dark/40">Titi · aprendemos juntos</span>
            </div>
          )}
        </div>

        <div className="px-4 sm:px-6 pb-5">
          {/* Avatar superpuesto + acciones */}
          <div className="flex items-end justify-between gap-3 -mt-12 sm:-mt-14 mb-3">
            <Avatar username={user.username} src={user.avatarUrl} size="xl" className="relative ring-4 ring-white" />
            <div className="flex items-center gap-2 pb-1">
              {isSelf && (
                <>
                  <span className="hidden sm:inline-flex h-8 items-center px-3 rounded-full bg-titi-yellow border-2 border-titi-dark text-xs font-extrabold text-titi-dark">
                    Vos
                  </span>
                  <button type="button" onClick={() => setEditModalOpen(true)} className={BTN_SECONDARY}>
                    <PencilIcon className="w-4 h-4" />
                    Editar perfil
                  </button>
                </>
              )}
              {!isSelf && isAuthenticated && (
                <FollowButton
                  key={user.username}
                  username={user.username}
                  initialFollowing={following}
                  onChange={(now) => {
                    setFollowing(now);
                    setFollowerCount((c) => Math.max(0, c + (now ? 1 : -1)));
                  }}
                />
              )}
            </div>
          </div>

          {/* Datos */}
          <h1 className="text-3xl sm:text-4xl font-black text-titi-dark leading-tight break-words">
            <span className="text-titi-streak">@</span>
            {user.username}
          </h1>
          {user.bio ? (
            <p className="text-base font-medium text-titi-dark whitespace-pre-wrap break-words mt-1 max-w-2xl">{user.bio}</p>
          ) : isSelf ? (
            <button
              type="button"
              onClick={() => setEditModalOpen(true)}
              className="mt-1 text-sm font-bold uppercase tracking-wide text-blue-500 hover:text-blue-600 transition-all duration-150 active:scale-95"
            >
              Agregá una biografía
            </button>
          ) : null}

          <div className="flex flex-wrap gap-2 mt-3">
            {location && (
              <MetaChip Icon={PinIcon} solid="bg-green-500">
                {location.city}, {location.country}
              </MetaChip>
            )}
            {user.createdAt && (
              <MetaChip Icon={CalendarIcon} solid="bg-blue-500">
                Se unió el {formatDate(user.createdAt)}
              </MetaChip>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-4">
            <Stat label={stats.postCount === 1 ? 'Post' : 'Posts'} value={stats.postCount} Icon={GridIcon} solid="bg-titi-yellow text-titi-dark" />
            <Stat label={followerCount === 1 ? 'Seguidor' : 'Seguidores'} value={followerCount} Icon={UsersIcon} solid="bg-blue-500 text-white" />
            <Stat label="Seguidos" value={stats.followingCount} Icon={UserIcon} solid="bg-green-500 text-white" />
          </div>
        </div>
      </section>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6 lg:items-start">
        {/* Rail: racha + logros (arriba en celular) */}
        <aside className="lg:order-2 flex flex-col gap-5 mb-6 lg:mb-0 min-w-0">
          <StreakBadge
            variant="hero"
            racha={isSelf ? streak.racha : profileStreak?.racha}
            estaActiva={isSelf ? streak.estaActiva : profileStreak?.estaActiva}
            ultimaActividad={isSelf ? streak.ultimaActividad : profileStreak?.ultimaActividad}
            isSelf={isSelf}
          />
          <AchievementsSection username={username} isSelf={isSelf} />
        </aside>

        <div className="lg:order-1 min-w-0">
          {/* Pestañas */}
          <div role="group" aria-label="Secciones del perfil" className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-4 px-4 sm:mx-0 sm:px-0 py-1 mb-4">
            {tabs.map(({ id, label, Icon, solid, count }) => (
              <Pill key={id} active={tab === id} onClick={() => setTab(id)}>
                <span className={`w-7 h-7 rounded-full grid place-items-center ${solid}`}>
                  <Icon className="w-4 h-4" filled={id !== 'posts' && tab === id} />
                </span>
                {label}
                {typeof count === 'number' && <span className="text-xs font-extrabold tabular-nums text-gray-500">{count}</span>}
              </Pill>
            ))}
          </div>

          {tab === 'posts' && (
            <section aria-label={`Posts de @${user.username}`}>
              <PostsList
                loading={postsLoading}
                error={postsError}
                posts={posts}
                onRetry={fetchUserPosts}
                empty={
                  isSelf
                    ? { state: 'idle', title: 'Todavía no', accent: 'publicaste', text: 'Compartí lo que estás aprendiendo y aparece acá.', to: '/feed', cta: 'Publicar en Inicio' }
                    : { state: 'pensando', title: `@${user.username} todavía no`, accent: 'publicó', text: 'Mientras tanto, descubrí lo que comparte la comunidad.', to: '/explore', cta: 'Ir a Explorar' }
                }
                handleDelete={handleDeletePost}
                handleEdit={handleEditPost}
                onChange={handlePostChange}
              />
            </section>
          )}

          {tab === 'saved' && isSelf && (
            <section aria-label="Posts guardados">
              <PostsList
                loading={savedLoading}
                error={savedError}
                posts={saved}
                onRetry={fetchSaved}
                empty={{ state: 'pensando', title: 'Nada', accent: 'guardado', text: 'Guardá un post con el marcador y lo encontrás rápido acá.', to: '/explore', cta: 'Ir a Explorar' }}
                handleDelete={handleDeletePost}
                handleEdit={handleEditPost}
                onChange={handlePostChange}
              />
            </section>
          )}

          {tab === 'liked' && isSelf && (
            <section aria-label="Posts con like">
              <PostsList
                loading={likedLoading}
                error={likedError}
                posts={liked}
                onRetry={fetchLiked}
                empty={{ state: 'pensando', title: 'Sin', accent: 'likes', text: 'Los posts que te gusten aparecen acá, del más nuevo al más viejo.', to: '/feed', cta: 'Ir a Inicio' }}
                handleDelete={handleDeletePost}
                handleEdit={handleEditPost}
                onChange={handlePostChange}
              />
            </section>
          )}
        </div>
      </div>

      {/* Modal para editar perfil propio */}
      {isSelf && (
        <EditProfileModal
          open={editModalOpen}
          user={user}
          onSaved={(updated) => {
            setProfile((prev) => (prev ? { ...prev, user: { ...prev.user, ...updated } } : prev));
          }}
          onClose={() => setEditModalOpen(false)}
        />
      )}
    </div>
  );
}

function MetaChip({ Icon, solid, children }) {
  return (
    <span className="inline-flex items-center gap-1.5 h-8 pl-1 pr-3 max-w-full rounded-full bg-titi-cream border-2 border-gray-200 text-xs font-bold text-titi-dark">
      <span className={`w-6 h-6 rounded-full grid place-items-center text-white shrink-0 ${solid}`}>
        <Icon className="w-3.5 h-3.5" />
      </span>
      <span className="truncate">{children}</span>
    </span>
  );
}

function Stat({ label, value, Icon, solid }) {
  const shown = useCountUp(value ?? 0);
  return (
    <div className="flex flex-col sm:flex-row items-center sm:items-center gap-1.5 sm:gap-3 p-2.5 sm:p-3 rounded-xl bg-titi-cream border-2 border-gray-200 text-center sm:text-left min-w-0">
      <span className={`w-9 h-9 rounded-xl border-2 border-titi-dark grid place-items-center shrink-0 -rotate-6 ${solid}`} aria-hidden="true">
        <Icon className="w-4 h-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-2xl sm:text-3xl font-black text-titi-dark tabular-nums leading-none">{shown}</span>
        <span className="block text-xs font-extrabold uppercase tracking-wide text-gray-500 mt-1 truncate">{label}</span>
      </span>
    </div>
  );
}

function PostsList({ loading, error, posts, onRetry, empty, handleDelete, handleEdit, onChange }) {
  const listRef = useStaggerReveal([loading, posts.length === 0]);
  if (loading) {
    return (
      <div aria-busy="true" aria-label="Cargando posts">
        <PostCardSkeleton />
        <PostCardSkeleton withImage />
      </div>
    );
  }
  if (error) return <ErrorBox title="No pudimos cargar los posts" message={error} onRetry={onRetry} />;
  if (posts.length === 0) {
    return (
      <EmptyState state={empty.state} title={empty.title} accent={empty.accent} text={empty.text}>
        <Link to={empty.to} className="titi-btn-primary">
          {empty.cta}
        </Link>
      </EmptyState>
    );
  }
  return (
    <div ref={listRef}>
      {posts.map((p) => (
        <PostCard key={p.id} post={p} onDelete={handleDelete} onEdit={handleEdit} onChange={onChange} />
      ))}
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="max-w-6xl mx-auto animate-pulse motion-reduce:animate-none" aria-busy="true" aria-label="Cargando perfil">
      <div className="bg-white rounded-2xl border-2 border-gray-200 overflow-hidden mb-6">
        <div className="h-28 sm:h-40 bg-gray-100 border-b-2 border-gray-200" />
        <div className="px-4 sm:px-6 pb-5">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gray-100 ring-4 ring-white -mt-12 sm:-mt-14 mb-3" />
          <div className="h-8 w-48 bg-gray-100 rounded-full" />
          <div className="h-4 w-2/3 bg-gray-100 rounded-full mt-3" />
          <div className="flex gap-2 mt-3">
            <div className="h-8 w-36 bg-gray-100 rounded-full" />
            <div className="h-8 w-40 bg-gray-100 rounded-full" />
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[76px] rounded-xl bg-gray-100" />
            ))}
          </div>
        </div>
      </div>
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6">
        <div className="lg:order-2 flex flex-col gap-5 mb-6">
          <div className="h-52 rounded-2xl border-2 border-gray-200 bg-white" />
        </div>
        <div className="lg:order-1">
          <div className="flex gap-2 mb-4">
            <div className="h-10 w-28 bg-gray-100 rounded-full" />
            <div className="h-10 w-32 bg-gray-100 rounded-full" />
          </div>
          <div className="h-40 rounded-2xl border-2 border-gray-200 bg-white" />
        </div>
      </div>
    </div>
  );
}
