import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import LessonComments from '../components/LessonComments.jsx';
import { resolveMediaUrl } from '../lib/format.js';

export default function LearnCourse() {
  const { id: courseId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [curso, setCurso] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // IDs de lecciones completadas
  const [completed, setCompleted] = useState(() => new Set());

  // Cache de lecciones completas (con contenido) por moduloId
  // El endpoint GET /api/courses/:id no devuelve `contenido`, así que
  // lazy-cargamos GET /api/modules/:moduloId/lessons cuando se necesita.
  const [lessonsByModulo, setLessonsByModulo] = useState({});

  // Cache de materiales por leccionId (GET /api/lessons/:id)
  const [materialsByLesson, setMaterialsByLesson] = useState({});

  // Lección activa
  const [activeId, setActiveId] = useState(null);

  // UI state al marcar como completada
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState(null);

  // Mobile: drawer de lecciones abierto
  const [drawerOpen, setDrawerOpen] = useState(false);

  // --- Fetch del curso + progreso en paralelo ---
  useEffect(() => {
    if (!courseId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      client.get(`/api/courses/${courseId}`),
      isAuthenticated
        ? client
            .get(`/api/courses/${courseId}/progress`)
            .catch(() => ({ data: null }))
        : Promise.resolve({ data: null }),
    ])
      .then(([detailRes, progRes]) => {
        if (cancelled) return;
        const d = detailRes.data;
        if (!d?.success) {
          setError(d?.message || 'No se pudo cargar el curso');
          return;
        }
        const c = d.data?.curso;
        setCurso(c);

        // Activar la primera lección por defecto
        const firstLeccion = c?.modulos?.[0]?.lecciones?.[0];
        if (firstLeccion) setActiveId(firstLeccion.id);

        // Aplicar progreso (set de leccionIds completadas)
        const p = progRes?.data;
        if (p?.success) {
          const completedIds = new Set();
          (p.data?.modulos || []).forEach((m) =>
            (m.lecciones || []).forEach((l) => {
              if (l.completada) completedIds.add(l.id);
            }),
          );
          setCompleted(completedIds);
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
  }, [courseId, isAuthenticated]);

  // --- Módulo de la lección activa ---
  const activeModulo = useMemo(() => {
    if (!curso || !activeId) return null;
    return (
      curso.modulos?.find((m) =>
        m.lecciones?.some((l) => l.id === activeId),
      ) || null
    );
  }, [curso, activeId]);

  // --- Lazy-cargar lecciones completas (con contenido) del módulo activo ---
  useEffect(() => {
    if (!activeModulo) return;
    if (lessonsByModulo[activeModulo.id]) return; // ya cacheado
    let cancelled = false;
    client
      .get(`/api/modules/${activeModulo.id}/lessons`)
      .then(({ data }) => {
        if (cancelled) return;
        if (data?.success) {
          setLessonsByModulo((prev) => ({
            ...prev,
            [activeModulo.id]: data.data?.lecciones || [],
          }));
        }
      })
      .catch(() => {
        // Silencioso — fallback a la versión sin contenido.
      });
    return () => {
      cancelled = true;
    };
  }, [activeModulo, lessonsByModulo]);

  // --- Lección activa (con contenido si está cacheado) ---
  const activeLesson = useMemo(() => {
    if (!activeModulo || !activeId) return null;
    const cached = lessonsByModulo[activeModulo.id]?.find(
      (l) => l.id === activeId,
    );
    if (cached) return cached;
    return activeModulo.lecciones?.find((l) => l.id === activeId) || null;
  }, [activeModulo, activeId, lessonsByModulo]);

  // --- Lazy-cargar materiales de la lección activa ---
  useEffect(() => {
    if (!activeId) return;
    if (materialsByLesson[activeId] !== undefined) return;
    let cancelled = false;
    client
      .get(`/api/lessons/${activeId}`)
      .then(({ data }) => {
        if (cancelled) return;
        if (data?.success) {
          setMaterialsByLesson((prev) => ({
            ...prev,
            [activeId]: data.data?.leccion?.materiales || [],
          }));
        } else {
          setMaterialsByLesson((prev) => ({ ...prev, [activeId]: [] }));
        }
      })
      .catch(() => {
        setMaterialsByLesson((prev) => ({ ...prev, [activeId]: [] }));
      });
    return () => {
      cancelled = true;
    };
  }, [activeId, materialsByLesson]);

  // --- Totales para barra de progreso ---
  const totalLessons = useMemo(() => {
    if (!curso) return 0;
    return (
      curso.modulos?.reduce(
        (sum, m) => sum + (m.lecciones?.length || 0),
        0,
      ) || 0
    );
  }, [curso]);

  const completedCount = completed.size;
  const progressPct =
    totalLessons === 0 ? 0 : Math.round((completedCount / totalLessons) * 100);

  // --- Handlers ---
  const handleSelectLesson = (lessonId) => {
    setActiveId(lessonId);
    setCompleteError(null);
    setDrawerOpen(false);
  };

  const handleComplete = async () => {
    if (!activeId || completed.has(activeId) || completing) return;
    setCompleting(true);
    setCompleteError(null);
    try {
      const { data } = await client.post(`/api/lessons/${activeId}/complete`);
      if (data?.success) {
        setCompleted((prev) => {
          const next = new Set(prev);
          next.add(activeId);
          return next;
        });
      } else {
        setCompleteError(
          data?.message || 'No se pudo marcar la lección como completada',
        );
      }
    } catch (err) {
      setCompleteError(
        err.response?.data?.message || err.message || 'Error de red',
      );
    } finally {
      setCompleting(false);
    }
  };

  // --- Render: loading ---
  if (loading) {
    return (
      <div className="flex min-h-screen bg-titi-cream items-center justify-center">
        <Spinner />
      </div>
    );
  }

  // --- Render: error ---
  if (error) {
    return (
      <div className="flex min-h-screen bg-titi-cream items-center justify-center p-8">
        <div className="max-w-md w-full bg-red-50 border border-red-200 rounded-xl p-6">
          <div className="flex items-start gap-3 mb-4">
            <span className="text-red-500 text-lg" aria-hidden="true">⚠️</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-700">
                No pudimos cargar el curso
              </p>
              <p className="text-xs text-red-500 mt-0.5">{error}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/courses/${courseId}`)}
            className="text-sm font-semibold text-titi-dark hover:text-titi-yellow-dark transition-colors"
          >
            ← Volver al detalle del curso
          </button>
        </div>
      </div>
    );
  }

  if (!curso) return null;

  return (
    <div className="flex min-h-screen bg-titi-cream">
      {/* === Sidebar de lecciones (desktop) + drawer (móvil) === */}
      <aside
        className={`
          w-72 bg-white border-r border-gray-100 flex flex-col
          fixed inset-y-0 left-0 z-40 overflow-y-auto
          transition-transform duration-200
          ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}
          md:sticky md:top-0 md:h-screen md:translate-x-0
        `}
      >
        {/* Header del sidebar */}
        <div className="p-4 border-b border-gray-100">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-xs font-semibold text-gray-400 hover:text-titi-dark transition-colors mb-2 inline-flex items-center gap-1"
          >
            ← Volver
          </button>
          <h2 className="text-base font-bold text-titi-dark leading-snug line-clamp-2">
            {curso.titulo}
          </h2>
          <p className="text-xs font-medium text-gray-400 mt-1">
            {completedCount} de {totalLessons}{' '}
            {totalLessons === 1 ? 'lección' : 'lecciones'}
          </p>
        </div>

        {/* Lista de módulos + lecciones */}
        <nav className="flex-1 py-2">
          {curso.modulos?.length === 0 ? (
            <p className="px-4 py-3 text-xs text-gray-400 font-medium">
              Este curso aún no tiene módulos publicados.
            </p>
          ) : (
            curso.modulos?.map((modulo) => (
              <div key={modulo.id} className="mb-2">
                <h3 className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  {modulo.titulo}
                </h3>
                <ul>
                  {modulo.lecciones?.map((leccion) => {
                    const isActive = leccion.id === activeId;
                    const isDone = completed.has(leccion.id);
                    return (
                      <li key={leccion.id}>
                        <button
                          type="button"
                          onClick={() => handleSelectLesson(leccion.id)}
                          className={[
                            'w-full text-left px-4 py-2.5 flex items-center gap-3 cursor-pointer text-sm font-medium hover:bg-titi-cream transition-colors',
                            isActive
                              ? 'bg-titi-yellow-light text-titi-dark font-semibold border-l-2 border-titi-yellow'
                              : isDone
                                ? 'text-gray-400'
                                : 'text-titi-dark',
                          ].join(' ')}
                        >
                          {isDone ? (
                            <span
                              className="text-green-500 text-base shrink-0 font-bold"
                              aria-label="Completada"
                            >
                              ✓
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-gray-400 w-4 shrink-0 tabular-nums text-center">
                              {leccion.orden}
                            </span>
                          )}
                          <span className="line-clamp-2 flex-1">
                            {leccion.titulo}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </nav>
      </aside>

      {/* Overlay móvil cuando el drawer está abierto */}
      {drawerOpen && (
        <div
          aria-hidden="true"
          onClick={() => setDrawerOpen(false)}
          className="fixed inset-0 bg-black/30 z-30 md:hidden"
        />
      )}

      {/* === Panel derecho: lección activa === */}
      <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto md:ml-0">
        <div className="max-w-3xl mx-auto">
          {/* Toggle del drawer en móvil */}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="md:hidden mb-4 w-full text-sm font-semibold text-titi-dark bg-white border border-gray-200 rounded-xl px-4 py-3 hover:bg-gray-50 transition-colors inline-flex items-center gap-2 justify-center"
          >
            ☰ Ver lecciones ({completedCount}/{totalLessons})
          </button>

          {/* Barra de progreso */}
          <div className="flex items-center gap-3 mb-5 sm:mb-6">
            <button
              type="button"
              onClick={() => navigate('/my-courses')}
              className="w-9 h-9 grid place-items-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 text-lg leading-none transition-colors shrink-0"
              aria-label="Cerrar curso"
              title="Salir del curso"
            >
              ✕
            </button>
            <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-titi-yellow rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="text-sm font-bold text-gray-400 tabular-nums">
              {progressPct}%
            </span>
          </div>

          {activeLesson ? (
            <LessonView
              leccion={activeLesson}
              materiales={materialsByLesson[activeLesson.id]}
              completed={completed.has(activeLesson.id)}
              completing={completing}
              completeError={completeError}
              onComplete={handleComplete}
            />
          ) : (
            <EmptyLessonState
              onBack={() => navigate(`/courses/${courseId}`)}
            />
          )}
        </div>
      </main>
    </div>
  );
}

// ---- Vista de lección activa ----
const TIPO_ICON = {
  pdf: '📄',
  word: '📝',
  imagen: '🖼️',
  codigo: '💻',
  otro: '📎',
};

function MaterialChip({ material }) {
  const icon = TIPO_ICON[material.tipo] || '📎';
  const href = material.url?.startsWith('/uploads/')
    ? resolveMediaUrl(material.url)
    : material.url;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      download
      className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-titi-dark hover:border-titi-yellow hover:bg-titi-cream transition-all duration-150 max-w-full"
    >
      <span className="text-base" aria-hidden="true">
        {icon}
      </span>
      <span className="truncate">{material.nombre}</span>
      <span className="text-xs text-gray-400 uppercase tracking-wide shrink-0">
        {material.tipo}
      </span>
    </a>
  );
}

function LessonView({ leccion, materiales, completed, completing, completeError, onComplete }) {
  const videoEmbed = useMemo(
    () => normalizeVideoUrl(leccion.videoUrl),
    [leccion.videoUrl],
  );

  return (
    <article>
      {videoEmbed && (
        <div className="w-full aspect-video rounded-2xl overflow-hidden bg-titi-dark mb-6">
          <iframe
            key={videoEmbed}
            src={videoEmbed}
            title={leccion.titulo}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="w-full h-full border-0"
          />
        </div>
      )}

      <h1 className="text-xl sm:text-2xl font-bold text-titi-dark mb-3">
        {leccion.titulo}
      </h1>

      {leccion.contenido ? (
        <div className="text-sm sm:text-base text-gray-600 leading-relaxed whitespace-pre-line mb-6 sm:mb-8">
          {leccion.contenido}
        </div>
      ) : (
        <p className="text-sm text-gray-400 font-medium mb-8">
          Cargando contenido…
        </p>
      )}

      {/* Materiales */}
      {materiales === undefined ? (
        <div className="mb-6 sm:mb-8">
          <h2 className="text-sm font-bold text-titi-dark uppercase tracking-wide mb-2">Materiales</h2>
          <p className="text-xs text-gray-400 font-medium">Cargando…</p>
        </div>
      ) : materiales.length > 0 ? (
        <div className="mb-6 sm:mb-8">
          <h2 className="text-sm font-bold text-titi-dark uppercase tracking-wide mb-3">
            Materiales
          </h2>
          <div className="flex flex-wrap gap-2">
            {materiales.map((m) => (
              <MaterialChip key={m.id} material={m} />
            ))}
          </div>
        </div>
      ) : null}

      {completeError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 mb-4">
          <span className="text-red-500 text-lg" aria-hidden="true">⚠️</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-700">
              No pudimos marcar la lección
            </p>
            <p className="text-xs text-red-500 mt-0.5">{completeError}</p>
          </div>
        </div>
      )}

      <div>
        {completed ? (
          <button
            type="button"
            disabled
            className="bg-green-500 text-white font-bold text-base px-6 py-3 rounded-xl shadow-[0_4px_0px_#16A34A] cursor-default inline-flex items-center gap-2"
          >
            <span aria-hidden="true">✓</span>
            Lección completada
          </button>
        ) : (
          <button
            type="button"
            onClick={onComplete}
            disabled={completing}
            className="bg-titi-yellow text-titi-dark font-bold text-base px-6 py-3 rounded-xl shadow-[0_4px_0px_#E6B800] hover:shadow-[0_2px_0px_#E6B800] hover:-translate-y-0.5 active:shadow-none active:translate-y-0 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {completing ? 'Marcando…' : 'Marcar como completada'}
          </button>
        )}
      </div>

      {/* Comentarios */}
      <hr className="border-titi-border my-8" />
      <LessonComments lessonId={leccion.id} />
    </article>
  );
}

// ---- Empty state cuando no hay lecciones ----
function EmptyLessonState({ onBack }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      <img
        src="/Titi.png"
        alt="Titi"
        className="w-24 h-24 mb-4 object-contain drop-shadow-sm select-none"
        draggable={false}
      />
      <h3 className="text-xl font-bold text-titi-dark mb-2">
        Aún no hay lecciones
      </h3>
      <p className="text-sm text-gray-400 mb-6 max-w-xs">
        Cuando el profe agregue contenido, lo vas a poder seguir desde aquí.
      </p>
      <button
        type="button"
        onClick={onBack}
        className="bg-titi-yellow text-titi-dark font-bold text-base px-6 py-3 rounded-xl shadow-[0_4px_0px_#E6B800] hover:shadow-[0_2px_0px_#E6B800] hover:-translate-y-0.5 active:shadow-none active:translate-y-0 transition-all duration-150"
      >
        Volver al detalle del curso
      </button>
    </div>
  );
}

// ---- Spinner ----
function Spinner() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="w-12 h-12 border-4 border-titi-yellow-light border-t-titi-yellow rounded-full animate-spin" />
      <p className="text-sm font-semibold text-gray-400">Cargando curso…</p>
    </div>
  );
}

// ---- Normaliza videoUrl (YouTube watch/shortlink → embed) ----
function normalizeVideoUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (
      (u.hostname === 'www.youtube.com' || u.hostname === 'youtube.com') &&
      u.pathname === '/watch'
    ) {
      const v = u.searchParams.get('v');
      if (v) return `https://www.youtube.com/embed/${v}`;
    }
    if (u.hostname === 'youtu.be') {
      const v = u.pathname.slice(1);
      if (v) return `https://www.youtube.com/embed/${v}`;
    }
    return url;
  } catch {
    return url;
  }
}
