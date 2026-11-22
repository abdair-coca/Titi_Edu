import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useGamification } from '../context/GamificationContext.jsx';
import useStreak from '../hooks/useStreak.js';
import { useCountUp, useStaggerReveal } from '../lib/motion.js';
import PostCard, { PostCardSkeleton } from '../components/PostCard.jsx';
import CreatePost from '../components/CreatePost.jsx';
import AcademicActivityCard from '../components/AcademicActivityCard.jsx';
import CategoriesExplorer from '../components/CategoriesExplorer.jsx';
import TitiMascot from '../components/TitiMascot.jsx';
import CourseQuickView from '../components/catalog/CourseQuickView.jsx';
import CourseRow, { ContinueCard, RowItem } from '../components/catalog/CourseRow.jsx';
import { Pill } from '../components/catalog/CatalogFilters.jsx';
import { buildRows } from '../components/catalog/catalogData.js';
import useQuickViewParam from '../components/catalog/useQuickViewParam.js';
import { SuggestionsPanel, SuggestionsRow } from '../components/social/Suggestions.jsx';
import { ErrorBox } from '../components/social/StateBlocks.jsx';
import { useApiList, useSuggestions } from '../components/social/useSocialData.js';
import { BoltIcon, BooksIcon, CommentIcon, GotaIcon, RefreshIcon, SparklesIcon, TargetIcon } from '../components/icons.jsx';

// Inicio (rediseno-inicio-explorar R2): saludo → composer → continuá →
// pestañas → línea de tiempo; rail con tu día, gente para seguir y categorías.

const TABS = [
  { id: 'todo', label: 'Todo', Icon: SparklesIcon, solid: 'bg-titi-dark' },
  { id: 'posts', label: 'Publicaciones', Icon: CommentIcon, solid: 'bg-blue-500' },
  { id: 'aprendizaje', label: 'Aprendizaje', Icon: BooksIcon, solid: 'bg-green-500' },
];

/** Después de cuántas entradas va la fila de sugerencias (pantallas sin rail). */
const SUGGESTIONS_AFTER = 4;

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Buen día';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

export default function Feed() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [academic, setAcademic] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('todo');
  const [hasNews, setHasNews] = useState(false);

  const enrolled = useApiList('/api/courses/my/enrolled', 'inscripciones');
  const suggestions = useSuggestions(10);
  const { openCourseId, openCourse, closeCourse } = useQuickViewParam();

  // Carga inicial: primera página de posts sociales + actividad académica.
  // El académico es complementario (se carga una vez); la paginación es del social.
  const fetchFeed = useCallback(async () => {
    setLoading(true);
    setError(null);
    setHasNews(false);
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
        setError(postsData?.message || 'No se pudo cargar el inicio');
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
      const { data } = await client.get('/api/posts/feed', { params: { cursor: nextCursor, limit: 20 } });
      if (data?.success) {
        setPosts((prev) => [...prev, ...(data.data.posts || [])]);
        setNextCursor(data.data.nextCursor ?? null);
      }
    } catch {
      /* mantenemos lo cargado; el sentinel reintenta al volver a verse */
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  const handleDelete = useCallback((id) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }, []);
  const handleEdit = useCallback((updated) => {
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
  }, []);

  // Scroll infinito: el sentinel dispara loadMore al acercarse al viewport.
  const sentinelRef = useRef(null);
  useEffect(() => {
    if (!nextCursor || tab === 'aprendizaje') return undefined;
    const el = sentinelRef.current;
    if (!el) return undefined;
    const obs = new IntersectionObserver((entries) => entries[0].isIntersecting && loadMore(), { rootMargin: '300px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [nextCursor, loadMore, tab]);

  // Mezclar posts + actividad académica en una sola línea de tiempo (DESC).
  const timeline = useMemo(
    () =>
      [
        ...posts.map((p) => ({ kind: 'post', createdAt: p.createdAt, data: p })),
        ...academic.map((a, i) => ({ kind: 'academic', createdAt: a.createdAt, data: a, _i: i })),
      ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [posts, academic],
  );
  const counts = { todo: timeline.length, posts: posts.length, aprendizaje: academic.length };
  const visible = tab === 'todo' ? timeline : timeline.filter((e) => (tab === 'posts' ? e.kind === 'post' : e.kind === 'academic'));
  const isEmpty = timeline.length === 0;

  const continua = useMemo(() => buildRows({ cursos: [], enrolled: enrolled.items }).continua, [enrolled.items]);
  const enrollmentMap = useMemo(() => new Map(enrolled.items.map((i) => [i.curso.id, i])), [enrolled.items]);

  // Vista rápida: los datos del curso que ya trae la actividad se ven al instante.
  const coursePreview = useMemo(() => {
    if (!openCourseId) return null;
    const fromActivity = academic.find((a) => a.curso?.id === openCourseId)?.curso;
    return fromActivity || enrollmentMap.get(openCourseId)?.curso || { id: openCourseId };
  }, [openCourseId, academic, enrollmentMap]);

  // Seguir a alguien: con el inicio vacío se recarga solo (es lo que se está
  // esperando); con contenido, el botón de refrescar avisa que hay novedades.
  const refetchTimer = useRef(null);
  const onFollowChange = useCallback(
    (nowFollowing) => {
      if (!nowFollowing) return;
      if (isEmpty) {
        clearTimeout(refetchTimer.current);
        refetchTimer.current = setTimeout(fetchFeed, 900);
      } else {
        setHasNews(true);
      }
    },
    [isEmpty, fetchFeed],
  );
  useEffect(() => () => clearTimeout(refetchTimer.current), []);

  // Entrada escalonada al cargar o cambiar de pestaña (no al anexar páginas).
  const timelineRef = useStaggerReveal([loading, tab]);
  const showEmpty = !loading && !error && isEmpty;

  return (
    <div className="max-w-6xl mx-auto lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6 lg:items-start">
      <div className="max-w-2xl w-full mx-auto lg:max-w-none lg:mx-0 min-w-0">
        <header className="flex items-start justify-between gap-3 mb-5">
          <div className="min-w-0">
            <p className="text-sm font-extrabold uppercase tracking-wide text-gray-500">{greeting()}</p>
            <h1 className="text-3xl sm:text-4xl font-black text-titi-dark leading-tight break-words">
              Hola, <span className="text-titi-streak">@{user?.username}</span>
            </h1>
            <p className="text-base font-medium text-gray-500 mt-0.5">Lo que comparte y aprende tu gente.</p>
          </div>
          <RefreshButton loading={loading} hasNews={hasNews} onClick={fetchFeed} />
        </header>

        <CreatePost onCreated={fetchFeed} />

        {continua.length > 0 && (
          <div className="mb-6">
            <CourseRow title="Continuá donde" accent="quedaste" count={continua.length} seeAll={{ label: 'Mis cursos', onClick: () => navigate('/my-courses') }}>
              {continua.map((i) => (
                <RowItem key={i.curso.id} wide>
                  <ContinueCard inscripcion={i} />
                </RowItem>
              ))}
            </CourseRow>
          </div>
        )}

        {!isEmpty && (
          <div role="group" aria-label="Filtrar el inicio" className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-4 px-4 sm:mx-0 sm:px-0 py-1 mb-4">
            {TABS.map(({ id, label, Icon, solid }) => (
              <Pill key={id} active={tab === id} onClick={() => setTab(id)}>
                <span className={`w-7 h-7 rounded-full grid place-items-center text-white ${solid}`}>
                  <Icon className="w-4 h-4" />
                </span>
                {label}
                <span className="text-xs font-extrabold tabular-nums text-gray-500">{counts[id]}</span>
              </Pill>
            ))}
          </div>
        )}

        {loading && isEmpty && (
          <div aria-busy="true" aria-label="Cargando el inicio">
            <PostCardSkeleton />
            <PostCardSkeleton withImage />
            <PostCardSkeleton />
          </div>
        )}

        {error && <ErrorBox title="No pudimos cargar tu inicio" message={error} onRetry={fetchFeed} />}

        {showEmpty && <EmptyFeed suggestions={suggestions} onFollowChange={onFollowChange} />}

        {!isEmpty && visible.length === 0 && <EmptyTab tab={tab} />}

        {visible.length > 0 && (
          <div ref={timelineRef}>
            {visible.map((entry, idx) => (
              <TimelineEntry
                key={entry.kind === 'post' ? entry.data.id : `acad-${entry.data.type}-${entry.data.actorUsername}-${entry.data.cursoId || entry.data.logroNombre}-${entry.data.createdAt}-${entry._i}`}
                entry={entry}
                onDelete={handleDelete}
                onEdit={handleEdit}
                onOpenCourse={(curso) => openCourse(curso.id)}
                after={
                  tab === 'todo' && idx === SUGGESTIONS_AFTER - 1 ? (
                    <div className="lg:hidden mb-5">
                      <SuggestionsRow suggestions={suggestions} onFollowChange={onFollowChange} subtitle="Sumá gente a tu inicio." />
                    </div>
                  ) : null
                }
              />
            ))}
          </div>
        )}

        {nextCursor && tab !== 'aprendizaje' && <div ref={sentinelRef} aria-hidden className="h-1" />}
        {loadingMore && <PostCardSkeleton />}
        {!loading && !nextCursor && visible.length > 3 && (
          <p className="py-4 text-center text-sm font-bold text-gray-400">Llegaste al final. ¡Buen momento para una lección!</p>
        )}
      </div>

      {/* Rail lateral (solo desktop) */}
      <aside className="hidden lg:flex flex-col gap-5 sticky top-8">
        <TuDia />
        {!showEmpty && <SuggestionsPanel suggestions={suggestions} onFollowChange={onFollowChange} />}
        <CategoriesExplorer layout="rail" />
      </aside>

      <CourseQuickView
        cursoId={openCourseId}
        preview={coursePreview}
        enrollment={openCourseId ? enrollmentMap.get(openCourseId) : undefined}
        onClose={closeCourse}
        onEnrolled={enrolled.reload}
      />
    </div>
  );
}

function TimelineEntry({ entry, onDelete, onEdit, onOpenCourse, after }) {
  return (
    <>
      {entry.kind === 'post' ? (
        <PostCard post={entry.data} onDelete={onDelete} onEdit={onEdit} />
      ) : (
        <AcademicActivityCard item={entry.data} onOpenCourse={onOpenCourse} />
      )}
      {after}
    </>
  );
}

function RefreshButton({ loading, hasNews, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      aria-label={hasNews ? 'Ver novedades' : 'Refrescar el inicio'}
      title={hasNews ? 'Ver novedades' : 'Refrescar'}
      className={[
        'group shrink-0 inline-flex items-center justify-center gap-2 h-11 rounded-xl border-2 border-titi-dark font-extrabold text-sm text-titi-dark',
        'shadow-[0_3px_0_#1A1A2E] hover:-translate-y-0.5 hover:shadow-[0_4px_0_#1A1A2E] active:translate-y-0.5 active:shadow-none',
        'transition-all duration-150 disabled:opacity-60 disabled:cursor-wait disabled:hover:translate-y-0 motion-reduce:transition-none',
        'focus:outline-none focus-visible:ring-4 focus-visible:ring-titi-yellow/60',
        hasNews ? 'bg-titi-yellow px-3.5' : 'bg-white w-11 hover:bg-titi-yellow',
      ].join(' ')}
    >
      <RefreshIcon className={`w-5 h-5 ${loading ? 'titi-refresh-spin' : 'transition-transform duration-300 group-hover:rotate-180 motion-reduce:transition-none'}`} />
      {hasNews && <span className="whitespace-nowrap">Novedades</span>}
    </button>
  );
}

// ---- Rail: tu día (racha + gotas con conteo) ----
function TuDia() {
  const { gotas } = useGamification();
  const { racha, estaActiva } = useStreak();
  const activa = estaActiva && racha > 0;
  const rachaShown = useCountUp(racha);
  const gotasShown = useCountUp(gotas?.saldo ?? gotas?.total ?? 0);

  return (
    <section aria-label="Tu día" className="bg-titi-dark rounded-2xl border-2 border-titi-dark p-4">
      <h2 className="text-lg font-extrabold text-titi-cream">
        Tu <span className="text-titi-yellow">día</span>
      </h2>
      <p className="text-sm font-medium text-white/60 mb-3">{activa ? '¡Vas con todo! Mantené la racha.' : 'Una lección hoy enciende tu racha.'}</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white/5 border-2 border-white/10 rounded-xl p-3">
          <span className={`w-9 h-9 rounded-xl grid place-items-center text-white mb-2 ${activa ? 'bg-titi-streak' : 'bg-white/10'}`}>
            <BoltIcon className="w-5 h-5" />
          </span>
          <p className="text-2xl font-black text-titi-cream tabular-nums leading-none">{rachaShown}</p>
          <p className="text-xs font-bold text-white/60 mt-1">{racha === 1 ? 'día de racha' : 'días de racha'}</p>
        </div>
        <div className="bg-white/5 border-2 border-white/10 rounded-xl p-3">
          <span className="w-9 h-9 rounded-xl grid place-items-center bg-titi-yellow text-titi-dark mb-2">
            <GotaIcon className="w-5 h-5" />
          </span>
          <p className="text-2xl font-black text-titi-cream tabular-nums leading-none">{gotasShown}</p>
          <p className="text-xs font-bold text-white/60 mt-1">gotas</p>
        </div>
      </div>
      <Link to="/my-courses" className="titi-btn-primary w-full mt-3 py-2.5 text-sm">
        <TargetIcon className="w-4 h-4" />
        Ver desafíos del día
      </Link>
    </section>
  );
}

function EmptyTab({ tab }) {
  const aprendizaje = tab === 'aprendizaje';
  return (
    <div className="bg-white rounded-2xl border-2 border-dashed border-gray-300 py-10 px-6 text-center mb-5">
      <span className="mx-auto w-12 h-12 rounded-xl border-2 border-titi-dark bg-titi-yellow text-titi-dark grid place-items-center -rotate-6 mb-3">
        {aprendizaje ? <BooksIcon className="w-6 h-6" /> : <CommentIcon className="w-6 h-6" />}
      </span>
      <h2 className="text-lg font-extrabold text-titi-dark">
        {aprendizaje ? 'Tus amigos todavía no empezaron cursos' : 'Nadie publicó todavía'}
      </h2>
      <p className="text-sm font-medium text-gray-500 mt-1 mb-4 max-w-sm mx-auto">
        {aprendizaje
          ? 'Cuando alguien que seguís se inscriba o termine un curso, lo vas a ver acá.'
          : 'Animate a ser la primera publicación de tu inicio.'}
      </p>
      {aprendizaje ? (
        <Link to="/courses" className="titi-btn-primary px-5 py-2.5 text-sm">
          Explorar cursos
        </Link>
      ) : (
        <button type="button" onClick={() => document.querySelector('form[aria-label="Crear post"] textarea')?.focus()} className="titi-btn-primary px-5 py-2.5 text-sm">
          Escribir algo
        </button>
      )}
    </div>
  );
}

function EmptyFeed({ suggestions, onFollowChange }) {
  return (
    <>
      <section className="bg-white rounded-2xl border-2 border-titi-dark shadow-[0_2px_8px_rgba(0,0,0,0.06)] py-8 px-6 text-center mb-6">
        <TitiMascot state="pensando" size="md" message="¡Seguí a alguien para ver su actividad!" className="mb-4" />
        <h2 className="text-2xl font-extrabold text-titi-dark">
          Tu inicio está <span className="text-titi-streak">vacío</span>
        </h2>
        <p className="text-base font-medium text-gray-500 mt-1 mb-5 max-w-md mx-auto">
          Seguí a gente de tu universidad y vas a ver lo que publican y los cursos que toman.
        </p>
        <Link to="/explore" className="titi-btn-primary">
          Ir a Explorar
        </Link>
      </section>
      <SuggestionsRow suggestions={suggestions} onFollowChange={onFollowChange} title="Empezá por" accent="acá" subtitle="Gente que ya está aprendiendo en Titi." />
    </>
  );
}
