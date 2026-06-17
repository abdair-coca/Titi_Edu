import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client.js';
import { useStaggerReveal } from '../lib/motion.js';

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

  // Mapa cursoId → { total, completadas, porcentaje }
  // Se llena en paralelo después de cargar las inscripciones para detectar
  // cursos 100% completados aunque la Inscripcion no esté marcada como tal.
  const [progressByCurso, setProgressByCurso] = useState({});

  const gridRef = useStaggerReveal([inscripciones.length]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setProgressByCurso({});

    client
      .get('/api/courses/my/enrolled')
      .then(({ data }) => {
        if (cancelled) return;
        if (!data?.success) {
          setError(data?.message || 'No se pudieron cargar tus cursos');
          return;
        }
        const list = data.data?.inscripciones || [];
        setInscripciones(list);

        // Fetch del progreso real por curso en paralelo
        Promise.all(
          list.map((insc) =>
            client
              .get(`/api/courses/${insc.cursoId}/progress`)
              .then(({ data }) =>
                data?.success ? [insc.cursoId, data.data] : null,
              )
              .catch(() => null),
          ),
        ).then((results) => {
          if (cancelled) return;
          const map = {};
          for (const r of results) {
            if (r) map[r[0]] = r[1];
          }
          setProgressByCurso(map);
        });
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
    <div>
      {/* Header */}
      <header className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-titi-dark">
            Mis cursos
          </h1>
          <p className="text-sm font-medium text-gray-500 mt-1">
            Continuá donde lo dejaste
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/certificates')}
          className="bg-white text-titi-dark font-semibold text-sm px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-all whitespace-nowrap"
        >
          🎓 Mis certificados
        </button>
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
        <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {inscripciones.map((insc) => (
            <EnrolledCard
              key={insc.id}
              inscripcion={insc}
              progress={progressByCurso[insc.cursoId]}
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
function EnrolledCard({ inscripcion, progress, onContinue, onOpenDetail }) {
  const curso = inscripcion.curso || {};

  // Completado real = lo que diga el backend OR todas las lecciones marcadas
  const computedComplete = Boolean(
    progress && progress.total > 0 && progress.completadas === progress.total,
  );
  const completado = Boolean(inscripcion.completado) || computedComplete;

  const porcentaje = progress?.porcentaje ?? 0;
  const hasProgressData = Boolean(progress && progress.total > 0);

  return (
    <article className="titi-card-pop bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_24px_rgba(255,217,61,0.2)] overflow-hidden flex flex-col">
      {/* Portada con badges */}
      <button
        type="button"
        onClick={onOpenDetail}
        aria-label={`Ver detalle de ${curso.titulo || 'curso'}`}
        className="relative h-40 bg-gradient-to-br from-titi-yellow-light via-titi-yellow-light to-titi-yellow/40 overflow-hidden block w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-titi-yellow"
      >
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
          <>
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

        {/* Badge de nivel — top-left */}
        {curso.nivel && (
          <span className="absolute top-3 left-3 bg-white text-titi-dark text-xs font-semibold capitalize px-2.5 py-1 rounded-full shadow-sm">
            {curso.nivel}
          </span>
        )}

        {/* Badge "Completado" — top-right */}
        {completado && (
          <span className="absolute top-3 right-3 bg-green-50 text-green-700 border border-green-200 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap shadow-sm">
            Completado ✓
          </span>
        )}
      </button>

      {/* Cuerpo */}
      <div className="p-5 flex flex-col gap-2 flex-1">
        {/* Categoría */}
        {curso.categoria?.nombre && (
          <span className="text-xs font-semibold text-titi-streak uppercase tracking-wide">
            {curso.categoria.nombre}
          </span>
        )}

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

        {/* Fecha de inscripción */}
        <p className="text-sm font-medium text-gray-500">
          Inscrito el {formatDateEs(inscripcion.fechaInscripcion)}
        </p>

        {/* Barra de progreso */}
        {hasProgressData && (
          <div className="mt-1">
            <div className="flex justify-between text-xs font-medium text-gray-400 mb-1">
              <span>
                {progress.completadas} / {progress.total}{' '}
                {progress.total === 1 ? 'lección' : 'lecciones'}
              </span>
              <span className="tabular-nums">{porcentaje}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  completado ? 'bg-green-500' : 'bg-titi-yellow'
                }`}
                style={{ width: `${porcentaje}%` }}
              />
            </div>
          </div>
        )}

        {/* Acción */}
        <div className="mt-auto pt-3">
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
                className="text-sm font-semibold text-titi-dark hover:text-titi-yellow-dark transition-colors ml-auto"
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
          className="bg-white rounded-2xl border border-gray-100 overflow-hidden flex flex-col animate-pulse"
        >
          <div className="h-40 bg-gray-100" />
          <div className="p-5 flex flex-col gap-3">
            <div className="h-3 w-24 bg-gray-100 rounded-full" />
            <div className="h-5 w-3/4 bg-gray-100 rounded" />
            <div className="h-3 w-1/2 bg-gray-100 rounded" />
            <div className="h-2 w-full bg-gray-100 rounded-full mt-2" />
            <div className="h-9 w-32 bg-gray-100 rounded-xl mt-2" />
          </div>
        </div>
      ))}
    </div>
  );
}
