import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useGamification } from '../context/GamificationContext.jsx';
import TitiMascot from '../components/TitiMascot.jsx';
import StreakToast from '../components/StreakToast.jsx';
import AchievementToast from '../components/AchievementToast.jsx';
import { resolveMediaUrl } from '../lib/format.js';
import {
  clearLessonDetailCache,
  invalidateLessonDetail,
  requestLessonDetail,
} from '../lib/lesson-cache.js';
import { requestLessonComments } from '../lib/lesson-comments-cache.js';
import { useTutorAvailability } from '../hooks/useTutorAvailability.js';
import { sanitizeMarkdownUrl } from '../lib/markdown.js';
import { usePopIn, useStaggerReveal } from '../lib/motion.js';
import { markPerformance } from '../lib/performance.js';
import {
  FileIcon,
  PencilIcon,
  ImageIcon,
  CodeIcon,
  ClipIcon,
  AwardIcon,
  SparklesIcon,
} from '../components/icons.jsx';

// Los paneles y renderizadores pesados no forman parte del primer chunk de
// LearnCourse. Se cargan en el momento justo y se pueden precargar cuando el
// estudiante expresa intención (hover/focus/click), sin cambiar la UI.
const loadLessonComments = () => import('../components/LessonComments.jsx');
const loadEvaluationQuiz = () => import('../components/EvaluationQuiz.jsx');
const loadMarkdownContent = () => import('../components/MarkdownContent.jsx');
const loadHtmlLessonPlayer = () => import('../components/HtmlLessonPlayer.jsx');
const loadTutorPanel = () => import('../components/TutorPanel.jsx');

const LessonComments = lazy(loadLessonComments);
const EvaluationQuiz = lazy(loadEvaluationQuiz);
const MarkdownContent = lazy(loadMarkdownContent);
const HtmlLessonPlayer = lazy(loadHtmlLessonPlayer);
const TutorPanel = lazy(loadTutorPanel);

const PANEL_PRELOADERS = {
  tutor: loadTutorPanel,
  comentarios: loadLessonComments,
};

function preloadLearnModule(loader) {
  loader().catch(() => {});
}

function preloadLearnPanel(key) {
  const loader = PANEL_PRELOADERS[key];
  if (loader) preloadLearnModule(loader);
}

export default function LearnCourse() {
  const { id: courseId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const paramLessonId = searchParams.get('lessonId');
  const paramComments = searchParams.get('comments');
  const { isAuthenticated, updateUser, user } = useAuth();
  const { pushGota } = useGamification();
  const userCacheKey = user?.id || user?.neoId || user?.email || 'anonymous';
  const previousCacheUserRef = useRef(userCacheKey);

  // Toast de racha
  const [streakToast, setStreakToast] = useState({ shown: false, racha: 0 });

  // Toast de logros desbloqueados + banner de curso completado
  const [achievements, setAchievements] = useState([]);
  const [certBanner, setCertBanner] = useState(null); // { certificado }

  // Evaluación activa (mutuamente excluyente con la lección activa)
  const [activeEvalId, setActiveEvalId] = useState(null);

  const [curso, setCurso] = useState(null);
  const [loading, setLoading] = useState(true);
  const [progressLoading, setProgressLoading] = useState(true);
  const [error, setError] = useState(null);
  // 403 al pedir contenido real (no inscripto, curso visto solo por el temario trimeado)
  const [accessDenied, setAccessDenied] = useState(false);

  // IDs de lecciones completadas
  const [completed, setCompleted] = useState(() => new Set());
  const [newLessons, setNewLessons] = useState(() => new Set());
  const [baseProgress, setBaseProgress] = useState(null);

  // Detalle de la lección activa (contenido + materiales).
  // El resumen del curso sigue siendo la fuente de navegación del sidebar;
  // la caché/deduplicación entre lecciones queda para la Fase 3.
  const [activeLessonDetail, setActiveLessonDetail] = useState(null);

  // Lección activa
  const [activeId, setActiveId] = useState(null);

  // UI state al marcar como completada
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState(null);
  const [activeHtmlEvaluable, setActiveHtmlEvaluable] = useState(null);
  const [activeHtmlDeadlineExpired, setActiveHtmlDeadlineExpired] = useState(false);

  // Mobile: drawer de lecciones abierto
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Panel lateral derecho abierto: null | 'notas' | 'materiales' | 'comentarios'
  const [sidePanel, setSidePanel] = useState(null);
  const [tutorSettingsOpen, setTutorSettingsOpen] = useState(false);

  // Nota personal de la lección activa
  const [noteText, setNoteText] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);

  // Conteo de comentarios de la lección activa (para "Comentarios (N)")
  const [commentCount, setCommentCount] = useState(0);

  // Conversaciones del Tutor IA por lección (el backend es stateless: la
  // conversación vive acá, keyed por lección para no mezclarlas).
  const [tutorConvos, setTutorConvos] = useState({});
  // Estado efímero del ciclo práctica → respuesta → feedback, keyed por lección.
  const [tutorPractice, setTutorPractice] = useState({});
  const previousTutorLessonRef = useRef(null);

  const appendTutorMessages = (lessonId, msgs) => {
    setTutorConvos((prev) => ({
      ...prev,
      [lessonId]: [...(prev[lessonId] || []), ...msgs],
    }));
  };

  const resetTutorConversation = (lessonId) => {
    setTutorConvos((prev) => ({ ...prev, [lessonId]: [] }));
    setTutorPractice((prev) => {
      if (!prev[lessonId]) return prev;
      const next = { ...prev };
      delete next[lessonId];
      return next;
    });
  };

  const setTutorPracticeForLesson = (lessonId, state) => {
    setTutorPractice((prev) => {
      const next = { ...prev };
      if (state) next[lessonId] = state;
      else delete next[lessonId];
      return next;
    });
  };

  useEffect(() => {
    const previousLessonId = previousTutorLessonRef.current;
    if (previousLessonId && previousLessonId !== activeId) {
      setTutorPractice((prev) => {
        if (!prev[previousLessonId]) return prev;
        const next = { ...prev };
        delete next[previousLessonId];
        return next;
      });
    }
    previousTutorLessonRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    if (previousCacheUserRef.current !== userCacheKey) {
      clearLessonDetailCache();
      previousCacheUserRef.current = userCacheKey;
    }
  }, [userCacheKey]);

  useEffect(() => {
    markPerformance('learn:start', courseId);
  }, [courseId]);

  useEffect(() => {
    if (curso && !loading) markPerformance('learn:shell-ready', courseId);
  }, [courseId, curso, loading]);

  // --- Fetch del curso y progreso en paralelo, sin bloquear el shell ---
  useEffect(() => {
    if (!courseId) return;
    let cancelled = false;
    setLoading(true);
    setProgressLoading(Boolean(isAuthenticated));
    setError(null);

    const applyCourse = (detailRes) => {
        if (cancelled) return;
        const d = detailRes.data;
        if (!d?.success) {
          setError(d?.message || 'No se pudo cargar el curso');
          return;
        }
        const c = d.data?.curso;
        setCurso(c);

        // Activar la lección indicada en query param o la primera por defecto
        const targetLessonId =
          paramLessonId && c?.modulos?.some((m) => m.lecciones?.some((l) => l.id === paramLessonId))
            ? paramLessonId
            : c?.modulos?.[0]?.lecciones?.[0]?.id;
        if (targetLessonId) {
          setActiveId(targetLessonId);
          if (paramLessonId !== targetLessonId) {
            const nextParams = new URLSearchParams(searchParams);
            nextParams.set('lessonId', targetLessonId);
            setSearchParams(nextParams, { replace: true });
          }
        }
        if (paramComments === 'true') setSidePanel('comentarios');
    };

    const applyProgress = (progressRes) => {
        if (cancelled) return;
        // Aplicar progreso (set de leccionIds completadas)
        const p = progressRes?.data;
        if (p?.success) {
          const completedIds = new Set();
          (p.data?.modulos || []).forEach((m) =>
            (m.lecciones || []).forEach((l) => {
              if (l.completada) completedIds.add(l.id);
            }),
          );
          setCompleted(completedIds);
          const newIds = new Set();
          (p.data?.modulos || []).forEach((m) => (m.lecciones || []).forEach((l) => { if (l.esNueva) newIds.add(l.id); }));
          setNewLessons(newIds);
          setBaseProgress(p.data);
        }
    };

    client
      .get(`/api/courses/${courseId}`)
      .then(applyCourse)
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

    if (isAuthenticated) {
      client
        .get(`/api/courses/${courseId}/progress`)
        .then(applyProgress)
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setProgressLoading(false);
        });
    } else {
      setProgressLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [courseId, isAuthenticated]);

  // Si cambia el query param (ej. navegando desde notificaciones o atrás/adelante)
  useEffect(() => {
    if (!curso) return;
    const urlLesson = curso.modulos
      ?.flatMap((modulo) => modulo.lecciones || [])
      .find((lesson) => lesson.id === paramLessonId);
    const targetLessonId = urlLesson?.id || curso.modulos?.[0]?.lecciones?.[0]?.id;
    if (targetLessonId && targetLessonId !== activeId) {
      setActiveId(targetLessonId);
      setActiveEvalId(null);
      setActiveHtmlEvaluable(null);
      setActiveHtmlDeadlineExpired(false);
      setCompleteError(null);
    }
    if (paramComments === 'true') {
      setSidePanel('comentarios');
    }
  }, [curso, paramLessonId, paramComments, activeId]);

  // --- Módulo de la lección activa ---
  const activeModulo = useMemo(() => {
    if (!curso || !activeId) return null;
    return (
      curso.modulos?.find((m) =>
        m.lecciones?.some((l) => l.id === activeId),
      ) || null
    );
  }, [curso, activeId]);

  // --- Cargar únicamente el detalle de la lección activa ---
  useEffect(() => {
    if (!activeId) {
      setActiveLessonDetail(null);
      return;
    }
    let cancelled = false;
    setActiveLessonDetail(null);
    setAccessDenied(false);
    if (!isAuthenticated) return undefined;

    const request = requestLessonDetail({
      userKey: userCacheKey,
      courseId,
      lessonId: activeId,
    });
    request.promise
      .then((lesson) => {
        if (!cancelled && lesson) setActiveLessonDetail(lesson);
      })
      .catch((err) => {
        if (cancelled) return;
        // 403 = no inscripto: no hay contenido real que mostrar, cortamos con
        // una pantalla dedicada en vez de dejar "Cargando contenido…" colgado.
        if (err.response?.status === 403) setAccessDenied(true);
      });
    return () => {
      cancelled = true;
      request.release();
    };
  }, [activeId, courseId, isAuthenticated, userCacheKey]);

  // --- Lección activa (detalle completo o resumen mientras carga) ---
  const activeLesson = useMemo(() => {
    if (!activeId) return null;
    if (activeLessonDetail?.id === activeId) return activeLessonDetail;
    return curso?.modulos
      ?.flatMap((modulo) => modulo.lecciones || [])
      .find((lesson) => lesson.id === activeId) || null;
  }, [curso, activeId, activeLessonDetail]);

  useEffect(() => {
    if (activeLesson && Object.prototype.hasOwnProperty.call(activeLesson, 'contenido')) {
      markPerformance('learn:lesson-ready', activeLesson.id);
    }
  }, [activeLesson]);

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
  const currentPosition = currentIndex >= 0 ? currentIndex + 1 : 0;
  const nextLesson =
    currentIndex >= 0 ? orderedLessons[currentIndex + 1] : null;
  const hasNext = Boolean(nextLesson || curso?.evaluacionFinal);
  const activeLessonReady = Boolean(
    activeLesson && Object.prototype.hasOwnProperty.call(activeLesson, 'contenido'),
  );

  // El aviso comparte la misma consulta/cache que TutorPanel. Solo se consulta
  // cuando el detalle de la lección ya está listo, evitando otra petición en
  // el primer paint o para usuarios sin acceso al contenido.
  const tutorAvailabilityEnabled = Boolean(
    isAuthenticated
      && user?.rol === 'ESTUDIANTE'
      && activeLessonReady
      && !activeEvalId
      && !accessDenied,
  );
  const {
    status: tutorAvailability,
    loading: tutorAvailabilityLoading,
  } = useTutorAvailability(activeLesson?.id || null, { enabled: tutorAvailabilityEnabled });
  const tutorCredential = tutorAvailability?.credential || null;
  const tutorCredentialRequired = tutorAvailability?.credential?.required !== false;
  const tutorLessonAvailable = Boolean(tutorAvailability?.enabled && tutorAvailability?.indexed);
  const tutorCredentialInvalid = tutorCredential?.status === 'INVALID';
  const showTutorKeyNotice = Boolean(
    tutorAvailabilityEnabled
      && tutorAvailability
      && !tutorAvailabilityLoading
      && tutorLessonAvailable
      && tutorCredentialRequired
      && tutorCredential?.status !== 'VALID',
  );

  // La siguiente lección se prepara en idle, después de pintar la actual.
  // Si el estudiante navega mientras la petición está pendiente, la petición
  // se deduplica con la carga activa y no se bloquea el contenido visible.
  useEffect(() => {
    if (!activeLessonReady || !nextLesson || activeEvalId || !isAuthenticated) return undefined;
    let request = null;
    let settled = false;
    const startPrefetch = () => {
      request = requestLessonDetail({
        userKey: userCacheKey,
        courseId,
        lessonId: nextLesson.id,
      });
      request.promise
        .catch(() => {})
        .finally(() => {
          settled = true;
          request.release();
        });
    };
    const canScheduleIdle = typeof window !== 'undefined' && Boolean(window.requestIdleCallback);
    const scheduleId = canScheduleIdle
      ? window.requestIdleCallback(startPrefetch, { timeout: 1000 })
      : setTimeout(startPrefetch, 250);

    return () => {
      if (canScheduleIdle && window.cancelIdleCallback) {
        window.cancelIdleCallback(scheduleId);
      } else clearTimeout(scheduleId);
      if (request && !settled) request.release();
    };
  }, [activeLessonReady, activeLesson?.id, activeEvalId, courseId, isAuthenticated, nextLesson?.id, userCacheKey]);

  // Los comentarios se precargan en idle para que abrir el panel sea inmediato,
  // sin competir con el contenido principal de la lección.
  useEffect(() => {
    if (!activeLessonReady || !activeId || !isAuthenticated) return undefined;
    let request = null;
    let settled = false;
    const startPrefetch = () => {
      request = requestLessonComments({ userKey: userCacheKey, lessonId: activeId });
      request.promise
        .catch(() => {})
        .finally(() => {
          settled = true;
          request.release();
        });
    };
    const canScheduleIdle = typeof window !== 'undefined' && Boolean(window.requestIdleCallback);
    const scheduleId = canScheduleIdle
      ? window.requestIdleCallback(startPrefetch, { timeout: 1500 })
      : setTimeout(startPrefetch, 400);
    return () => {
      if (canScheduleIdle && window.cancelIdleCallback) window.cancelIdleCallback(scheduleId);
      else clearTimeout(scheduleId);
      if (request && !settled) request.release();
    };
  }, [activeLessonReady, activeId, isAuthenticated, userCacheKey]);

  // Los renderizadores de contenido se descargan después de tener la lección
  // lista. Así el primer paint no compite con Markdown/HTML y el chunk ya está
  // en caché cuando React lo necesita.
  useEffect(() => {
    if (!activeLessonReady || !activeLesson) return;
    preloadLearnModule(loadMarkdownContent);
    if (activeLesson.formatoContenido === 'HTML') preloadLearnModule(loadHtmlLessonPlayer);
  }, [activeLessonReady, activeLesson?.id, activeLesson?.formatoContenido]);

  // Entrada escalonada de los módulos del índice lateral al cargar el curso.
  // Dep = nº de módulos (primitivo, estable). Ver motion.md §5.
  const lessonNavRef = useStaggerReveal([curso?.modulos?.length]);

  // --- Handlers ---
  const handleSelectLesson = (lessonId) => {
    setActiveId(lessonId);
    setActiveEvalId(null);
    setTutorSettingsOpen(false);
    setActiveHtmlEvaluable(null);
    setActiveHtmlDeadlineExpired(false);
    setCompleteError(null);
    setDrawerOpen(false);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('lessonId', lessonId);
    setSearchParams(nextParams);
  };

  const handleSelectEval = (evalId) => {
    preloadLearnModule(loadEvaluationQuiz);
    setActiveEvalId(evalId);
    setTutorSettingsOpen(false);
    setActiveHtmlEvaluable(null);
    setActiveHtmlDeadlineExpired(false);
    setCompleteError(null);
    setDrawerOpen(false);
  };

  const handleSidePanelChange = (nextPanel) => {
    setSidePanel(nextPanel);
    if (nextPanel !== 'tutor') setTutorSettingsOpen(false);
  };

  const handleConfigureTutor = () => {
    setTutorSettingsOpen(true);
    setSidePanel('tutor');
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
      if (data?.success) {
        // La nota se guarda en un recurso separado; invalidar el detalle es
        // conservador para no reutilizar una representación potencialmente
        // desactualizada al volver a la lección.
        invalidateLessonDetail({ userKey: userCacheKey, courseId, lessonId: activeId });
        setNoteSaved(true);
      }
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
      setCertBanner({ certificado: d.cursoCompletado.certificado || null });
    }
  };

  const handleComplete = async () => {
    if (!activeId || completed.has(activeId) || completing) return;
    setCompleting(true);
    setCompleteError(null);
    try {
      const { data } = await client.post(`/api/lessons/${activeId}/complete`);
      if (data?.success) {
        invalidateLessonDetail({ userKey: userCacheKey, courseId, lessonId: activeId });
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

  const handleHtmlScoreRecorded = (data) => {
    if (!activeId) return;
    setCompleteError(null);
    invalidateLessonDetail({ userKey: userCacheKey, courseId, lessonId: activeId });
    setCompleted((prev) => {
      const next = new Set(prev);
      next.add(activeId);
      return next;
    });
    handleProgressEvents(data);
  };

  // --- Render: loading ---
  if (loading) {
    return <LearnCourseSkeleton />;
  }

  // --- Render: error ---
  if (error) {
    return (
      <div className="flex min-h-screen bg-titi-cream items-center justify-center p-8">
        <div className="max-w-md w-full bg-red-50 border border-red-200 rounded-xl p-6">
          <div className="flex items-start gap-3 mb-4">
            <span className="w-8 h-8 rounded-full bg-red-500 grid place-items-center shrink-0 text-white text-sm font-black" aria-hidden="true">!</span>
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

  // --- Render: no inscripto (el temario cargó, pero el contenido no) ---
  if (accessDenied) {
    return (
      <div className="flex min-h-screen bg-titi-cream items-center justify-center p-8">
        <div className="max-w-md w-full flex flex-col items-center text-center">
          <TitiMascot state="triste" size="lg" message="" className="mb-4" />
          <h2 className="text-xl font-bold text-titi-dark mb-2">
            Necesitás inscribirte para ver este curso
          </h2>
          <p className="text-sm text-gray-400 mb-6">
            Andá al detalle del curso e inscribite gratis para acceder a las lecciones.
          </p>
          <button
            type="button"
            onClick={() => navigate(`/courses/${courseId}`)}
            className="bg-titi-yellow text-titi-dark font-bold text-base px-6 py-3 rounded-xl shadow-[0_4px_0px_#E6B800] hover:shadow-[0_2px_0px_#E6B800] hover:-translate-y-0.5 active:shadow-none active:translate-y-0 transition-all duration-150"
          >
            Ir al detalle del curso
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen lg:min-h-0 lg:h-[calc(100vh-1.5rem)] lg:overflow-hidden bg-titi-cream lg:gap-3">
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
          fixed top-12 bottom-14 left-0 z-40 overflow-y-auto scrollbar-none
          transition-transform duration-200
          ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:static lg:inset-auto lg:h-full lg:transform-none
          lg:border-r-0 lg:border lg:border-gray-100 lg:rounded-2xl
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
            Lección {currentPosition} de {totalLessons}
            {progressLoading ? (
              <span className="block mt-1.5 h-3 w-24 rounded bg-gray-100 animate-pulse" aria-label="Cargando progreso" />
            ) : (
              <span className="block text-[11px] font-medium text-gray-400 mt-0.5">
                {completedCount} {completedCount === 1 ? 'completada' : 'completadas'}
              </span>
            )}
          </p>

          {/* Progreso del curso */}
          <div className="mt-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
              Progreso del curso
            </p>
            {progressLoading ? (
              <div className="h-2 w-full rounded-full bg-gray-100 animate-pulse" aria-hidden="true" />
            ) : (
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
            )}
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
                  {modulo.lecciones?.map((leccion, index) => {
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
                              {index + 1}
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
                        <AwardIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
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
          className="fixed inset-0 bg-black/30 z-30 lg:hidden"
        />
      )}

      {/* === Centro + columna derecha === */}
      <div className="flex-1 flex flex-col lg:flex-row min-w-0 min-h-0 lg:h-full lg:gap-3">
        <main className="flex-1 p-4 sm:p-5 lg:p-5 overflow-y-auto scrollbar-none min-w-0 min-h-0">
          <div className="max-w-5xl mx-auto">
            {/* Toggle del drawer en móvil */}
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="lg:hidden mb-4 w-full text-sm font-semibold text-titi-dark bg-white border border-gray-200 rounded-xl px-3 py-2.5 hover:bg-gray-50 transition-colors inline-flex items-center justify-between gap-2"
            >
              <span className="inline-flex items-center gap-2">
                <span aria-hidden="true">☰</span>
                <span>Lección · {currentPosition}/{totalLessons}</span>
              </span>
              <span aria-hidden="true" className="text-base leading-none">⌄</span>
            </button>

            {certBanner && (
              <CertificateBanner certificado={certBanner.certificado} onClose={() => setCertBanner(null)} />
            )}

            {showTutorKeyNotice && !activeEvalId && (
              <TutorCredentialBanner
                invalid={tutorCredentialInvalid}
                onConfigure={handleConfigureTutor}
              />
            )}

            {activeEvalId ? (
              <Suspense fallback={<LessonContentSkeleton title="evaluación" />}>
                <EvaluationQuiz
                  key={activeEvalId}
                  evaluationId={activeEvalId}
                  onResult={handleProgressEvents}
                />
              </Suspense>
            ) : activeLesson ? (
              Object.prototype.hasOwnProperty.call(activeLesson, 'contenido') ? (
                <LessonView
                  key={activeLesson.id}
                  leccion={activeLesson}
                  completed={completed.has(activeLesson.id)}
                  completing={completing}
                  completeError={completeError}
                  onComplete={handleComplete}
                  htmlEvaluable={activeHtmlEvaluable}
                  onHtmlEvaluableChange={setActiveHtmlEvaluable}
                  htmlDeadlineExpired={activeHtmlDeadlineExpired}
                  onHtmlDeadlineChange={setActiveHtmlDeadlineExpired}
                  onHtmlScoreRecorded={handleHtmlScoreRecorded}
                  hasNext={hasNext}
                  onNext={handleNext}
                  onSaveNote={() => setSidePanel('notas')}
                />
              ) : (
                <LessonContentSkeleton title={activeLesson.titulo} />
              )
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
            onChange={handleSidePanelChange}
            lessonId={activeLesson.id}
            materiales={activeLesson.materiales || []}
            noteText={noteText}
            onNoteChange={handleNoteChange}
            onNoteSave={handleSaveNote}
            noteSaving={noteSaving}
            noteSaved={noteSaved}
            commentCount={commentCount}
            onCommentCount={setCommentCount}
            onPanelIntent={preloadLearnPanel}
            showTutorNotice={showTutorKeyNotice}
            tutor={{
              lessonId: activeLesson.id,
              cursoTitulo: curso.titulo,
              moduloNumero: (curso.modulos?.findIndex((m) => m.id === activeModulo?.id) ?? -1) + 1,
              moduloTitulo: activeModulo?.titulo,
              leccionTitulo: activeLesson.titulo,
              conversation: tutorConvos[activeLesson.id] || [],
              practiceState: tutorPractice[activeLesson.id] || null,
              onAppendMessages: (msgs) => appendTutorMessages(activeLesson.id, msgs),
              onResetConversation: () => resetTutorConversation(activeLesson.id),
              onPracticeStateChange: (state) => setTutorPracticeForLesson(activeLesson.id, state),
              onNavigateToLesson: handleSelectLesson,
              openSettings: tutorSettingsOpen,
            }}
          />
        )}
      </div>
    </div>
  );
}

// ---- Vista de lección activa ----
const TIPO_ICON = {
  pdf: FileIcon,
  word: PencilIcon,
  imagen: ImageIcon,
  codigo: CodeIcon,
  otro: ClipIcon,
};

function MaterialChip({ material }) {
  const Icon = TIPO_ICON[material.tipo] || ClipIcon;
  const href = material.url?.startsWith('/uploads/')
    ? resolveMediaUrl(material.url)
    : sanitizeMarkdownUrl(material.url);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      download
      className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-titi-dark hover:border-titi-yellow hover:bg-titi-cream transition-all duration-150 max-w-full"
    >
      <Icon className="w-4 h-4 text-gray-500 shrink-0" aria-hidden="true" />
      <span className="truncate">{material.nombre}</span>
      <span className="text-xs text-gray-400 uppercase tracking-wide shrink-0">
        {material.tipo}
      </span>
    </a>
  );
}

function LessonView({ leccion, completed, completing, completeError, onComplete, htmlEvaluable, onHtmlEvaluableChange, htmlDeadlineExpired, onHtmlDeadlineChange, onHtmlScoreRecorded, hasNext, onNext, onSaveNote }) {
  const videoEmbed = useMemo(
    () => normalizeVideoUrl(leccion.videoUrl),
    [leccion.videoUrl],
  );
  // Pop al cambiar de lección (también remonta por key en el padre). Ver motion.md §5.
  const articleRef = usePopIn([leccion.id]);
  const isHtml = leccion.formatoContenido === 'HTML';

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
            sandbox="allow-scripts allow-same-origin allow-presentation"
            referrerPolicy="strict-origin-when-cross-origin"
            className="w-full h-full border-0"
          />
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start justify-between gap-3 mb-3">
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

      {/* Contenido de la lección — se muestra directo, sin toggle. */}
      {leccion.contenido && (
        <Suspense fallback={<LessonBodySkeleton label="Cargando contenido…" />}>
          <MarkdownContent
            content={leccion.contenido}
            format="MARKDOWN"
            className="mb-6"
          />
        </Suspense>
      )}

      {/* Profundiza en este tema (chips de IA — stub por ahora) */}
      {isHtml && (
        <Suspense fallback={<LessonBodySkeleton label="Cargando actividad…" />}>
          <HtmlLessonPlayer
            lessonId={leccion.id}
            title={leccion.titulo}
            onEvaluableChange={onHtmlEvaluableChange}
            onDeadlineChange={onHtmlDeadlineChange}
            onScoreRecorded={onHtmlScoreRecorded}
          />
        </Suspense>
      )}

      {completeError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 mb-4">
          <span className="w-8 h-8 rounded-full bg-red-500 grid place-items-center shrink-0 text-white text-sm font-black" aria-hidden="true">!</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-700">
              No pudimos marcar la lección
            </p>
            <p className="text-xs text-red-500 mt-0.5">{completeError}</p>
          </div>
        </div>
      )}

      {/* Fila de acción */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3">
        {hasNext && (
          <button
            type="button"
            onClick={onNext}
            className={`order-2 lg:order-1 w-full sm:w-auto justify-center bg-white text-titi-dark font-bold text-sm px-5 py-3 rounded-xl border-2 border-gray-200 shadow-[0_4px_0px_#E5E7EB] hover:border-titi-yellow hover:-translate-y-0.5 hover:shadow-[0_6px_0px_#E5E7EB] active:translate-y-0.5 active:shadow-none transition-all duration-150 inline-flex items-center gap-2 ${completed ? 'bg-titi-yellow border-titi-yellow text-titi-dark shadow-[0_4px_0px_#E6B800] lg:bg-white lg:border-gray-200 lg:text-titi-dark lg:shadow-[0_4px_0px_#E5E7EB]' : ''}`}
          >
            <span className="lg:hidden">{completed ? 'Continuar →' : 'Siguiente lección →'}</span>
            <span className="hidden lg:inline">Siguiente lección →</span>
          </button>
        )}
        {completed ? (
          <>
            <span className="order-1 lg:hidden w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-green-50 border border-green-200 px-4 py-2 text-sm font-bold text-green-700">
              <span aria-hidden="true">✓</span>
              Lección completada
            </span>
            <button
              type="button"
              disabled
              className="hidden lg:inline-flex order-2 bg-green-500 text-white font-bold text-base px-6 py-3 rounded-xl shadow-[0_4px_0px_#16A34A] cursor-default items-center gap-2"
            >
              <span aria-hidden="true">✓</span>
              Lección completada
            </button>
          </>
        ) : isHtml && htmlEvaluable !== false ? (
          <p className="order-1 lg:order-2 text-sm font-semibold text-gray-500">
            {htmlEvaluable === null ? 'Preparando la actividad…' : htmlDeadlineExpired ? 'El plazo venció; podés revisar la presentación, pero no enviar nuevos puntajes.' : 'Completá la actividad para registrar tu nota.'}
          </p>
        ) : (
          <button
            type="button"
            onClick={onComplete}
            disabled={completing}
            className="order-1 lg:order-2 w-full sm:w-auto bg-titi-yellow text-titi-dark font-bold text-base px-6 py-3 rounded-xl shadow-[0_4px_0px_#E6B800] hover:shadow-[0_2px_0px_#E6B800] hover:-translate-y-0.5 active:shadow-none active:translate-y-0 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {completing ? 'Marcando…' : 'Marcar como completada'}
          </button>
        )}
      </div>
    </article>
  );
}

function LearnCourseSkeleton() {
  return (
    <div className="flex min-h-screen lg:min-h-0 lg:h-[calc(100vh-1.5rem)] bg-titi-cream lg:gap-3 animate-pulse" role="status" aria-busy="true" aria-label="Cargando curso">
      <aside className="hidden lg:flex w-72 bg-white border border-gray-100 rounded-2xl flex-col p-4 gap-4">
        <div className="h-3 w-16 rounded bg-gray-100" />
        <div className="h-5 w-4/5 rounded bg-gray-100" />
        <div className="h-3 w-2/5 rounded bg-gray-100" />
        <div className="h-2 w-full rounded-full bg-gray-100 mt-3" />
        <div className="space-y-3 mt-3">
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <div key={item} className="h-8 rounded-xl bg-gray-100" />
          ))}
        </div>
      </aside>
      <main className="flex-1 p-4 sm:p-5 lg:p-5 min-w-0">
        <div className="max-w-5xl mx-auto space-y-5">
          <div className="lg:hidden h-10 rounded-xl bg-gray-100" />
          <div className="h-7 w-3/5 rounded bg-gray-100" />
          <div className="h-4 w-2/5 rounded bg-gray-100" />
          <div className="space-y-3 pt-3">
            <div className="h-4 w-full rounded bg-gray-100" />
            <div className="h-4 w-11/12 rounded bg-gray-100" />
            <div className="h-4 w-4/5 rounded bg-gray-100" />
            <div className="h-48 w-full rounded-2xl bg-gray-100 mt-6" />
          </div>
        </div>
      </main>
      <aside className="hidden lg:flex w-24 bg-white border border-gray-100 rounded-2xl flex-col justify-center gap-3 p-3">
        {[0, 1, 2, 3].map((item) => <div key={item} className="h-14 rounded-xl bg-gray-100" />)}
      </aside>
    </div>
  );
}

function LessonContentSkeleton({ title }) {
  return (
    <article className="animate-pulse" aria-busy="true" aria-label="Cargando lección">
      <div className="h-7 w-3/5 rounded bg-gray-100" aria-hidden="true" />
      <div className="h-4 w-2/5 rounded bg-gray-100 mt-3" aria-hidden="true" />
      <div className="space-y-3 mt-8">
        <div className="h-4 w-full rounded bg-gray-100" />
        <div className="h-4 w-11/12 rounded bg-gray-100" />
        <div className="h-4 w-4/5 rounded bg-gray-100" />
        <div className="h-52 w-full rounded-2xl bg-gray-100 mt-6" />
      </div>
      <span className="sr-only">Cargando {title || 'lección'}.</span>
    </article>
  );
}

function TutorCredentialBanner({ invalid, onConfigure }) {
  return (
    <section
      aria-live="polite"
      aria-labelledby="tutor-credential-banner-title"
      className="mb-5 flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-titi-yellow bg-titi-yellow-light px-4 py-3.5 sm:px-5"
    >
      <span className="w-10 h-10 rounded-xl bg-titi-yellow grid place-items-center shrink-0" aria-hidden="true">
        <SparklesIcon className="w-5 h-5 text-titi-dark" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 id="tutor-credential-banner-title" className="text-sm font-extrabold text-titi-dark">
          {invalid ? 'Tu clave necesita reemplazo' : 'Conecta tu clave personal de Groq para usar el Tutor IA'}
        </h2>
        <p className="mt-0.5 text-xs sm:text-sm font-medium text-gray-600">
          {invalid
            ? 'La clave guardada no es válida o fue revocada. Reemplázala para continuar.'
            : 'La clave se valida y se guarda cifrada en tu cuenta; nunca se muestra completa.'}
        </p>
      </div>
      <button
        type="button"
        onClick={onConfigure}
        className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center rounded-xl bg-titi-dark px-4 py-2.5 text-sm font-bold text-white hover:bg-titi-dark/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-titi-dark focus-visible:ring-offset-2 transition-colors"
      >
        Configurar ahora
      </button>
    </section>
  );
}

function LessonBodySkeleton({ label }) {
  return (
    <div className="space-y-3 mb-6 animate-pulse" aria-busy="true" role="status">
      <div className="h-4 w-full rounded bg-gray-100" aria-hidden="true" />
      <div className="h-4 w-11/12 rounded bg-gray-100" aria-hidden="true" />
      <div className="h-4 w-4/5 rounded bg-gray-100" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

function PanelSkeleton({ label = 'Cargando panel…' }) {
  return (
    <div className="space-y-3 animate-pulse" aria-busy="true" role="status">
      <div className="h-4 w-2/3 rounded bg-gray-100" aria-hidden="true" />
      <div className="h-24 w-full rounded-xl bg-gray-100" aria-hidden="true" />
      <div className="h-4 w-5/6 rounded bg-gray-100" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

// ---- Columna derecha: riel de íconos + panel desplegable ----
const PANELS = [
  { key: 'tutor', label: 'Tutor IA', Icon: SparklesIcon, title: 'Tutor IA' },
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
  onPanelIntent,
  showTutorNotice,
  tutor,
}) {
  const toggle = (key) => onChange(open === key ? null : key);
  const isTutor = open === 'tutor';
  const mobileTutorRef = useRef(null);
  // El grid colapsable solo gobierna Notas/Materiales/Comentarios. El tutor
  // vive en overlays propios (panel lateral md+, bottom-sheet móvil).
  const gridOpen = !isTutor ? open : null;
  const expanded = Boolean(gridOpen);
  // Mantener el panel montado durante el cierre para que el colapso anime
  // (si desmontáramos al instante no habría qué animar). displayKey va detrás
  // de `gridOpen` al cerrar y se limpia cuando termina la transición.
  const [displayKey, setDisplayKey] = useState(gridOpen);
  useEffect(() => {
    if (gridOpen) setDisplayKey(gridOpen);
  }, [gridOpen]);
  useEffect(() => {
    if (!isTutor || !window.matchMedia('(max-width: 767px)').matches) return undefined;
    const previousFocus = document.activeElement;
    const frame = requestAnimationFrame(() => {
      mobileTutorRef.current?.querySelector('button, input, textarea, a[href]')?.focus();
    });
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onChange(null);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(mobileTutorRef.current?.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), a[href]',
      ) || []).filter((element) => element.getClientRects().length > 0);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus?.();
    };
  }, [isTutor, onChange]);
  const active = PANELS.find((p) => p.key === displayKey);
  const title =
    active?.key === 'comentarios'
      ? `Comentarios (${commentCount})`
      : active?.title;

  return (
    <>
      {/* Tutor IA — panel lateral flotante (md+): no reorganiza el layout, el
          contenido principal queda estable. Ancho adaptado (22rem) en tablet,
          26rem en desktop. */}
      {isTutor && (
        <div
          id="lesson-panel-tutor"
          role="tabpanel"
          aria-labelledby="lesson-tab-tutor"
          className="fixed inset-y-0 right-0 z-50 hidden md:flex flex-col w-[22rem] lg:w-[26rem] bg-white border-l border-gray-100 shadow-[-8px_0_30px_rgba(0,0,0,0.12)] titi-sheet-right"
        >
          <Suspense fallback={<PanelSkeleton label="Cargando Tutor IA…" />}>
            <TutorPanel {...tutor} titleId="tutor-panel-title-desktop" onClose={() => onChange(null)} />
          </Suspense>
        </div>
      )}

      {/* Tutor IA — bottom-sheet a pantalla casi completa (móvil < md) */}
      {isTutor && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            aria-hidden="true"
            onClick={() => onChange(null)}
            className="absolute inset-0 bg-black/30 titi-backdrop-in"
          />
          <div
            ref={mobileTutorRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="tutor-panel-title-mobile"
            className="absolute inset-x-0 bottom-0 h-[92vh] bg-white rounded-t-2xl flex flex-col overflow-hidden shadow-[0_-8px_30px_rgba(0,0,0,0.12)] titi-sheet-in"
          >
            <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mt-2 shrink-0" />
            <Suspense fallback={<PanelSkeleton label="Cargando Tutor IA…" />}>
              <TutorPanel {...tutor} titleId="tutor-panel-title-mobile" onClose={() => onChange(null)} />
            </Suspense>
          </div>
        </div>
      )}

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
                id={`lesson-panel-${displayKey}`}
                role="tabpanel"
                aria-labelledby={`lesson-tab-${displayKey}`}
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
                  <Suspense fallback={<PanelSkeleton label="Cargando comentarios…" />}>
                    <LessonComments lessonId={lessonId} hideHeader onCount={onCommentCount} />
                  </Suspense>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Riel de íconos */}
        <nav
          role="tablist"
          aria-label="Recursos de la lección"
          className={`grid grid-cols-4 lg:flex lg:flex-col gap-1 p-2 bg-white lg:w-24 lg:h-full shrink-0 justify-center lg:justify-start ${expanded ? 'lg:border-l border-gray-100' : ''}`}
        >
          {PANELS.map(({ key, label, Icon }) => {
            const isOpen = open === key;
            const needsTutorKey = key === 'tutor' && showTutorNotice;
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggle(key)}
                onFocus={() => onPanelIntent?.(key)}
                onMouseEnter={() => onPanelIntent?.(key)}
                id={`lesson-tab-${key}`}
                role="tab"
                aria-selected={isOpen}
                aria-controls={`lesson-panel-${key}`}
                className={[
                  'relative flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl transition-colors w-full',
                  isOpen
                    ? 'bg-titi-yellow-light text-titi-dark border-b-2 border-titi-yellow lg:border-b-0'
                    : 'text-gray-500 hover:bg-titi-cream hover:text-titi-dark',
                ].join(' ')}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-semibold leading-none">{label}</span>
                {needsTutorKey && (
                  <>
                    <span
                      className="absolute right-2 top-2 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white"
                      aria-hidden="true"
                    />
                    <span className="sr-only">Requiere configurar una clave de Groq</span>
                  </>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </>
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
        <span className="text-xs font-semibold text-green-500">
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
function CertificateBanner({ certificado, onClose }) {
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
          {certificado
            ? 'Tu certificado esta listo y tiene codigo de verificacion unico.'
            : 'Completaste todos los requisitos. Este curso no emite certificado.'}
        </p>
        {certificado && (
          <Link
            to="/certificates"
            className="inline-block mt-2 bg-titi-yellow text-titi-dark font-bold text-sm px-4 py-2 rounded-xl shadow-[0_3px_0px_#E6B800] hover:shadow-[0_1px_0px_#E6B800] hover:-translate-y-0.5 active:shadow-none active:translate-y-0 transition-all duration-150"
          >
            Ver mi certificado
          </Link>
        )}
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

// ---- Normaliza videoUrl (YouTube watch/shortlink → embed) ----
function normalizeVideoUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' || u.username || u.password) return null;
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
    if ((u.hostname === 'vimeo.com' || u.hostname === 'www.vimeo.com') && /^\/\d+$/.test(u.pathname)) {
      return `https://player.vimeo.com/video/${u.pathname.slice(1)}`;
    }
    if (u.hostname === 'player.vimeo.com' && /^\/video\/\d+$/.test(u.pathname)) return u.toString();
    if (u.hostname === 'www.youtube.com' || u.hostname === 'youtube.com') {
      return u.pathname.startsWith('/embed/') ? u.toString() : null;
    }
    return null;
  } catch {
    return null;
  }
}
