import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

const NIVEL_BADGE = {
  principiante: 'bg-titi-green/20 text-titi-green',
  intermedio: 'bg-titi-blue/20 text-titi-blue',
  avanzado: 'bg-titi-red/20 text-titi-red',
};

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
  const { isAuthenticated } = useAuth();

  const [inscripciones, setInscripciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      setError('Necesitas iniciar sesión para ver tus cursos.');
      return;
    }
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
  }, [isAuthenticated, refreshTick]);

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-titi-text mb-1">
          Mis cursos
        </h1>
        <p className="text-sm text-titi-muted font-semibold">
          Continuá donde lo dejaste
        </p>
      </header>

      {loading ? (
        <SkeletonGrid />
      ) : error ? (
        <div className="bg-white border-2 border-titi-red/40 rounded-2xl p-6 text-center shadow-titi">
          <p className="text-titi-red font-bold mb-2">Algo salió mal</p>
          <p className="text-sm text-titi-muted mb-4">{error}</p>
          <button
            type="button"
            onClick={() => setRefreshTick((t) => t + 1)}
            className="titi-btn-primary"
          >
            Reintentar
          </button>
        </div>
      ) : inscripciones.length === 0 ? (
        <EmptyState onExplore={() => navigate('/courses')} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
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

// ---- Sub-componentes (mismo archivo) ----

function EnrolledCard({ inscripcion, onContinue, onOpenDetail }) {
  const curso = inscripcion.curso || {};
  const nivelKey = (curso.nivel || '').toLowerCase();
  const badgeClass =
    NIVEL_BADGE[nivelKey] || 'bg-titi-yellow/30 text-titi-dark';

  return (
    <article className="titi-card overflow-hidden flex flex-col">
      {/* Portada / icono */}
      <button
        type="button"
        onClick={onOpenDetail}
        aria-label={`Ver detalle de ${curso.titulo || 'curso'}`}
        className="aspect-[16/9] w-full bg-titi-yellow/20 border-b border-titi-border overflow-hidden focus:outline-none focus:ring-2 focus:ring-titi-yellow"
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
          <div className="w-full h-full grid place-items-center text-3xl">
            {curso.categoria?.icono || '📚'}
          </div>
        )}
      </button>

      {/* Cuerpo */}
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
          {curso.titulo || 'Curso sin título'}
        </h3>

        <p className="text-xs sm:text-sm text-titi-muted font-semibold">
          Inscrito el {formatDateEs(inscripcion.fechaInscripcion)}
        </p>

        {/* Estado de progreso / acción */}
        <div className="mt-auto pt-3">
          {inscripcion.completado ? (
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-sm font-extrabold text-titi-green bg-titi-green/15 px-3 py-1.5 rounded-full">
                Completado ✓
              </span>
              {inscripcion.fechaCompletado && (
                <span className="text-[11px] font-bold text-titi-muted">
                  {formatDateEs(inscripcion.fechaCompletado)}
                </span>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={onContinue}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full font-extrabold text-titi-dark bg-titi-yellow hover:bg-titi-orange hover:-translate-y-0.5 shadow-titi transition-all"
            >
              Continuar →
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function EmptyState({ onExplore }) {
  return (
    <div className="titi-card p-10 text-center flex flex-col items-center gap-4">
      <img
        src="/Titi.png"
        alt="Titi"
        className="w-32 h-32 object-contain drop-shadow-lg select-none"
        draggable={false}
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
      <p className="text-titi-text font-bold text-base max-w-md leading-snug">
        Aún no te has inscrito en ningún curso. ¡Explora el catálogo! 🐒
      </p>
      <button
        type="button"
        onClick={onExplore}
        className="titi-btn-primary"
      >
        Ver catálogo
      </button>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="titi-card overflow-hidden flex flex-col animate-pulse"
        >
          <div className="aspect-[16/9] w-full bg-titi-border/60" />
          <div className="p-4 flex flex-col gap-3">
            <div className="h-3 w-20 rounded-full bg-titi-border/80" />
            <div className="h-4 w-3/4 rounded bg-titi-border/80" />
            <div className="h-3 w-1/2 rounded bg-titi-border/60" />
            <div className="h-9 w-full rounded-full bg-titi-border/60 mt-3" />
          </div>
        </div>
      ))}
    </div>
  );
}
