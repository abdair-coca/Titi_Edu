import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useGamification } from '../context/GamificationContext.jsx';
import LessonComments from '../components/LessonComments.jsx';
import StreakToast from '../components/StreakToast.jsx';
import AchievementToast from '../components/AchievementToast.jsx';
import EvaluationQuiz from '../components/EvaluationQuiz.jsx';
import { resolveMediaUrl } from '../lib/format.js';
import { usePopIn, useStaggerReveal } from '../lib/motion.js';

export default function LearnCourse() {
  const { id: courseId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, updateUser } = useAuth();
  const { pushGota } = useGamification();

  // Toast de racha
  const [streakToast, setStreakToast] = useState({ shown: false, racha: 0 });

  // Toast de logros desbloqueados + banner de curso completado
  const [achievements, setAchievements] = useState([]);
  const [certBanner, setCertBanner] = useState(null); // { codigoVerif }

  // Evaluación activa (mutuamente excluyente con la lección activa)
  const [activeEvalId, setActiveEvalId] = useState(null);

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

  // Panel lateral derecho abierto: null | 'notas' | 'materiales' | 'comentarios'
  const [sidePanel, setSidePanel] = useState(null);

  // Nota personal de la lección activa
  const [noteText, setNoteText] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);

  // Conteo de comentarios de la lección activa (para "Comentarios (N)")
  const [commentCount, setCommentCount] = useState(0);

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

  // --- Cargar la nota personal de la lección activa ---
  useEffect(() => {
    if (!activeId || !isAuthenticated) {
      setNoteText('');
      setNoteSaved(false);
      return;
    }
    let cancelled = false;
    setNoteSaved(false);
    client
      .get(`/api/lessons/${activeId}/note`)
      .then(({ data }) => {
        if (cancelled) return;
        if (data?.success) setNoteText(data.data?.nota?.texto || '');
      })
      .catch(() => {
        // Silencioso — si falla, el textarea queda vacío.
      });
    return () => {
      cancelled = true;
    };
  }, [activeId, isAuthenticated]);

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

  // --- Lecciones en orden plano (para "Siguiente lección") ---
  const orderedLessons = useMemo(
    () => curso?.modulos?.flatMap((m) => m.lecciones || []) || [],
    [curso],
  );
  const currentIndex = orderedLessons.findIndex((l) => l.id === activeId);
  const nextLesson =
    currentIndex >= 0 ? orderedLessons[currentIndex + 1] : null;
  const hasNext = Boolean(nextLesson || curso?.evaluacionFinal);

  // Entrada escalonada de los módulos del índice lateral al cargar el curso.
  // Dep = nº de módulos (primitivo, estable). Ver motion.md §5.
  const lessonNavRef = useStaggerReveal([curso?.modulos?.length]);

  // --- Handlers ---
  const handleSelectLesson = (lessonId) => {
    setActiveId(lessonId);
    setActiveEvalId(null);
    setCompleteError(null);
    setDrawerOpen(false);
  };

  const handleSelectEval = (evalId) => {
    setActiveEvalId(evalId);
    setCompleteError(null);
    setDrawerOpen(false);
  };

  const handleNext = () => {
    if (nextLesson) handleSelectLesson(nextLesson.id);
    else if (curso?.evaluacionFinal) handleSelectEval(curso.evaluacionFinal.id);
  };

  const handleNoteChange = (v) => {
    setNoteText(v);
    setNoteSaved(false);
  };

  const handleSaveNote = async () => {
    if (!activeId) return;
    setNoteSaving(true);
    setNoteSaved(false);
    try {
      const { data } = await client.put(`/api/lessons/${activeId}/note`, {
        texto: noteText,
      });
      if (data?.success) setNoteSaved(true);
    } catch {
      // Silencioso — el textarea conserva el texto para reintentar.
    } finally {
      setNoteSaving(false);
    }
  };

  // Procesa racha / logros / curso completado que devuelven complete y attempt
  const handleProgressEvents = (d) => {
    if (d?.gotas > 0) pushGota(d.gotas);
    const r = d?.racha;
    if (r) {
      updateUser({ racha: r.racha });
      if (r.subio) setStreakToast({ shown: true, racha: r.racha });
    }
    if (d?.logros?.length) {
      setAchievements(d.logros);
    }
    if (d?.cursoCompletado?.nuevo) {
      setCertBanner({ codigoVerif: d.cursoCompletado.certificado?.codigoVerif });
    }
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
        handleProgressEvents(data.data);
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
    <div className="flex min-h-screen md:min-h-0 md:h-[calc(100vh-1.5rem)] md:overflow-hidden bg-titi-cream md:gap-3">
      <StreakToast
        shown={streakToast.shown}
        racha={streakToast.racha}
        onDone={() => setStreakToast({ shown: false, racha: 0 })}
      />
      <AchievementToast
        logros={achievements}
        onDone={() => setAchievements([])}
      />
      {/* === Sidebar de lecciones (desktop) + drawer (móvil) === */}
      <aside
        className={`
          w-72 bg-white border-r border-gray-100 flex flex-col
          fixed top-14 bottom-16 left-0 z-40 overflow-y-auto scrollbar-none
          transition-transform duration-200
          ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}
          md:static md:inset-auto md:h-full md:transform-none
          md:border-r-0 md:border md:border-gray-100 md:rounded-2xl
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

          {/* Progreso del curso */}
          <div className="mt-4">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
              Progreso del curso
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-titi-yellow rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="text-xs font-bold text-gray-400 tabular-nums">
                {progressPct}%
              </span>
            </div>
          </div>
        </div>

        {/* Lista de módulos + lecciones */}
        <nav ref={lessonNavRef} className="flex-1 py-2">
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
                  {modulo.evaluacion && (
                    <li>
                      <button
                        type="button"
                        onClick={() => handleSelectEval(modulo.evaluacion.id)}
                        className={[
                          'w-full text-left px-4 py-2.5 flex items-center gap-3 cursor-pointer text-sm font-semibold hover:bg-titi-cream transition-colors',
                          modulo.evaluacion.id === activeEvalId
                            ? 'bg-purple-50 text-titi-dark border-l-2 border-titi-achievement'
                            : 'text-titi-achievement',
                        ].join(' ')}
                      >
                        <span className="text-base shrink-0" aria-hidden="true">📝</span>
                        <span className="line-clamp-2 flex-1">{modulo.evaluacion.titulo}</span>
                      </button>
                    </li>
                  )}
                </ul>
              </div>
            ))
          )}
          {curso.evaluacionFinal && (
            <div className="mt-2 border-t border-gray-100 pt-2">
              <button
                type="button"
                onClick={() => handleSelectEval(curso.evaluacionFinal.id)}
                className={[
                  'w-full text-left px-4 py-3 flex items-center gap-3 cursor-pointer text-sm font-bold hover:bg-titi-cream transition-colors',
                  curso.evaluacionFinal.id === activeEvalId
                    ? 'bg-purple-50 text-titi-dark border-l-2 border-titi-achievement'
                    : 'text-titi-achievement',
                ].join(' ')}
              >
                <span className="text-base shrink-0" aria-hidden="true">🏁</span>
                <span className="line-clamp-2 flex-1">{curso.evaluacionFinal.titulo}</span>
              </button>
            </div>
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

      {/* === Centro + columna derecha === */}
      <div className="flex-1 flex flex-col lg:flex-row min-w-0 min-h-0 md:h-full lg:gap-3">
        <main className="flex-1 p-3 sm:p-4 md:p-5 overflow-y-auto scrollbar-none min-w-0 min-h-0">
          <div className="max-w-5xl mx-auto">
            {/* Toggle del drawer en móvil */}
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="md:hidden mb-4 w-full text-sm font-semibold text-titi-dark bg-white border border-gray-200 rounded-xl px-4 py-3 hover:bg-gray-50 transition-colors inline-flex items-center gap-2 justify-center"
            >
              ☰ Ver lecciones ({completedCount}/{totalLessons})
            </button>

            {certBanner && (
              <CertificateBanner onClose={() => setCertBanner(null)} />
            )}

            {activeEvalId ? (
              <EvaluationQuiz
                key={activeEvalId}
                evaluationId={activeEvalId}
                onResult={handleProgressEvents}
              />
            ) : activeLesson ? (
              <LessonView
                key={activeLesson.id}
                leccion={activeLesson}
                completed={completed.has(activeLesson.id)}
                completing={completing}
                completeError={completeError}
                onComplete={handleComplete}
                hasNext={hasNext}
                onNext={handleNext}
                onSaveNote={() => setSidePanel('notas')}
              />
            ) : (
              <EmptyLessonState
                onBack={() => navigate(`/courses/${courseId}`)}
              />
            )}
          </div>
        </main>

        {/* Columna derecha — riel de íconos + panel (solo en vista de lección) */}
        {activeLesson && !activeEvalId && (
          <LessonSidePanels
            open={sidePanel}
            onChange={setSidePanel}
            lessonId={activeLesson.id}
            materiales={materialsByLesson[activeLesson.id]}
            noteText={noteText}
            onNoteChange={handleNoteChange}
            onNoteSave={handleSaveNote}
            noteSaving={noteSaving}
            noteSaved={noteSaved}
            commentCount={commentCount}
            onCommentCount={setCommentCount}
          />
        )}
      </div>
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

function LessonView({ leccion, completed, completing, completeError, onComplete, hasNext, onNext, onSaveNote }) {
  const videoEmbed = useMemo(
    () => normalizeVideoUrl(leccion.videoUrl),
    [leccion.videoUrl],
  );
  // Descripción colapsada por defecto (se despliega a pedido).
  const [showDesc, setShowDesc] = useState(false);
  // Pop al cambiar de lección (también remonta por key en el padre). Ver motion.md §5.
  const articleRef = usePopIn([leccion.id]);

  return (
    <article ref={articleRef}>
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

      <div className="flex items-start justify-between gap-3 mb-3">
        <h1 className="text-xl sm:text-2xl font-bold text-titi-dark">
          {leccion.titulo}
        </h1>
        <button
          type="button"
          onClick={onSaveNote}
          className="shrink-0 inline-flex items-center gap-1.5 text-sm font-semibold text-titi-dark hover:text-titi-yellow-dark transition-colors"
        >
          <BookmarkIcon className="w-4 h-4" />
          Guardar nota
        </button>
      </div>

      {/* Descripción de la lección — colapsada por defecto, desplegable */}
      {leccion.contenido ? (
        <div className="mb-6">
          <button
            type="button"
            onClick={() => setShowDesc((s) => !s)}
            aria-expanded={showDesc}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-titi-dark hover:text-titi-yellow-dark transition-colors"
          >
            <span
              className={`text-xs transition-transform duration-200 ${showDesc ? 'rotate-90' : ''}`}
              aria-hidden="true"
            >
              ▶
            </span>
            {showDesc ? 'Ocultar descripción' : 'Ver descripción'}
          </button>
          {/* Colapsable: grid-rows 0fr→1fr + fade, ease neutro (no pop). Ver motion.md §3. */}
          <div
            className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${
              showDesc ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
            }`}
          >
            <div className="overflow-hidden">
              <div
                className={`text-sm sm:text-base text-gray-600 leading-relaxed whitespace-pre-line mt-3 transition-opacity duration-300 ease-out motion-reduce:transition-none ${
                  showDesc ? 'opacity-100' : 'opacity-0'
                }`}
              >
                {leccion.contenido}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-400 font-medium mb-6">Cargando contenido…</p>
      )}

      {/* Profundiza en este tema (chips de IA — stub por ahora) */}
      <DeepenCard />

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

      {/* Fila de acción */}
      <div className="flex flex-wrap items-center gap-3">
        {hasNext && (
          <button
            type="button"
            onClick={onNext}
            className="bg-white text-titi-dark font-semibold text-sm px-5 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-all inline-flex items-center gap-2"
          >
            Siguiente lección →
          </button>
        )}
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
    </article>
  );
}

// ---- Profundiza en este tema (chips de IA — STUB, sin IA real todavía) ----
const DEEPEN_PROMPTS = [
  'Quiero preguntas de práctica',
  'Explica este tema de forma sencilla',
  'Hazme un resumen',
  'Dame ejemplos de la vida real',
];

function DeepenCard() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const respRef = usePopIn([selected]);

  return (
    <section className="bg-titi-yellow-light/60 border border-titi-yellow/40 rounded-2xl mb-6">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 p-4 sm:p-5 text-left"
      >
        <span className="text-base font-bold text-titi-dark flex items-center gap-2">
          <span aria-hidden="true">✨</span> Profundiza en este tema
        </span>
        <span
          className={`text-sm text-titi-dark transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          ▾
        </span>
      </button>

      {/* Colapsable: grid-rows 0fr→1fr + fade, ease neutro (no pop). Ver motion.md §3. */}
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          <div
            className={`px-4 sm:px-5 pb-4 sm:pb-5 transition-opacity duration-300 ease-out motion-reduce:transition-none ${
              open ? 'opacity-100' : 'opacity-0'
            }`}
          >
          <div className="flex flex-wrap gap-2">
            {DEEPEN_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => setSelected(prompt)}
                className={[
                  'text-sm font-semibold px-4 py-2.5 rounded-xl border transition-all duration-150',
                  selected === prompt
                    ? 'bg-titi-yellow text-titi-dark border-titi-yellow'
                    : 'bg-white text-titi-dark border-gray-200 hover:border-titi-yellow hover:bg-titi-cream',
                ].join(' ')}
              >
                {prompt}
              </button>
            ))}
          </div>

          {selected && (
            <div ref={respRef} className="mt-4 bg-white border border-titi-border rounded-xl p-4 flex items-start gap-3">
              <img
                src="/Titi.png"
                alt="Titi"
                className="w-10 h-10 object-contain select-none shrink-0"
                draggable={false}
              />
              <div className="min-w-0">
                <p className="text-sm font-bold text-titi-dark">{selected}</p>
                <p className="text-sm text-gray-500 mt-1">
                  Titi va a responder esto con IA muy pronto. Función en construcción 🛠️
                </p>
              </div>
            </div>
          )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ---- Columna derecha: riel de íconos + panel desplegable ----
const PANELS = [
  { key: 'notas', label: 'Notas', Icon: NoteIcon, title: 'Notas' },
  { key: 'materiales', label: 'Archivos', Icon: FilesIcon, title: 'Materiales' },
  { key: 'comentarios', label: 'Comentarios', Icon: CommentIcon, title: 'Comentarios' },
];

function LessonSidePanels({
  open,
  onChange,
  lessonId,
  materiales,
  noteText,
  onNoteChange,
  onNoteSave,
  noteSaving,
  noteSaved,
  commentCount,
  onCommentCount,
}) {
  const toggle = (key) => onChange(open === key ? null : key);
  const expanded = Boolean(open);
  // Mantener el panel montado durante el cierre para que el colapso anime
  // (si desmontáramos al instante no habría qué animar). displayKey va detrás
  // de `open` al cerrar y se limpia cuando termina la transición.
  const [displayKey, setDisplayKey] = useState(open);
  useEffect(() => {
    if (open) setDisplayKey(open);
  }, [open]);
  const active = PANELS.find((p) => p.key === displayKey);
  const title =
    active?.key === 'comentarios'
      ? `Comentarios (${commentCount})`
      : active?.title;

  return (
    <div className="flex flex-col-reverse lg:flex-row shrink-0 lg:h-full bg-white border border-gray-100 rounded-2xl overflow-hidden">
      {/* Panel colapsable: alto en móvil, ancho en desktop (grid 0fr→1fr + fade),
          ease neutro, no pop. Abre y cierra. Ver motion.md §3. */}
      <div
        onTransitionEnd={(e) => {
          if (e.target === e.currentTarget && !expanded) setDisplayKey(null);
        }}
        className={`grid min-w-0 transition-[grid-template-rows,grid-template-columns] duration-300 ease-out motion-reduce:transition-none ${
          expanded
            ? 'grid-rows-[1fr] lg:grid-cols-[1fr]'
            : 'grid-rows-[0fr] lg:grid-rows-[1fr] lg:grid-cols-[0fr]'
        }`}
      >
        <div className="overflow-hidden min-w-0 min-h-0">
          {active && (
            <div
              className={`w-full lg:w-80 bg-white p-4 sm:p-5 lg:h-full lg:overflow-y-auto scrollbar-none transition-opacity duration-300 ease-out motion-reduce:transition-none ${
                expanded ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-3">
                <h2 className="text-base font-bold text-titi-dark flex items-center gap-2">
                  <active.Icon className="w-4 h-4 text-titi-dark" />
                  {title}
                </h2>
                <button
                  type="button"
                  onClick={() => onChange(null)}
                  className="w-8 h-8 grid place-items-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                  aria-label="Cerrar panel"
                >
                  ✕
                </button>
              </div>

              {displayKey === 'notas' && (
                <NotesPanel
                  value={noteText}
                  onChange={onNoteChange}
                  onSave={onNoteSave}
                  saving={noteSaving}
                  saved={noteSaved}
                />
              )}
              {displayKey === 'materiales' && <MaterialsPanel materiales={materiales} />}
              {displayKey === 'comentarios' && (
                <LessonComments lessonId={lessonId} hideHeader onCount={onCommentCount} />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Riel de íconos */}
      <nav className={`flex lg:flex-col gap-1 p-2 bg-white lg:w-24 lg:h-full shrink-0 justify-center lg:justify-start ${expanded ? 'lg:border-l border-gray-100' : ''}`}>
        {PANELS.map(({ key, label, Icon }) => {
          const isOpen = open === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggle(key)}
              aria-pressed={isOpen}
              className={[
                'flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl transition-colors w-full',
                isOpen
                  ? 'bg-titi-yellow-light text-titi-dark'
                  : 'text-gray-500 hover:bg-titi-cream hover:text-titi-dark',
              ].join(' ')}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[11px] font-semibold leading-none">{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function NotesPanel({ value, onChange, onSave, saving, saved }) {
  return (
    <div>
      <p className="text-xs text-gray-400 font-medium mb-2">
        Tus apuntes personales de esta lección.
      </p>
      <textarea
        rows={6}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={5000}
        placeholder="Escribí tus apuntes…"
        className="titi-input resize-none text-sm"
      />
      <div className="flex items-center justify-between mt-2">
        <span className="text-[11px] font-semibold text-green-500">
          {saved ? 'Guardado ✓' : ''}
        </span>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="bg-titi-yellow text-titi-dark font-bold text-sm px-4 py-2 rounded-xl shadow-[0_3px_0px_#E6B800] hover:shadow-[0_1px_0px_#E6B800] hover:-translate-y-0.5 active:shadow-none active:translate-y-0 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </div>
  );
}

function MaterialsPanel({ materiales }) {
  return (
    <div>
      <p className="text-xs text-gray-400 font-medium mb-3">
        Recursos descargables de la lección.
      </p>
      {materiales === undefined ? (
        <p className="text-xs text-gray-400 font-medium">Cargando…</p>
      ) : materiales.length > 0 ? (
        <div className="flex flex-col gap-2">
          {materiales.map((m) => (
            <MaterialChip key={m.id} material={m} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400 font-medium">
          No hay materiales disponibles por el momento.
        </p>
      )}
    </div>
  );
}

// ---- Íconos de línea (riel + guardar nota) ----
function NoteIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function FilesIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

function CommentIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />
    </svg>
  );
}

function BookmarkIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z" />
    </svg>
  );
}

// ---- Banner de curso completado con certificado ----
function CertificateBanner({ onClose }) {
  return (
    <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 p-4 sm:p-5 pr-10 mb-6 bg-titi-yellow-light border-2 border-titi-yellow rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
      <img
        src="/Titi.png"
        alt="Titi"
        className="w-14 h-14 sm:w-16 sm:h-16 object-contain select-none shrink-0"
        draggable={false}
      />
      <div className="min-w-0 flex-1 w-full">
        <p className="text-base sm:text-lg font-extrabold text-titi-dark leading-tight">
          ¡Curso completado! 🎓
        </p>
        <p className="text-sm font-semibold text-gray-600 mt-0.5">
          Tu certificado está listo y tiene código de verificación único.
        </p>
        <Link
          to="/certificates"
          className="inline-block mt-2 bg-titi-yellow text-titi-dark font-bold text-sm px-4 py-2 rounded-xl shadow-[0_3px_0px_#E6B800] hover:shadow-[0_1px_0px_#E6B800] hover:-translate-y-0.5 active:shadow-none active:translate-y-0 transition-all duration-150"
        >
          Ver mi certificado
        </Link>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        className="absolute top-2 right-2 w-8 h-8 grid place-items-center rounded-full text-gray-500 hover:text-gray-700 hover:bg-titi-yellow/30 text-lg font-bold transition-colors"
      >
        ✕
      </button>
    </div>
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
