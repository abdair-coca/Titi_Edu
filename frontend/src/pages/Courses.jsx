import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useStaggerReveal } from '../lib/motion.js';
import RecommendedCourseCard from '../components/RecommendedCourseCard.jsx';

const NIVELES = [
  { value: 'all', label: 'Todos los niveles' },
  { value: 'principiante', label: 'Principiante' },
  { value: 'intermedio', label: 'Intermedio' },
  { value: 'avanzado', label: 'Avanzado' },
];

export default function Courses() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [nivel, setNivel] = useState('all');
  const [categoria, setCategoria] = useState('all');

  const [categorias, setCategorias] = useState([]);
  const [cursos, setCursos] = useState([]);
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
    if (nivel !== 'all') params.nivel = nivel;
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
  }, [debouncedQuery, nivel, categoria, refreshTick]);

  // Entrada escalonada de las cards del catálogo (GSAP, respeta reduced-motion).
  const gridRef = useStaggerReveal([cursos]);

  const hasFilters = debouncedQuery || nivel !== 'all' || categoria !== 'all';

  function clearFilters() {
    setQuery('');
    setDebouncedQuery('');
    setNivel('all');
    setCategoria('all');
  }

  return (
    <div>
      {/* Header */}
      <header className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-titi-dark mb-1">
          Catálogo de Cursos
        </h1>
        <p className="text-sm font-medium text-gray-500">
          Aprendé algo nuevo con la comunidad Titi
        </p>
      </header>

      {/* Recomendados por tus amigos */}
      {recommended.length > 0 && (
        <section aria-label="Recomendados por tus amigos" className="mb-8">
          <h2 className="text-lg font-bold text-titi-dark mb-3">
            Tus amigos están aprendiendo
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6 sm:mb-8">
        {/* Search */}
        <div className="relative flex-1">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscá un curso por título…"
            aria-label="Buscar cursos"
            className="w-full bg-titi-cream border border-gray-200 rounded-xl pl-11 pr-4 py-3 text-sm font-medium text-titi-dark placeholder:text-gray-300 focus:outline-none focus:border-titi-yellow focus:ring-2 focus:ring-titi-yellow/20 transition-all duration-150"
          />
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.5" y2="16.5" />
          </svg>
        </div>

        {/* Categoría select */}
        <select
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          aria-label="Filtrar por categoría"
          className="sm:w-56 bg-titi-cream border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-titi-dark cursor-pointer focus:outline-none focus:border-titi-yellow focus:ring-2 focus:ring-titi-yellow/20 transition-all duration-150"
        >
          <option value="all">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icono} {c.nombre}
            </option>
          ))}
        </select>

        {/* Nivel select */}
        <select
          value={nivel}
          onChange={(e) => setNivel(e.target.value)}
          aria-label="Filtrar por nivel"
          className="sm:w-56 bg-titi-cream border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-titi-dark cursor-pointer focus:outline-none focus:border-titi-yellow focus:ring-2 focus:ring-titi-yellow/20 transition-all duration-150"
        >
          {NIVELES.map((n) => (
            <option key={n.value} value={n.value}>
              {n.label}
            </option>
          ))}
        </select>
      </div>

      {/* Contenido principal */}
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
    </div>
  );
}

// ---- CourseCard (sección 5.2 del DESIGN.md) ----
function CourseCard({ curso, onOpen }) {
  const cantidadLecciones =
    curso._count?.lecciones ??
    curso._count?.modulos ??
    0;
  const lessonsLabel =
    cantidadLecciones === 1 ? '1 lección' : `${cantidadLecciones} lecciones`;

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
      className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_24px_rgba(255,217,61,0.2)] hover:-translate-y-1 transition-all duration-200 overflow-hidden cursor-pointer flex flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-titi-yellow"
    >
      {/* Imagen de portada */}
      <div className="relative h-44 bg-gradient-to-br from-titi-yellow-light via-titi-yellow-light to-titi-yellow/40 overflow-hidden">
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
          <>
            {/* Decoraciones de fondo — círculos suaves */}
            <span
              aria-hidden="true"
              className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/40 blur-xl"
            />
            <span
              aria-hidden="true"
              className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-titi-yellow/30 blur-xl"
            />
            <div className="relative w-full h-full grid place-items-center text-6xl select-none drop-shadow-sm">
              {curso.categoria?.icono || '📚'}
            </div>
          </>
        )}

        {/* Badge de nivel */}
        <span className="absolute top-3 left-3 bg-white text-titi-dark text-xs font-semibold capitalize px-2.5 py-1 rounded-full shadow-sm">
          {curso.nivel || 'sin nivel'}
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

        {/* Meta info */}
        <p className="text-sm text-gray-500 font-medium">
          {lessonsLabel}
          {curso.creador?.username && (
            <> · Por {curso.creador.username}</>
          )}
        </p>
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
          <div className="h-44 bg-gray-100" />
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
