import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

const NIVEL_BADGE = {
  principiante: 'bg-titi-green/20 text-titi-green',
  intermedio: 'bg-titi-blue/20 text-titi-blue',
  avanzado: 'bg-titi-red/20 text-titi-red',
};

function formatDate(value) {
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

export default function   CourseDetail() {
  const { id: courseId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const [curso, setCurso] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Enrollment state
  const [enrolled, setEnrolled] = useState(false);
  const [enrollChecked, setEnrollChecked] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const isStudent = isAuthenticated && user?.rol === 'ESTUDIANTE';

  // --- Fetch del detalle del curso ---
  useEffect(() => {
    if (!courseId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    client
      .get(`/api/courses/${courseId}`)
      .then(({ data }) => {
        if (cancelled) return;
        if (data?.success) setCurso(data.data?.curso || null);
        else setError(data?.message || 'No se pudo cargar el curso');
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.response?.status === 404) {
          setError('Curso no encontrado');
        } else {
          setError(
            err.response?.data?.message || err.message || 'Error de red',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [courseId]);

  // --- Check si ya está inscrito (solo estudiantes autenticados) ---
  useEffect(() => {
    if (!courseId || !isStudent) {
      setEnrollChecked(true);
      return;
    }
    let cancelled = false;
    setEnrollChecked(false);

    client
      .get('/api/courses/my/enrolled')
      .then(({ data }) => {
        if (cancelled) return;
        if (data?.success) {
          const list = data.data?.inscripciones || [];
          setEnrolled(list.some((i) => i.cursoId === courseId));
        }
      })
      .catch(() => {
        // Silencioso: si falla, asumimos no inscrito y dejamos que el
        // backend devuelva 409 al inscribirse de nuevo.
      })
      .finally(() => {
        if (!cancelled) setEnrollChecked(true);
      });

    return () => {
      cancelled = true;
    };
  }, [courseId, isStudent]);

  // --- Acciones ---
  const handleEnroll = async () => {
    setEnrolling(true);
    setEnrollError(null);
    try {
      const { data } = await client.post(`/api/courses/${courseId}/enroll`);
      if (data?.success) {
        setEnrolled(true);
        setSuccessMsg('¡Te inscribiste con éxito! Redirigiendo al curso…');
        setTimeout(() => navigate(`/courses/${courseId}/learn`), 900);
      } else {
        setEnrollError(data?.message || 'No se pudo completar la inscripción');
      }
    } catch (err) {
      // 409 = ya inscrito → tratarlo como éxito y redirigir
      if (err.response?.status === 409) {
        setEnrolled(true);
        navigate(`/courses/${courseId}/learn`);
        return;
      }
      setEnrollError(
        err.response?.data?.message || err.message || 'Error de red',
      );
    } finally {
      setEnrolling(false);
    }
  };

  // --- Render ---
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-2/3 bg-titi-border/70 rounded animate-pulse" />
        <div className="h-4 w-1/3 bg-titi-border/60 rounded animate-pulse" />
        <div className="titi-card p-6 animate-pulse space-y-3">
          <div className="h-4 w-full bg-titi-border/60 rounded" />
          <div className="h-4 w-5/6 bg-titi-border/60 rounded" />
          <div className="h-4 w-2/3 bg-titi-border/60 rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border-2 border-titi-red/40 rounded-2xl p-6 text-center shadow-titi">
        <p className="text-titi-red font-bold mb-2">No se pudo cargar el curso</p>
        <p className="text-sm text-titi-muted mb-4">{error}</p>
        <button
          type="button"
          onClick={() => navigate('/courses')}
          className="titi-btn-ghost"
        >
          ← Volver al catálogo
        </button>
      </div>
    );
  }

  if (!curso) return null;

  const nivelKey = (curso.nivel || '').toLowerCase();
  const badgeClass =
    NIVEL_BADGE[nivelKey] || 'bg-titi-yellow/30 text-titi-dark';

  return (
    <div className="space-y-6">
      {/* Volver */}
      <button
        type="button"
        onClick={() => navigate('/courses')}
        className="text-sm font-bold text-titi-muted hover:text-titi-text transition-colors inline-flex items-center gap-1"
      >
        ← Volver al catálogo
      </button>

      {/* Hero */}
      <header className="titi-card p-0 overflow-hidden">
        {curso.portadaUrl ? (
          <div className="aspect-[21/9] w-full bg-titi-yellow/20 border-b border-titi-border overflow-hidden">
            <img
              src={curso.portadaUrl}
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        ) : null}

        <div className="p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-xs font-extrabold uppercase tracking-wide px-3 py-1 rounded-full ${badgeClass}`}
            >
              {curso.nivel || 'sin nivel'}
            </span>
            {curso.categoria?.nombre && (
              <span className="titi-chip">
                {curso.categoria.icono ? `${curso.categoria.icono} ` : ''}
                {curso.categoria.nombre}
              </span>
            )}
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-titi-text leading-tight">
            {curso.titulo}
          </h1>

          <div className="flex items-center gap-4 flex-wrap text-sm text-titi-muted font-semibold">
            {curso.creador?.username && (
              <span>
                Por{' '}
                <span className="text-titi-text font-extrabold">
                  @{curso.creador.username}
                </span>
              </span>
            )}
            {curso.createdAt && (
              <span>Creado el {formatDate(curso.createdAt)}</span>
            )}
            {typeof curso._count?.inscripciones === 'number' && (
              <span>
                {curso._count.inscripciones}{' '}
                {curso._count.inscripciones === 1 ? 'inscrito' : 'inscritos'}
              </span>
            )}
          </div>

          <p className="text-titi-text text-base leading-relaxed whitespace-pre-line">
            {curso.descripcion}
          </p>

          {/* CTA — inscripción / login */}
          <div className="pt-2">
            {successMsg && (
              <div className="mb-3 px-4 py-2 rounded-xl bg-titi-green/20 text-titi-green font-bold text-sm">
                {successMsg}
              </div>
            )}
            {enrollError && (
              <div className="mb-3 px-4 py-2 rounded-xl bg-titi-red/20 text-titi-red font-bold text-sm">
                {enrollError}
              </div>
            )}

            {!isAuthenticated ? (
              <button
                type="button"
                onClick={() =>
                  navigate('/login', {
                    state: { from: `/courses/${courseId}` },
                  })
                }
                className="titi-btn-primary"
              >
                Inicia sesión para inscribirte
              </button>
            ) : isStudent ? (
              !enrollChecked ? (
                <button
                  type="button"
                  disabled
                  className="titi-btn-ghost opacity-60 cursor-wait"
                >
                  Verificando inscripción…
                </button>
              ) : enrolled ? (
                <button
                  type="button"
                  onClick={() => navigate(`/courses/${courseId}/learn`)}
                  className="titi-btn-primary"
                >
                  Continuar curso →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleEnroll}
                  disabled={enrolling}
                  className="titi-btn-primary disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {enrolling ? 'Inscribiendo…' : 'Inscribirme al curso'}
                </button>
              )
            ) : (
              <p className="text-sm text-titi-muted font-semibold">
                Solo los estudiantes pueden inscribirse en este curso.
              </p>
            )}
          </div>
        </div>
      </header>

      {/* Módulos */}
      <section className="titi-card p-6 sm:p-8">
        <h2 className="text-xl sm:text-2xl font-extrabold text-titi-text mb-4">
          Contenido del curso
        </h2>

        {!curso.modulos || curso.modulos.length === 0 ? (
          <p className="text-sm text-titi-muted font-semibold">
            Este curso aún no tiene módulos publicados.
          </p>
        ) : (
          <ol className="space-y-3">
            {curso.modulos.map((modulo, idx) => {
              const numLecciones = modulo.lecciones?.length ?? 0;
              return (
                <li
                  key={modulo.id}
                  className="flex items-start gap-4 p-4 rounded-xl border border-titi-border hover:border-titi-yellow/70 transition-colors"
                >
                  <span className="shrink-0 w-9 h-9 rounded-full bg-titi-yellow text-titi-dark grid place-items-center font-extrabold">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-extrabold text-titi-text leading-snug">
                      {modulo.titulo}
                    </h3>
                    <p className="text-xs sm:text-sm text-titi-muted font-semibold mt-1">
                      {numLecciones}{' '}
                      {numLecciones === 1 ? 'lección' : 'lecciones'}
                      {modulo.evaluacion ? ' · incluye evaluación' : ''}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
