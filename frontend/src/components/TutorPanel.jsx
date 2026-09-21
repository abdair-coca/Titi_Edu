import { useCallback, useEffect, useRef, useState } from 'react';
import client from '../api/client.js';
import ConfirmModal from './ConfirmModal.jsx';
import MarkdownContent from './MarkdownContent.jsx';
import TitiMascot from './TitiMascot.jsx';
import { buildTutorHistory } from '../lib/tutorHistory.js';
import {
  PRACTICE_AWAITING_ANSWER,
  practiceStateAfterResponse,
  resolveTutorIntent,
} from '../lib/tutorPractice.js';
import { usePopIn } from '../lib/motion.js';
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
} from './icons.jsx';

// Secuencia de estados de carga: visual, honesta. Las etapas 1–2 se ejecutan
// con temporizador corto; la 3 usa el conteo REAL de fuentes de la respuesta
// y la 4 precede al reveal. El backend responde en un solo turno, así que no
// se afirma ninguna operación que no ocurra.
const STAGE_LABELS = {
  1: 'Analizando tu pregunta…',
  2: 'Buscando en los materiales del curso…',
  4: 'Preparando tu respuesta…',
};

const QUICK_ACTIONS = [
  {
    label: 'Explícame este tema',
    Icon: BookIcon,
    intent: 'EXPLICAR',
    prompt: 'Explícame este tema de forma sencilla, usando los materiales de la lección.',
  },
  {
    label: 'Dame un ejemplo',
    Icon: CodeIcon,
    intent: 'EJEMPLO',
    prompt: 'Dame un ejemplo práctico sobre este tema.',
  },
  {
    label: 'Hazme una pregunta',
    Icon: LightbulbIcon,
    intent: 'PRACTICA',
    prompt: 'Proponé una pregunta de práctica sobre este tema. No muestres la solución.',
  },
  {
    label: 'Crea un ejercicio',
    Icon: PracticeIcon,
    intent: 'PRACTICA',
    prompt: 'Crea un ejercicio sobre este tema para practicar.',
  },
];

const POST_ACTIONS = [
  { label: 'Más simple', intent: 'EXPLICAR', prompt: 'Explicámelo más simple, paso a paso, usando los materiales de la lección.' },
  { label: 'Otro ejemplo', intent: 'EJEMPLO', prompt: 'Dame otro ejemplo distinto sobre este tema.' },
  { label: 'Ejercicio', intent: 'PRACTICA', prompt: 'Crea un ejercicio de práctica sobre este tema. No muestres la solución.' },
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
  titleId = 'tutor-panel-title',
}) {
  const [status, setStatus] = useState(null); // null | { enabled, indexed, credential }
  const [statusError, setStatusError] = useState(null);
  const [credential, setCredential] = useState(null);
  const [credentialLoading, setCredentialLoading] = useState(true);
  const [credentialError, setCredentialError] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
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
  const availabilityRequestRef = useRef(0);

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

  const refreshTutorState = useCallback(async ({ showLoading = true } = {}) => {
    const requestId = availabilityRequestRef.current + 1;
    availabilityRequestRef.current = requestId;
    if (showLoading) setStatus(null);
    setStatusError(null);
    setCredentialLoading(true);
    setCredentialError(null);

    const [statusResult, credentialResult] = await Promise.allSettled([
      client.get(`/api/lessons/${lessonId}/chat/status`),
      client.get('/api/rag/credentials/groq'),
    ]);
    if (availabilityRequestRef.current !== requestId) return;

    let nextStatus = null;
    if (statusResult.status === 'fulfilled' && statusResult.value.data?.success) {
      const data = statusResult.value.data.data;
      nextStatus = {
        enabled: Boolean(data?.enabled),
        indexed: Boolean(data?.indexed),
        credential: data?.credential || null,
      };
      setStatus(nextStatus);
    } else {
      setStatus(null);
      setStatusError(requestErrorMessage(
        statusResult.status === 'rejected' ? statusResult.reason : null,
        'No se pudo verificar la disponibilidad del tutor.',
      ));
    }

    if (credentialResult.status === 'fulfilled' && credentialResult.value.data?.success) {
      setCredential({
        ...(nextStatus?.credential || {}),
        ...credentialResult.value.data.data,
      });
    } else {
      setCredential(nextStatus?.credential || null);
      setCredentialError(requestErrorMessage(
        credentialResult.status === 'rejected' ? credentialResult.reason : null,
        'No se pudo cargar la configuración de la clave.',
      ));
    }
    setCredentialLoading(false);
  }, [lessonId]);

  useEffect(() => {
    refreshTutorState();
    return () => { availabilityRequestRef.current += 1; };
  }, [refreshTutorState]);

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

        timersRef.current.push(
          setTimeout(() => {
            if (isCurrentRequest()) setPending((p) => (p ? { ...p, stage: 3, count: citations.length } : p));
          }, 450),
        );
        timersRef.current.push(
          setTimeout(() => {
            if (isCurrentRequest()) setPending((p) => (p ? { ...p, stage: 4 } : p));
          }, 1350),
        );
        timersRef.current.push(
          setTimeout(() => {
            if (!isCurrentRequest()) return;
            const relatedLesson = data.data?.relatedLesson ?? null;
            onAppendMessages([{ role: 'tutor', content: answer, citations, relatedLesson }]);
            const nextPracticeState = practiceStateAfterResponse(requestIntent, citations.length);
            if (nextPracticeState !== undefined) onPracticeStateChange?.(nextPracticeState);
            activeRef.current = false;
            if (controllerRef.current === controller) controllerRef.current = null;
            clearTimers();
            setPending(null);
          }, 2000),
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
          refreshTutorState({ showLoading: false });
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
      ? pending.count > 0
        ? `Encontré ${pending.count} fuente${pending.count === 1 ? '' : 's'} relevante${pending.count === 1 ? '' : 's'}`
        : 'No encontré fuentes relevantes'
      : STAGE_LABELS[pending?.stage] || 'Trabajando…';

  const canSend = ready && !pending && input.trim().length > 0;
  const connectionLabel = ready
    ? 'Conectado'
    : lessonReady && credentialRequired
      ? 'Clave requerida'
      : 'No disponible';

  return (
    <div className="flex flex-col h-full min-h-0 bg-white">
      {/* Header */}
      <header className="shrink-0 border-b border-gray-100 px-4 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-8 h-8 rounded-full bg-titi-yellow grid place-items-center shrink-0">
            <SparklesIcon className="w-4 h-4 text-titi-dark" />
          </span>
          <div className="min-w-0">
            <h2 id={titleId} className="text-sm font-bold text-titi-dark leading-none">
              {settingsOpen ? 'Configuración del tutor' : 'Tutor IA'}
            </h2>
            <p className="text-[11px] font-semibold text-gray-400 mt-1">Apoyo formativo · no califica</p>
            <div className="mt-1">
              {status && (ready ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" aria-hidden="true" />
                  {connectionLabel}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400" aria-hidden="true" />
                  {connectionLabel}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleNewConversation}
            aria-label="Nueva conversación"
            title="Nueva conversación"
            className="w-8 h-8 grid place-items-center rounded-full text-gray-500 hover:text-titi-dark hover:bg-titi-cream transition-colors active:scale-95"
          >
            <PlusIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen((open) => !open)}
            aria-label={settingsOpen ? 'Volver a la conversación' : 'Configurar tutor'}
            aria-pressed={settingsOpen}
            title={settingsOpen ? 'Volver a la conversación' : 'Configurar tutor'}
            className="w-8 h-8 grid place-items-center rounded-full text-gray-500 hover:text-titi-dark hover:bg-titi-cream transition-colors duration-150 active:scale-95"
          >
            <GearIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar panel"
            className="w-8 h-8 grid place-items-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors active:scale-95"
          >
            ✕
          </button>
        </div>
      </header>

      {/* Contexto de la lección */}
      {!settingsOpen && <div className="shrink-0 px-4 pt-3">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1.5">
          Contexto activo de la lección
        </p>
        <div className="rounded-xl border border-titi-yellow/40 bg-titi-yellow-light/50 px-3 py-2.5">
          <div className="flex items-start gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-titi-yellow grid place-items-center shrink-0">
              <BookIcon className="w-4 h-4 text-titi-dark" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-titi-dark leading-snug line-clamp-1">{cursoTitulo}</p>
              <p className="text-xs font-semibold text-gray-500 mt-0.5 line-clamp-1">
                {moduloNumero ? `Capítulo ${moduloNumero} · ` : ''}{moduloTitulo}
              </p>
              <p className="text-xs font-medium text-gray-400 mt-0.5 line-clamp-2">{leccionTitulo}</p>
            </div>
          </div>
        </div>
        {practiceState?.phase === PRACTICE_AWAITING_ANSWER && (
          <div role="status" className="mt-2 rounded-xl border border-titi-yellow/50 bg-titi-yellow-light/40 px-3 py-2">
            <p className="text-xs font-bold text-titi-dark">Práctica en curso</p>
            <p className="text-xs font-medium text-gray-500 mt-0.5">
              Respondé en el campo de abajo para recibir retroalimentación formativa. No es una calificación oficial.
            </p>
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
            onRetry={() => refreshTutorState({ showLoading: false })}
            onChanged={() => refreshTutorState({ showLoading: false })}
          />
        ) : statusError ? (
          <TutorLoadError message={statusError} onRetry={() => refreshTutorState()} />
        ) : status === null ? (
          <p className="text-sm text-gray-400 font-medium">Verificando disponibilidad del tutor…</p>
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
                onAsk={(prompt, options) => ask(prompt, options)}
                onNavigateToLesson={onNavigateToLesson}
              />
            ))}

            {pending && (
              <div className="flex items-start gap-2.5">
                <span className="w-7 h-7 rounded-full bg-titi-yellow grid place-items-center shrink-0 mt-0.5">
                  <SparklesIcon className="w-4 h-4 text-titi-dark" />
                </span>
                <div className="pt-1 flex flex-col gap-1.5">
                  <p className="text-sm font-semibold text-titi-dark">{pendingText}</p>
                  <div className="flex gap-1.5" aria-hidden="true">
                    {[1, 2, 3, 4].map((n) => (
                      <span
                        key={n}
                        className={`w-4 h-1 rounded-full transition-colors duration-200 ${n <= pending.stage ? 'bg-titi-yellow' : 'bg-gray-200'}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                <span className="w-8 h-8 rounded-full bg-red-500 grid place-items-center shrink-0 text-white text-sm font-black" aria-hidden="true">!</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-red-700">
                    {error.message}
                  </p>
                  <button
                    type="button"
                    onClick={() => ask(error.question, { appendUser: false, intent: error.intent })}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-titi-dark bg-white border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 transition-colors"
                  >
                    Reintentar
                  </button>
                </div>
              </div>
            )}

            <div ref={endRef} />
          </>
        )}
      </div>

      {/* Input: nunca se muestra sin disponibilidad y credencial válida. */}
      {!settingsOpen && ready && <div className="shrink-0 border-t border-gray-100 p-3">
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
            className="w-full min-w-0 resize-none bg-titi-cream border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-titi-dark placeholder:text-gray-300 focus:outline-none focus:border-titi-yellow focus:ring-2 focus:ring-titi-yellow/20 transition-all duration-150 max-h-[120px]"
          />
          <button
            type="submit"
            disabled={!canSend}
            aria-label="Enviar pregunta"
            className={`w-10 h-10 shrink-0 grid place-items-center rounded-xl transition-all duration-150 ${
              canSend
                ? 'bg-titi-yellow text-titi-dark shadow-[0_3px_0px_#E6B800] hover:shadow-[0_1px_0px_#E6B800] hover:-translate-y-0.5 active:shadow-none active:translate-y-0'
                : 'bg-gray-100 text-gray-300 cursor-not-allowed'
            }`}
          >
            <SendIcon className="w-4 h-4" />
          </button>
        </form>
        <p className="mt-1.5 text-xs font-medium text-gray-400">
          {practiceState?.phase === PRACTICE_AWAITING_ANSWER ? 'Al enviar recibirás feedback formativo · no modifica notas' : 'Enter para enviar · Shift+Enter para nueva línea'}
        </p>
      </div>}
    </div>
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
  return (
    <div className="m-auto w-full flex flex-col items-center text-center py-4">
      <TitiMascot state="pensando" size="sm" message="" className="mb-3" />
      <h3 className="text-base font-bold text-titi-dark mb-2">
        Conectá tu clave para usar el Tutor IA
      </h3>
      {invalid && (
        <p role="alert" className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
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
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-blue-600 hover:text-titi-dark transition-colors duration-150"
      >
        Obtener clave de Groq
        <ExternalLinkIcon className="w-4 h-4" />
      </a>
      <button
        type="button"
        onClick={onStart}
        className="mt-5 bg-titi-yellow text-titi-dark font-bold text-sm px-5 py-2.5 rounded-xl shadow-[0_4px_0px_#E6B800] hover:shadow-[0_2px_0px_#E6B800] hover:-translate-y-0.5 active:shadow-none active:translate-y-0 transition-all duration-150"
      >
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
    return <p role="status" className="text-sm font-medium text-gray-400">Cargando configuración…</p>;
  }

  return (
    <div className="w-full flex flex-col gap-4">
      <div>
        <h3 className="text-base font-bold text-titi-dark">Clave personal de Groq</h3>
        <p className="mt-1 text-sm font-medium leading-relaxed text-gray-500">
          La clave se guarda cifrada, vinculada a tu cuenta y nunca se vuelve a mostrar completa. Las preguntas y el contexto del curso pasan por Cloudflare y Groq.
        </p>
        <a
          href="https://console.groq.com/keys"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-blue-600 hover:text-titi-dark transition-colors duration-150"
        >
          Obtener clave de Groq
          <ExternalLinkIcon className="w-4 h-4" />
        </a>
      </div>

      {loadError && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3">
          <p className="text-sm font-semibold text-red-700">{loadError}</p>
          <button type="button" onClick={onRetry} className="mt-2 text-xs font-bold text-titi-dark underline">
            Reintentar
          </button>
        </div>
      )}

      {!required && !connected && (
        <p role="status" className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-700">
          Este tutor no requiere una clave personal.
        </p>
      )}

      {credential?.configured && (
        <div className={`rounded-xl border p-4 ${connected ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
          <p className={`text-sm font-bold ${connected ? 'text-green-700' : 'text-red-700'}`}>
            {connected ? 'Clave conectada' : 'Clave inválida o revocada'}
          </p>
          {credential.last4 && (
            <p className="mt-1 text-sm font-semibold text-titi-dark" aria-label={`Clave terminada en ${credential.last4}`}>
              Terminada en •••• {credential.last4}
            </p>
          )}
          {credential.updatedAt && (
            <p className="mt-1 text-xs font-medium text-gray-500">
              Actualizada {formatCredentialDate(credential.updatedAt)}
            </p>
          )}
          {credential.configured && (
            <div className="mt-3 flex flex-wrap gap-2">
              {connected && !editing && (
                <button
                  type="button"
                  onClick={() => { setEditing(true); setSuccess(null); focusInput(); }}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-titi-dark hover:border-titi-yellow transition-colors duration-150"
                >
                  Reemplazar clave
                </button>
              )}
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                className="rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50 transition-colors duration-150"
              >
                Eliminar clave
              </button>
            </div>
          )}
        </div>
      )}

      {editing && (
        <form onSubmit={handleSave} className="rounded-2xl border border-gray-200 bg-white p-4">
          <label htmlFor="groq-api-key" className="block text-sm font-bold text-titi-dark mb-2">
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
              className="w-full min-w-0 bg-titi-cream border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium text-titi-dark placeholder:text-gray-300 focus:outline-none focus:border-titi-yellow focus:ring-2 focus:ring-titi-yellow/20 transition-all duration-150 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => setRevealed((value) => !value)}
              aria-label={revealed ? 'Ocultar clave' : 'Mostrar clave'}
              aria-pressed={revealed}
              disabled={saving}
              className="w-11 shrink-0 grid place-items-center rounded-xl border border-gray-200 text-gray-500 hover:border-titi-yellow hover:text-titi-dark transition-colors duration-150 disabled:opacity-50"
            >
              <EyeIcon className="w-5 h-5" crossed={revealed} />
            </button>
          </div>
          {formError && (
            <p id="groq-api-key-error" role="alert" className="mt-2 text-sm font-semibold text-red-700">
              {formError}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving || !apiKey.trim()}
              aria-busy={saving}
              className="bg-titi-yellow text-titi-dark font-bold text-sm px-5 py-2.5 rounded-xl shadow-[0_4px_0px_#E6B800] hover:shadow-[0_2px_0px_#E6B800] hover:-translate-y-0.5 active:shadow-none active:translate-y-0 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Validando…' : connected ? 'Guardar reemplazo' : 'Conectar clave'}
            </button>
            {connected && (
              <button
                type="button"
                onClick={() => { setEditing(false); setApiKey(''); setFormError(null); }}
                disabled={saving}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-titi-dark hover:bg-gray-50 transition-colors duration-150 disabled:opacity-50"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      )}

      {success && (
        <p role="status" className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-700">
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
    <div className="m-auto w-full rounded-xl border border-red-200 bg-red-50 p-4 text-center">
      <p role="alert" className="text-sm font-semibold text-red-700">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-bold text-titi-dark hover:bg-red-50 transition-colors duration-150"
      >
        Reintentar
      </button>
    </div>
  );
}

function formatCredentialDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium' }).format(date);
}

function GearIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
    </svg>
  );
}

function EyeIcon({ className, crossed }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {crossed && <path d="m4 4 16 16" />}
    </svg>
  );
}

// ---- Estado vacío con quick actions reales ----
function EmptyState({ onAsk }) {
  const ref = usePopIn([]);
  return (
    <div ref={ref} className="m-auto w-full flex flex-col items-center text-center py-4">
      <TitiMascot state="saludo" size="sm" message="" className="mb-3" />
      <h3 className="text-base font-bold text-titi-dark mb-1.5">¡Hola! Soy tu Tutor IA.</h3>
      <p className="text-sm text-gray-500 font-medium leading-relaxed mb-5 max-w-xs">
        Puedo ayudarte a comprender esta lección, darte ejemplos, generar ejercicios y resolver tus dudas usando los materiales del curso. No pongo notas ni cambio tu progreso.
      </p>
      <div className="w-full grid grid-cols-2 gap-2">
        {QUICK_ACTIONS.map(({ label, Icon, prompt, intent }) => (
          <button
            key={label}
            type="button"
            onClick={() => onAsk(prompt, { intent })}
            className="flex items-center gap-2 rounded-xl border-2 border-gray-200 bg-white px-3 py-2.5 text-left text-xs font-bold text-titi-dark hover:border-titi-yellow hover:-translate-y-0.5 hover:shadow-[0_3px_0px_#E5E7EB] active:translate-y-0 active:shadow-none transition-all duration-150"
          >
            <Icon className="w-4 h-4 text-titi-yellow-dark shrink-0" aria-hidden="true" />
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
      <h3 className="text-base font-bold text-titi-dark mb-1">El tutor todavía no está disponible</h3>
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
      <h3 className="text-base font-bold text-titi-dark mb-1">Preparando los materiales…</h3>
      <p className="text-sm text-gray-500 font-medium max-w-xs leading-relaxed">
        Todavía estoy organizando el contenido de esta lección. Intentá de nuevo en unos minutos.
      </p>
    </div>
  );
}

// ---- Burbujas de mensaje ----
function MessageBubble({ msg, messageRef, showActions, onAsk, onNavigateToLesson }) {
  if (msg.role === 'user') {
    return (
      <div className="self-end max-w-[85%] bg-titi-yellow text-titi-dark rounded-2xl rounded-br-md px-4 py-2.5 text-sm font-medium whitespace-pre-wrap">
        {msg.content}
      </div>
    );
  }

  const { relatedLesson } = msg;

  return (
    <div ref={messageRef} className="self-start w-full max-w-full">
      <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3">
        <MarkdownContent content={msg.content} format="MARKDOWN" compact codeCopy />
        {relatedLesson && (
          <div className="mt-3 rounded-xl border border-titi-yellow bg-titi-cream px-3 py-2.5">
            <p className="text-xs font-bold text-titi-dark">
              Esta respuesta usa material de otra lección del curso.
            </p>
            <button
              type="button"
              onClick={() => onNavigateToLesson(relatedLesson.lessonId)}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-titi-yellow px-3 py-1.5 text-xs font-bold text-titi-dark hover:bg-titi-yellow-light transition-colors"
            >
              Ir a la lección
              <ExternalLinkIcon className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        )}
        {msg.citations?.length > 0 && (
          <div className="mt-3 border-t border-gray-100 pt-3">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500 flex items-center gap-1.5 mb-2">
              <BookIcon className="w-4 h-4 text-titi-yellow-dark" aria-hidden="true" />
              Fuentes utilizadas ({msg.citations.length})
            </p>
            <div className="flex flex-col gap-2">
              {msg.citations.map((citation) => (
                <CitationCard
                  key={`${citation.lessonId}-${citation.number}`}
                  citation={citation}
                  onNavigate={onNavigateToLesson}
                />
              ))}
            </div>
          </div>
        )}
        {showActions && (
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-gray-100 pt-3">
            {POST_ACTIONS.map(({ label, prompt, intent }) => (
              <button
                key={label}
                type="button"
                onClick={() => onAsk(prompt, { intent })}
                className="rounded-full border border-gray-200 bg-titi-cream px-2.5 py-1 text-xs font-bold text-titi-dark hover:border-titi-yellow hover:bg-titi-yellow-light transition-colors active:scale-95"
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
function CitationCard({ citation, onNavigate }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-gray-200 bg-titi-cream/60 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full text-left px-3 py-2.5 flex items-start gap-2 hover:bg-titi-yellow-light/40 transition-colors"
      >
        <span className="text-xs font-bold text-gray-400 tabular-nums mt-0.5 shrink-0">
          [{citation.number}]
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-titi-dark leading-snug line-clamp-2">
            {citation.title}
          </span>
          <span className="block text-xs font-medium text-gray-500 mt-0.5 truncate">
            {citation.moduleTitle}
          </span>
          <span className="inline-flex items-center gap-1 mt-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">
            Fuente publicada del curso
          </span>
        </span>
        <ChevronDownIcon
          className={`w-4 h-4 text-gray-400 shrink-0 mt-1 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      <div className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="px-3 pb-3">
            <p className="text-xs leading-relaxed text-gray-600">{citation.excerpt}</p>
            <button
              type="button"
              onClick={() => onNavigate(citation.lessonId)}
              className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-blue-500 hover:text-titi-dark transition-colors"
            >
              Ver material
              <ExternalLinkIcon className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
