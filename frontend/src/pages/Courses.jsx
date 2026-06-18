import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useStaggerReveal, usePopIn } from '../lib/motion.js';
import RecommendedCourseCard from '../components/RecommendedCourseCard.jsx';

// Copys estáticos de los paneles de comunidad (marketing, sin backend).
const PERKS = [
  'Lecciones cortas que terminás en una sentada',
  'Profes de la comunidad, no robots',
  'Seguí tu progreso y tu racha de gotas',
  'Aprendé gratis, a tu propio ritmo',
];

const BADGES = [
  { glyph: '🔥', title: 'Racha activa', note: '7 días seguidos' },
  { glyph: '💧', title: 'Coleccionista', note: '50 gotas ganadas' },
  { glyph: '🏅', title: 'Primer curso', note: 'curso completado' },
];

// Testimonios — placeholder estático (sin backend, contenido de ejemplo).
const TESTIMONIALS = [
  {
    quote:
      'Empecé sin saber nada de código y hoy mantengo el back-end de mi propio proyecto.',
    name: 'Lucía R.',
    role: 'Estudiante de Back-End',
    tint: 'bg-titi-dark',
  },
  {
    quote:
      'Las lecciones cortas hacen que sea fácil sumar aunque tenga poco tiempo.',
    name: 'Martín D.',
    role: 'Estudiante de Python',
    tint: 'bg-titi-streak',
  },
  {
    quote: 'La comunidad responde rapidísimo, nunca te quedás trabado.',
    name: 'Sofía G.',
    role: 'Estudiante de Diseño',
    tint: 'bg-titi-achievement',
  },
  {
    quote:
      'Pasé de tenerle miedo al inglés a leer documentación sin traductor.',
    name: 'Diego F.',
    role: 'Estudiante de Inglés',
    tint: 'bg-titi-certificate',
  },
];

// Rutas de aprendizaje — placeholder estático (sin backend, contenido de ejemplo).
const PATHS = [
  { title: 'Ingeniero Back-End', meta: '6 cursos', rating: '4.7' },
  { title: 'Científico de Datos', meta: '5 cursos', rating: '4.8' },
  { title: 'Diseñador de Producto', meta: '4 cursos', rating: '4.6' },
];

const FOOTER_COLS = [
  { title: 'Explorar', items: ['Cursos', 'Categorías', 'Rutas'] },
  { title: 'Comunidad', items: ['Profes', 'Logros', 'Ranking'] },
  { title: 'Titi', items: ['Sobre nosotros', 'Ayuda', 'Contacto'] },
];

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

  // Entrada escalonada de las cards (GSAP, respeta reduced-motion).
  const gridRef = useStaggerReveal([cursos.length]);
  const recommendedRef = useStaggerReveal([recommended.length]);
  const featuredRef = useStaggerReveal([categorias.length]);
  const testimonialsRef = useStaggerReveal([TESTIMONIALS.length]);
  const pathsRef = useStaggerReveal([PATHS.length]);
  const stripRef = useStaggerReveal([4]);
  const badgesRef = useStaggerReveal([BADGES.length]);
  // Bloques sueltos (no-lista) que también deben entrar (motion.md §4).
  const promoRef = usePopIn([]);
  const heroRef = usePopIn([]);
  const darkPromoRef = usePopIn([]);
  const footerRef = usePopIn([]);

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
  const popularRef = useStaggerReveal([popularCats.length]);

  // Total de lecciones del catálogo (para el stat strip).
  const lessonsTotal = useMemo(
    () =>
      allCursos.reduce(
        (sum, c) => sum + (c._count?.lecciones ?? c._count?.modulos ?? 0),
        0,
      ),
    [allCursos],
  );

  function goToTrending() {
    document.getElementById('trending')?.scrollIntoView();
  }

  function clearFilters() {
    setQuery('');
    setDebouncedQuery('');
    setCategoria('all');
  }

  return (
    <div className="flex flex-col gap-8 sm:gap-10">
      {/* Promo bar */}
      <div ref={promoRef} className="flex items-center justify-center gap-2 bg-titi-yellow text-titi-dark rounded-xl px-4 py-2.5 text-center text-sm font-bold">
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
      <section ref={heroRef} className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 items-center">
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
          <h1 className="text-4xl sm:text-5xl font-extrabold text-titi-dark leading-[1.05] tracking-tight mb-4">
            Aprendé algo nuevo, <span className="text-titi-streak">hoy</span>.
          </h1>
          <p className="text-base sm:text-lg font-medium text-gray-500 leading-relaxed mb-6 max-w-md">
            Cursos creados por personas como vos. Sumá lecciones cortas, ganá
            gotas y seguí tu propio ritmo en la comunidad Titi.
          </p>

          {/* Search grande */}
          <div className="relative max-w-lg mb-6">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="¿Qué querés aprender hoy?"
              aria-label="Buscar cursos"
              className="w-full bg-white border border-gray-100 rounded-2xl pl-12 pr-5 py-5 text-base font-medium text-titi-dark placeholder:text-gray-400 shadow-[0_4px_14px_rgba(0,0,0,0.06)] focus:outline-none focus:border-titi-yellow focus:ring-2 focus:ring-titi-yellow/20 transition-all duration-150"
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
          <div ref={featuredRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
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
      <section id="trending" aria-label="Cursos en tendencia">
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

      {/* Dark promo — reimaginá tu forma de aprender */}
      <section ref={darkPromoRef} aria-label="Reimaginá tu forma de aprender">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center bg-titi-dark rounded-2xl p-8 sm:p-10">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-titi-cream leading-tight mb-3">
              Reimaginá tu forma de{' '}
              <span className="text-titi-yellow">aprender</span>
            </h2>
            <p className="text-sm font-medium text-white/60 leading-relaxed mb-6 max-w-md">
              Lecciones cortas, hechas por la comunidad, pensadas para que
              avances a tu ritmo y sin frustrarte.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 mb-7">
              {PERKS.map((perk) => (
                <div key={perk} className="flex items-start gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-titi-yellow/15 grid place-items-center shrink-0 mt-0.5">
                    <svg
                      viewBox="0 0 14 14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-3 h-3 text-titi-yellow"
                      aria-hidden="true"
                    >
                      <path d="M2 7 6 11l6-8" />
                    </svg>
                  </span>
                  <span className="text-sm font-medium text-white/85 leading-snug">
                    {perk}
                  </span>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={goToTrending}
              className="bg-titi-yellow text-titi-dark font-bold text-base px-6 py-3 rounded-xl shadow-[0_4px_0px_#E6B800] hover:shadow-[0_2px_0px_#E6B800] hover:-translate-y-0.5 active:shadow-none active:translate-y-0 transition-all duration-150"
            >
              Empezar a aprender
            </button>
          </div>

          {/* Visual plano */}
          <div className="hidden lg:block relative">
            <div className="h-56 rounded-2xl bg-titi-dark-mid flex items-center justify-center">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-white/40">
                imagen / collage
              </span>
            </div>
            <div className="absolute -bottom-4 -left-4 bg-titi-cream rounded-xl px-4 py-3 shadow-lg flex items-center gap-2.5">
              <span className="text-xl" aria-hidden="true">💧</span>
              <div className="leading-tight">
                <p className="text-base font-extrabold text-titi-dark">+1 gota</p>
                <p className="text-xs font-bold text-gray-400">por lección</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stat strip — la comunidad en números (data real) */}
      <section aria-label="La comunidad Titi en números">
        <p className="text-center text-sm font-bold text-gray-400 mb-5">
          Lo que está construyendo la comunidad Titi
        </p>
        <div ref={stripRef} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StripStat num={allCursos.length} label="cursos publicados" />
          <StripStat num={profesCount} label="profes de la comunidad" />
          <StripStat num={categorias.length} label="categorías" />
          <StripStat num={lessonsTotal} label="lecciones disponibles" />
        </div>
      </section>

      {/* Testimonios — placeholder estático (contenido de ejemplo) */}
      <section aria-label="Historias de la comunidad">
        <div className="flex items-end justify-between gap-3 mb-5">
          <h2 className="text-2xl font-bold text-titi-dark">
            Historias de la comunidad
          </h2>
          <span className="text-xs font-semibold text-gray-400 italic shrink-0">
            contenido de ejemplo
          </span>
        </div>
        <div
          ref={testimonialsRef}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {TESTIMONIALS.map((t) => (
            <div
              key={t.name}
              className="bg-white border border-gray-100 rounded-2xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.06)] flex flex-col"
            >
              <span
                className="text-titi-yellow text-3xl font-black leading-none h-5"
                aria-hidden="true"
              >
                “
              </span>
              <p className="text-sm font-medium text-titi-dark leading-relaxed mb-4 flex-1">
                {t.quote}
              </p>
              <div className="flex items-center gap-2.5">
                <span
                  className={`w-9 h-9 rounded-full grid place-items-center text-white text-sm font-bold shrink-0 ${t.tint}`}
                >
                  {t.name[0]}
                </span>
                <div className="leading-tight min-w-0">
                  <p className="text-sm font-bold text-titi-dark truncate">
                    {t.name}
                  </p>
                  <p className="text-xs font-medium text-gray-400 truncate">
                    {t.role}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Logros — sumá gotas y desbloqueá logros */}
      <section aria-label="Sumá gotas y desbloqueá logros">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center bg-titi-dark rounded-2xl p-8 sm:p-10">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-titi-cream leading-tight mb-3">
              Sumá gotas y desbloqueá logros
            </h2>
            <p className="text-sm font-medium text-white/60 leading-relaxed mb-6 max-w-sm">
              Cada lección suma. Mantené tu racha, ganá insignias y subí en el
              ranking de la comunidad.
            </p>
            <button
              type="button"
              onClick={() => navigate('/certificates')}
              className="bg-white text-titi-dark font-semibold text-sm px-5 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all duration-150"
            >
              Ver mis logros
            </button>
          </div>
          <div ref={badgesRef} className="grid grid-cols-3 gap-3 sm:gap-4">
            {BADGES.map((b) => (
              <div
                key={b.title}
                className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center"
              >
                <div className="w-12 h-12 rounded-xl bg-white/10 grid place-items-center mx-auto mb-3 text-2xl">
                  <span aria-hidden="true">{b.glyph}</span>
                </div>
                <div className="text-sm font-bold text-titi-cream mb-0.5">
                  {b.title}
                </div>
                <div className="text-xs font-medium text-white/50">{b.note}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Learning paths — placeholder estático (contenido de ejemplo) */}
      <section aria-label="Rutas de aprendizaje">
        <div className="flex items-end justify-between gap-3 mb-1">
          <h2 className="text-2xl font-bold text-titi-dark">
            ¿Listo para seguir aprendiendo?
          </h2>
          <span className="text-xs font-semibold text-gray-400 italic shrink-0">
            contenido de ejemplo
          </span>
        </div>
        <p className="text-sm font-medium text-gray-500 mb-5">
          Rutas armadas por la comunidad para llevarte de cero a proyecto real.
        </p>
        <div
          ref={pathsRef}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6"
        >
          {PATHS.map((p) => (
            <div
              key={p.title}
              className="relative h-52 rounded-2xl bg-titi-dark overflow-hidden p-6 flex flex-col justify-end"
            >
              <span className="absolute top-4 left-4 inline-flex items-center bg-titi-cream text-titi-dark text-xs font-extrabold px-2.5 py-1 rounded-full">
                RUTA
              </span>
              <h3 className="text-xl font-bold text-titi-cream mb-1">
                {p.title}
              </h3>
              <div className="flex items-center gap-2 text-sm font-bold text-white/70">
                <span>{p.meta}</span>
                <span className="opacity-50" aria-hidden="true">·</span>
                <span className="text-titi-yellow">★ {p.rating}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Categorías populares — columnas con cursos por categoría */}
      {popularCats.length > 0 && (
        <section aria-label="Categorías populares">
          <h2 className="text-2xl font-bold text-titi-dark mb-6">
            Categorías populares
          </h2>
          <div ref={popularRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-8">
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

      {/* Footer */}
      <footer ref={footerRef} className="bg-titi-dark rounded-2xl p-8 sm:p-10 text-white/60">
        <div className="flex items-center gap-2.5 mb-6">
          <img
            src="/favicon.png"
            alt=""
            className="w-9 h-9 object-contain select-none"
            draggable={false}
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
          <span className="text-xl font-extrabold lowercase tracking-tight text-titi-cream">
            titi
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pb-6 border-b border-white/10">
          <p className="text-sm font-medium leading-relaxed max-w-xs col-span-2 md:col-span-1">
            Una comunidad donde cualquiera puede aprender y enseñar. Lecciones
            cortas, gente real, a tu ritmo.
          </p>
          {FOOTER_COLS.map((col) => (
            <div key={col.title} className="flex flex-col gap-2.5">
              <span className="text-sm font-bold text-titi-cream mb-0.5">
                {col.title}
              </span>
              {col.items.map((item) => (
                <span key={item} className="text-sm font-medium">
                  {item}
                </span>
              ))}
            </div>
          ))}
        </div>
        <p className="text-xs font-medium text-white/40 pt-5">
          © 2026 Titi · Hecho por y para la comunidad
        </p>
      </footer>
    </div>
  );
}

// ---- Stat del strip de comunidad ----
function StripStat({ num, label }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 text-center shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
      <div className="text-3xl font-extrabold text-titi-dark tabular-nums">
        {num}
      </div>
      <div className="text-sm font-bold text-gray-400 mt-1">{label}</div>
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
