import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client.js';
import { useStaggerReveal, useCountUp } from '../lib/motion.js';
import { useGamification } from '../context/GamificationContext.jsx';
import useStreak from '../hooks/useStreak.js';
import {
  AwardIcon,
  BagIcon,
  StreakIcon,
  CheckIcon,
  ClockIcon,
  GotaIcon,
  GraduationIcon,
  PlayIcon,
  TargetIcon,
  TrophyIcon,
} from '../components/icons.jsx';
import DailyMissions from '../components/DailyMissions.jsx';
import CategoriesExplorer from '../components/CategoriesExplorer.jsx';
import TitiMascot from '../components/TitiMascot.jsx';
import { CourseCover, LevelChip } from '../components/catalog/CourseCard.jsx';
import { CategoryIcon, categoryTheme } from '../components/catalog/categoryTheme.jsx';
import { ErrorBox, SectionHeading } from '../components/social/StateBlocks.jsx';
import {
  BTN_SECONDARY,
  DARK_PANEL,
  DARK_TILE,
  EmptyState,
  PageHeader,
  PanelTitle,
  ProgressBar,
  SURFACE,
  TILE,
} from '../components/ui/v3.jsx';
import { relativeTime } from '../lib/format.js';

// Mis cursos v3 (rediseno-plataforma-v3 R4): resumen en panel oscuro, ruta de
// aprendizaje con tiles v3 y nodos del color de cada categoría.

// Cuántos nodos se ven en la ruta antes de "Ver toda la ruta".
const RUTA_VISIBLE = 4;

export default function MyCourses() {
  const navigate = useNavigate();
  const { gotas } = useGamification();
  const streak = useStreak();

  const [inscripciones, setInscripciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);

  // Mapa cursoId → { total, completadas, porcentaje }
  // Se llena en paralelo después de cargar las inscripciones para detectar
  // cursos 100% completados aunque la Inscripcion no esté marcada como tal.
  const [progressByCurso, setProgressByCurso] = useState({});

  // Promedio simple del % de progreso entre TODOS los cursos inscritos
  // (completados cuentan 100% aunque el progreso todavía no haya llegado).
  const progresoPromedio = useMemo(() => {
    if (inscripciones.length === 0) return 0;
    const suma = inscripciones.reduce((acc, insc) => {
      const p = progressByCurso[insc.cursoId];
      const pct = p?.porcentaje ?? (insc.completado ? 100 : 0);
      return acc + pct;
    }, 0);
    return Math.round(suma / inscripciones.length);
  }, [inscripciones, progressByCurso]);

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
      <PageHeader title="Mis" accent="cursos" subtitle="Continuá donde lo dejaste.">
        {/* Ranking y Tienda viven acá (se sacaron del navbar) */}
        <button type="button" onClick={() => navigate('/leaderboard')} className="titi-btn-primary text-sm px-4 whitespace-nowrap">
          <TrophyIcon className="w-4 h-4" />
          Ranking
        </button>
        <button type="button" onClick={() => navigate('/shop')} className="titi-btn-primary text-sm px-4 whitespace-nowrap">
          <BagIcon className="w-4 h-4" />
          Tienda
        </button>
        <button type="button" onClick={() => navigate('/certificates')} className={BTN_SECONDARY}>
          <GraduationIcon className="w-4 h-4 text-titi-certificate" />
          Mis certificados
        </button>
      </PageHeader>

      {loading ? (
        <SkeletonGrid />
      ) : error ? (
        <ErrorBox title="No pudimos cargar tus cursos" message={error} onRetry={() => setRefreshTick((t) => t + 1)} />
      ) : inscripciones.length === 0 ? (
        <EmptyState
          state="pensando"
          title="Todavía no tenés"
          accent="cursos"
          text="Explorá el catálogo y encontrá algo nuevo para aprender con la comunidad Titi."
        >
          <button type="button" onClick={() => navigate('/courses')} className="titi-btn-primary">
            Ver catálogo de cursos
          </button>
        </EmptyState>
      ) : (
        <>
          <StatsRow progresoPromedio={progresoPromedio} gotasTotal={gotas.total} streak={streak} />
          <LearningPathSection
            inscripciones={inscripciones}
            progressByCurso={progressByCurso}
            onContinue={(cursoId) => navigate(`/courses/${cursoId}/learn`)}
            onOpenDetail={(cursoId) => navigate(`/courses/${cursoId}`)}
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6 mb-6 sm:mb-8 items-start">
            <div className="flex flex-col gap-5 sm:gap-6">
              <DailyMissions title="Desafíos del día" />
              <CategoriesExplorer />
            </div>
            <RecentActivity />
          </div>
          <BottomBanner onExplore={() => navigate('/courses')} />
        </>
      )}
    </div>
  );
}

// ---- Resumen en panel oscuro (v3): progreso, gotas y racha con count-up ----
function StatsRow({ progresoPromedio, gotasTotal, streak }) {
  const rachaActiva = streak.estaActiva && streak.racha > 0;
  const progresoAnim = useCountUp(progresoPromedio);
  const gotasAnim = useCountUp(gotasTotal);
  const rachaAnim = useCountUp(streak.racha);
  return (
    <section aria-label="Tu progreso" className={`${DARK_PANEL} p-4 sm:p-5 mb-6 sm:mb-8`}>
      <h2 className="text-lg font-extrabold text-titi-cream mb-3">
        Tu <span className="text-titi-yellow">progreso</span>
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className={`${DARK_TILE} p-4 flex items-center gap-3`}>
          <StatIcon solid="bg-titi-yellow text-titi-dark" Icon={TargetIcon} />
          <div className="min-w-0 flex-1">
            <p className="text-3xl font-black text-titi-cream tabular-nums leading-none">{progresoAnim}%</p>
            <p className="text-xs font-bold text-white/60 mt-1 mb-2">Promedio de tus cursos</p>
            <ProgressBar value={progresoPromedio} track="bg-white/10" height="h-2" label="Progreso general" />
          </div>
        </div>
        <div className={`${DARK_TILE} p-4 flex items-center gap-3`}>
          <StatIcon solid="bg-blue-500 text-white" Icon={GotaIcon} />
          <div className="min-w-0">
            <p className="text-3xl font-black text-titi-cream tabular-nums leading-none">{gotasAnim}</p>
            <p className="text-xs font-bold text-white/60 mt-1">Gotas totales</p>
          </div>
        </div>
        <div className={`${DARK_TILE} p-4 flex items-center gap-3`}>
          <StatIcon solid={rachaActiva ? 'bg-titi-streak text-white' : 'bg-white/10 text-white'} Icon={StreakIcon} />
          <div className="min-w-0">
            <p className="text-3xl font-black text-titi-cream tabular-nums leading-none">{rachaAnim}</p>
            <p className="text-xs font-bold text-white/60 mt-1">
              {streak.racha === 1 ? 'Día de racha' : 'Días de racha'}
              {rachaActiva && <span className="text-titi-yellow"> · ¡Seguí así!</span>}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatIcon({ Icon, solid }) {
  return (
    <span aria-hidden="true" className={`w-12 h-12 rounded-xl grid place-items-center shrink-0 -rotate-6 ${solid}`}>
      <Icon className="w-6 h-6" />
    </span>
  );
}

// ---- Ruta de aprendizaje: timeline vertical de cursos inscritos ----
function LearningPathSection({ inscripciones, progressByCurso, onContinue, onOpenDetail }) {
  const [expanded, setExpanded] = useState(false);

  const sorted = useMemo(
    () => [...inscripciones].sort((a, b) => new Date(a.fechaInscripcion) - new Date(b.fechaInscripcion)),
    [inscripciones],
  );

  const hiddenCount = sorted.length - RUTA_VISIBLE;
  const showToggle = hiddenCount > 0;
  const visible = expanded ? sorted : sorted.slice(0, RUTA_VISIBLE);
  const toggle = () => setExpanded((e) => !e);
  const showMoreNode = !expanded && showToggle;

  const pathRef = useStaggerReveal([visible.length, expanded]);

  return (
    <section aria-label="Tu ruta de aprendizaje" className="mb-6 sm:mb-8">
      <SectionHeading title="Tu ruta de" accent="aprendizaje" className="mb-4">
        {showToggle && (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={expanded}
            className="text-sm font-bold text-blue-500 hover:text-blue-600 uppercase tracking-wide transition-all duration-150 active:scale-95 whitespace-nowrap"
          >
            {expanded ? 'Ver menos' : 'Ver toda la ruta'}
          </button>
        )}
      </SectionHeading>

      <ul ref={pathRef} className="flex flex-col gap-5">
        {visible.map((insc, i) => (
          <LearningPathNode
            key={insc.id}
            inscripcion={insc}
            progress={progressByCurso[insc.cursoId]}
            isLast={i === visible.length - 1 && !showMoreNode}
            onContinue={() => onContinue(insc.cursoId)}
            onOpenDetail={() => onOpenDetail(insc.cursoId)}
          />
        ))}
        {showMoreNode && <LearningPathMoreNode count={hiddenCount} onClick={toggle} />}
      </ul>
    </section>
  );
}

// ---- Un nodo de la ruta: cuadro de la categoría + línea + tile horizontal ----
function LearningPathNode({ inscripcion, progress, isLast, onContinue, onOpenDetail }) {
  const curso = inscripcion.curso || {};
  const theme = categoryTheme(curso.categoria?.nombre);
  const computedComplete = Boolean(progress && progress.total > 0 && progress.completadas === progress.total);
  const completado = Boolean(inscripcion.completado) || computedComplete;
  const porcentaje = progress?.porcentaje ?? (completado ? 100 : 0);
  const total = progress?.total ?? 0;
  const completadas = progress?.completadas ?? 0;

  return (
    <li className="group relative flex gap-3 sm:gap-4">
      {/* Rail: nodo de la categoría centrado + línea conectora */}
      <div className="relative w-11 sm:w-12 shrink-0 flex justify-center">
        {!isLast && (
          <span aria-hidden="true" className="absolute top-1/2 left-1/2 -translate-x-1/2 w-1 rounded-full bg-gray-200 h-[calc(100%+1.25rem)]" />
        )}
        <span
          aria-hidden="true"
          className={`relative z-10 self-center w-11 h-11 sm:w-12 sm:h-12 rounded-xl border-2 border-titi-dark grid place-items-center text-white -rotate-6 transition-transform duration-200 group-hover:rotate-0 group-hover:scale-110 motion-reduce:transition-none ${
            completado ? 'bg-green-500' : theme.solid
          }`}
        >
          {completado ? <CheckIcon className="w-5 h-5" /> : <CategoryIcon nombre={curso.categoria?.nombre} className="w-5 h-5" />}
        </span>
      </div>

      {/* Tile horizontal: toda la tarjeta abre el detalle; "Continuar" va a la lección */}
      <article className={`relative flex-1 min-w-0 overflow-hidden ${TILE} has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-titi-yellow`}>
        <div className="flex flex-col sm:flex-row sm:h-44">
          <div className="relative shrink-0 w-full sm:w-[38%] h-36 sm:h-full border-b-2 sm:border-b-0 sm:border-r-2 border-titi-dark">
            <CourseCover curso={curso} className="w-full h-full" />
            <LevelChip nivel={curso.nivel} className="absolute top-2.5 left-2.5" />
            {completado && (
              <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 bg-green-500 text-white text-xs font-bold px-2.5 py-1 rounded-full border-2 border-titi-dark whitespace-nowrap">
                <CheckIcon className="w-3.5 h-3.5" />
                Completado
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1 flex flex-col p-4 sm:p-5">
            {curso.categoria?.nombre && (
              <p className={`text-xs font-extrabold uppercase tracking-wide truncate ${theme.text}`}>{curso.categoria.nombre}</p>
            )}
            <h3 className="text-lg font-extrabold text-titi-dark leading-snug line-clamp-1 mt-0.5">
              <button
                type="button"
                onClick={onOpenDetail}
                aria-label={`Ver detalle de ${curso.titulo || 'curso'}`}
                className="text-left focus:outline-none after:absolute after:inset-0 after:content-['']"
              >
                {curso.titulo || 'Curso sin título'}
              </button>
            </h3>

            <div className="mt-2">
              {completado ? (
                <p className="inline-flex items-center gap-1.5 text-sm font-extrabold text-green-600">
                  <CheckIcon className="w-4 h-4" /> ¡Lo terminaste!
                </p>
              ) : (
                <button type="button" onClick={onContinue} className="relative z-10 titi-btn-primary text-sm px-4 py-2">
                  <PlayIcon className="w-4 h-4" />
                  {porcentaje > 0 ? 'Continuar' : 'Empezar'}
                </button>
              )}
            </div>

            <div className="mt-auto pt-4">
              <div className="flex items-center justify-between text-sm font-bold text-gray-500 mb-1.5">
                <span className="tabular-nums">
                  {completadas} de {total} {total === 1 ? 'lección' : 'lecciones'}
                </span>
                <span className={`tabular-nums font-extrabold ${completado ? 'text-green-600' : 'text-titi-yellow-dark'}`}>{porcentaje}%</span>
              </div>
              <ProgressBar
                value={porcentaje}
                color={completado ? 'bg-green-500' : 'bg-titi-yellow'}
                label={`Progreso de ${curso.titulo || 'curso'}`}
              />
            </div>
          </div>
        </div>
      </article>
    </li>
  );
}

// ---- Nodo "+N": mismo estilo de nodo, dispara el toggle de la ruta ----
function LearningPathMoreNode({ count, onClick }) {
  return (
    <li className="relative flex gap-3 sm:gap-4 items-center">
      <div className="relative w-11 sm:w-12 shrink-0 flex justify-center">
        <button
          type="button"
          onClick={onClick}
          aria-label={`Ver ${count} cursos más de tu ruta`}
          className="relative z-10 w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-white border-2 border-titi-dark grid place-items-center shrink-0 shadow-[0_3px_0_#1A1A2E] hover:bg-titi-yellow active:translate-y-0.5 active:shadow-none transition-all duration-150 focus:outline-none focus-visible:ring-4 focus-visible:ring-titi-yellow/60"
        >
          <span className="text-sm font-black text-titi-dark tabular-nums">+{count}</span>
        </button>
      </div>
      <button
        type="button"
        onClick={onClick}
        className="text-sm font-bold uppercase tracking-wide text-blue-500 hover:text-blue-600 active:scale-95 transition-all duration-150"
      >
        Ver {count} {count === 1 ? 'curso más' : 'cursos más'}
      </button>
    </li>
  );
}

// ---- Actividad reciente: eventos académicos (leccion/evaluacion/curso) ----
// Se trae una sola vez (limit=20); "Ver toda la actividad" es un toggle
// inline sobre la misma lista, sin segundo fetch.
const ACTIVIDAD_VISIBLE = 4;

function activityMeta(tipo, titulo) {
  if (tipo === 'curso') return { Icon: GraduationIcon, tint: 'bg-titi-yellow text-titi-dark', text: `Completaste el curso "${titulo}"` };
  if (tipo === 'evaluacion') return { Icon: AwardIcon, tint: 'bg-titi-achievement text-white', text: `Aprobaste "${titulo}"` };
  return { Icon: CheckIcon, tint: 'bg-green-500 text-white', text: `Completaste "${titulo}"` };
}

function RecentActivity() {
  const [actividad, setActividad] = useState(null);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    client
      .get('/api/gotas/activity', { params: { limit: 20 } })
      .then(({ data }) => {
        if (cancelled) return;
        if (data?.success) setActividad(data.data?.actividad || []);
        else setError(true);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const listRef = useStaggerReveal([actividad?.length ?? 0, expanded]);

  if (error) return null;

  const showToggle = (actividad?.length || 0) > ACTIVIDAD_VISIBLE;
  const visible = expanded ? actividad : (actividad || []).slice(0, ACTIVIDAD_VISIBLE);

  return (
    <section aria-label="Actividad reciente" className={`${SURFACE} p-4 sm:p-5`}>
      <PanelTitle Icon={ClockIcon} solid="bg-blue-500" title="Actividad" accent="reciente" />

      {actividad === null ? (
        <div className="flex flex-col gap-3 animate-pulse motion-reduce:animate-none">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-1">
              <div className="w-9 h-9 rounded-xl bg-gray-100 shrink-0" />
              <div className="flex-1 flex flex-col gap-1.5">
                <div className="h-3 w-3/4 bg-gray-100 rounded-full" />
                <div className="h-2.5 w-1/3 bg-gray-100 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : actividad.length === 0 ? (
        <EmptyState compact state="idle" title="Todavía no tenés" accent="actividad" text="Completá una lección y la vas a ver acá." />
      ) : (
        <ul ref={listRef} className="flex flex-col">
          {visible.map((item, i) => {
            const { Icon, tint, text } = activityMeta(item.tipo, item.titulo);
            return (
              <li key={`${item.tipo}-${item.titulo}-${item.createdAt}-${i}`} className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0">
                <span className={`w-9 h-9 rounded-xl border-2 border-titi-dark grid place-items-center shrink-0 -rotate-6 ${tint}`}>
                  <Icon className="w-4 h-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-titi-dark leading-snug line-clamp-2">{text}</p>
                  <p className="text-xs font-semibold text-gray-400">{relativeTime(item.createdAt)}</p>
                </div>
                <span className="inline-flex items-center gap-1 h-7 px-2 rounded-lg bg-titi-yellow-light text-sm font-black text-titi-dark shrink-0 tabular-nums whitespace-nowrap">
                  <GotaIcon className="w-3.5 h-3.5 text-titi-yellow-dark" />+{item.cantidad}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {actividad !== null && showToggle && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          className="w-full mt-3 pt-3 border-t-2 border-gray-100 text-center text-sm font-bold text-blue-500 hover:text-blue-600 uppercase tracking-wide transition-all duration-150 active:scale-95"
        >
          {expanded ? 'Ver menos' : 'Ver toda la actividad'}
        </button>
      )}
    </section>
  );
}

// ---- Banner de cierre: panel oscuro con Titi (máx. 1 por página) ----
function BottomBanner({ onExplore }) {
  return (
    <section className={`${DARK_PANEL} p-5 sm:p-6 flex flex-col sm:flex-row items-center gap-4 sm:gap-5`}>
      <TitiMascot state="saludo" size="sm" message="" className="shrink-0" />
      <div className="flex-1 text-center sm:text-left">
        <h3 className="text-xl font-extrabold text-titi-cream">
          ¡Seguí <span className="text-titi-yellow">aprendiendo</span>!
        </h3>
        <p className="text-base font-medium text-white/60">La constancia es la clave: una lección hoy suma gotas y alarga tu racha.</p>
      </div>
      <button type="button" onClick={onExplore} className="titi-btn-primary whitespace-nowrap">
        Explorar cursos
      </button>
    </section>
  );
}

// ---- Skeleton con la silueta real ----
function SkeletonGrid() {
  return (
    <div className="flex flex-col gap-6 sm:gap-8 animate-pulse motion-reduce:animate-none" aria-busy="true" aria-label="Cargando tus cursos">
      <div className="rounded-2xl bg-gray-200 p-4 sm:p-5">
        <div className="h-5 w-32 bg-gray-100 rounded-full mb-3" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-[88px] bg-gray-100 rounded-xl" />
          ))}
        </div>
      </div>
      <div>
        <div className="h-6 w-56 bg-gray-100 rounded-full mb-4" />
        <div className="flex flex-col gap-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <div className="w-12 h-12 rounded-xl bg-gray-100 shrink-0 self-center" />
              <div className="flex-1 bg-white rounded-2xl border-2 border-gray-200 overflow-hidden flex flex-col sm:flex-row sm:h-44">
                <div className="w-full sm:w-[38%] h-36 sm:h-full bg-gray-100 shrink-0" />
                <div className="flex-1 flex flex-col gap-2 p-4 sm:p-5">
                  <div className="h-3 w-24 bg-gray-100 rounded-full" />
                  <div className="h-5 w-3/4 bg-gray-100 rounded-full" />
                  <div className="h-9 w-28 bg-gray-100 rounded-xl mt-1" />
                  <div className="h-2.5 w-full bg-gray-100 rounded-full mt-auto" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
