import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useStaggerReveal } from '../lib/motion.js';
import RecommendedCourseCard from '../components/RecommendedCourseCard.jsx';

export default function Courses() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [categoria, setCategoria] = useState('all');

  const [categorias, setCategorias] = useState([]);
  const [cursos, setCursos] = useState([]);
  // Catálogo completo (sin filtros) — para stats estables, conteos por categoría
  // y la sección "Categorías populares".
  const [allCursos, setAllCursos] = useState([]);
  const [recommended, setRecommended] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);

  // Recomendados por amigos — solo para usuarios autenticados.
  useEffect(() => {
    if (!isAuthenticated) {
      setRecommended([]);
      return;
    }
    let cancelled = false;
    client
      .get('/api/courses/recommended')
      .then(({ data }) => {
        if (cancelled) return;
        if (data?.success) setRecommended(data.data?.recommended || []);
      })
      .catch(() => {
        // Silencioso: la sección de recomendados no bloquea el catálogo.
        if (!cancelled) setRecommended([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  // Cargar categorías una sola vez
  useEffect(() => {
    let cancelled = false;
    client
      .get('/api/categories')
      .then(({ data }) => {
        if (cancelled) return;
        if (data?.success) setCategorias(data.data?.categorias || []);
      })
      .catch(() => {
        // Silencioso: si falla, el filtro de categoría queda vacío.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Catálogo completo (una vez por refresh) — independiente de los filtros.
  useEffect(() => {
    let cancelled = false;
    client
      .get('/api/courses')
      .then(({ data }) => {
        if (cancelled) return;
        if (data?.success) setAllCursos(data.data?.cursos || []);
      })
      .catch(() => {
        // Silencioso: si falla, featured/populares quedan vacíos.
      });
    return () => {
      cancelled = true;
    };
  }, [refreshTick]);

  // Debounce del search input
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  // Fetch del catálogo
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = {};
    if (debouncedQuery) params.search = debouncedQuery;
    if (categoria !== 'all') params.categoria = categoria;

    client
      .get('/api/courses', { params })
      .then(({ data }) => {
        if (cancelled) return;
        if (data?.success) setCursos(data.data?.cursos || []);
        else setError(data?.message || 'No se pudo cargar el catálogo');
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
  }, [debouncedQuery, categoria, refreshTick]);

  // Entrada escalonada de las cards del catálogo (GSAP, respeta reduced-motion).
  const gridRef = useStaggerReveal([cursos.length]);
  const recommendedRef = useStaggerReveal([recommended.length]);

  const hasFilters = debouncedQuery || categoria !== 'all';

  // Stats del hero, derivados del catálogo completo (estables, no cambian al
  // filtrar/buscar).
  const profesCount = useMemo(
    () => new Set(allCursos.map((c) => c.creador?.username).filter(Boolean)).size,
    [allCursos],
  );

  // Cursos agrupados por categoría (del catálogo completo).
  const coursesByCat = useMemo(() => {
    const map = {};
    for (const c of allCursos) {
      const id = c.categoria?.id;
      if (!id) continue;
      (map[id] ||= []).push(c);
    }
    return map;
  }, [allCursos]);

  // Categorías que tienen al menos un curso (para "Categorías populares").
  const popularCats = useMemo(
    () => categorias.filter((c) => coursesByCat[c.id]?.length),
    [categorias, coursesByCat],
  );

  function clearFilters() {
    setQuery('');
    setDebouncedQuery('');
    setCategoria('all');
  }

  return (
    <div className="flex flex-col gap-8 sm:gap-10">
      {/* Promo bar */}
      <div className="flex items-center justify-center gap-2 bg-titi-yellow text-titi-dark rounded-xl px-4 py-2.5 text-center text-sm font-bold">
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-4 h-4 shrink-0"
          aria-hidden="true"
        >
          <path d="M8 1.5 9.5 6l4.5 1.5L9.5 9 8 13.5 6.5 9 2 7.5 6.5 6Z" />
        </svg>
        Cursos nuevos cada semana, creados por la comunidad Titi
      </div>

      {/* Hero */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 items-center">
        <div>
          {/* Badge */}
          <span className="inline-flex items-center gap-2 bg-white border border-gray-100 rounded-full pl-1.5 pr-3 py-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.06)] mb-5">
            <span className="w-5 h-5 rounded-full bg-titi-yellow grid place-items-center shrink-0">
              <svg
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-3 h-3 text-titi-dark"
                aria-hidden="true"
              >
                <path d="M2 6 5 9l5-6" />
              </svg>
            </span>
            <span className="text-xs font-bold text-titi-dark">
              Comunidad de aprendizaje
            </span>
          </span>

          {/* Título */}
          <h1 className="text-3xl sm:text-4xl font-extrabold text-titi-dark leading-tight mb-3">
            Aprendé algo nuevo, <span className="text-titi-streak">hoy</span>.
          </h1>
          <p className="text-base sm:text-lg font-medium text-gray-500 leading-relaxed mb-6 max-w-md">
            Cursos creados por personas como vos. Sumá lecciones cortas, ganá
            gotas y seguí tu propio ritmo en la comunidad Titi.
          </p>

          {/* Search grande */}
          <div className="relative max-w-md mb-6">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="¿Qué querés aprender hoy?"
              aria-label="Buscar cursos"
              className="w-full bg-titi-cream border border-gray-200 rounded-xl pl-12 pr-4 py-4 text-base font-medium text-titi-dark placeholder:text-gray-300 focus:outline-none focus:border-titi-yellow focus:ring-2 focus:ring-titi-yellow/20 transition-all duration-150"
            />
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.5" y2="16.5" />
            </svg>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-5 flex-wrap">
            <HeroStat num={allCursos.length} label="cursos" />
            <span className="w-px h-5 bg-gray-200" aria-hidden="true" />
            <HeroStat num={categorias.length} label="categorías" />
            <span className="w-px h-5 bg-gray-200" aria-hidden="true" />
            <HeroStat
              num={profesCount}
              label={profesCount === 1 ? 'profe de la comunidad' : 'profes de la comunidad'}
            />
          </div>
        </div>

        {/* Visual del hero — plano (sin gradiente ni blur) */}
        <div className="hidden lg:flex relative h-[300px] rounded-2xl bg-titi-dark items-center justify-center overflow-hidden">
          <span
            aria-hidden="true"
            className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-titi-yellow/15"
          />
          <span
            aria-hidden="true"
            className="absolute -bottom-12 -left-8 w-40 h-40 rounded-full bg-titi-streak/15"
          />
          <div className="relative text-center px-6">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/50 mb-2">
              Comunidad
            </p>
            <p className="text-2xl font-extrabold text-titi-cream leading-tight">
              Aprendé · Enseñá · Crecé
            </p>
          </div>
        </div>
      </section>

      {/* Featured — habilidades esenciales (3 categorías destacadas) */}
      {categorias.length > 0 && (
        <section aria-label="Habilidades esenciales">
          <h2 className="text-2xl font-bold text-titi-dark mb-1">
            Aprendé habilidades{' '}
            <span className="italic text-titi-streak">esenciales</span>
          </h2>
          <p className="text-sm font-medium text-gray-500 mb-5">
            Áreas destacadas para impulsar lo que estás construyendo.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {categorias.slice(0, 3).map((c) => (
              <FeaturedCategoryCard
                key={c.id}
                categoria={c}
                count={coursesByCat[c.id]?.length || 0}
                onClick={() => setCategoria(c.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Recomendados por tus amigos */}
      {recommended.length > 0 && (
        <section aria-label="Recomendados por tus amigos">
          <h2 className="text-lg font-bold text-titi-dark mb-3">
            Tus amigos están aprendiendo
          </h2>
          <div ref={recommendedRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recommended.map(({ curso, friendCount, sampleFriends }) => (
              <RecommendedCourseCard
                key={curso.id}
                curso={curso}
                friendCount={friendCount}
                sampleFriends={sampleFriends}
                onOpen={() => navigate(`/courses/${curso.id}`)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Trending — tabs de categoría + grid */}
      <section aria-label="Cursos en tendencia">
        <h2 className="text-2xl font-bold text-titi-dark mb-4">
          Cursos en tendencia
        </h2>

        {/* Tabs de categoría */}
        <div className="flex flex-wrap gap-2 mb-6">
          <CategoryPill
            active={categoria === 'all'}
            onClick={() => setCategoria('all')}
          >
            Todas
          </CategoryPill>
          {categorias.map((c) => (
            <CategoryPill
              key={c.id}
              active={categoria === c.id}
              onClick={() => setCategoria(c.id)}
            >
              {c.icono} {c.nombre}
            </CategoryPill>
          ))}
        </div>

        {loading ? (
          <SkeletonGrid />
        ) : error ? (
          <ErrorState
            message={error}
            onRetry={() => setRefreshTick((t) => t + 1)}
          />
        ) : cursos.length === 0 ? (
          <EmptyState hasFilters={hasFilters} onClear={clearFilters} />
        ) : (
          <>
            {/* Contador de resultados */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-gray-500">
                {cursos.length === 1
                  ? '1 curso encontrado'
                  : `${cursos.length} cursos encontrados`}
                {hasFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="ml-2 text-titi-dark font-bold hover:text-titi-yellow-dark transition-colors"
                  >
                    · Limpiar filtros
                  </button>
                )}
              </p>
            </div>

            <div
              ref={gridRef}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6"
            >
              {cursos.map((curso) => (
                <CourseCard
                  key={curso.id}
                  curso={curso}
                  onOpen={() => navigate(`/courses/${curso.id}`)}
                />
              ))}
            </div>
          </>
        )}
      </section>

      {/* Categorías populares — columnas con cursos por categoría */}
      {popularCats.length > 0 && (
        <section aria-label="Categorías populares">
          <h2 className="text-2xl font-bold text-titi-dark mb-6">
            Categorías populares
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-8">
            {popularCats.slice(0, 6).map((c) => (
              <div key={c.id}>
                <button
                  type="button"
                  onClick={() => setCategoria(c.id)}
                  className="text-base font-bold text-titi-streak uppercase tracking-wide mb-3 hover:text-titi-yellow-dark transition-colors"
                >
                  {c.nombre}
                </button>
                <div className="flex flex-col gap-3">
                  {coursesByCat[c.id].slice(0, 4).map((curso) => (
                    <button
                      key={curso.id}
                      type="button"
                      onClick={() => navigate(`/courses/${curso.id}`)}
                      className="flex items-center justify-between gap-2 text-left text-sm font-bold text-titi-dark hover:text-titi-streak transition-colors"
                    >
                      <span className="truncate">{curso.titulo}</span>
                      <svg
                        viewBox="0 0 13 13"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="w-3 h-3 shrink-0"
                        aria-hidden="true"
                      >
                        <path d="m4 2 5 4.5-5 4.5" />
                      </svg>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ---- Card de categoría destacada (Featured) ----
function FeaturedCategoryCard({ categoria, count, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="titi-card-pop text-left bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_24px_rgba(255,217,61,0.2)] overflow-hidden flex flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-titi-yellow"
    >
      {/* Thumb plano */}
      <div className="h-32 bg-titi-yellow-light flex items-center justify-center">
        <span className="text-5xl select-none" aria-hidden="true">
          {categoria.icono || '📚'}
        </span>
      </div>
      <div className="p-5 flex flex-col gap-1.5">
        <h3 className="text-lg font-bold text-titi-dark">{categoria.nombre}</h3>
        <p className="text-sm font-medium text-gray-500">
          {count} {count === 1 ? 'curso' : 'cursos'} en esta área.
        </p>
        <span className="mt-1 inline-flex items-center gap-1.5 text-sm font-bold text-titi-streak">
          Explorar área
          <svg
            viewBox="0 0 15 15"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-3.5 h-3.5"
            aria-hidden="true"
          >
            <path d="M3 7.5h9" />
            <path d="m8 3.5 4 4-4 4" />
          </svg>
        </span>
      </div>
    </button>
  );
}

// ---- Pill de categoría (tabs del Trending) ----
function CategoryPill({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'h-9 px-4 rounded-full border text-sm font-bold cursor-pointer transition-colors duration-150',
        active
          ? 'bg-titi-dark text-titi-cream border-titi-dark'
          : 'bg-white text-titi-dark border-gray-200 hover:border-titi-yellow',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

// ---- Stat del hero ----
function HeroStat({ num, label }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-2xl font-extrabold text-titi-dark tabular-nums">
        {num}
      </span>
      <span className="text-sm font-bold text-gray-400">{label}</span>
    </div>
  );
}

// Color del punto de nivel (clase Tailwind, sin hex hardcodeado en JSX).
function nivelDotClass(nivel) {
  switch ((nivel || '').toLowerCase()) {
    case 'principiante':
      return 'bg-green-500';
    case 'intermedio':
      return 'bg-titi-certificate';
    case 'avanzado':
      return 'bg-titi-streak';
    default:
      return 'bg-gray-300';
  }
}

// ---- CourseCard v2 (propuesta catálogo, plano + DESIGN.md §5.2) ----
function CourseCard({ curso, onOpen }) {
  const cantidadLecciones =
    curso._count?.lecciones ?? curso._count?.modulos ?? 0;
  const lessonsLabel =
    cantidadLecciones === 1 ? '1 lección' : `${cantidadLecciones} lecciones`;
  const nivel = curso.nivel || 'sin nivel';
  const author = curso.creador?.username;
  const initial = author?.[0]?.toUpperCase() ?? '?';

  return (
    <div
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      role="button"
      tabIndex={0}
      className="titi-card-pop bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_24px_rgba(255,217,61,0.2)] overflow-hidden cursor-pointer flex flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-titi-yellow"
    >
      {/* Thumb — plano (sin gradiente ni blur) */}
      <div className="relative h-40 bg-titi-yellow-light flex items-center justify-center overflow-hidden">
        {curso.portadaUrl ? (
          <img
            src={curso.portadaUrl}
            alt={curso.titulo}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <span className="text-5xl select-none" aria-hidden="true">
            {curso.categoria?.icono || '📚'}
          </span>
        )}

        {/* Badge de nivel — punto de color + texto */}
        <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 bg-white rounded-full px-2.5 py-1 shadow-sm">
          <span
            className={`w-2 h-2 rounded-full ${nivelDotClass(nivel)}`}
            aria-hidden="true"
          />
          <span className="text-xs font-semibold text-titi-dark capitalize">
            {nivel}
          </span>
        </span>
      </div>

      {/* Contenido */}
      <div className="p-4 flex flex-col gap-2 flex-1">
        {/* Categoría */}
        {curso.categoria?.nombre && (
          <span className="text-xs font-semibold text-titi-streak uppercase tracking-wide">
            {curso.categoria.nombre}
          </span>
        )}

        {/* Título */}
        <h3 className="text-base font-bold text-titi-dark leading-snug line-clamp-2">
          {curso.titulo}
        </h3>

        {/* Autor + lecciones */}
        <div className="mt-auto pt-2 flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-titi-dark text-titi-cream grid place-items-center text-xs font-bold shrink-0">
            {initial}
          </span>
          <span className="text-sm font-bold text-titi-dark truncate">
            {author || 'Anónimo'}
          </span>
          <span className="ml-auto text-xs font-medium text-gray-400 shrink-0">
            {lessonsLabel}
          </span>
        </div>
      </div>
    </div>
  );
}

// ---- Skeleton (sección 8 del DESIGN.md) ----
function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse"
        >
          <div className="h-40 bg-gray-100" />
          <div className="p-4 flex flex-col gap-3">
            <div className="h-3 bg-gray-100 rounded w-1/3" />
            <div className="h-4 bg-gray-100 rounded w-3/4" />
            <div className="h-3 bg-gray-100 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- Empty state (sección 8 del DESIGN.md) ----
function EmptyState({ hasFilters, onClear }) {
  const navigate = useNavigate();

  if (hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
        <img
          src="/Titi.png"
          alt="Titi"
          className="w-24 h-24 mb-4 object-contain drop-shadow-sm select-none"
          draggable={false}
        />
        <h3 className="text-xl font-bold text-titi-dark mb-2">
          No encontré cursos con esos filtros
        </h3>
        <p className="text-sm text-gray-400 mb-6 max-w-xs">
          Probá ajustar la búsqueda o quitá los filtros para ver el catálogo
          completo.
        </p>
        <button
          type="button"
          onClick={onClear}
          className="bg-titi-yellow text-titi-dark font-bold text-base px-6 py-3 rounded-xl shadow-[0_4px_0px_#E6B800] hover:shadow-[0_2px_0px_#E6B800] hover:-translate-y-0.5 active:shadow-none active:translate-y-0 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Limpiar filtros
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      <img
        src="/Titi.png"
        alt="Titi"
        className="w-24 h-24 mb-4 object-contain drop-shadow-sm select-none"
        draggable={false}
      />
      <h3 className="text-xl font-bold text-titi-dark mb-2">
        ¡Aún no hay cursos disponibles!
      </h3>
      <p className="text-sm text-gray-400 mb-6 max-w-xs">
        Pronto vas a poder explorar contenido creado por la comunidad Titi.
      </p>
      <button
        type="button"
        onClick={() => navigate('/feed')}
        className="bg-titi-yellow text-titi-dark font-bold text-base px-6 py-3 rounded-xl shadow-[0_4px_0px_#E6B800] hover:shadow-[0_2px_0px_#E6B800] hover:-translate-y-0.5 active:shadow-none active:translate-y-0 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Volver al feed
      </button>
    </div>
  );
}

// ---- Error state (sección 8 del DESIGN.md) ----
function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
        <span className="text-red-500 text-lg" aria-hidden="true">
          ⚠️
        </span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-red-700">
            No pudimos cargar el catálogo
          </p>
          <p className="text-xs text-red-500 mt-0.5">{message}</p>
        </div>
      </div>
      <div>
        <button
          type="button"
          onClick={onRetry}
          className="bg-titi-yellow text-titi-dark font-bold text-base px-6 py-3 rounded-xl shadow-[0_4px_0px_#E6B800] hover:shadow-[0_2px_0px_#E6B800] hover:-translate-y-0.5 active:shadow-none active:translate-y-0 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}
