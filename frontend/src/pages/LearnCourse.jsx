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
import { useCountUp, usePopIn, useStaggerReveal } from '../lib/motion.js';
import { markPerformance } from '../lib/performance.js';
import {
  FileIcon,
  PencilIcon,
  ImageIcon,
  CodeIcon,
  ClipIcon,
  AwardIcon,
  SparklesIcon,
  CheckIcon,
  CloseIcon,
  ListIcon,
  ChevronDownIcon,
  ArrowRightIcon,
  TrophyIcon,
  BookmarkIcon,
  CommentIcon,
  GraduationIcon,
  ExternalLinkIcon,
} from '../components/icons.jsx';
import { CategoryIcon, categoryTheme } from '../components/catalog/categoryTheme.jsx';
import { ErrorBox } from '../components/social/StateBlocks.jsx';
import {
  BackLink,
  BTN_SECONDARY,
  BTN_SECONDARY_SM,
  DARK_PANEL,
  EmptyState,
  INPUT,
  ProgressBar,
  RoleBadge,
  SkeletonLine,
  SURFACE,
  TILE,
} from '../components/ui/v3.jsx';

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
  // Reintentar la carga del curso sin recargar la página.
  const [reloadKey, setReloadKey] = useState(0);
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
  }, [courseId, isAuthenticated, reloadKey]);

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
      <div className="min-h-[70vh] grid place-items-center p-4">
        <EmptyState state="triste" title="No pudimos cargar el" accent="curso" text={error} className="w-full max-w-md mb-0">
          <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="titi-btn-primary">
            Reintentar
          </button>
          <button type="button" onClick={() => navigate(`/courses/${courseId}`)} className={BTN_SECONDARY}>
            Volver al detalle del curso
          </button>
        </EmptyState>
      </div>
    );
  }

  if (!curso) return null;

  // --- Render: no inscripto (el temario cargó, pero el contenido no) ---
  if (accessDenied) {
    return (
      <div className="min-h-[70vh] grid place-items-center p-4">
        <EmptyState
          state="triste"
          title="Inscribite para ver este"
          accent="curso"
          text="Andá al detalle del curso e inscribite gratis para acceder a las lecciones."
          className="w-full max-w-md mb-0"
        >
          <button type="button" onClick={() => navigate(`/courses/${courseId}`)} className="titi-btn-primary">
            Ir al detalle del curso
          </button>
        </EmptyState>
      </div>
    );
  }

  const theme = categoryTheme(curso.categoria?.nombre);
  const activeModuloNumero = (curso.modulos?.findIndex((m) => m.id === activeModulo?.id) ?? -1) + 1;

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
      {/* === Índice del curso (desktop) + cajón (móvil) === */}
      <CourseIndex
        curso={curso}
        theme={theme}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onBack={() => navigate(-1)}
        navRef={lessonNavRef}
        activeId={activeId}
        activeEvalId={activeEvalId}
        completed={completed}
        newLessons={newLessons}
        progressLoading={progressLoading}
        progressPct={progressPct}
        completedCount={completedCount}
        currentPosition={currentPosition}
        totalLessons={totalLessons}
        onSelectLesson={handleSelectLesson}
        onSelectEval={handleSelectEval}
      />

      {/* Fondo del cajón en móvil */}
      {drawerOpen && (
        <div
          aria-hidden="true"
          onClick={() => setDrawerOpen(false)}
          className="fixed inset-0 bg-titi-dark/40 z-30 lg:hidden titi-backdrop-in"
        />
      )}

      {/* === Centro + columna derecha === */}
      <div className="flex-1 flex flex-col lg:flex-row min-w-0 min-h-0 lg:h-full lg:gap-3">
        <main className="flex-1 p-4 sm:p-5 lg:p-5 overflow-y-auto scrollbar-none min-w-0 min-h-0">
          <div className="max-w-5xl mx-auto">
            {/* Botón del índice en móvil */}
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-expanded={drawerOpen}
              aria-controls="learn-index"
              className={`lg:hidden mb-4 w-full flex items-center gap-3 p-3 text-left ${TILE}`}
            >
              <RoleBadge Icon={ListIcon} solid={theme.solid} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-extrabold uppercase tracking-wide text-gray-500">
                  Lección {currentPosition} de {totalLessons}
                </span>
                <span className="block text-sm font-extrabold text-titi-dark truncate">
                  {activeModulo?.titulo || curso.titulo}
                </span>
                <ProgressBar value={progressPct} height="h-1.5" className="mt-1.5" label="Avance del curso" />
              </span>
              <ChevronDownIcon className="w-5 h-5 shrink-0 text-titi-dark" />
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
                  moduloNumero={activeModuloNumero}
                  moduloTitulo={activeModulo?.titulo}
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
                  nextTitle={nextLesson?.titulo || curso.evaluacionFinal?.titulo}
                  onNext={handleNext}
                  onSaveNote={() => setSidePanel('notas')}
                />
              ) : (
                <LessonContentSkeleton title={activeLesson.titulo} />
              )
            ) : (
              <EmptyState
                state="pensando"
                title="Aún no hay"
                accent="lecciones"
                text="Cuando el profe agregue contenido, lo vas a poder seguir desde acá."
              >
                <button type="button" onClick={() => navigate(`/courses/${courseId}`)} className={BTN_SECONDARY}>
                  Volver al detalle del curso
                </button>
              </EmptyState>
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
              moduloNumero: activeModuloNumero,
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

// ---- Índice del curso: cabecera, avance y ruta de lecciones ----
function CourseIndex({
  curso,
  theme,
  open,
  onClose,
  onBack,
  navRef,
  activeId,
  activeEvalId,
  completed,
  newLessons,
  progressLoading,
  progressPct,
  completedCount,
  currentPosition,
  totalLessons,
  onSelectLesson,
  onSelectEval,
}) {
  const shownPct = useCountUp(progressLoading ? 0 : progressPct);
  const finalEval = curso.evaluacionFinal;
  const finalActive = finalEval && finalEval.id === activeEvalId;

  // Esc cierra el cajón en móvil.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <aside
      id="learn-index"
      aria-label="Índice del curso"
      className={`
        w-80 max-w-[85vw] lg:w-72 bg-white flex flex-col
        fixed top-12 bottom-14 left-0 z-40 overflow-y-auto scrollbar-none
        border-r-2 border-titi-dark
        transition-transform duration-200 motion-reduce:transition-none
        ${open ? 'translate-x-0 shadow-[6px_0_0_rgba(26,26,46,0.12)]' : '-translate-x-full'}
        lg:static lg:inset-auto lg:h-full lg:max-w-none lg:transform-none
        lg:border-2 lg:rounded-2xl lg:shadow-[0_2px_8px_rgba(0,0,0,0.06)] lg:shrink-0
      `}
    >
      {/* Cabecera: volver, categoría, título y avance */}
      <div className="p-4 border-b-2 border-gray-100">
        <div className="flex items-start justify-between gap-2">
          <BackLink onClick={onBack}>Volver</BackLink>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar índice"
            className="lg:hidden w-9 h-9 grid place-items-center rounded-full border-2 border-gray-200 text-titi-dark hover:border-titi-dark active:translate-y-0.5 transition-all duration-150 focus:outline-none focus-visible:ring-4 focus-visible:ring-titi-yellow/60"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>
        {curso.categoria?.nombre && (
          <p className={`group inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide ${theme.text}`}>
            <span className={`w-6 h-6 rounded-lg grid place-items-center text-white ${theme.solid}`}>
              <CategoryIcon nombre={curso.categoria.nombre} className="w-3.5 h-3.5" />
            </span>
            {curso.categoria.nombre}
          </p>
        )}
        <h2 className="text-lg font-black text-titi-dark leading-snug line-clamp-3 mt-1.5 break-words">
          {curso.titulo}
        </h2>

        {/* Avance del curso (panel oscuro) */}
        <div className={`${DARK_PANEL} p-3.5 mt-4`}>
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-extrabold uppercase tracking-wide text-white/60">Tu avance</p>
              <p className="text-sm font-bold text-white mt-0.5">
                Lección {currentPosition} de {totalLessons}
              </p>
            </div>
            {progressLoading ? (
              <span className="h-7 w-14 rounded-lg bg-white/10 animate-pulse" aria-label="Cargando progreso" />
            ) : (
              <span className="text-3xl font-black text-titi-yellow tabular-nums leading-none">{shownPct}%</span>
            )}
          </div>
          {progressLoading ? (
            <div className="h-2.5 w-full rounded-full bg-white/10 animate-pulse mt-3" aria-hidden="true" />
          ) : (
            <ProgressBar value={progressPct} color="bg-titi-yellow" track="bg-white/10" className="mt-3" label="Avance del curso" />
          )}
          <p className="text-xs font-semibold text-white/60 mt-2 tabular-nums">
            {progressLoading
              ? 'Cargando tu avance…'
              : totalLessons === 0
                ? 'Todavía no hay lecciones.'
                : `${Math.min(completedCount, totalLessons)} de ${totalLessons} ${totalLessons === 1 ? 'lección completada' : 'lecciones completadas'}`}
          </p>
        </div>
      </div>

      {/* Ruta: módulos + lecciones + evaluaciones */}
      <nav ref={navRef} aria-label="Lecciones del curso" className="flex-1 p-3">
        {!curso.modulos?.length ? (
          <p className="px-1 py-2 text-sm font-semibold text-gray-500">
            Este curso aún no tiene módulos publicados.
          </p>
        ) : (
          curso.modulos.map((modulo, mIndex) => {
            const lecciones = modulo.lecciones || [];
            const doneInModule = lecciones.filter((l) => completed.has(l.id)).length;
            const steps = [
              ...lecciones.map((leccion, index) => ({ kind: 'leccion', leccion, index })),
              ...(modulo.evaluacion ? [{ kind: 'eval', evaluacion: modulo.evaluacion }] : []),
            ];
            return (
              <section key={modulo.id} className="mb-4 last:mb-0">
                <div className="flex items-center gap-2.5 px-1 mb-1.5">
                  <span
                    aria-hidden="true"
                    className={`w-7 h-7 shrink-0 rounded-lg border-2 border-titi-dark grid place-items-center text-xs font-black text-white tabular-nums -rotate-6 ${theme.solid}`}
                  >
                    {mIndex + 1}
                  </span>
                  <h3 className="flex-1 min-w-0 text-sm font-extrabold text-titi-dark leading-snug break-words">
                    {modulo.titulo}
                  </h3>
                  {lecciones.length > 0 && (
                    <span className="shrink-0 text-xs font-bold text-gray-500 tabular-nums" aria-label={`${doneInModule} de ${lecciones.length} completadas`}>
                      {doneInModule}/{lecciones.length}
                    </span>
                  )}
                </div>
                <ol>
                  {steps.map((step, sIndex) => {
                    const isLast = sIndex === steps.length - 1;
                    if (step.kind === 'eval') {
                      const isActive = step.evaluacion.id === activeEvalId;
                      return (
                        <li key={step.evaluacion.id} className="relative py-0.5">
                          <IndexStep
                            active={isActive}
                            activeTint="bg-purple-100"
                            onClick={() => onSelectEval(step.evaluacion.id)}
                            node={
                              <span className="w-7 h-7 rounded-full border-2 border-titi-dark bg-titi-achievement text-white grid place-items-center">
                                <AwardIcon className="w-3.5 h-3.5" />
                              </span>
                            }
                          >
                            <span className="block text-xs font-extrabold uppercase tracking-wide text-titi-achievement">Evaluación</span>
                            <span className="block line-clamp-2">{step.evaluacion.titulo}</span>
                          </IndexStep>
                        </li>
                      );
                    }
                    const { leccion, index } = step;
                    const isActive = leccion.id === activeId && !activeEvalId;
                    const isDone = completed.has(leccion.id);
                    const isNew = newLessons.has(leccion.id) && !isDone;
                    return (
                      <li key={leccion.id} className="relative py-0.5">
                        {!isLast && (
                          <span
                            aria-hidden="true"
                            className={`absolute left-[23px] top-1/2 h-full w-0.5 ${isDone ? 'bg-green-500' : 'bg-gray-200'}`}
                          />
                        )}
                        <IndexStep
                          active={isActive}
                          activeTint="bg-titi-yellow-light"
                          onClick={() => onSelectLesson(leccion.id)}
                          node={
                            isDone ? (
                              <span className="w-7 h-7 rounded-full border-2 border-titi-dark bg-green-500 text-white grid place-items-center">
                                <CheckIcon className="w-3.5 h-3.5" />
                              </span>
                            ) : (
                              <span
                                className={`w-7 h-7 rounded-full border-2 grid place-items-center text-xs font-black tabular-nums ${
                                  isActive ? 'bg-titi-yellow border-titi-dark text-titi-dark' : 'bg-white border-gray-300 text-gray-500'
                                }`}
                              >
                                {index + 1}
                              </span>
                            )
                          }
                          muted={isDone && !isActive}
                          badge={isNew ? <span className="shrink-0 h-6 px-2 rounded-full bg-blue-500 text-white text-xs font-extrabold inline-flex items-center">Nueva</span> : null}
                        >
                          <span className="block line-clamp-2">{leccion.titulo}</span>
                          {isDone && <span className="sr-only"> (completada)</span>}
                        </IndexStep>
                      </li>
                    );
                  })}
                </ol>
              </section>
            );
          })
        )}
      </nav>

      {/* Evaluación final al pie */}
      {finalEval && (
        <div className="p-3 border-t-2 border-gray-100">
          <button
            type="button"
            onClick={() => onSelectEval(finalEval.id)}
            aria-current={finalActive ? 'step' : undefined}
            className={`${TILE.replace('bg-white ', '')} ${finalActive ? 'bg-purple-100' : 'bg-white'} w-full flex items-center gap-3 p-3 text-left`}
          >
            <RoleBadge Icon={TrophyIcon} solid="bg-titi-achievement" size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-extrabold uppercase tracking-wide text-titi-achievement">Evaluación final</span>
              <span className="block text-sm font-extrabold text-titi-dark leading-snug line-clamp-2">{finalEval.titulo}</span>
            </span>
          </button>
        </div>
      )}
    </aside>
  );
}

/** Un paso de la ruta del índice: nodo + texto; la actual queda resaltada. */
function IndexStep({ active, activeTint, onClick, node, muted = false, badge = null, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'step' : undefined}
      className={[
        'relative w-full flex items-center gap-3 pl-2 pr-2.5 py-2 rounded-xl border-2 text-left text-sm leading-snug',
        'transition-all duration-150 active:translate-y-0.5 motion-reduce:transition-none',
        'focus:outline-none focus-visible:ring-4 focus-visible:ring-titi-yellow/60',
        active
          ? `${activeTint} border-titi-dark font-extrabold text-titi-dark shadow-[0_3px_0_#1A1A2E]`
          : `border-transparent hover:bg-titi-cream hover:border-gray-200 font-semibold ${muted ? 'text-gray-500' : 'text-titi-dark'}`,
      ].join(' ')}
    >
      <span className="relative z-10 shrink-0">{node}</span>
      <span className="min-w-0 flex-1 break-words">{children}</span>
      {badge}
    </button>
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

const TIPO_LABEL = {
  pdf: 'PDF',
  word: 'Word',
  imagen: 'Imagen',
  codigo: 'Código',
  otro: 'Archivo',
};

// Insignia sólida por tipo de material (design.md §2: un rol por color).
const TIPO_SOLID = {
  pdf: 'bg-red-500',
  word: 'bg-blue-500',
  imagen: 'bg-green-500',
  codigo: 'bg-titi-dark',
  otro: 'bg-titi-yellow',
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
      className={`${TILE} flex items-center gap-3 p-2.5 pr-3 max-w-full`}
    >
      <RoleBadge Icon={Icon} solid={TIPO_SOLID[material.tipo] || TIPO_SOLID.otro} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-extrabold text-titi-dark">{material.nombre}</span>
        <span className="block text-xs font-bold text-gray-500">{TIPO_LABEL[material.tipo] || TIPO_LABEL.otro}</span>
      </span>
      <ExternalLinkIcon className="w-4 h-4 text-gray-500 shrink-0" />
    </a>
  );
}

function LessonView({ leccion, moduloNumero, moduloTitulo, completed, completing, completeError, onComplete, htmlEvaluable, onHtmlEvaluableChange, htmlDeadlineExpired, onHtmlDeadlineChange, onHtmlScoreRecorded, hasNext, nextTitle, onNext, onSaveNote }) {
  const videoEmbed = useMemo(
    () => normalizeVideoUrl(leccion.videoUrl),
    [leccion.videoUrl],
  );
  // Pop al cambiar de lección (también remonta por key en el padre). Ver motion.md §5.
  const articleRef = usePopIn([leccion.id]);
  const isHtml = leccion.formatoContenido === 'HTML';
  const hasBody = Boolean(videoEmbed || leccion.contenido);

  return (
    <article ref={articleRef}>
      {/* Cabecera de la lección */}
      <header className="mb-4">
        {moduloTitulo && (
          <p className="text-xs font-extrabold uppercase tracking-wide text-gray-500 break-words">
            {moduloNumero ? `Módulo ${moduloNumero} · ` : ''}{moduloTitulo}
          </p>
        )}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mt-1">
          <h1 className="text-2xl sm:text-3xl font-black text-titi-dark leading-tight break-words min-w-0">
            {leccion.titulo}
          </h1>
          <button type="button" onClick={onSaveNote} className={`${BTN_SECONDARY_SM} self-start shrink-0`}>
            <BookmarkIcon className="w-4 h-4" />
            Guardar nota
          </button>
        </div>
        {completed && (
          <span className="mt-3 inline-flex items-center gap-1.5 h-8 pl-1 pr-3 rounded-full bg-green-50 border-2 border-green-500 text-sm font-extrabold text-green-700">
            <span className="w-6 h-6 rounded-full bg-green-500 grid place-items-center" aria-hidden="true">
              <CheckIcon className="w-3.5 h-3.5 text-white" />
            </span>
            Completada
          </span>
        )}
      </header>

      {/* Video + contenido sobre una superficie (lectura sobre blanco) */}
      {hasBody && (
        <div className={`${SURFACE} p-4 sm:p-6 lg:p-8 mb-4`}>
          {videoEmbed && (
            <div className={`w-full aspect-video rounded-xl overflow-hidden bg-titi-dark border-2 border-titi-dark ${leccion.contenido ? 'mb-6' : ''}`}>
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

          {/* Contenido de la lección — se muestra directo, sin toggle. */}
          {leccion.contenido && (
            <Suspense fallback={<LessonBodySkeleton label="Cargando contenido…" />}>
              <MarkdownContent
                content={leccion.contenido}
                format="MARKDOWN"
              />
            </Suspense>
          )}
        </div>
      )}

      {/* Presentación interactiva (trae su propio marco) */}
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
        <ErrorBox title="No pudimos marcar la lección" message={completeError} onRetry={onComplete} />
      )}

      {/* Barra de acción: completar + siguiente */}
      <div className={`${SURFACE} p-3 sm:p-4 flex flex-wrap items-center gap-3`}>
        <div className="grow basis-56 min-w-0">
          {completed ? (
            <p className="inline-flex items-center gap-2 text-sm font-extrabold text-green-700">
              <span className="w-8 h-8 rounded-full bg-green-500 grid place-items-center shrink-0" aria-hidden="true">
                <CheckIcon className="w-4 h-4 text-white" />
              </span>
              Lección completada
            </p>
          ) : isHtml && htmlEvaluable !== false ? (
            <p className="text-sm font-semibold text-gray-500">
              {htmlEvaluable === null ? 'Preparando la actividad…' : htmlDeadlineExpired ? 'El plazo venció; podés revisar la presentación, pero no enviar nuevos puntajes.' : 'Completá la actividad para registrar tu nota.'}
            </p>
          ) : (
            <button
              type="button"
              onClick={onComplete}
              disabled={completing}
              className="titi-btn-primary w-full sm:w-auto py-3 text-base whitespace-nowrap"
            >
              <CheckIcon className="w-5 h-5" />
              {completing ? 'Marcando…' : 'Marcar como completada'}
            </button>
          )}
        </div>
        {hasNext && (
          <button
            type="button"
            onClick={onNext}
            className={[
              'group grow sm:grow-0 basis-56 sm:max-w-xs min-w-0 inline-flex items-center justify-between gap-3 min-h-11 pl-4 pr-3 py-2 rounded-xl border-2 border-titi-dark text-left',
              'transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none motion-reduce:transition-none',
              'focus:outline-none focus-visible:ring-4 focus-visible:ring-titi-yellow/60',
              completed
                ? 'bg-titi-yellow shadow-[0_3px_0_#1A1A2E] hover:shadow-[0_4px_0_#1A1A2E]'
                : 'bg-white shadow-[0_3px_0_#1A1A2E] hover:bg-titi-yellow hover:shadow-[0_4px_0_#1A1A2E]',
            ].join(' ')}
          >
            <span className="min-w-0">
              <span className="block text-xs font-extrabold uppercase tracking-wide text-titi-dark/60">
                {completed ? 'Seguí con' : 'Siguiente'}
              </span>
              <span className="block truncate text-sm font-extrabold text-titi-dark">
                {nextTitle || 'Siguiente lección'}
              </span>
            </span>
            <ArrowRightIcon className="w-5 h-5 shrink-0 text-titi-dark transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none" />
          </button>
        )}
      </div>
    </article>
  );
}

function LearnCourseSkeleton() {
  return (
    <div className="flex min-h-screen lg:min-h-0 lg:h-[calc(100vh-1.5rem)] bg-titi-cream lg:gap-3 animate-pulse" role="status" aria-busy="true" aria-label="Cargando curso">
      <aside className={`hidden lg:flex w-72 shrink-0 ${SURFACE} flex-col p-4 gap-3`}>
        <SkeletonLine className="h-9 w-24" />
        <SkeletonLine className="h-3 w-28" />
        <SkeletonLine className="h-5 w-4/5" />
        <div className="h-28 rounded-2xl bg-titi-dark/10 mt-1" />
        <div className="space-y-2.5 mt-2">
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <div key={item} className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-gray-100 shrink-0" />
              <SkeletonLine className="h-3.5 flex-1" />
            </div>
          ))}
        </div>
      </aside>
      <main className="flex-1 p-4 sm:p-5 lg:p-5 min-w-0">
        <div className="max-w-5xl mx-auto space-y-4">
          <div className="lg:hidden h-16 rounded-2xl bg-gray-100" />
          <SkeletonLine className="h-3 w-40" />
          <SkeletonLine className="h-8 w-3/5" />
          <div className={`${SURFACE} p-6 space-y-3`}>
            <SkeletonLine className="h-4 w-full" />
            <SkeletonLine className="h-4 w-11/12" />
            <SkeletonLine className="h-4 w-4/5" />
            <div className="h-40 w-full rounded-xl bg-gray-100 mt-4" />
          </div>
        </div>
      </main>
      <aside className={`hidden lg:flex w-24 ${SURFACE} flex-col gap-2 p-2`}>
        {[0, 1, 2, 3].map((item) => <div key={item} className="h-16 rounded-xl bg-gray-100" />)}
      </aside>
    </div>
  );
}

function LessonContentSkeleton({ title }) {
  return (
    <article className="animate-pulse" aria-busy="true" aria-label="Cargando lección">
      <div aria-hidden="true">
        <SkeletonLine className="h-3 w-40" />
        <SkeletonLine className="h-8 w-3/5 mt-3" />
        <div className={`${SURFACE} p-6 space-y-3 mt-4`}>
          <SkeletonLine className="h-4 w-full" />
          <SkeletonLine className="h-4 w-11/12" />
          <SkeletonLine className="h-4 w-4/5" />
          <div className="h-44 w-full rounded-xl bg-gray-100 mt-4" />
        </div>
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
      className={`${SURFACE} mb-4 flex flex-col sm:flex-row sm:items-center gap-3 p-4`}
    >
      <RoleBadge Icon={SparklesIcon} solid="bg-titi-yellow" />
      <div className="min-w-0 flex-1">
        <h2 id="tutor-credential-banner-title" className="text-base font-extrabold text-titi-dark leading-snug">
          {invalid ? 'Tu clave necesita reemplazo' : 'Conectá tu clave personal de Groq para usar el Tutor IA'}
        </h2>
        <p className="mt-0.5 text-sm font-medium text-gray-500">
          {invalid
            ? 'La clave guardada no es válida o fue revocada. Reemplazala para continuar.'
            : 'La clave se valida y se guarda cifrada en tu cuenta; nunca se muestra completa.'}
        </p>
      </div>
      <button
        type="button"
        onClick={onConfigure}
        className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl bg-titi-dark border-2 border-titi-dark text-sm font-extrabold text-white shadow-[0_3px_0_#E6B800] hover:-translate-y-0.5 hover:shadow-[0_4px_0_#E6B800] active:translate-y-0.5 active:shadow-none transition-all duration-150 motion-reduce:transition-none focus:outline-none focus-visible:ring-4 focus-visible:ring-titi-yellow/60"
      >
        <SparklesIcon className="w-4 h-4 text-titi-yellow" />
        Configurar ahora
      </button>
    </section>
  );
}

function LessonBodySkeleton({ label }) {
  return (
    <div className="space-y-3 mb-6 animate-pulse" aria-busy="true" role="status">
      <SkeletonLine className="h-4 w-full" />
      <SkeletonLine className="h-4 w-11/12" />
      <SkeletonLine className="h-4 w-4/5" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

function PanelSkeleton({ label = 'Cargando panel…' }) {
  return (
    <div className="space-y-3 p-4 animate-pulse" aria-busy="true" role="status">
      <SkeletonLine className="h-4 w-2/3" />
      <div className="h-24 w-full rounded-xl bg-gray-100" aria-hidden="true" />
      <SkeletonLine className="h-4 w-5/6" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

// ---- Columna derecha: riel de íconos + panel desplegable ----
const PANELS = [
  { key: 'tutor', label: 'Tutor IA', Icon: SparklesIcon, title: 'Tutor IA', solid: 'bg-titi-yellow' },
  { key: 'notas', label: 'Notas', Icon: PencilIcon, title: 'Notas', solid: 'bg-blue-500' },
  { key: 'materiales', label: 'Archivos', Icon: FileIcon, title: 'Materiales', solid: 'bg-green-500' },
  { key: 'comentarios', label: 'Comentarios', Icon: CommentIcon, title: 'Comentarios', solid: 'bg-titi-streak' },
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
          className="fixed inset-y-0 right-0 z-50 hidden md:flex flex-col w-[22rem] lg:w-[26rem] bg-white border-l-2 border-titi-dark shadow-[-8px_0_0_rgba(26,26,46,0.12)] titi-sheet-right"
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
            className="absolute inset-0 bg-titi-dark/40 titi-backdrop-in"
          />
          <div
            ref={mobileTutorRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="tutor-panel-title-mobile"
            className="absolute inset-x-0 bottom-0 h-[92vh] bg-white rounded-t-2xl border-t-2 border-titi-dark flex flex-col overflow-hidden titi-sheet-in"
          >
            <div className="w-10 h-1.5 rounded-full bg-gray-200 mx-auto mt-2 shrink-0" />
            <Suspense fallback={<PanelSkeleton label="Cargando Tutor IA…" />}>
              <TutorPanel {...tutor} titleId="tutor-panel-title-mobile" onClose={() => onChange(null)} />
            </Suspense>
          </div>
        </div>
      )}

      <div className={`${SURFACE} flex flex-col-reverse lg:flex-row shrink-0 lg:h-full overflow-hidden mx-4 mb-4 sm:mx-5 lg:m-0`}>
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
                <div className="flex items-center gap-2.5 mb-4">
                  <RoleBadge Icon={active.Icon} solid={active.solid} size="sm" />
                  <h2 className="flex-1 min-w-0 text-lg font-extrabold text-titi-dark leading-tight">
                    {active.title}
                    {active.key === 'comentarios' && (
                      <span className="ml-1.5 align-middle inline-grid place-items-center min-w-6 h-6 px-1.5 rounded-full bg-titi-dark text-white text-xs font-extrabold tabular-nums">
                        {commentCount}
                      </span>
                    )}
                  </h2>
                  <button
                    type="button"
                    onClick={() => onChange(null)}
                    className="w-9 h-9 shrink-0 grid place-items-center rounded-full border-2 border-gray-200 text-titi-dark hover:border-titi-dark active:translate-y-0.5 transition-all duration-150 focus:outline-none focus-visible:ring-4 focus-visible:ring-titi-yellow/60"
                    aria-label="Cerrar panel"
                  >
                    <CloseIcon className="w-4 h-4" />
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
          className={`grid grid-cols-4 lg:flex lg:flex-col gap-1.5 p-2 bg-white lg:w-24 lg:h-full shrink-0 justify-center lg:justify-start ${expanded ? 'border-b-2 lg:border-b-0 lg:border-l-2 border-gray-100' : ''}`}
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
                  'relative flex flex-col items-center justify-center gap-1 px-1.5 py-2.5 rounded-xl border-2 w-full',
                  'transition-all duration-150 active:translate-y-0.5 active:shadow-none motion-reduce:transition-none',
                  'focus:outline-none focus-visible:ring-4 focus-visible:ring-titi-yellow/60',
                  isOpen
                    ? 'bg-titi-yellow border-titi-dark text-titi-dark shadow-[0_3px_0_#1A1A2E]'
                    : 'border-transparent text-gray-500 hover:bg-titi-cream hover:border-gray-200 hover:text-titi-dark',
                ].join(' ')}
              >
                <Icon className="w-5 h-5" />
                <span className={`text-xs leading-none ${isOpen ? 'font-extrabold' : 'font-bold'}`}>{label}</span>
                {needsTutorKey && (
                  <>
                    <span
                      className="absolute right-2 top-2 w-3 h-3 rounded-full bg-titi-streak border-2 border-white"
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
      <p className="text-sm font-medium text-gray-500 mb-2">
        Tus apuntes personales de esta lección.
      </p>
      <textarea
        rows={7}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={5000}
        placeholder="Escribí tus apuntes…"
        aria-label="Apuntes de la lección"
        className={`${INPUT} resize-none leading-relaxed`}
      />
      <div className="flex items-center justify-between gap-2 mt-3">
        <span role="status" className="inline-flex items-center gap-1.5 text-sm font-extrabold text-green-600">
          {saved && (
            <>
              <span className="w-5 h-5 rounded-full bg-green-500 grid place-items-center" aria-hidden="true">
                <CheckIcon className="w-3 h-3 text-white" />
              </span>
              Guardado
            </>
          )}
        </span>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="titi-btn-primary text-sm px-4 py-2"
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
      {materiales === undefined ? (
        <div className="space-y-2 animate-pulse" role="status" aria-busy="true">
          <div className="h-14 rounded-2xl bg-gray-100" />
          <div className="h-14 rounded-2xl bg-gray-100" />
          <span className="sr-only">Cargando materiales…</span>
        </div>
      ) : materiales.length > 0 ? (
        <>
          <p className="text-sm font-medium text-gray-500 mb-3">
            Recursos descargables de la lección.
          </p>
          <ul className="flex flex-col gap-2.5">
            {materiales.map((m) => (
              <li key={m.id}>
                <MaterialChip material={m} />
              </li>
            ))}
          </ul>
        </>
      ) : (
        <EmptyState
          compact
          state="pensando"
          title="Todavía no hay"
          accent="materiales"
          text="Cuando el profe suba archivos para esta lección, los vas a encontrar acá."
        />
      )}
    </div>
  );
}

// ---- Banner de curso completado con certificado ----
function CertificateBanner({ certificado, onClose }) {
  const ref = usePopIn([]);
  return (
    <div
      ref={ref}
      role="status"
      className={`${DARK_PANEL} relative flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-5 p-4 sm:p-5 pr-12 mb-5`}
    >
      <TitiMascot state="celebra" size="sm" message="" className="shrink-0" />
      <div className="min-w-0 flex-1 w-full">
        <p className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-titi-yellow">
          <GraduationIcon className="w-4 h-4" />
          Curso completado
        </p>
        <h2 className="text-xl sm:text-2xl font-black text-white leading-tight mt-0.5">
          ¡Lo <span className="text-titi-yellow">lograste</span>!
        </h2>
        <p className="text-sm font-medium text-white/70 mt-1">
          {certificado
            ? 'Tu certificado está listo y tiene un código de verificación único.'
            : 'Completaste todos los requisitos. Este curso no emite certificado.'}
        </p>
        {certificado && (
          <Link to="/certificates" className="titi-btn-primary text-sm px-4 py-2 mt-3">
            <AwardIcon className="w-4 h-4" />
            Ver mi certificado
          </Link>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        className="absolute top-3 right-3 w-9 h-9 grid place-items-center rounded-full border-2 border-white/20 text-white hover:bg-white/10 active:translate-y-0.5 transition-all duration-150 focus:outline-none focus-visible:ring-4 focus-visible:ring-titi-yellow/60"
      >
        <CloseIcon className="w-4 h-4" />
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
