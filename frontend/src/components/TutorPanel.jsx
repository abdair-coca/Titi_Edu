import { useEffect, useRef, useState } from 'react';
import client from '../api/client.js';
import { markPerformance } from '../lib/performance.js';
import ConfirmModal from './ConfirmModal.jsx';
import MarkdownContent from './MarkdownContent.jsx';
import DilMessage from './tutor/DilMessage.jsx';
import TitiMascot from './TitiMascot.jsx';
import { useTutorAvailability } from '../hooks/useTutorAvailability.js';
import { buildTutorHistory } from '../lib/tutorHistory.js';
import {
  PRACTICE_AWAITING_ANSWER,
  practiceStateAfterResponse,
  resolveTutorIntent,
} from '../lib/tutorPractice.js';
import { usePopIn, useStaggerReveal } from '../lib/motion.js';
import { ErrorBox } from './social/StateBlocks.jsx';
import {
  BTN_DANGER_SM,
  BTN_SECONDARY,
  BTN_SECONDARY_SM,
  INPUT,
  RoleBadge,
  SkeletonLine,
  SURFACE,
  TILE,
} from './ui/v3.jsx';
import { quizAnswerMessage, renderableNodes } from '../lib/dil.js';
import {
  SparklesIcon,
  PlusIcon,
  SendIcon,
  BookIcon,
  CodeIcon,
  LightbulbIcon,
  PracticeIcon,
  ChevronDownIcon,
  ExternalLinkIcon,
  CloseIcon,
  CheckIcon,
  RefreshIcon,
  ArrowRightIcon,
  AlertIcon,
  EyeIcon,
  EyeOffIcon,
  GearIcon,
  KeyIcon,
} from './icons.jsx';

// Secuencia de estados de carga: visual, honesta. Las etapas 1–2 corren con
// temporizador y no nombran la búsqueda, porque una charla no busca nada. La 3
// solo aparece si la respuesta cita fuentes, con su conteo real; la 4 precede
// al reveal. Una respuesta sin citas se muestra sin la etapa 3 ni su espera.
const STAGE_LABELS = {
  1: 'Leyendo tu mensaje…',
  2: 'Pensando…',
  4: 'Preparando tu respuesta…',
};
const CONVERSATION_REVEAL_MS = 400;

const QUICK_ACTIONS = [
  {
    label: 'Explicame este tema',
    Icon: BookIcon,
    solid: 'bg-blue-500',
    intent: 'EXPLICAR',
    prompt: 'Explicame este tema de forma sencilla, usando los materiales de la lección.',
  },
  {
    label: 'Dame un ejemplo',
    Icon: CodeIcon,
    solid: 'bg-titi-dark',
    intent: 'EJEMPLO',
    prompt: 'Dame un ejemplo práctico sobre este tema.',
  },
  {
    label: 'Haceme una pregunta',
    Icon: LightbulbIcon,
    solid: 'bg-titi-yellow',
    intent: 'PRACTICA',
    prompt: 'Proponé una pregunta de práctica sobre este tema. No muestres la solución.',
  },
  {
    label: 'Creá un ejercicio',
    Icon: PracticeIcon,
    solid: 'bg-green-500',
    intent: 'PRACTICA',
    prompt: 'Creá un ejercicio sobre este tema para practicar.',
  },
];

const POST_ACTIONS = [
  { label: 'Más simple', intent: 'EXPLICAR', prompt: 'Explicámelo más simple, paso a paso, usando los materiales de la lección.' },
  { label: 'Otro ejemplo', intent: 'EJEMPLO', prompt: 'Dame otro ejemplo distinto sobre este tema.' },
  { label: 'Ejercicio', intent: 'PRACTICA', prompt: 'Creá un ejercicio de práctica sobre este tema. No muestres la solución.' },
  { label: 'Resumir', intent: 'RESUMEN', prompt: 'Resumí los puntos clave de esta lección en una lista corta.' },
];

export default function TutorPanel({
  lessonId,
  cursoTitulo,
  moduloNumero,
  moduloTitulo,
  leccionTitulo,
  conversation,
  practiceState,
  onAppendMessages,
  onResetConversation,
  onPracticeStateChange,
  onNavigateToLesson,
  onClose,
  openSettings = false,
  titleId = 'tutor-panel-title',
}) {
  const {
    status,
    statusError,
    loading: credentialLoading,
    refresh: refreshTutorState,
  } = useTutorAvailability(lessonId);
  const credential = status?.credential || null;
  const statusErrorMessage = statusError
    ? requestErrorMessage(statusError, 'No se pudo verificar la disponibilidad del tutor.')
    : null;
  const credentialError = statusErrorMessage;
  const [settingsOpen, setSettingsOpen] = useState(openSettings);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(null); // null | { stage, count }
  const [error, setError] = useState(null); // null | { question, intent }
  const textareaRef = useRef(null);
  const latestTutorMessageRef = useRef(null);
  const endRef = useRef(null);
  const activeRef = useRef(false);
  const requestIdRef = useRef(0);
  const controllerRef = useRef(null);
  const timersRef = useRef([]);

  useEffect(() => {
    if (openSettings) setSettingsOpen(true);
  }, [openSettings]);

  const clearTimers = () => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  };

  useEffect(() => () => {
    requestIdRef.current += 1;
    activeRef.current = false;
    controllerRef.current?.abort();
    controllerRef.current = null;
    clearTimers();
  }, []);

  // Al cambiar de lección: cancelo request/estados en vuelo para no mezclar
  // loading ni respuestas entre conversaciones distintas.
  useEffect(() => {
    requestIdRef.current += 1;
    activeRef.current = false;
    controllerRef.current?.abort();
    controllerRef.current = null;
    clearTimers();
    setPending(null);
    setError(null);
    setInput('');
  }, [lessonId]);

  useEffect(() => {
    if (!credentialLoading && (status || statusErrorMessage)) markPerformance('learn:tutor-ready', lessonId);
  }, [credentialLoading, lessonId, status, statusErrorMessage]);

  const credentialRequired = status?.credential?.required !== false;
  const credentialReady = !credentialRequired || Boolean(
    (credential?.configured ?? status?.credential?.configured)
      && (credential?.status ?? status?.credential?.status) === 'VALID',
  );
  const lessonReady = Boolean(status?.enabled && status?.indexed);
  const ready = lessonReady && credentialReady;

  // Respuesta nueva: mostrar inicio. Pregunta/carga/error: mantener final visible.
  useEffect(() => {
    if (pending || error) {
      endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
      return;
    }
    latestTutorMessageRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [conversation.length, pending, error]);

  const resizeTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const ask = (prompt, { appendUser = true, intent } = {}) => {
    const question = String(prompt || '').trim();
    if (!question || pending || !ready) return;
    const requestIntent = resolveTutorIntent(intent, practiceState);
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    controllerRef.current?.abort();
    clearTimers();
    const controller = new AbortController();
    controllerRef.current = controller;
    const isCurrentRequest = () => activeRef.current && requestIdRef.current === requestId;
    if (requestIntent !== 'RETROALIMENTAR' && requestIntent !== 'DUDA') onPracticeStateChange?.(null);
    if (appendUser) onAppendMessages([{ role: 'user', content: question }]);
    setError(null);
    activeRef.current = true;
    setPending({ stage: 1 });

    // Historial request-scoped: turnos previos (excluye la pregunta recién
    // agregada). El backend lo trata como contexto no confiable.
    const history = buildTutorHistory(conversation, question);

    timersRef.current.push(
      setTimeout(() => {
        if (isCurrentRequest()) setPending((p) => (p ? { ...p, stage: 2 } : p));
      }, 650),
    );

    client
      .post(`/api/lessons/${lessonId}/chat`, { message: question, history, intent: requestIntent }, { signal: controller.signal })
      .then(({ data }) => {
        if (!isCurrentRequest()) return;
        if (!data?.success) throw new Error(data?.message || 'No se pudo consultar al tutor');
        const citations = Array.isArray(data.data?.citations) ? data.data.citations : [];
        const answer = data.data?.answer || 'No encontré evidencia suficiente.';

        const usedSources = citations.length > 0;
        if (usedSources) {
          timersRef.current.push(
            setTimeout(() => {
              if (isCurrentRequest()) setPending((p) => (p ? { ...p, stage: 3, count: citations.length } : p));
            }, 450),
          );
        }
        timersRef.current.push(
          setTimeout(() => {
            if (isCurrentRequest()) setPending((p) => (p ? { ...p, stage: 4 } : p));
          }, usedSources ? 1350 : 0),
        );
        timersRef.current.push(
          setTimeout(() => {
            if (!isCurrentRequest()) return;
            const relatedLesson = data.data?.relatedLesson ?? null;
            const dil = data.data?.dil ?? null;
            onAppendMessages([{ role: 'tutor', content: answer, citations, relatedLesson, dil }]);
            const nextPracticeState = practiceStateAfterResponse(requestIntent, citations.length);
            if (nextPracticeState !== undefined) onPracticeStateChange?.(nextPracticeState);
            activeRef.current = false;
            if (controllerRef.current === controller) controllerRef.current = null;
            clearTimers();
            setPending(null);
          }, usedSources ? 2000 : CONVERSATION_REVEAL_MS),
        );
      })
      .catch((err) => {
        if (!isCurrentRequest()) return;
        clearTimers();
        activeRef.current = false;
        if (controllerRef.current === controller) controllerRef.current = null;
        setPending(null);
        setError({
          question,
          intent: requestIntent,
          message: requestErrorMessage(err, 'No se pudo consultar al tutor en este momento.'),
        });
        if ([409, 422].includes(err.response?.status)) {
          refreshTutorState({ force: true, showLoading: false });
        }
      });
  };

  const handleSend = () => {
    const q = input.trim();
    if (!q || pending || !ready) return;
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    ask(q);
  };

  const handleNewConversation = () => {
    requestIdRef.current += 1;
    activeRef.current = false;
    controllerRef.current?.abort();
    controllerRef.current = null;
    clearTimers();
    setPending(null);
    setError(null);
    setInput('');
    onResetConversation();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const pendingText =
    pending?.stage === 3
      ? `Encontré ${pending.count} fuente${pending.count === 1 ? '' : 's'} relevante${pending.count === 1 ? '' : 's'}`
      : STAGE_LABELS[pending?.stage] || 'Trabajando…';

  const canSend = ready && !pending && input.trim().length > 0;
  const practiceHasQuiz = renderableNodes(conversation.at(-1)?.dil).some((node) => node.c === 'Quiz');
  const connectionLabel = ready
    ? 'Conectado'
    : lessonReady && credentialRequired
      ? 'Clave requerida'
      : 'No disponible';

  return (
    <div className="flex flex-col h-full min-h-0 bg-white">
      {/* Header */}
      <header className="shrink-0 border-b-2 border-gray-100 px-4 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <RoleBadge Icon={settingsOpen ? GearIcon : SparklesIcon} solid="bg-titi-yellow" />
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-extrabold text-titi-dark leading-none">
              {settingsOpen ? 'Configuración del tutor' : 'Tutor IA'}
            </h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              {status && (ready ? (
                <span className="inline-flex items-center gap-1.5 h-6 rounded-full bg-green-50 border-2 border-green-500 px-2 text-xs font-extrabold text-green-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" aria-hidden="true" />
                  {connectionLabel}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 h-6 rounded-full bg-gray-50 border-2 border-gray-200 px-2 text-xs font-extrabold text-gray-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400" aria-hidden="true" />
                  {connectionLabel}
                </span>
              ))}
              <p className="text-xs font-semibold text-gray-500">Apoyo formativo · no califica</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleNewConversation}
            aria-label="Nueva conversación"
            title="Nueva conversación"
            className={HEADER_BTN}
          >
            <PlusIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen((open) => !open)}
            aria-label={settingsOpen ? 'Volver a la conversación' : 'Configurar tutor'}
            aria-pressed={settingsOpen}
            title={settingsOpen ? 'Volver a la conversación' : 'Configurar tutor'}
            className={`${HEADER_BTN} ${settingsOpen ? 'bg-titi-yellow border-titi-dark shadow-[0_2px_0_#1A1A2E]' : ''}`}
          >
            <GearIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar panel"
            className={HEADER_BTN}
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Contexto de la lección */}
      {!settingsOpen && <div className="shrink-0 px-4 pt-3 pb-3 border-b-2 border-gray-100">
        <div className="rounded-xl border-2 border-titi-dark bg-titi-yellow-light px-3 py-2.5">
          <div className="flex items-start gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-titi-yellow border-2 border-titi-dark grid place-items-center shrink-0 -rotate-6" aria-hidden="true">
              <BookIcon className="w-4 h-4 text-titi-dark" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-extrabold uppercase tracking-wide text-titi-dark/60">Contexto activo de la lección</p>
              <p className="text-sm font-extrabold text-titi-dark leading-snug line-clamp-1 mt-0.5">{leccionTitulo}</p>
              <p className="text-xs font-semibold text-gray-600 mt-0.5 line-clamp-1">
                {moduloNumero ? `Módulo ${moduloNumero} · ` : ''}{moduloTitulo}
                {cursoTitulo ? ` · ${cursoTitulo}` : ''}
              </p>
            </div>
          </div>
        </div>
        {practiceState?.phase === PRACTICE_AWAITING_ANSWER && (
          <div role="status" className="mt-2 flex items-start gap-2.5 rounded-xl border-2 border-green-500 bg-green-50 px-3 py-2">
            <span className="w-7 h-7 rounded-lg bg-green-500 text-white grid place-items-center shrink-0" aria-hidden="true">
              <PracticeIcon className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-titi-dark">Práctica en curso</p>
              <p className="text-xs font-medium text-gray-600 mt-0.5">
                {practiceHasQuiz ? 'Elegí una opción o respondé' : 'Respondé'} en el campo de abajo para recibir retroalimentación formativa. No es una calificación oficial.
              </p>
            </div>
          </div>
        )}
      </div>}

      {/* Cuerpo: conversación / estados */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-none px-4 py-4 flex flex-col gap-4">
        {settingsOpen ? (
          <TutorSettings
            credential={credential}
            required={credentialRequired}
            loading={credentialLoading}
            loadError={credentialError}
            onRetry={() => refreshTutorState({ force: true, showLoading: false })}
            onChanged={() => refreshTutorState({ force: true, showLoading: false })}
          />
        ) : statusErrorMessage ? (
          <TutorLoadError message={statusErrorMessage} onRetry={() => refreshTutorState({ force: true })} />
        ) : status === null ? (
          <div role="status" className="m-auto flex flex-col items-center gap-3 text-center animate-pulse">
            <span className="w-12 h-12 rounded-xl bg-gray-100" aria-hidden="true" />
            <p className="text-sm text-gray-500 font-semibold">Verificando disponibilidad del tutor…</p>
          </div>
        ) : !status.enabled ? (
          <UnavailableState />
        ) : !status.indexed ? (
          <IndexingState />
        ) : !credentialReady ? (
          <CredentialOnboarding
            invalid={(credential?.status ?? status?.credential?.status) === 'INVALID'}
            onStart={() => setSettingsOpen(true)}
          />
        ) : conversation.length === 0 && !pending && !error ? (
          <EmptyState onAsk={(prompt) => ask(prompt)} />
        ) : (
          <>
            {conversation.map((msg, index) => (
              <MessageBubble
                key={`${index}-${msg.role}`}
                msg={msg}
                messageRef={index === conversation.length - 1 && msg.role === 'tutor' ? latestTutorMessageRef : undefined}
                showActions={index === conversation.length - 1 && msg.role === 'tutor'}
                quizEnabled={index === conversation.length - 1 && msg.role === 'tutor' && !pending}
                onAsk={(prompt, options) => ask(prompt, options)}
                onFocusInput={() => textareaRef.current?.focus()}
                onNavigateToLesson={onNavigateToLesson}
              />
            ))}

            {pending && (
              <div className="flex items-start gap-2.5" role="status" aria-live="polite">
                <TutorAvatar />
                <div className="rounded-2xl rounded-tl-md border-2 border-gray-200 bg-white px-3.5 py-2.5 flex flex-col gap-2">
                  <p className="text-sm font-bold text-titi-dark">{pendingText}</p>
                  <div className="flex gap-1.5" aria-hidden="true">
                    {[1, 2, 3, 4].map((n) => (
                      <span
                        key={n}
                        className={`w-6 h-1.5 rounded-full transition-colors duration-200 motion-reduce:transition-none ${n <= pending.stage ? 'bg-titi-yellow' : 'bg-gray-200'}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {error && (
              <ErrorBox
                title="No pudimos consultar al tutor"
                message={error.message}
                onRetry={() => ask(error.question, { appendUser: false, intent: error.intent })}
              />
            )}

            <div ref={endRef} />
          </>
        )}
      </div>

      {/* Input: nunca se muestra sin disponibilidad y credencial válida. */}
      {!settingsOpen && ready && <div className="shrink-0 border-t-2 border-gray-100 p-3">
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => { setInput(e.target.value); resizeTextarea(); }}
            onKeyDown={handleKeyDown}
            rows={1}
            maxLength={1000}
            placeholder={practiceState?.phase === PRACTICE_AWAITING_ANSWER ? 'Escribí tu respuesta para recibir feedback…' : 'Preguntá sobre esta lección…'}
            aria-label={practiceState?.phase === PRACTICE_AWAITING_ANSWER ? 'Respuesta para la práctica del tutor' : 'Pregunta al tutor de la lección'}
            className={`${INPUT} min-w-0 resize-none max-h-[120px]`}
          />
          <button
            type="submit"
            disabled={!canSend}
            aria-label="Enviar pregunta"
            className={`w-11 h-11 shrink-0 grid place-items-center rounded-xl border-2 transition-all duration-150 motion-reduce:transition-none focus:outline-none focus-visible:ring-4 focus-visible:ring-titi-yellow/60 ${
              canSend
                ? 'bg-titi-yellow border-titi-dark text-titi-dark shadow-[0_3px_0_#1A1A2E] hover:-translate-y-0.5 hover:shadow-[0_4px_0_#1A1A2E] active:translate-y-0.5 active:shadow-none'
                : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <SendIcon className="w-4 h-4" />
          </button>
        </form>
        <p className="mt-1.5 text-xs font-medium text-gray-500">
          {practiceState?.phase === PRACTICE_AWAITING_ANSWER ? 'Al enviar recibirás feedback formativo · no modifica notas' : 'Enter para enviar · Shift+Enter para nueva línea'}
        </p>
      </div>}
    </div>
  );
}

// Botón redondo de la cabecera (nueva conversación, ajustes, cerrar).
const HEADER_BTN = [
  'w-9 h-9 grid place-items-center rounded-full border-2 border-gray-200 bg-white text-titi-dark',
  'hover:border-titi-dark active:translate-y-0.5 active:shadow-none transition-all duration-150 motion-reduce:transition-none',
  'focus:outline-none focus-visible:ring-4 focus-visible:ring-titi-yellow/60',
].join(' ');

// Avatar del tutor al lado de sus respuestas.
function TutorAvatar() {
  return (
    <span className="w-8 h-8 rounded-lg bg-titi-yellow border-2 border-titi-dark grid place-items-center shrink-0 -rotate-6" aria-hidden="true">
      <SparklesIcon className="w-4 h-4 text-titi-dark" />
    </span>
  );
}

function requestErrorMessage(error, fallback) {
  const serverMessage = error?.response?.data?.message;
  if (typeof serverMessage === 'string' && serverMessage.trim()) return serverMessage;
  const messages = {
    400: 'La clave enviada no tiene un formato válido.',
    409: 'Conectá una clave de Groq para usar el Tutor IA.',
    422: 'La clave de Groq no es válida o fue revocada.',
    429: 'Groq alcanzó su límite de uso. Intentá nuevamente más tarde.',
    502: 'Groq no está disponible en este momento. Intentá nuevamente más tarde.',
    504: 'Groq tardó demasiado en responder. Intentá nuevamente.',
  };
  return messages[error?.response?.status] || fallback;
}

function CredentialOnboarding({ invalid, onStart }) {
  const ref = usePopIn([]);
  return (
    <div ref={ref} className="m-auto w-full flex flex-col items-center text-center py-4">
      <TitiMascot state="pensando" size="sm" message="" className="mb-3" />
      <h3 className="text-lg font-extrabold text-titi-dark mb-2 leading-snug">
        Conectá tu clave para usar el Tutor IA
      </h3>
      {invalid && (
        <p role="alert" className="mb-3 rounded-xl border-2 border-red-500 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
          Tu clave guardada no es válida o fue revocada. Reemplazala para continuar.
        </p>
      )}
      <p className="text-sm text-gray-500 font-medium leading-relaxed max-w-sm">
        Tu clave se guarda cifrada y queda vinculada a tu cuenta. Tus preguntas y el contexto del curso pasan por Cloudflare y Groq para generar cada respuesta.
      </p>
      <a
        href="https://console.groq.com/keys"
        target="_blank"
        rel="noopener noreferrer"
        className={`${BTN_SECONDARY_SM} mt-4`}
      >
        Obtener clave de Groq
        <ExternalLinkIcon className="w-4 h-4" />
      </a>
      <button
        type="button"
        onClick={onStart}
        className="titi-btn-primary mt-3 text-sm px-5 py-2.5"
      >
        <KeyIcon className="w-4 h-4" />
        Ya tengo una clave
      </button>
    </div>
  );
}

function TutorSettings({ credential, required, loading, loadError, onRetry, onChanged }) {
  const connected = Boolean(credential?.configured && credential?.status === 'VALID');
  const [editing, setEditing] = useState(!connected);
  const [apiKey, setApiKey] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [formError, setFormError] = useState(null);
  const [success, setSuccess] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!connected) setEditing(true);
  }, [connected]);

  useEffect(() => {
    if (!editing || connected || loading) return undefined;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [connected, editing, loading]);

  const focusInput = () => {
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleSave = async (event) => {
    event.preventDefault();
    const submittedKey = apiKey.trim();
    setFormError(null);
    setSuccess(null);
    if (!submittedKey) {
      setFormError('Ingresá tu clave API de Groq.');
      focusInput();
      return;
    }

    setApiKey('');
    setSaving(true);
    try {
      const { data } = await client.put('/api/rag/credentials/groq', { apiKey: submittedKey });
      if (!data?.success) throw new Error(data?.message || 'No se pudo guardar la clave.');
      await onChanged();
      setEditing(false);
      setRevealed(false);
      setSuccess('Clave conectada correctamente.');
    } catch (error) {
      setFormError(requestErrorMessage(error, 'No se pudo validar la clave. Intentá nuevamente.'));
      focusInput();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setFormError(null);
    setSuccess(null);
    try {
      const { data } = await client.delete('/api/rag/credentials/groq');
      if (!data?.success) throw new Error(data?.message || 'No se pudo eliminar la clave.');
      setConfirmOpen(false);
      setEditing(true);
      setApiKey('');
      setRevealed(false);
      await onChanged();
      setSuccess('Clave eliminada. El Tutor IA quedó desconectado.');
      focusInput();
    } catch (error) {
      setFormError(requestErrorMessage(error, 'No se pudo eliminar la clave. Intentá nuevamente.'));
    } finally {
      setDeleting(false);
    }
  };

  if (loading && !credential) {
    return (
      <div role="status" className="w-full space-y-3 animate-pulse">
        <SkeletonLine className="h-4 w-2/3" />
        <div className="h-24 rounded-2xl bg-gray-100" aria-hidden="true" />
        <span className="sr-only">Cargando configuración…</span>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-4">
      <div>
        <h3 className="text-base font-extrabold text-titi-dark">
          Clave personal de <span className="text-titi-streak">Groq</span>
        </h3>
        <p className="mt-1 text-sm font-medium leading-relaxed text-gray-500">
          La clave se guarda cifrada, vinculada a tu cuenta y nunca se vuelve a mostrar completa. Las preguntas y el contexto del curso pasan por Cloudflare y Groq.
        </p>
        <a
          href="https://console.groq.com/keys"
          target="_blank"
          rel="noopener noreferrer"
          className={`${BTN_SECONDARY_SM} mt-3`}
        >
          Obtener clave de Groq
          <ExternalLinkIcon className="w-4 h-4" />
        </a>
      </div>

      {loadError && <ErrorBox title="No pudimos cargar tu clave" message={loadError} onRetry={onRetry} />}

      {!required && !connected && (
        <p role="status" className="flex items-center gap-2 rounded-xl border-2 border-green-500 bg-green-50 p-3 text-sm font-bold text-green-700">
          <CheckIcon className="w-4 h-4 shrink-0" />
          Este tutor no requiere una clave personal.
        </p>
      )}

      {credential?.configured && (
        <div className={`rounded-2xl border-2 p-4 ${connected ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}`}>
          <div className="flex items-center gap-2.5">
            <span
              className={`w-8 h-8 rounded-full grid place-items-center shrink-0 text-white ${connected ? 'bg-green-500' : 'bg-red-500'}`}
              aria-hidden="true"
            >
              {connected ? <CheckIcon className="w-4 h-4" /> : <span className="text-sm font-black">!</span>}
            </span>
            <div className="min-w-0">
              <p className={`text-sm font-extrabold ${connected ? 'text-green-700' : 'text-red-700'}`}>
                {connected ? 'Clave conectada' : 'Clave inválida o revocada'}
              </p>
              {credential.last4 && (
                <p className="text-sm font-bold text-titi-dark tabular-nums" aria-label={`Clave terminada en ${credential.last4}`}>
                  Terminada en •••• {credential.last4}
                </p>
              )}
            </div>
          </div>
          {credential.updatedAt && (
            <p className="mt-2 text-xs font-semibold text-gray-500">
              Actualizada {formatCredentialDate(credential.updatedAt)}
            </p>
          )}
          {credential.configured && (
            <div className="mt-3 flex flex-wrap gap-2">
              {connected && !editing && (
                <button
                  type="button"
                  onClick={() => { setEditing(true); setSuccess(null); focusInput(); }}
                  className={BTN_SECONDARY_SM}
                >
                  <RefreshIcon className="w-4 h-4" />
                  Reemplazar clave
                </button>
              )}
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                className={BTN_DANGER_SM}
              >
                Eliminar clave
              </button>
            </div>
          )}
        </div>
      )}

      {editing && (
        <form onSubmit={handleSave} className={`${SURFACE} p-4`}>
          <label htmlFor="groq-api-key" className="block text-sm font-extrabold text-titi-dark mb-2">
            Clave API de Groq
          </label>
          <div className="flex gap-2 items-stretch">
            <input
              ref={inputRef}
              id="groq-api-key"
              type={revealed ? 'text' : 'password'}
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={512}
              disabled={saving}
              aria-invalid={Boolean(formError)}
              aria-describedby={formError ? 'groq-api-key-error' : undefined}
              placeholder="gsk_…"
              className={`${INPUT} min-w-0 font-mono`}
            />
            <button
              type="button"
              onClick={() => setRevealed((value) => !value)}
              aria-label={revealed ? 'Ocultar clave' : 'Mostrar clave'}
              aria-pressed={revealed}
              disabled={saving}
              className="w-11 shrink-0 grid place-items-center rounded-xl border-2 border-gray-200 bg-white text-gray-500 hover:border-titi-dark hover:text-titi-dark active:translate-y-0.5 transition-all duration-150 disabled:opacity-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-titi-yellow/60"
            >
              {revealed ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
            </button>
          </div>
          {formError && (
            <p id="groq-api-key-error" role="alert" className="mt-2 flex items-center gap-1.5 text-sm font-bold text-red-700">
              <AlertIcon className="w-4 h-4 shrink-0" />
              {formError}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving || !apiKey.trim()}
              aria-busy={saving}
              className="titi-btn-primary text-sm px-5 py-2.5"
            >
              {saving ? 'Validando…' : connected ? 'Guardar reemplazo' : 'Conectar clave'}
            </button>
            {connected && (
              <button
                type="button"
                onClick={() => { setEditing(false); setApiKey(''); setFormError(null); }}
                disabled={saving}
                className={BTN_SECONDARY}
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      )}

      {success && (
        <p role="status" className="flex items-center gap-2 rounded-xl border-2 border-green-500 bg-green-50 p-3 text-sm font-bold text-green-700">
          <CheckIcon className="w-4 h-4 shrink-0" />
          {success}
        </p>
      )}

      <ConfirmModal
        open={confirmOpen}
        title="¿Eliminar tu clave de Groq?"
        message="El Tutor IA quedará desconectado hasta que agregues otra clave."
        confirmText="Eliminar clave"
        cancelText="Cancelar"
        danger
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => { if (!deleting) setConfirmOpen(false); }}
      />
    </div>
  );
}

function TutorLoadError({ message, onRetry }) {
  return (
    <div className="m-auto w-full">
      <ErrorBox title="No pudimos abrir el tutor" message={message} onRetry={onRetry} />
    </div>
  );
}

function formatCredentialDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium' }).format(date);
}

// ---- Estado vacío con quick actions reales ----
function EmptyState({ onAsk }) {
  const ref = usePopIn([]);
  const actionsRef = useStaggerReveal([]);
  return (
    <div ref={ref} className="m-auto w-full flex flex-col items-center text-center py-4">
      <TitiMascot state="saludo" size="sm" message="" className="mb-3" />
      <h3 className="text-lg font-extrabold text-titi-dark mb-1.5">
        ¡Hola! Soy tu <span className="text-titi-streak">Tutor IA</span>.
      </h3>
      <p className="text-sm text-gray-500 font-medium leading-relaxed mb-5 max-w-xs">
        Puedo ayudarte a comprender esta lección, darte ejemplos, generar ejercicios y resolver tus dudas usando los materiales del curso. No pongo notas ni cambio tu progreso.
      </p>
      <div ref={actionsRef} className="w-full grid grid-cols-2 gap-2.5">
        {QUICK_ACTIONS.map(({ label, Icon, solid, prompt, intent }) => (
          <button
            key={label}
            type="button"
            onClick={() => onAsk(prompt, { intent })}
            className={`${TILE} flex flex-col items-start gap-2 px-3 py-3 text-left text-sm font-extrabold text-titi-dark leading-snug`}
          >
            <RoleBadge Icon={Icon} solid={solid} size="sm" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---- Estados honestos cuando el tutor no está listo ----
function UnavailableState() {
  return (
    <div className="m-auto w-full flex flex-col items-center text-center">
      <TitiMascot state="pensando" size="sm" message="" className="mb-3" />
      <h3 className="text-lg font-extrabold text-titi-dark mb-1">
        El tutor todavía no está <span className="text-titi-streak">disponible</span>
      </h3>
      <p className="text-sm text-gray-500 font-medium max-w-xs leading-relaxed">
        Estamos preparando el tutor IA para este curso. Volvé en unos días.
      </p>
    </div>
  );
}

function IndexingState() {
  return (
    <div className="m-auto w-full flex flex-col items-center text-center">
      <TitiMascot state="idle" size="sm" message="" className="mb-3" />
      <h3 className="text-lg font-extrabold text-titi-dark mb-1">
        Preparando los <span className="text-titi-streak">materiales</span>…
      </h3>
      <p className="text-sm text-gray-500 font-medium max-w-xs leading-relaxed">
        Todavía estoy organizando el contenido de esta lección. Intentá de nuevo en unos minutos.
      </p>
    </div>
  );
}

// ---- Burbujas de mensaje ----
function MessageBubble({ msg, messageRef, showActions, quizEnabled, onAsk, onFocusInput, onNavigateToLesson }) {
  const [openCitations, setOpenCitations] = useState(() => new Set());
  const citationRefs = useRef({});

  const toggleCitation = (number) => setOpenCitations((current) => {
    const next = new Set(current);
    if (next.has(number)) next.delete(number);
    else next.add(number);
    return next;
  });

  // A badge inside the answer opens its source and brings it into view.
  const showCitation = (number) => {
    setOpenCitations((current) => new Set(current).add(number));
    requestAnimationFrame(() => citationRefs.current[number]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  };

  if (msg.role === 'user') {
    return (
      <div className="self-end max-w-[85%] bg-titi-yellow text-titi-dark border-2 border-titi-dark rounded-2xl rounded-br-md px-4 py-2.5 text-sm font-semibold whitespace-pre-wrap break-words shadow-[0_2px_0_#1A1A2E]">
        {msg.content}
      </div>
    );
  }

  const { relatedLesson } = msg;
  const dilNodes = renderableNodes(msg.dil);
  const citationNumbers = (msg.citations || []).map((citation) => citation.number);

  return (
    <div ref={messageRef} className="self-start w-full max-w-full flex items-start gap-2.5 scroll-mt-2">
      <TutorAvatar />
      <div className="min-w-0 flex-1 bg-white border-2 border-titi-dark rounded-2xl rounded-tl-md px-4 py-3 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
        {dilNodes.length ? (
          <DilMessage
            nodes={dilNodes}
            citationNumbers={citationNumbers}
            onCite={showCitation}
            onFocusInput={showActions ? onFocusInput : undefined}
            quizEnabled={quizEnabled}
            onQuizAnswer={(option) => onAsk(quizAnswerMessage(option), { intent: 'RETROALIMENTAR' })}
          />
        ) : (
          <MarkdownContent content={msg.content} format="MARKDOWN" compact codeCopy />
        )}
        {relatedLesson && (
          <div className="mt-3 rounded-xl border-2 border-titi-dark bg-titi-yellow-light px-3 py-2.5">
            <p className="text-sm font-bold text-titi-dark">
              Esta respuesta usa material de otra lección del curso.
            </p>
            <button
              type="button"
              onClick={() => onNavigateToLesson(relatedLesson.lessonId)}
              className={`${BTN_SECONDARY_SM} mt-2`}
            >
              Ir a la lección
              <ArrowRightIcon className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        )}
        {msg.citations?.length > 0 && (
          <div className="mt-3 border-t-2 border-gray-100 pt-3">
            <p className="text-xs font-extrabold uppercase tracking-wide text-gray-500 flex items-center gap-1.5 mb-2">
              <BookIcon className="w-4 h-4 text-titi-dark" aria-hidden="true" />
              Fuentes utilizadas ({msg.citations.length})
            </p>
            <div className="flex flex-col gap-2">
              {msg.citations.map((citation) => (
                <CitationCard
                  key={`${citation.lessonId}-${citation.number}`}
                  citation={citation}
                  open={openCitations.has(citation.number)}
                  onToggle={() => toggleCitation(citation.number)}
                  cardRef={(element) => { citationRefs.current[citation.number] = element; }}
                  onNavigate={onNavigateToLesson}
                />
              ))}
            </div>
          </div>
        )}
        {showActions && (
          <div className="mt-3 flex flex-wrap gap-1.5 border-t-2 border-gray-100 pt-3">
            {POST_ACTIONS.map(({ label, prompt, intent }) => (
              <button
                key={label}
                type="button"
                onClick={() => onAsk(prompt, { intent })}
                className="h-8 rounded-full border-2 border-gray-200 bg-white px-3 text-xs font-extrabold text-titi-dark hover:border-titi-dark hover:bg-titi-yellow-light active:translate-y-0.5 transition-all duration-150 motion-reduce:transition-none focus:outline-none focus-visible:ring-4 focus-visible:ring-titi-yellow/60"
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Fuente RAG expandible (datos reales del backend) ----
function CitationCard({ citation, open, onToggle, cardRef, onNavigate }) {
  return (
    <div
      ref={cardRef}
      className={`rounded-xl border-2 bg-white overflow-hidden transition-colors duration-150 ${open ? 'border-titi-dark' : 'border-gray-200'}`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full text-left px-3 py-2.5 flex items-start gap-2.5 hover:bg-titi-cream transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-titi-yellow/60"
      >
        <span className="w-6 h-6 rounded-md bg-titi-yellow border-2 border-titi-dark grid place-items-center text-xs font-black text-titi-dark tabular-nums shrink-0 mt-0.5">
          {citation.number}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-extrabold text-titi-dark leading-snug line-clamp-2">
            {citation.title}
          </span>
          <span className="block text-xs font-semibold text-gray-500 mt-0.5 truncate">
            {citation.moduleTitle}
          </span>
          <span className="inline-flex items-center gap-1 mt-1.5 rounded-full bg-green-50 border-2 border-green-500 px-2 py-0.5 text-xs font-extrabold text-green-700">
            <CheckIcon className="w-3 h-3" />
            Fuente publicada del curso
          </span>
        </span>
        <ChevronDownIcon
          className={`w-4 h-4 text-titi-dark shrink-0 mt-1 transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      <div className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="px-3 pb-3">
            <p className="text-sm leading-relaxed text-gray-600 border-l-2 border-titi-yellow pl-2.5">{citation.excerpt}</p>
            <button
              type="button"
              onClick={() => onNavigate(citation.lessonId)}
              className={`${BTN_SECONDARY_SM} mt-2.5`}
            >
              Ver material
              <ArrowRightIcon className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
