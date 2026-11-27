import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCountUp, useStaggerReveal } from '../lib/motion.js';
import { formatDate } from '../lib/format.js';
import { CourseCover, LevelChip } from '../components/catalog/CourseCard.jsx';
import { CategoryIcon, categoryTheme } from '../components/catalog/categoryTheme.jsx';
import Avatar from '../components/social/Avatar.jsx';
import { ErrorBox } from '../components/social/StateBlocks.jsx';
import { BackLink, BTN_SECONDARY, EmptyState, RoleBadge, SURFACE } from '../components/ui/v3.jsx';
import { BooksIcon, CalendarIcon, CheckIcon, GraduationIcon, ListIcon, PlayIcon, UsersIcon } from '../components/icons.jsx';

// Detalle de curso v3 (rediseno-plataforma-v3 R8): portada de la categoría sin
// gradiente ni emoji, temario numerado con el acento del curso y panel de
// inscripción pegajoso.

export default function CourseDetail() {
  const { id: courseId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const [curso, setCurso] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);

  // Entrada al ver el curso: las dos columnas (contenido + inscripción) entran
  // escalonadas con pop. Dep = id del curso (primitivo, estable) → anima una vez
  // al aparecer, no en cada churn de estado. Ver motion.md §5.
  const contentRef = useStaggerReveal([curso?.id]);
  const modulesRef = useStaggerReveal([curso?.modulos?.length]);

  // Enrollment state — `enrolled` viene embebido en data.viewer de /api/courses/:id
  const [enrolled, setEnrolled] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const isStudent = isAuthenticated && user?.rol === 'ESTUDIANTE';

  // --- Fetch detalle del curso (incluye viewer.enrolled) ---
  useEffect(() => {
    if (!courseId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    client
      .get(`/api/courses/${courseId}`)
      .then(({ data }) => {
        if (cancelled) return;
        if (data?.success) {
          setCurso(data.data?.curso || null);
          setEnrolled(Boolean(data.data?.viewer?.enrolled));
        } else {
          setError(data?.message || 'No se pudo cargar el curso');
        }
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
  }, [courseId, reloadTick]);

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
        <BackLink to="/courses">Volver al catálogo</BackLink>
        {error === 'Curso no encontrado' ? (
          <EmptyState state="triste" title="No encontramos este" accent="curso" text="Puede que lo hayan despublicado. Hay mucho más para aprender en el catálogo.">
            <Link to="/courses" className="titi-btn-primary">
              Ver catálogo
            </Link>
          </EmptyState>
        ) : (
          <ErrorBox title="No pudimos cargar el curso" message={error} onRetry={() => setReloadTick((t) => t + 1)} />
        )}
      </div>
    );
  }

  if (!curso) return null;
  const theme = categoryTheme(curso.categoria?.nombre);
  const modulos = curso.modulos || [];
  const totalLecciones = modulos.reduce((acc, m) => acc + (m.lecciones?.length ?? 0), 0);
  const inscritos = curso._count?.inscripciones;

  return (
    <div className="max-w-6xl">
      <BackLink to="/courses">Volver al catálogo</BackLink>

      <div ref={contentRef} className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6 lg:items-start">
        {/* --- Columna izquierda: contenido --- */}
        <div className="flex flex-col gap-5 sm:gap-6 min-w-0">
          {/* Hero del curso */}
          <section className={`${SURFACE} overflow-hidden`}>
            <div className="relative border-b-2 border-titi-dark">
              <CourseCover curso={curso} className="h-40 sm:h-52 md:h-60" />
              <LevelChip nivel={curso.nivel} className="absolute top-3 left-3" />
            </div>

            <div className="p-5 sm:p-6 flex flex-col gap-3">
              {curso.categoria?.nombre && (
                <span className={`inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide ${theme.text}`}>
                  <span className={`w-6 h-6 rounded-lg grid place-items-center text-white ${theme.solid}`}>
                    <CategoryIcon nombre={curso.categoria.nombre} className="w-3.5 h-3.5" />
                  </span>
                  {curso.categoria.nombre}
                </span>
              )}

              <h1 className="text-3xl sm:text-4xl font-black text-titi-dark leading-tight break-words">{curso.titulo}</h1>

              <div className="flex items-center gap-2 flex-wrap">
                {curso.creador?.username && (
                  <Link
                    to={`/profile/${curso.creador.username}`}
                    className="group inline-flex items-center gap-2 h-9 pl-1 pr-3 rounded-full bg-white border-2 border-gray-200 text-sm font-bold text-titi-dark hover:border-titi-dark active:translate-y-0.5 transition-all duration-150 focus:outline-none focus-visible:ring-4 focus-visible:ring-titi-yellow/60"
                  >
                    <Avatar username={curso.creador.username} src={curso.creador.avatarUrl} size="xs" />
                    @{curso.creador.username}
                  </Link>
                )}
                {curso.createdAt && (
                  <MetaChip Icon={CalendarIcon} solid="bg-blue-500">
                    Creado el {formatDate(curso.createdAt)}
                  </MetaChip>
                )}
                {typeof inscritos === 'number' && (
                  <MetaChip Icon={UsersIcon} solid="bg-green-500">
                    {inscritos} {inscritos === 1 ? 'estudiante' : 'estudiantes'}
                  </MetaChip>
                )}
              </div>

              {curso.descripcion && (
                <p className="text-base font-medium text-titi-dark leading-relaxed whitespace-pre-line mt-1">{curso.descripcion}</p>
              )}
            </div>
          </section>

          {/* Temario */}
          <section aria-label="Contenido del curso" className={`${SURFACE} p-5 sm:p-6`}>
            <div className="flex items-center gap-3 mb-4">
              <RoleBadge Icon={ListIcon} solid={theme.solid} size="sm" />
              <div className="min-w-0">
                <h2 className="text-xl sm:text-2xl font-extrabold text-titi-dark leading-tight">
                  Contenido del <span className="text-titi-streak">curso</span>
                </h2>
                <p className="text-sm font-semibold text-gray-500">
                  {modulos.length
                    ? `${modulos.length} ${modulos.length === 1 ? 'módulo' : 'módulos'} · ${totalLecciones} ${totalLecciones === 1 ? 'lección' : 'lecciones'}`
                    : 'Aún sin módulos publicados'}
                </p>
              </div>
            </div>

            {modulos.length === 0 ? (
              <EmptyState compact state="pensando" title="Aún no hay" accent="módulos" text="Volvé pronto: el profe está preparando el contenido." />
            ) : (
              <ol ref={modulesRef} className="relative flex flex-col gap-3">
                {modulos.map((modulo, idx) => {
                  const numLecciones = modulo.lecciones?.length ?? 0;
                  return (
                    <li key={modulo.id} className="group flex items-center gap-3 p-3 sm:p-4 rounded-xl border-2 border-gray-200 bg-white hover:border-titi-dark transition-colors duration-150">
                      <span
                        className={`shrink-0 w-10 h-10 rounded-xl border-2 border-titi-dark grid place-items-center font-black text-white tabular-nums -rotate-6 transition-transform duration-200 group-hover:rotate-0 motion-reduce:transition-none ${theme.solid}`}
                      >
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-extrabold text-titi-dark leading-snug">{modulo.titulo}</h3>
                        <p className="text-sm font-semibold text-gray-500 mt-0.5">
                          {numLecciones} {numLecciones === 1 ? 'lección' : 'lecciones'}
                        </p>
                      </div>
                      {modulo.evaluacion && (
                        <span className="shrink-0 inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-purple-100 border-2 border-titi-dark text-xs font-extrabold text-titi-dark">
                          <CheckIcon className="w-3.5 h-3.5 text-titi-achievement" />
                          <span className="sr-only sm:not-sr-only">Evaluación</span>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>

        {/* --- Columna derecha: inscripción (pegajosa en lg+) --- */}
        <aside className="mt-5 sm:mt-6 lg:mt-0 lg:sticky lg:top-8">
          <div className={`${SURFACE} p-5 sm:p-6 flex flex-col gap-4`}>
            <div>
              <h2 className="text-xl font-extrabold text-titi-dark leading-tight">
                {enrolled ? (
                  <>
                    Ya estás <span className="text-titi-streak">inscrito</span>
                  </>
                ) : (
                  <>
                    Empezá a <span className="text-titi-streak">aprender</span>
                  </>
                )}
              </h2>
              <p className="text-sm font-medium text-gray-500 mt-1">
                {enrolled ? 'Seguí desde donde lo dejaste.' : 'Inscribite gratis y avanzá a tu ritmo con la comunidad Titi.'}
              </p>
            </div>

            <ul className="grid grid-cols-3 gap-2">
              <Stat Icon={BooksIcon} solid="bg-blue-500" value={modulos.length} label={modulos.length === 1 ? 'módulo' : 'módulos'} />
              <Stat Icon={ListIcon} solid="bg-green-500" value={totalLecciones} label={totalLecciones === 1 ? 'lección' : 'lecciones'} />
              <Stat Icon={UsersIcon} solid="bg-titi-streak" value={inscritos ?? 0} label={inscritos === 1 ? 'inscrito' : 'inscritos'} />
            </ul>
            {curso.nivel && (
              <p className="inline-flex items-center gap-2 text-sm font-bold text-titi-dark -mt-1">
                <GraduationIcon className="w-4 h-4 text-titi-streak" />
                Nivel <span className="capitalize">{curso.nivel.toLowerCase()}</span>
              </p>
            )}

            {successMsg && (
              <div role="status" className="bg-green-50 border-2 border-green-500 rounded-2xl p-3 flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-green-500 grid place-items-center shrink-0" aria-hidden="true">
                  <CheckIcon className="w-4 h-4 text-white" />
                </span>
                <p className="text-sm font-bold text-green-700">{successMsg}</p>
              </div>
            )}
            {enrollError && <ErrorBox title="No pudimos inscribirte" message={enrollError} onRetry={handleEnroll} />}

            {/* CTA */}
            {!isAuthenticated ? (
              <button type="button" onClick={() => navigate('/login', { state: { from: `/courses/${courseId}` } })} className={`${BTN_SECONDARY} w-full`}>
                Iniciá sesión para inscribirte
              </button>
            ) : isStudent ? (
              enrolled ? (
                <button type="button" onClick={() => navigate(`/courses/${courseId}/learn`)} className="titi-btn-primary w-full py-3 text-base">
                  <PlayIcon className="w-5 h-5" />
                  Continuar
                </button>
              ) : (
                <button type="button" onClick={handleEnroll} disabled={enrolling} className="titi-btn-primary w-full py-3 text-base">
                  {enrolling ? 'Inscribiendo…' : 'Inscribirme al curso'}
                </button>
              )
            ) : (
              <div className="bg-titi-cream border-2 border-gray-200 rounded-xl p-3">
                <p className="text-sm font-bold text-titi-dark">Solo los estudiantes pueden inscribirse.</p>
                <p className="text-sm font-medium text-gray-500 mt-0.5">Iniciá sesión con una cuenta de estudiante para participar.</p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

// ---- Sub-componentes ----

function MetaChip({ Icon, solid, children }) {
  return (
    <span className="inline-flex items-center gap-1.5 h-9 pl-1 pr-3 max-w-full rounded-full bg-titi-cream border-2 border-gray-200 text-sm font-bold text-titi-dark">
      <span className={`w-6 h-6 rounded-full grid place-items-center text-white shrink-0 ${solid}`}>
        <Icon className="w-3.5 h-3.5" />
      </span>
      <span className="truncate">{children}</span>
    </span>
  );
}

function Stat({ Icon, solid, value, label }) {
  const shown = useCountUp(value);
  return (
    <li className="flex flex-col items-center text-center gap-1 p-2.5 rounded-xl bg-titi-cream border-2 border-gray-200">
      <span className={`w-8 h-8 rounded-lg border-2 border-titi-dark grid place-items-center text-white -rotate-6 ${solid}`} aria-hidden="true">
        <Icon className="w-4 h-4" />
      </span>
      <span className="text-xl font-black text-titi-dark tabular-nums leading-none mt-1">{shown}</span>
      <span className="text-xs font-bold text-gray-500">{label}</span>
    </li>
  );
}

function LoadingSkeleton() {
  return (
    <div className="max-w-6xl animate-pulse motion-reduce:animate-none" aria-busy="true" aria-label="Cargando el curso">
      <div className="h-9 w-48 bg-gray-100 rounded-full mb-4" />
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6">
        <div className="flex flex-col gap-5 sm:gap-6">
          <div className="bg-white rounded-2xl border-2 border-gray-200 overflow-hidden">
            <div className="h-40 sm:h-52 md:h-60 bg-gray-100 border-b-2 border-gray-200" />
            <div className="p-5 sm:p-6 flex flex-col gap-3">
              <div className="h-4 w-28 bg-gray-100 rounded-full" />
              <div className="h-8 w-3/4 bg-gray-100 rounded-full" />
              <div className="flex gap-2">
                <div className="h-9 w-32 bg-gray-100 rounded-full" />
                <div className="h-9 w-40 bg-gray-100 rounded-full" />
              </div>
              <div className="h-4 w-full bg-gray-100 rounded-full mt-2" />
              <div className="h-4 w-5/6 bg-gray-100 rounded-full" />
            </div>
          </div>
          <div className="bg-white rounded-2xl border-2 border-gray-200 p-5 sm:p-6 flex flex-col gap-3">
            <div className="h-6 w-1/3 bg-gray-100 rounded-full mb-2" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-[72px] bg-gray-100 rounded-xl" />
            ))}
          </div>
        </div>
        <div className="mt-5 sm:mt-6 lg:mt-0">
          <div className="bg-white rounded-2xl border-2 border-gray-200 p-5 sm:p-6 flex flex-col gap-4">
            <div className="h-6 w-2/3 bg-gray-100 rounded-full" />
            <div className="h-3 w-full bg-gray-100 rounded-full" />
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-24 bg-gray-100 rounded-xl" />
              ))}
            </div>
            <div className="h-12 w-full bg-gray-100 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
