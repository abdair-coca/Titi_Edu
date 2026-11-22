import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useStaggerReveal } from '../lib/motion.js';
import { relativeTime, resolveMediaUrl } from '../lib/format.js';
import PostCard, { PostCardSkeleton } from '../components/PostCard.jsx';
import TitiMascot from '../components/TitiMascot.jsx';
import CategoriesExplorer from '../components/CategoriesExplorer.jsx';
import CourseCard, { CourseCardSkeleton } from '../components/catalog/CourseCard.jsx';
import CourseQuickView from '../components/catalog/CourseQuickView.jsx';
import CourseRow, { RowItem } from '../components/catalog/CourseRow.jsx';
import { Pill } from '../components/catalog/CatalogFilters.jsx';
import { enrolledCount, friendsByCourse } from '../components/catalog/catalogData.js';
import useQuickViewParam from '../components/catalog/useQuickViewParam.js';
import Avatar from '../components/social/Avatar.jsx';
import PersonCard, { PersonCardSkeleton, socialProof } from '../components/social/PersonCard.jsx';
import { SuggestionsRow } from '../components/social/Suggestions.jsx';
import { HashtagPill, TrendingPanel, TrendingStrip } from '../components/social/TrendingHashtags.jsx';
import { ErrorBox, SectionHeading } from '../components/social/StateBlocks.jsx';
import { useApiList, useSuggestions, useTrending } from '../components/social/useSocialData.js';
import { BooksIcon, CloseIcon, CommentIcon, HashIcon, SearchIcon, SparklesIcon, UsersIcon } from '../components/icons.jsx';

// Explorar (rediseno-inicio-explorar R7): cabecera con buscador (en la URL),
// gente para seguir, cursos de la comunidad y publicaciones recientes; rail con
// tendencias, categorías y el catálogo.

const SEARCH_DEBOUNCE_MS = 300;
const COURSES_ROW_MAX = 10;

/** Búsqueda en `?q=`: valor inmediato del input + URL con debounce. */
function useSearchQuery() {
  const [params, setParams] = useSearchParams();
  const q = (params.get('q') || '').trim();
  const [input, setInput] = useState(params.get('q') || '');
  const written = useRef(q);

  // Atrás/adelante o enlace: el input sigue a la URL.
  useEffect(() => {
    if (q !== written.current) {
      written.current = q;
      setInput(q);
    }
  }, [q]);

  useEffect(() => {
    const next = input.trim();
    if (next === q) return undefined;
    const id = setTimeout(() => {
      written.current = next;
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (next) p.set('q', next);
          else p.delete('q');
          return p;
        },
        { replace: true },
      );
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [input, q, setParams]);

  const clear = useCallback(() => setInput(''), []);
  return { q, input, setInput, clear };
}

export default function Explore() {
  const navigate = useNavigate();
  const { q, input, setInput, clear } = useSearchQuery();
  const trending = useTrending(8);
  const suggestions = useSuggestions(12);
  const courses = useApiList('/api/courses', 'cursos');
  const recommended = useApiList('/api/courses/recommended', 'recommended');
  const enrolled = useApiList('/api/courses/my/enrolled', 'inscripciones');
  const { openCourseId, openCourse, closeCourse } = useQuickViewParam();

  const friendsMap = useMemo(() => friendsByCourse(recommended.items), [recommended.items]);
  const enrollmentMap = useMemo(() => new Map(enrolled.items.map((i) => [i.curso.id, i])), [enrolled.items]);
  const progressMap = useMemo(() => new Map(enrolled.items.map((i) => [i.curso.id, i.avance])), [enrolled.items]);

  // Lo que aprende tu gente primero (cursos de amigos), después lo más tomado.
  const communityCourses = useMemo(() => {
    const byId = new Map(courses.items.map((c) => [c.id, c]));
    const fromFriends = recommended.items.map((r) => byId.get(r.curso.id) || r.curso);
    const popular = [...courses.items].sort((a, b) => enrolledCount(b) - enrolledCount(a));
    const seen = new Set();
    return [...fromFriends, ...popular].filter((c) => c && !seen.has(c.id) && seen.add(c.id)).slice(0, COURSES_ROW_MAX);
  }, [courses.items, recommended.items]);

  const quickPreview = useMemo(
    () => (openCourseId ? courses.items.find((c) => c.id === openCourseId) || { id: openCourseId } : null),
    [openCourseId, courses.items],
  );

  const searching = q.length > 0;

  return (
    <div className="max-w-6xl mx-auto lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6 lg:items-start">
      <div className="min-w-0">
        <header className="mb-6">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-titi-dark leading-tight">
            Descubrí tu <span className="text-titi-streak">comunidad</span>
          </h1>
          <p className="text-base sm:text-lg font-semibold text-gray-500 mt-1 mb-5">Personas, temas y cursos que se mueven en Titi.</p>
          <SearchBox value={input} onChange={setInput} onClear={clear} />
          <TrendingStrip trending={trending} className="mt-4 lg:hidden" />
        </header>

        {searching ? (
          <SearchResults q={q} onClear={clear} trending={trending} />
        ) : (
          <div className="flex flex-col gap-8">
            <SuggestionsRow suggestions={suggestions} subtitle="Amigos de tus amigos y gente activa en Titi." />

            {(courses.loading || communityCourses.length > 0) && (
              <CourseRow
                title="Lo que está aprendiendo la"
                accent="comunidad"
                subtitle={recommended.items.length ? 'Primero, lo que toman tus amigos.' : 'Los cursos que más gente está tomando.'}
                count={courses.loading ? 0 : communityCourses.length}
                seeAll={{ label: 'Catálogo', onClick: () => navigate('/courses') }}
              >
                {courses.loading
                  ? [0, 1, 2].map((i) => (
                      <RowItem key={i}>
                        <CourseCardSkeleton />
                      </RowItem>
                    ))
                  : communityCourses.map((curso) => (
                      <RowItem key={curso.id}>
                        <CourseCard
                          curso={curso}
                          onOpen={() => openCourse(curso.id)}
                          friends={friendsMap.get(curso.id)}
                          progress={progressMap.get(curso.id)}
                        />
                      </RowItem>
                    ))}
              </CourseRow>
            )}

            <section aria-label="Publicaciones recientes">
              <SectionHeading title="Publicaciones" accent="recientes" />
              <ExploreFeed />
            </section>
          </div>
        )}
      </div>

      {/* Rail lateral (solo desktop) */}
      <aside className="hidden lg:flex flex-col gap-5 sticky top-8">
        <TrendingPanel trending={trending} />
        <CategoriesExplorer layout="rail" />
        <CoursesCTA />
      </aside>

      <CourseQuickView
        cursoId={openCourseId}
        preview={quickPreview}
        friends={openCourseId ? friendsMap.get(openCourseId) : undefined}
        enrollment={openCourseId ? enrollmentMap.get(openCourseId) : undefined}
        onClose={closeCourse}
        onEnrolled={() => {
          enrolled.reload();
          courses.reload();
        }}
      />
    </div>
  );
}

// ---- Buscador: la misma forma que el del catálogo ----
function SearchBox({ value, onChange, onClear }) {
  return (
    <div className="relative max-w-2xl">
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && value && onClear()}
        placeholder="Buscá personas, publicaciones o #temas"
        aria-label="Buscar en Titi"
        enterKeyHint="search"
        className="w-full bg-white border-2 border-titi-dark rounded-2xl pl-12 pr-12 py-4 text-base font-semibold text-titi-dark placeholder:text-gray-400 shadow-[0_4px_0px_#1A1A2E] focus:outline-none focus:ring-4 focus:ring-titi-yellow/50 transition-shadow duration-150 [&::-webkit-search-cancel-button]:hidden"
      />
      <SearchIcon className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-titi-dark pointer-events-none" />
      {value && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Limpiar búsqueda"
          className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 grid place-items-center rounded-full text-gray-400 hover:text-titi-dark hover:bg-gray-100 active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-titi-yellow transition-all duration-150"
        >
          <CloseIcon className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// ---- Rail: acceso al catálogo ----
function CoursesCTA() {
  return (
    <section className="bg-titi-dark rounded-2xl border-2 border-titi-dark p-4">
      <span className="w-10 h-10 rounded-xl bg-titi-yellow text-titi-dark border-2 border-titi-yellow grid place-items-center -rotate-6 mb-3">
        <BooksIcon className="w-5 h-5" />
      </span>
      <h2 className="text-lg font-extrabold text-titi-cream leading-tight">
        ¿Algo nuevo para <span className="text-titi-yellow">aprender</span>?
      </h2>
      <p className="text-sm font-medium text-white/60 mt-1 mb-4">Cursos cortos de la comunidad, gratis y a tu ritmo.</p>
      <Link to="/courses" className="titi-btn-primary w-full py-2.5 text-sm">
        Ver cursos
      </Link>
    </section>
  );
}

// ---- Publicaciones recientes (scroll infinito) ----
function ExploreFeed() {
  const [posts, setPosts] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  // Trae una página: si hay cursor, anexa; si no, reemplaza (carga inicial).
  const fetchPage = useCallback(async (cursor) => {
    const { data } = await client.get('/api/posts/explore', { params: { cursor: cursor || undefined, limit: 20 } });
    if (!data?.success) throw new Error(data?.message || 'No se pudo cargar');
    setPosts((prev) => (cursor ? [...prev, ...(data.data.posts || [])] : data.data.posts || []));
    setNextCursor(data.data.nextCursor ?? null);
  }, []);

  const fetchFirst = useCallback(async () => {
    setLoading(true);
    setError(null);
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
    } catch {
      /* mantenemos lo cargado; el sentinel reintenta al volver a verse */
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore, fetchPage]);

  useEffect(() => {
    fetchFirst();
  }, [fetchFirst]);

  const handleDelete = useCallback((id) => setPosts((prev) => prev.filter((p) => p.id !== id)), []);
  const handleEdit = useCallback((updated) => setPosts((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p))), []);

  const sentinelRef = useRef(null);
  useEffect(() => {
    if (!nextCursor) return undefined;
    const el = sentinelRef.current;
    if (!el) return undefined;
    const obs = new IntersectionObserver((entries) => entries[0].isIntersecting && loadMore(), { rootMargin: '300px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [nextCursor, loadMore]);

  // Anima una sola vez al terminar la carga inicial (no al anexar páginas).
  const listRef = useStaggerReveal([loading]);

  if (loading) {
    return (
      <div aria-busy="true" aria-label="Cargando publicaciones">
        <PostCardSkeleton />
        <PostCardSkeleton withImage />
      </div>
    );
  }
  if (error) return <ErrorBox title="No pudimos cargar las publicaciones" message={error} onRetry={fetchFirst} />;
  if (posts.length === 0) {
    return (
      <div className="bg-white rounded-2xl border-2 border-titi-dark py-8 px-6 text-center">
        <TitiMascot state="idle" size="md" message="Todavía no hay publicaciones." className="mb-4" />
        <p className="text-base font-medium text-gray-500 mb-5">Animate a estrenar la comunidad con la primera.</p>
        <Link to="/feed" className="titi-btn-primary">
          Publicar en Inicio
        </Link>
      </div>
    );
  }
  return (
    <>
      <div ref={listRef}>
        {posts.map((p) => (
          <PostCard key={p.id} post={p} onDelete={handleDelete} onEdit={handleEdit} />
        ))}
      </div>
      {nextCursor && <div ref={sentinelRef} aria-hidden className="h-1" />}
      {loadingMore && <PostCardSkeleton />}
    </>
  );
}

// ---- Resultados de búsqueda ----
const RESULT_TABS = [
  { id: 'todo', label: 'Todo', Icon: SparklesIcon, solid: 'bg-titi-dark' },
  { id: 'users', label: 'Personas', Icon: UsersIcon, solid: 'bg-blue-500' },
  { id: 'posts', label: 'Publicaciones', Icon: CommentIcon, solid: 'bg-green-500' },
  { id: 'hashtags', label: 'Hashtags', Icon: HashIcon, solid: 'bg-titi-streak' },
];

function SearchResults({ q, onClear, trending }) {
  const { user } = useAuth();
  const [data, setData] = useState({ users: [], posts: [], hashtags: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);
  const [tab, setTab] = useState('todo');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    client
      .get('/api/search', { params: { q } })
      .then(({ data: body }) => {
        if (cancelled) return;
        if (body?.success) {
          setData({ users: body.data.users || [], posts: body.data.posts || [], hashtags: body.data.hashtags || [] });
        } else {
          setError(body?.message || 'No se pudo buscar');
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.message || err.message || 'Error de red');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [q, tick]);

  const { users, posts, hashtags } = data;
  const counts = { todo: users.length + posts.length + hashtags.length, users: users.length, posts: posts.length, hashtags: hashtags.length };
  const show = (id) => tab === 'todo' || tab === id;
  const resultsRef = useStaggerReveal([loading, tab]);

  if (error) return <ErrorBox title="No pudimos buscar" message={error} onRetry={() => setTick((t) => t + 1)} />;

  if (!loading && counts.todo === 0) {
    return (
      <div className="bg-white rounded-2xl border-2 border-titi-dark py-8 px-6 text-center">
        <TitiMascot state="pensando" size="md" message="Mmm… no encontré nada." className="mb-4" />
        <h2 className="text-xl font-extrabold text-titi-dark break-words">
          Sin resultados para <span className="text-titi-streak">“{q}”</span>
        </h2>
        <p className="text-base font-medium text-gray-500 mt-1 mb-5">Probá con otra palabra, un @usuario o uno de los temas del momento.</p>
        <button type="button" onClick={onClear} className="titi-btn-primary">
          Limpiar búsqueda
        </button>
        {trending.items.length > 0 && (
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {trending.items.slice(0, 5).map((h) => (
              <HashtagPill key={h.name} name={h.name} count={h.postCount} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div aria-live="polite" aria-busy={loading}>
      <div role="group" aria-label="Tipo de resultado" className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-4 px-4 sm:mx-0 sm:px-0 py-1 mb-5">
        {RESULT_TABS.map(({ id, label, Icon, solid }) => (
          <Pill key={id} active={tab === id} onClick={() => setTab(id)}>
            <span className={`w-7 h-7 rounded-full grid place-items-center text-white ${solid}`}>
              <Icon className="w-4 h-4" />
            </span>
            {label}
            {!loading && <span className="text-xs font-extrabold tabular-nums text-gray-500">{counts[id]}</span>}
          </Pill>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4" aria-label="Buscando">
          {[0, 1, 2].map((i) => (
            <PersonCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div ref={resultsRef} className="flex flex-col gap-8">
          {show('hashtags') && hashtags.length > 0 && (
            <section aria-label="Hashtags">
              <SectionHeading title="Temas" accent={`(${hashtags.length})`} />
              <div className="flex flex-wrap gap-2">
                {hashtags.map((h) => (
                  <HashtagPill key={h.name} name={h.name} count={h.postCount} />
                ))}
              </div>
            </section>
          )}

          {show('users') && users.length > 0 && (
            <section aria-label="Personas">
              <SectionHeading title="Personas" accent={`(${users.length})`} />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {users.map((u) =>
                  u.username === user?.username ? (
                    <SelfCard key={u.id} person={u} />
                  ) : (
                    <PersonCard key={u.id} person={u} initialFollowing={Boolean(u.isFollowing)} />
                  ),
                )}
              </div>
            </section>
          )}

          {show('posts') && posts.length > 0 && (
            <section aria-label="Publicaciones">
              <SectionHeading title="Publicaciones" accent={`(${posts.length})`} />
              <ul className="flex flex-col gap-3">
                {posts.map((p) => (
                  <PostResult key={p.id} post={p} q={q} />
                ))}
              </ul>
            </section>
          )}

          {tab !== 'todo' && counts[tab] === 0 && (
            <p className="py-8 text-center text-base font-bold text-gray-500">Nada de este tipo para “{q}”.</p>
          )}
        </div>
      )}
    </div>
  );
}

/** Vos mismo en los resultados: tarjeta que lleva a tu perfil, sin botón de seguir. */
function SelfCard({ person }) {
  return (
    <Link
      to={`/profile/${person.username}`}
      className="h-full flex flex-col items-center justify-center gap-2 text-center p-4 bg-titi-yellow-light rounded-2xl border-2 border-titi-dark shadow-[0_5px_0_#1A1A2E] hover:-translate-y-1 hover:shadow-[0_8px_0_#1A1A2E] active:translate-y-[3px] active:shadow-[0_2px_0_#1A1A2E] transition-all duration-150 focus:outline-none focus-visible:ring-4 focus-visible:ring-titi-yellow"
    >
      <Avatar username={person.username} src={person.avatarUrl} size="lg" />
      <span className="text-base font-extrabold text-titi-dark truncate max-w-full">@{person.username}</span>
      <span className="text-xs font-bold text-gray-500">{socialProof(person)}</span>
      <span className="text-xs font-extrabold uppercase tracking-wide text-blue-500">Sos vos · ver perfil</span>
    </Link>
  );
}

/** Resalta el término buscado dentro del texto. */
function Highlight({ text, q }) {
  if (!q) return text;
  const clean = q.replace(/^#/, '');
  const i = text.toLowerCase().indexOf(clean.toLowerCase());
  if (!clean || i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-titi-yellow-light text-titi-dark rounded px-0.5">{text.slice(i, i + clean.length)}</mark>
      {text.slice(i + clean.length)}
    </>
  );
}

function PostResult({ post, q }) {
  const imageUrl = resolveMediaUrl(post.imageUrl);
  return (
    <li className="flex gap-3 p-3 bg-white rounded-2xl border-2 border-titi-dark shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
      <Link to={`/profile/${post.author}`} className="shrink-0 rounded-full self-start focus:outline-none focus-visible:ring-4 focus-visible:ring-titi-yellow/60">
        <Avatar username={post.author} src={post.authorAvatar} size="sm" />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <Link to={`/profile/${post.author}`} className="font-extrabold text-sm text-titi-dark hover:text-blue-500 transition-colors truncate">
            @{post.author}
          </Link>
          <span className="text-xs text-gray-400 font-semibold shrink-0">{relativeTime(post.createdAt)}</span>
        </div>
        <p className="text-sm font-medium text-titi-dark line-clamp-3 break-words mt-0.5">
          <Highlight text={post.content || ''} q={q} />
        </p>
      </div>
      {imageUrl && (
        <img src={imageUrl} alt="" loading="lazy" className="w-16 h-16 rounded-xl object-cover bg-titi-cream border-2 border-titi-dark shrink-0" />
      )}
    </li>
  );
}
