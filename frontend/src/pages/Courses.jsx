import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client.js';
import TitiMascot from '../components/TitiMascot.jsx';

const NIVELES = [
  { value: 'all', label: 'Todos los niveles' },
  { value: 'principiante', label: 'Principiante' },
  { value: 'intermedio', label: 'Intermedio' },
  { value: 'avanzado', label: 'Avanzado' },
];

// Estilos del badge de nivel — clave en minúsculas
const NIVEL_BADGE = {
  principiante: 'bg-titi-green/20 text-titi-green',
  intermedio: 'bg-titi-blue/20 text-titi-blue',
  avanzado: 'bg-titi-red/20 text-titi-red',
};

export default function Courses() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [nivel, setNivel] = useState('all');
  const [cursos, setCursos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);

  // Debounce del search → evita un fetch por tecla
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  // Fetch del catálogo cuando cambian los filtros
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = {};
    if (debouncedQuery) params.search = debouncedQuery;
    if (nivel !== 'all') params.nivel = nivel;

    client
      .get('/api/courses', { params })
      .then(({ data }) => {
        if (cancelled) return;
        if (data?.success) {
          setCursos(data.data?.cursos || []);
        } else {
          setError(data?.message || 'No se pudo cargar el catálogo');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err.response?.data?.message || err.message || 'Error de red',
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, nivel, refreshTick]);

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-titi-text mb-1">
          Cursos
        </h1>
        <p className="text-sm text-titi-muted font-semibold">
          Aprendé algo nuevo con la comunidad Titi
        </p>
      </header>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscá un curso por título…"
            className="titi-input pl-12"
            aria-label="Buscar cursos"
          />
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-titi-muted pointer-events-none"
          >
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.5" y2="16.5" />
          </svg>
        </div>

        <select
          value={nivel}
          onChange={(e) => setNivel(e.target.value)}
          aria-label="Filtrar por nivel"
          className="titi-input sm:w-56 cursor-pointer"
        >
          {NIVELES.map((n) => (
            <option key={n.value} value={n.value}>
              {n.label}
            </option>
          ))}
        </select>
      </div>

      {/* Contenido */}
      {loading ? (
        <CardsSkeleton />
      ) : error ? (
        <div className="bg-white border-2 border-titi-red/40 rounded-2xl p-6 text-center shadow-titi">
          <p className="text-titi-red font-bold mb-2">Error</p>
          <p className="text-sm text-titi-muted mb-4">{error}</p>
          <button
            type="button"
            onClick={() => setRefreshTick((t) => t + 1)}
            className="titi-btn-primary"
          >
            Reintentar
          </button>
        </div>
      ) : cursos.length === 0 ? (
        <div className="titi-card p-10 text-center">
          <TitiMascot
            mood="sad"
            message="¡Aún no hay cursos disponibles! 🐒"
            size="lg"
          />
          {(debouncedQuery || nivel !== 'all') && (
            <p className="text-titi-muted text-sm mt-4">
              Probá quitando los filtros para ver el catálogo completo.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {cursos.map((curso) => (
            <CourseCard
              key={curso.id}
              curso={curso}
              onOpen={() => navigate(`/courses/${curso.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Sub-componentes (mismo archivo, según pedido) ----

function CourseCard({ curso, onOpen }) {
  const nivelKey = (curso.nivel || '').toLowerCase();
  const badgeClass =
    NIVEL_BADGE[nivelKey] || 'bg-titi-yellow/30 text-titi-dark';
  const inscritos = curso._count?.inscripciones ?? 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="titi-card text-left p-0 overflow-hidden flex flex-col hover:-translate-y-0.5 hover:shadow-titi-lg transition-all focus:outline-none focus:ring-2 focus:ring-titi-yellow"
    >
      {/* Portada */}
      <div className="aspect-[16/9] w-full bg-titi-yellow/20 border-b border-titi-border overflow-hidden">
        {curso.portadaUrl ? (
          <img
            src={curso.portadaUrl}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full grid place-items-center text-3xl">
            {curso.categoria?.icono || '📚'}
          </div>
        )}
      </div>

      {/* Contenido */}
      <div className="p-4 flex flex-col gap-2 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-[10px] sm:text-xs font-extrabold uppercase tracking-wide px-2.5 py-0.5 rounded-full ${badgeClass}`}
          >
            {curso.nivel || 'sin nivel'}
          </span>
          {curso.categoria?.nombre && (
            <span className="text-[10px] sm:text-xs font-bold text-titi-muted">
              · {curso.categoria.nombre}
            </span>
          )}
        </div>

        <h3 className="text-base sm:text-lg font-extrabold text-titi-text leading-snug line-clamp-2">
          {curso.titulo}
        </h3>

        <p className="text-xs sm:text-sm text-titi-muted line-clamp-3 leading-relaxed">
          {curso.descripcion}
        </p>

        <div className="mt-auto pt-2 flex items-center justify-between text-xs font-bold text-titi-muted">
          {curso.creador?.username ? (
            <span className="truncate">@{curso.creador.username}</span>
          ) : (
            <span />
          )}
          <span className="shrink-0">
            {inscritos} {inscritos === 1 ? 'inscrito' : 'inscritos'}
          </span>
        </div>
      </div>
    </button>
  );
}

function CardsSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="titi-card overflow-hidden flex flex-col animate-pulse"
        >
          <div className="aspect-[16/9] w-full bg-titi-border/60" />
          <div className="p-4 flex flex-col gap-3">
            <div className="h-3 w-20 rounded-full bg-titi-border/80" />
            <div className="h-4 w-3/4 rounded bg-titi-border/80" />
            <div className="h-3 w-full rounded bg-titi-border/60" />
            <div className="h-3 w-5/6 rounded bg-titi-border/60" />
            <div className="h-3 w-1/3 rounded bg-titi-border/60 mt-2" />
          </div>
        </div>
      ))}
    </div>
  );
}
