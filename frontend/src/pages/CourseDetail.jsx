import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useStaggerReveal } from '../lib/motion.js';
import { BooksIcon, GraduationIcon, UsersIcon, CheckIcon } from '../components/icons.jsx';

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

export default function CourseDetail() {
  const { id: courseId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const [curso, setCurso] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Entrada al ver el curso: las dos columnas (contenido + inscripción) entran
  // escalonadas con pop. Dep = id del curso (primitivo, estable) → anima una vez
  // al aparecer, no en cada churn de estado. Ver motion.md §5.
  const contentRef = useStaggerReveal([curso?.id]);
  const modulesRef = useStaggerReveal([curso?.modulos?.length]);

  // Enrollment state
  const [enrolled, setEnrolled] = useState(false);
  const [enrollChecked, setEnrollChecked] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const isStudent = isAuthenticated && user?.rol === 'ESTUDIANTE';

  // --- Fetch detalle del curso ---
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

  // --- Check enrollment ---
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
        // Silencioso: si falla, asumimos no inscrito.
      })
      .finally(() => {
        if (!cancelled) setEnrollChecked(true);
      });

    return () => {
      cancelled = true;
    };
  }, [courseId, isStudent]);

  const handleEnroll = async () => {
    setEnrolling(true);
    setEnrollError(null);
    try {
      const { data } = await client.post(`/api/courses/${courseId}/enroll`);
      if (data?.success) {
        setEnrolled(true);
        setSuccessMsg('¡Te inscribiste con éxito! Llevándote al curso…');
        setTimeout(() => navigate(`/courses/${courseId}/learn`), 1100);
      } else {
        setEnrollError(data?.message || 'No se pudo completar la inscripción');
      }
    } catch (err) {
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

  // --- Render: loading ---
  if (loading) {
    return <LoadingSkeleton />;
  }

  // --- Render: error ---
  if (error) {
    return (
      <div className="max-w-2xl">
        <button
          type="button"
          onClick={() => navigate('/courses')}
          className="text-sm font-semibold text-gray-500 hover:text-titi-dark transition-colors mb-4 inline-flex items-center gap-1"
        >
          ← Volver al catálogo
        </button>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <span className="w-8 h-8 rounded-full bg-red-500 grid place-items-center shrink-0 text-white text-sm font-black" aria-hidden="true">!</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-700">
              No pudimos cargar el curso
            </p>
            <p className="text-xs text-red-500 mt-0.5">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!curso) return null;
  return (
    <div>
      {/* Volver */}
      <button
        type="button"
        onClick={() => navigate('/courses')}
        className="text-sm font-semibold text-gray-500 hover:text-titi-dark transition-colors mb-4 sm:mb-6 inline-flex items-center gap-1"
      >
        ← Volver al catálogo
      </button>

      <div ref={contentRef} className="lg:grid lg:grid-cols-3 lg:gap-8">
        {/* --- Columna izquierda: contenido --- */}
        <div className="lg:col-span-2 flex flex-col gap-4 sm:gap-6">
          {/* Hero del curso */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden">
            {/* Portada */}
            <div className="relative h-40 sm:h-48 md:h-56 bg-gradient-to-br from-titi-yellow-light via-titi-yellow-light to-titi-yellow/40 overflow-hidden">
              {curso.portadaUrl ? (
                <img
                  src={curso.portadaUrl}
                  alt={curso.titulo}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <>
                  <span
                    aria-hidden="true"
                    className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/40 blur-2xl"
                  />
                  <span
                    aria-hidden="true"
                    className="absolute -bottom-10 -left-10 w-44 h-44 rounded-full bg-titi-yellow/30 blur-2xl"
                  />
                  <div className="relative w-full h-full grid place-items-center text-7xl select-none drop-shadow-sm">
                    {curso.categoria?.icono || '📚'}
                  </div>
                </>
              )}
            </div>

            {/* Encabezado */}
            <div className="p-5 sm:p-6 md:p-8 flex flex-col gap-3 sm:gap-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-block bg-titi-yellow-light text-titi-dark text-xs font-semibold capitalize px-3 py-1 rounded-full">
                  {curso.nivel || 'sin nivel'}
                </span>
                {curso.categoria?.nombre && (
                  <span className="text-xs font-semibold text-titi-streak uppercase tracking-wide">
                    {curso.categoria.nombre}
                  </span>
                )}
              </div>

              <h1 className="text-3xl sm:text-4xl font-black text-titi-dark leading-tight">
                {curso.titulo}
              </h1>

              <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-xs sm:text-sm font-medium text-gray-500">
                {curso.creador?.username && (
                  <span>
                    Por{' '}
                    <Link
                      to={`/profile/${curso.creador.username}`}
                      className="text-titi-dark font-bold hover:text-titi-yellow-dark transition-colors"
                    >
                      @{curso.creador.username}
                    </Link>
                  </span>
                )}
                {curso.createdAt && (
                  <span>Creado el {formatDateEs(curso.createdAt)}</span>
                )}
                {typeof curso._count?.inscripciones === 'number' && (
                  <span>
                    {curso._count.inscripciones}{' '}
                    {curso._count.inscripciones === 1
                      ? 'estudiante inscrito'
                      : 'estudiantes inscritos'}
                  </span>
                )}
              </div>

              <p className="text-sm sm:text-base text-titi-dark leading-relaxed whitespace-pre-line">
                {curso.descripcion}
              </p>
            </div>
          </section>

          {/* Lista de módulos */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-5 sm:p-6 md:p-8">
            <h2 className="text-xl sm:text-2xl font-bold text-titi-dark mb-1">
              Contenido del curso
            </h2>
            <p className="text-sm font-medium text-gray-500 mb-5">
              {curso.modulos?.length
                ? `${curso.modulos.length} ${curso.modulos.length === 1 ? 'módulo' : 'módulos'}`
                : 'Aún sin módulos publicados'}
            </p>

            {!curso.modulos || curso.modulos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                <img
                  src="/Titi.png"
                  alt="Titi"
                  className="w-20 h-20 mb-3 object-contain drop-shadow-sm select-none"
                  draggable={false}
                />
                <h3 className="text-base font-bold text-titi-dark mb-1">
                  Aún no hay módulos
                </h3>
                <p className="text-sm text-gray-400 max-w-xs">
                  Vuelve pronto, el profe está preparando el contenido.
                </p>
              </div>
            ) : (
              <ol ref={modulesRef} className="flex flex-col gap-3">
                {curso.modulos.map((modulo, idx) => {
                  const numLecciones = modulo.lecciones?.length ?? 0;
                  return (
                    <li
                      key={modulo.id}
                      className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3 hover:border-titi-yellow-light hover:bg-titi-cream/50 transition-colors"
                    >
                      <span className="shrink-0 w-9 h-9 rounded-full bg-titi-yellow-light text-titi-dark grid place-items-center font-extrabold text-sm">
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-bold text-titi-dark leading-snug">
                          {modulo.titulo}
                        </h3>
                        <p className="text-xs font-medium text-gray-500 mt-0.5">
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

        {/* --- Columna derecha: enrollment card sticky en lg+ --- */}
        <aside className="mt-4 sm:mt-6 lg:mt-0">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-5 sm:p-6 lg:sticky lg:top-8 flex flex-col gap-4">
            <h2 className="text-xl font-bold text-titi-dark">
              {enrolled ? 'Ya estás inscrito 🎉' : 'Comenzá a aprender'}
            </h2>

            <p className="text-sm font-medium text-gray-500">
              {enrolled
                ? 'Continuá tu progreso desde Mis cursos.'
                : 'Inscribite gratis y avanzá a tu ritmo con la comunidad Titi.'}
            </p>

            {/* Stats rápidos */}
            <div className="flex flex-col gap-2 py-2 border-y border-gray-100">
              <Stat
                icon={<BooksIcon className="w-4 h-4" />}
                label={
                  curso.modulos?.length
                    ? `${curso.modulos.length} ${curso.modulos.length === 1 ? 'módulo' : 'módulos'}`
                    : 'Módulos por agregar'
                }
              />
              <Stat
                icon={<GraduationIcon className="w-4 h-4" />}
                label={
                  curso.nivel
                    ? `Nivel ${curso.nivel}`
                    : 'Nivel sin definir'
                }
              />
              {typeof curso._count?.inscripciones === 'number' && (
                <Stat
                  icon={<UsersIcon className="w-4 h-4" />}
                  label={`${curso._count.inscripciones} ${
                    curso._count.inscripciones === 1
                      ? 'estudiante'
                      : 'estudiantes'
                  }`}
                />
              )}
            </div>

            {/* Mensajes de estado */}
            {successMsg && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-green-500 grid place-items-center shrink-0" aria-hidden="true">
                  <CheckIcon className="w-4 h-4 text-white" />
                </span>
                <p className="text-sm font-semibold text-green-700">
                  {successMsg}
                </p>
              </div>
            )}
            {enrollError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                <span className="w-8 h-8 rounded-full bg-red-500 grid place-items-center shrink-0 text-white text-sm font-black" aria-hidden="true">!</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-700">
                    No pudimos inscribirte
                  </p>
                  <p className="text-xs text-red-500 mt-0.5">{enrollError}</p>
                </div>
              </div>
            )}

            {/* CTA */}
            {!isAuthenticated ? (
              <button
                type="button"
                onClick={() =>
                  navigate('/login', {
                    state: { from: `/courses/${courseId}` },
                  })
                }
                className="bg-white text-titi-dark font-bold text-sm w-full px-5 py-2.5 rounded-xl border-2 border-gray-200 shadow-[0_4px_0px_#E5E7EB] hover:border-titi-yellow hover:-translate-y-0.5 hover:shadow-[0_6px_0px_#E5E7EB] active:translate-y-0.5 active:shadow-none transition-all duration-150"
              >
                Inicia sesión para inscribirte
              </button>
            ) : isStudent ? (
              !enrollChecked ? (
                <button
                  type="button"
                  disabled
                  className="bg-titi-yellow text-titi-dark font-bold text-base w-full px-6 py-3 rounded-xl opacity-50 cursor-not-allowed"
                >
                  Verificando inscripción…
                </button>
              ) : enrolled ? (
                <button
                  type="button"
                  onClick={() => navigate(`/courses/${courseId}/learn`)}
                  className="bg-titi-yellow text-titi-dark font-bold text-base w-full px-6 py-3 rounded-xl shadow-[0_4px_0px_#E6B800] hover:shadow-[0_2px_0px_#E6B800] hover:-translate-y-0.5 active:shadow-none active:translate-y-0 transition-all duration-150"
                >
                  Continuar →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleEnroll}
                  disabled={enrolling}
                  className="bg-titi-yellow text-titi-dark font-bold text-base w-full px-6 py-3 rounded-xl shadow-[0_4px_0px_#E6B800] hover:shadow-[0_2px_0px_#E6B800] hover:-translate-y-0.5 active:shadow-none active:translate-y-0 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {enrolling ? 'Inscribiendo…' : 'Inscribirme al curso'}
                </button>
              )
            ) : (
              <div className="bg-titi-cream border border-gray-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-titi-dark">
                  Solo los estudiantes pueden inscribirse.
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Iniciá sesión con una cuenta de estudiante para participar.
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

// ---- Sub-componentes ----

function Stat({ icon, label }) {
  return (
    <div className="flex items-center gap-2.5 text-sm font-medium text-titi-dark">
      <span className="text-titi-yellow-dark" aria-hidden="true">
        {icon}
      </span>
      <span>{label}</span>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="lg:grid lg:grid-cols-3 lg:gap-8">
      <div className="lg:col-span-2 flex flex-col gap-4 sm:gap-6">
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
          <div className="h-40 sm:h-48 md:h-56 bg-gray-100" />
          <div className="p-5 sm:p-6 md:p-8 flex flex-col gap-3 sm:gap-4">
            <div className="h-3 w-24 bg-gray-100 rounded-full" />
            <div className="h-6 sm:h-7 w-3/4 bg-gray-100 rounded" />
            <div className="h-3 w-1/2 bg-gray-100 rounded" />
            <div className="h-4 w-full bg-gray-100 rounded mt-2" />
            <div className="h-4 w-5/6 bg-gray-100 rounded" />
            <div className="h-4 w-2/3 bg-gray-100 rounded" />
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6 md:p-8 animate-pulse flex flex-col gap-3">
          <div className="h-5 w-1/3 bg-gray-100 rounded mb-3" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-16 bg-gray-100 rounded-xl"
            />
          ))}
        </div>
      </div>
      <div className="mt-4 sm:mt-6 lg:mt-0">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6 animate-pulse flex flex-col gap-4">
          <div className="h-5 w-2/3 bg-gray-100 rounded" />
          <div className="h-3 w-full bg-gray-100 rounded" />
          <div className="h-3 w-5/6 bg-gray-100 rounded" />
          <div className="h-px bg-gray-100 my-2" />
          <div className="h-3 w-1/2 bg-gray-100 rounded" />
          <div className="h-3 w-1/2 bg-gray-100 rounded" />
          <div className="h-12 w-full bg-gray-100 rounded-xl mt-3" />
        </div>
      </div>
    </div>
  );
}
