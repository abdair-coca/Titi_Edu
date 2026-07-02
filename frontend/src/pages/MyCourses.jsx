import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client.js';
import { useStaggerReveal, useCountUp } from '../lib/motion.js';
import { useGamification } from '../context/GamificationContext.jsx';
import useStreak from '../hooks/useStreak.js';
import {
  BoltIcon,
  GotaIcon,
  TargetIcon,
  categoryIcon,
  CheckIcon,
  AwardIcon,
  GraduationIcon,
} from '../components/icons.jsx';
import DailyMissions from '../components/DailyMissions.jsx';
import TitiMascot from '../components/TitiMascot.jsx';
import { relativeTime } from '../lib/format.js';

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
      {/* Header */}
      <header className="mb-5 sm:mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-titi-dark">
            Mis cursos
          </h1>
          <span
            aria-hidden="true"
            className="block w-12 h-1.5 mt-1.5 bg-titi-yellow rounded-full"
          />
          <p className="text-base font-medium text-gray-500 mt-1.5">
            Continuá donde lo dejaste
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/certificates')}
          className="inline-flex items-center gap-2 bg-white text-titi-dark font-bold text-sm px-4 py-2.5 rounded-xl border-2 border-gray-200 shadow-[0_4px_0px_#E5E7EB] hover:border-titi-yellow hover:-translate-y-0.5 hover:shadow-[0_6px_0px_#E5E7EB] active:translate-y-0.5 active:shadow-none transition-all duration-150 whitespace-nowrap"
        >
          <GraduationIcon className="w-4 h-4 text-titi-certificate" />
          Mis certificados
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
            <CategoriesExplorer onOpen={(catId) => navigate(`/courses?categoria=${catId}`)} />
          </div>
          <RecentActivity />
        </div>
        <BottomBanner onExplore={() => navigate('/courses')} />
        </>
      )}
    </div>
  );
}

// ---- 3 stat cards separadas (mockup), cada una con su acento de color:
// progreso → amarillo Titi (XP), gotas → azul info, racha → naranja streak.
function StatsRow({ progresoPromedio, gotasTotal, streak }) {
  const rachaActiva = streak.estaActiva && streak.racha > 0;
  // Count-up de los 3 números (§10 patrón 5); la barra ya anima su width.
  const progresoAnim = useCountUp(progresoPromedio);
  const gotasAnim = useCountUp(gotasTotal);
  const rachaAnim = useCountUp(streak.racha);
  const cardClass =
    'bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_24px_rgba(255,217,61,0.2)] hover:-translate-y-0.5 transition-all duration-200 p-4 sm:p-5 flex items-center gap-3';
  return (
    <section className="mb-6 sm:mb-8 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
      {/* Tu progreso */}
      <div className={cardClass}>
        <StatIcon tint="bg-titi-yellow" icon={<TargetIcon className="w-6 h-6 text-titi-dark" />} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-500">Tu progreso</p>
          <p className="text-3xl font-extrabold text-titi-dark tabular-nums leading-tight">
            {progresoAnim}%
          </p>
          <p className="text-xs font-semibold text-gray-500">Promedio general</p>
          <div
            className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={progresoPromedio}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progreso general"
          >
            <div
              className="h-full bg-titi-yellow rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none"
              style={{ width: `${progresoPromedio}%` }}
            />
          </div>
        </div>
      </div>

      {/* Gotas totales */}
      <div className={cardClass}>
        <StatIcon tint="bg-blue-500" icon={<GotaIcon className="w-6 h-6 text-white" />} />
        <div className="min-w-0">
          <p className="text-3xl font-extrabold text-titi-dark tabular-nums leading-tight">
            {gotasAnim}
          </p>
          <p className="text-xs font-semibold text-gray-500">Gotas totales</p>
        </div>
      </div>

      {/* Racha actual */}
      <div className={cardClass}>
        <StatIcon tint="bg-titi-streak" icon={<BoltIcon className="w-6 h-6 text-white" />} />
        <div className="min-w-0">
          <p className="text-3xl font-extrabold text-titi-dark tabular-nums leading-tight">
            {rachaAnim}
          </p>
          <p className="text-xs font-semibold text-gray-500">Racha actual</p>
          {rachaActiva && (
            <p className="text-xs font-bold text-titi-streak">¡Sigue así!</p>
          )}
        </div>
      </div>
    </section>
  );
}

function StatIcon({ icon, tint = 'bg-titi-yellow' }) {
  return (
    <div className={`w-12 h-12 rounded-full ${tint} shadow-sm grid place-items-center shrink-0`}>
      {icon}
    </div>
  );
}

// ---- Ruta de aprendizaje: timeline vertical de cursos inscritos ----
function LearningPathSection({ inscripciones, progressByCurso, onContinue, onOpenDetail }) {
  const [expanded, setExpanded] = useState(false);

  const sorted = useMemo(
    () =>
      [...inscripciones].sort(
        (a, b) => new Date(a.fechaInscripcion) - new Date(b.fechaInscripcion),
      ),
    [inscripciones],
  );

  const hiddenCount = sorted.length - RUTA_VISIBLE;
  const showToggle = hiddenCount > 0;
  const visible = expanded ? sorted : sorted.slice(0, RUTA_VISIBLE);
  const toggle = () => setExpanded((e) => !e);
  const showMoreNode = !expanded && showToggle;

  const pathRef = useStaggerReveal([visible.length, expanded]);

  return (
    <section className="mb-6 sm:mb-8">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl sm:text-2xl font-extrabold text-titi-dark">Tu ruta de aprendizaje</h2>
        {showToggle && (
          <button
            type="button"
            onClick={toggle}
            className="text-sm font-bold text-blue-500 hover:text-blue-600 uppercase tracking-wide transition-all duration-150 active:scale-95 whitespace-nowrap"
          >
            {expanded ? 'Ver menos' : 'Ver toda la ruta'}
          </button>
        )}
      </div>

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

// ---- Círculo de la timeline con el ícono de trazo de la categoría ----
// Plomo por default; se pone amarillo con el group-hover del curso asociado.
function PathIcon({ categoria }) {
  const Icon = categoryIcon(categoria);
  return (
    <div className="relative z-10 w-11 h-11 sm:w-12 sm:h-12 rounded-full grid place-items-center shrink-0 shadow-sm bg-gray-200 transition-colors duration-150 group-hover:bg-titi-yellow">
      <Icon className="w-5 h-5 text-gray-500 transition-colors duration-150 group-hover:text-titi-dark" />
    </div>
  );
}

// ---- Un nodo de la ruta: círculo + línea + card horizontal (imagen | info) ----
function LearningPathNode({ inscripcion, progress, isLast, onContinue, onOpenDetail }) {
  const curso = inscripcion.curso || {};
  const computedComplete = Boolean(
    progress && progress.total > 0 && progress.completadas === progress.total,
  );
  const completado = Boolean(inscripcion.completado) || computedComplete;
  const porcentaje = progress?.porcentaje ?? (completado ? 100 : 0);
  const total = progress?.total ?? 0;
  const completadas = progress?.completadas ?? 0;

  return (
    <li className="group relative flex gap-3 sm:gap-4">
      {/* Rail: círculo centrado verticalmente + línea conectora */}
      <div className="relative w-11 sm:w-12 shrink-0 flex justify-center">
        {!isLast && (
          <span
            aria-hidden="true"
            className="absolute top-1/2 left-1/2 -translate-x-1/2 w-0.5 bg-gray-200 h-[calc(100%+1.25rem)]"
          />
        )}
        <div className="self-center">
          <PathIcon categoria={curso.categoria?.nombre} />
        </div>
      </div>

      {/* Card horizontal — la portada queda al ras del contenedor (sin padding) */}
      <article className="flex-1 min-w-0 bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_24px_rgba(255,217,61,0.2)] hover:-translate-y-0.5 transition-all duration-200 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:h-44">
          {/* Portada (izquierda, al ras) */}
          <button
            type="button"
            onClick={onOpenDetail}
            aria-label={`Ver detalle de ${curso.titulo || 'curso'}`}
            className="relative shrink-0 w-full sm:w-[42%] h-40 sm:h-full bg-titi-dark block focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-titi-yellow"
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
              <div className="w-full h-full grid place-items-center text-5xl select-none">
                {curso.categoria?.icono || '📚'}
              </div>
            )}
            {curso.nivel && (
              <span className="absolute top-2.5 left-2.5 bg-titi-dark text-white text-xs font-semibold capitalize px-3 py-1 rounded-full shadow-sm">
                {curso.nivel}
              </span>
            )}
            {completado && (
              <span className="absolute top-2.5 right-2.5 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm whitespace-nowrap">
                Completado ✓
              </span>
            )}
          </button>

          {/* Info (derecha) */}
          <div className="min-w-0 flex-1 flex flex-col p-4 sm:p-5 overflow-hidden">
            {curso.categoria?.nombre && (
              <p className="text-xs font-bold text-titi-streak uppercase tracking-wide">
                {curso.categoria.nombre}
              </p>
            )}
            <button
              type="button"
              onClick={onOpenDetail}
              className="text-left w-fit max-w-full rounded-lg mt-0.5 active:scale-[0.98] transition-transform duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-titi-yellow"
            >
              <h3 className="text-lg font-bold text-titi-dark leading-snug line-clamp-1 hover:text-titi-yellow-dark transition-colors">
                {curso.titulo || 'Curso sin título'}
              </h3>
            </button>

            <div className="mt-2">
              {completado ? (
                <p className="inline-flex items-center gap-1.5 text-sm font-bold text-green-600">
                  <CheckIcon className="w-4 h-4" /> Completado
                </p>
              ) : (
                <button
                  type="button"
                  onClick={onContinue}
                  className="inline-flex items-center gap-1.5 bg-titi-yellow text-titi-dark font-bold text-sm px-4 py-2 rounded-xl shadow-[0_3px_0px_#E6B800] hover:shadow-[0_1px_0px_#E6B800] hover:-translate-y-0.5 active:shadow-none active:translate-y-0 transition-all duration-150"
                >
                  Continuar →
                </button>
              )}
            </div>

            {/* Lecciones + % + barra (abajo) */}
            <div className="mt-auto pt-4">
              <div className="flex items-center justify-between text-sm font-medium text-gray-500 mb-1.5">
                <span>
                  {completadas} / {total} {total === 1 ? 'lección' : 'lecciones'}
                </span>
                <span
                  className={`tabular-nums font-bold ${
                    completado ? 'text-green-600' : 'text-titi-yellow-dark'
                  }`}
                >
                  {porcentaje}%
                </span>
              </div>
              <div
                className="h-2.5 bg-gray-100 rounded-full overflow-hidden"
                role="progressbar"
                aria-valuenow={porcentaje}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Progreso de ${curso.titulo || 'curso'}`}
              >
                <div
                  className={`h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none ${
                    completado ? 'bg-green-500' : 'bg-titi-yellow'
                  }`}
                  style={{ width: `${porcentaje}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </article>
    </li>
  );
}

// ---- Nodo "+N": mismo estilo de círculo, dispara el toggle de la ruta ----
function LearningPathMoreNode({ count, onClick }) {
  return (
    <li className="relative flex gap-3 sm:gap-4 items-center">
      <div className="relative w-11 sm:w-12 shrink-0 flex justify-center">
        <button
          type="button"
          onClick={onClick}
          aria-label={`Ver ${count} cursos más de tu ruta`}
          className="relative z-10 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-gray-200 grid place-items-center shrink-0 shadow-sm hover:bg-gray-300 active:scale-90 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-titi-yellow"
        >
          <span className="text-xs font-black text-gray-600 tabular-nums">+{count}</span>
        </button>
      </div>
      <button
        type="button"
        onClick={onClick}
        className="text-sm font-bold text-titi-dark hover:text-titi-yellow-dark active:scale-95 transition-all duration-150"
      >
        Ver {count} {count === 1 ? 'curso más' : 'cursos más'}
      </button>
    </li>
  );
}

// ---- Explorar categorías: fila de accesos a /courses?categoria=<id> ----
// Chip sólido rotado por índice — duotono por rol de design.md §2
// (logro/info/éxito/XP): color pleno + ícono blanco (oscuro sobre amarillo).
const CAT_TINTS = [
  'bg-titi-achievement text-white',
  'bg-blue-500 text-white',
  'bg-green-500 text-white',
  'bg-titi-yellow text-titi-dark',
];

function CategoriesExplorer({ onOpen }) {
  const navigate = useNavigate();
  const [categorias, setCategorias] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    client
      .get('/api/categories')
      .then(({ data }) => {
        if (cancelled) return;
        if (data?.success) setCategorias(data.data?.categorias || []);
        else setError(true);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Solo categorías con al menos un curso; fila de 4 (como el mockup).
  const withCourses = (categorias || []).filter((c) => (c._count?.cursos ?? 0) > 0);
  const visible = withCourses.slice(0, 4);

  if (error) return null;

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-titi-dark">Explorar categorías</h2>
        <button
          type="button"
          onClick={() => navigate('/courses')}
          className="text-sm font-bold text-blue-500 hover:text-blue-600 uppercase tracking-wide transition-all duration-150 active:scale-95 whitespace-nowrap"
        >
          Ver todas
        </button>
      </div>

      {categorias === null ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <p className="text-sm text-gray-400">Aún no hay categorías con cursos.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {visible.map((cat, i) => {
            const Icon = categoryIcon(cat.nombre);
            const count = cat._count?.cursos ?? 0;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onOpen(cat.id)}
                className="flex flex-col items-center gap-1.5 text-center rounded-xl py-3 px-1 hover:bg-titi-cream active:scale-[0.96] transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-titi-yellow"
              >
                <span
                  className={`w-11 h-11 rounded-full grid place-items-center shrink-0 shadow-sm ${CAT_TINTS[i % CAT_TINTS.length]}`}
                >
                  <Icon className="w-5 h-5" />
                </span>
                <span className="text-xs font-bold text-titi-dark leading-tight line-clamp-2">
                  {cat.nombre}
                </span>
                <span className="text-xs font-semibold text-gray-500">
                  {count} {count === 1 ? 'curso' : 'cursos'}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ---- Actividad reciente: eventos académicos (leccion/evaluacion/curso) ----
// Se trae una sola vez (limit=20); "Ver toda la actividad" es un toggle
// inline sobre la misma lista, sin segundo fetch.
const ACTIVIDAD_VISIBLE = 4;

function activityMeta(tipo, titulo) {
  if (tipo === 'curso') {
    return {
      Icon: GraduationIcon,
      tint: 'bg-titi-yellow text-titi-dark',
      text: `Completaste el curso "${titulo}"`,
    };
  }
  if (tipo === 'evaluacion') {
    return {
      Icon: AwardIcon,
      tint: 'bg-titi-achievement text-white',
      text: `Aprobaste "${titulo}"`,
    };
  }
  return {
    Icon: CheckIcon,
    tint: 'bg-green-500 text-white',
    text: `Completaste "${titulo}"`,
  };
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

  if (error) return null;

  const showToggle = (actividad?.length || 0) > ACTIVIDAD_VISIBLE;
  const visible = expanded ? actividad : (actividad || []).slice(0, ACTIVIDAD_VISIBLE);

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-4 sm:p-5">
      <div className="mb-3">
        <h2 className="text-lg font-bold text-titi-dark">Actividad reciente</h2>
      </div>

      {actividad === null ? (
        <div className="flex flex-col gap-3 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gray-100 shrink-0" />
              <div className="flex-1 flex flex-col gap-1.5">
                <div className="h-3 w-3/4 bg-gray-100 rounded" />
                <div className="h-2.5 w-1/3 bg-gray-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : actividad.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 px-4 text-center">
          <TitiMascot state="idle" size="sm" message="" className="mb-2" />
          <p className="text-sm text-gray-400">Aún no tenés actividad</p>
        </div>
      ) : (
        <ul className="flex flex-col">
          {visible.map((item, i) => {
            const { Icon, tint, text } = activityMeta(item.tipo, item.titulo);
            return (
              <li
                key={`${item.tipo}-${item.titulo}-${item.createdAt}-${i}`}
                className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0"
              >
                <span className={`w-9 h-9 rounded-full grid place-items-center shrink-0 ${tint}`}>
                  <Icon className="w-4 h-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-titi-dark leading-snug line-clamp-2">
                    {text}
                  </p>
                  <p className="text-xs text-gray-400">{relativeTime(item.createdAt)}</p>
                </div>
                <span className="text-sm font-bold text-green-600 shrink-0 tabular-nums whitespace-nowrap">
                  +{item.cantidad} gotas
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {/* Toggle centrado al pie, como el mockup */}
      {actividad !== null && showToggle && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="w-full mt-3 pt-3 border-t border-gray-50 text-center text-sm font-bold text-blue-500 hover:text-blue-600 uppercase tracking-wide transition-all duration-150 active:scale-95"
        >
          {expanded ? 'Ver menos' : 'Ver toda la actividad'}
        </button>
      )}
    </section>
  );
}

// ---- Banner de cierre: CTA plano a /courses ----
function BottomBanner({ onExplore }) {
  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-5 sm:p-6 flex flex-col sm:flex-row items-center gap-4 sm:gap-5">
      {/* Titi animado en el banner motivacional (design.md §7 v2, máx 1/página) */}
      <TitiMascot state="saludo" size="sm" message="" className="shrink-0" />
      <div className="flex-1 text-center sm:text-left">
        <h3 className="text-lg font-bold text-titi-dark">¡Sigue aprendiendo!</h3>
        <p className="text-base font-medium text-gray-500">
          La constancia es la clave del éxito.
        </p>
      </div>
      <button
        type="button"
        onClick={onExplore}
        className="bg-titi-yellow text-titi-dark font-bold text-base px-6 py-3 rounded-xl shadow-[0_4px_0px_#E6B800] hover:shadow-[0_2px_0px_#E6B800] hover:-translate-y-0.5 active:shadow-none active:translate-y-0 transition-all duration-150 whitespace-nowrap"
      >
        Explorar cursos
      </button>
    </section>
  );
}

// ---- Empty state (sección 8 del DESIGN.md) ----
function EmptyState({ onExplore }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-8 text-center">
      <img
        src="/Titi.png"
        alt="Titi"
        className="w-24 h-24 mb-4 object-contain drop-shadow-sm select-none"
        draggable={false}
      />
      <h3 className="text-xl font-bold text-titi-dark mb-2">
        Aún no tienes cursos
      </h3>
      <p className="text-base font-medium text-gray-500 mb-6 max-w-xs">
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
        <span className="w-8 h-8 rounded-full bg-red-500 grid place-items-center shrink-0 text-white text-sm font-black" aria-hidden="true">!</span>
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
    <div className="flex flex-col gap-6 sm:gap-8 animate-pulse">
      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 flex items-center gap-3"
          >
            <div className="w-12 h-12 rounded-full bg-gray-100 shrink-0" />
            <div className="flex-1 flex flex-col gap-2">
              <div className="h-5 w-16 bg-gray-100 rounded" />
              <div className="h-3 w-20 bg-gray-100 rounded" />
            </div>
          </div>
        ))}
      </div>
      {/* Ruta de aprendizaje */}
      <div>
        <div className="h-5 w-40 bg-gray-100 rounded mb-6" />
        <div className="flex flex-col gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <div className="w-12 h-12 rounded-full bg-gray-100 shrink-0 self-center" />
              <div className="flex-1 bg-white rounded-2xl border border-gray-100 p-3">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="w-full sm:w-[42%] h-32 sm:h-36 bg-gray-100 rounded-xl shrink-0" />
                  <div className="flex-1 flex flex-col gap-2 py-1">
                    <div className="h-3 w-24 bg-gray-100 rounded" />
                    <div className="h-5 w-3/4 bg-gray-100 rounded" />
                    <div className="h-8 w-28 bg-gray-100 rounded-xl mt-1" />
                    <div className="h-2.5 w-full bg-gray-100 rounded-full mt-auto" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
