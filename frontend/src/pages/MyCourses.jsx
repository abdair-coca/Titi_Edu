import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client.js';

function formatDateEs(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

export default function MyCourses() {
  const navigate = useNavigate();

  const [inscripciones, setInscripciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    client
      .get('/api/courses/my/enrolled')
      .then(({ data }) => {
        if (cancelled) return;
        if (data?.success) {
          setInscripciones(data.data?.inscripciones || []);
        } else {
          setError(data?.message || 'No se pudieron cargar tus cursos');
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
  }, [refreshTick]);

  return (
    <div className="bg-titi-cream min-h-screen p-8">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold text-titi-dark">
          Mis cursos
        </h1>
        <p className="text-sm font-medium text-gray-500 mt-1">
          Continuá donde lo dejaste
        </p>
      </header>

      {loading ? (
        <SkeletonGrid />
      ) : error ? (
        <ErrorState
          message={error}
          onRetry={() => setRefreshTick((t) => t + 1)}
        />
      ) : inscripciones.length === 0 ? (
        <EmptyState onExplore={() => navigate('/courses')} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {inscripciones.map((insc) => (
            <EnrolledCard
              key={insc.id}
              inscripcion={insc}
              onContinue={() => navigate(`/courses/${insc.cursoId}/learn`)}
              onOpenDetail={() => navigate(`/courses/${insc.cursoId}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Card de curso inscrito ----
function EnrolledCard({ inscripcion, onContinue, onOpenDetail }) {
  const curso = inscripcion.curso || {};
  const completado = Boolean(inscripcion.completado);

  return (
    <article className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_24px_rgba(255,217,61,0.2)] hover:-translate-y-1 transition-all duration-200 p-5 flex flex-col gap-3">
      {/* Header: categoría + estado */}
      <div className="flex items-start justify-between gap-2">
        {curso.categoria?.nombre ? (
          <span className="text-xs font-semibold text-titi-streak uppercase tracking-wide">
            {curso.categoria.nombre}
          </span>
        ) : (
          <span />
        )}

        {completado && (
          <span className="bg-green-50 text-green-700 border border-green-200 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap">
            Completado ✓
          </span>
        )}
      </div>

      {/* Título */}
      <button
        type="button"
        onClick={onOpenDetail}
        className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-titi-yellow rounded-lg"
      >
        <h3 className="text-base font-bold text-titi-dark leading-snug line-clamp-2 hover:text-titi-yellow-dark transition-colors">
          {curso.titulo || 'Curso sin título'}
        </h3>
      </button>

      {/* Meta: nivel + categoría */}
      <div className="flex items-center gap-2 flex-wrap">
        {curso.nivel && (
          <span className="inline-block bg-titi-yellow-light text-titi-dark text-xs font-semibold capitalize px-3 py-1 rounded-full">
            {curso.nivel}
          </span>
        )}
        {curso.categoria?.nombre && (
          <span className="text-xs font-medium text-gray-500">
            {curso.categoria.icono ? `${curso.categoria.icono} ` : ''}
            {curso.categoria.nombre}
          </span>
        )}
      </div>

      {/* Fecha de inscripción */}
      <p className="text-sm font-medium text-gray-500">
        Inscrito el {formatDateEs(inscripcion.fechaInscripcion)}
      </p>

      {/* Acción */}
      <div className="mt-auto pt-2">
        {completado ? (
          <div className="flex items-center justify-between gap-2">
            {inscripcion.fechaCompletado && (
              <span className="text-xs font-semibold text-gray-400">
                Completado el {formatDateEs(inscripcion.fechaCompletado)}
              </span>
            )}
            <button
              type="button"
              onClick={onOpenDetail}
              className="text-sm font-semibold text-titi-dark hover:text-titi-yellow-dark transition-colors"
            >
              Ver curso →
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onContinue}
            className="bg-titi-yellow text-titi-dark font-bold px-4 py-2 rounded-xl shadow-[0_4px_0px_#E6B800] hover:shadow-[0_2px_0px_#E6B800] hover:-translate-y-0.5 active:shadow-none active:translate-y-0 transition-all duration-150"
          >
            Continuar →
          </button>
        )}
      </div>
    </article>
  );
}

// ---- Empty state (sección 8 del DESIGN.md) ----
function EmptyState({ onExplore }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      <img
        src="/Titi.png"
        alt="Titi"
        className="w-24 h-24 mb-4 object-contain drop-shadow-sm select-none"
        draggable={false}
      />
      <h3 className="text-xl font-bold text-titi-dark mb-2">
        Aún no tienes cursos
      </h3>
      <p className="text-sm text-gray-400 mb-6 max-w-xs">
        Explorá el catálogo y encontrá algo nuevo para aprender con la
        comunidad Titi.
      </p>
      <button
        type="button"
        onClick={onExplore}
        className="bg-titi-yellow text-titi-dark font-bold text-base px-6 py-3 rounded-xl shadow-[0_4px_0px_#E6B800] hover:shadow-[0_2px_0px_#E6B800] hover:-translate-y-0.5 active:shadow-none active:translate-y-0 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Ver catálogo de cursos
      </button>
    </div>
  );
}

// ---- Error state ----
function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
        <span className="text-red-500 text-lg" aria-hidden="true">⚠️</span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-red-700">
            No pudimos cargar tus cursos
          </p>
          <p className="text-xs text-red-500 mt-0.5">{message}</p>
        </div>
      </div>
      <div>
        <button
          type="button"
          onClick={onRetry}
          className="bg-titi-yellow text-titi-dark font-bold text-base px-6 py-3 rounded-xl shadow-[0_4px_0px_#E6B800] hover:shadow-[0_2px_0px_#E6B800] hover:-translate-y-0.5 active:shadow-none active:translate-y-0 transition-all duration-150"
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}

// ---- Loading skeleton ----
function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-3 animate-pulse"
        >
          <div className="h-3 w-24 bg-gray-100 rounded-full" />
          <div className="h-5 w-3/4 bg-gray-100 rounded" />
          <div className="flex gap-2">
            <div className="h-6 w-20 bg-gray-100 rounded-full" />
            <div className="h-6 w-16 bg-gray-100 rounded-full" />
          </div>
          <div className="h-3 w-1/2 bg-gray-100 rounded" />
          <div className="h-9 w-32 bg-gray-100 rounded-xl mt-2" />
        </div>
      ))}
    </div>
  );
}
