import { useEffect, useRef, useState } from 'react';
import client from '../api/client.js';
import MarkdownContent from './MarkdownContent.jsx';
import TitiMascot from './TitiMascot.jsx';
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
    prompt: 'Explícame este tema de forma sencilla, usando los materiales de la lección.',
  },
  {
    label: 'Dame un ejemplo',
    Icon: CodeIcon,
    prompt: 'Dame un ejemplo práctico sobre este tema.',
  },
  {
    label: 'Hazme una pregunta',
    Icon: LightbulbIcon,
    prompt: 'Hazme una pregunta de práctica sobre este tema y corregí mi respuesta.',
  },
  {
    label: 'Crea un ejercicio',
    Icon: PracticeIcon,
    prompt: 'Crea un ejercicio sobre este tema para practicar.',
  },
];

const POST_ACTIONS = [
  { label: 'Más simple', prompt: 'Explicámelo más simple, paso a paso, usando los materiales de la lección.' },
  { label: 'Otro ejemplo', prompt: 'Dame otro ejemplo distinto sobre este tema.' },
  { label: 'Ejercicio', prompt: 'Crea un ejercicio de práctica sobre este tema y corregilo.' },
  { label: 'Resumir', prompt: 'Resumí los puntos clave de esta lección en una lista corta.' },
];

export default function TutorPanel({
  lessonId,
  cursoTitulo,
  moduloNumero,
  moduloTitulo,
  leccionTitulo,
  conversation,
  onAppendMessages,
  onResetConversation,
  onNavigateToLesson,
  onClose,
}) {
  const [status, setStatus] = useState(null); // null | { enabled, indexed }
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(null); // null | { stage, count }
  const [error, setError] = useState(null); // null | { question }
  const textareaRef = useRef(null);
  const lastMsgRef = useRef(null);
  const activeRef = useRef(false);
  const timersRef = useRef([]);

  const clearTimers = () => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  };

  useEffect(() => () => { activeRef.current = false; clearTimers(); }, []);

  // Al cambiar de lección: cancelo request/estados en vuelo para no mezclar
  // loading ni respuestas entre conversaciones distintas.
  useEffect(() => {
    activeRef.current = false;
    clearTimers();
    setPending(null);
    setError(null);
    setInput('');
  }, [lessonId]);

  const ready = Boolean(status?.enabled && status?.indexed);

  // Disponibilidad del tutor para esta lección.
  useEffect(() => {
    let cancelled = false;
    setStatus(null);
    client
      .get(`/api/lessons/${lessonId}/chat/status`)
      .then(({ data }) => {
        if (cancelled) return;
        setStatus({
          enabled: Boolean(data?.success && data.data?.enabled),
          indexed: Boolean(data?.success && data.data?.indexed),
        });
      })
      .catch(() => {
        if (!cancelled) setStatus({ enabled: false, indexed: false });
      });
    return () => { cancelled = true; };
  }, [lessonId]);

  // Auto-scroll al último mensaje / estado de carga.
  useEffect(() => {
    lastMsgRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [conversation.length, pending, error]);

  const resizeTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const ask = (prompt, { appendUser = true } = {}) => {
    const question = String(prompt || '').trim();
    if (!question || pending || !ready) return;
    if (appendUser) onAppendMessages([{ role: 'user', content: question }]);
    setError(null);
    activeRef.current = true;
    setPending({ stage: 1 });

    timersRef.current.push(
      setTimeout(() => {
        if (activeRef.current) setPending((p) => (p ? { ...p, stage: 2 } : p));
      }, 650),
    );

    client
      .post(`/api/lessons/${lessonId}/chat`, { message: question })
      .then(({ data }) => {
        if (!activeRef.current) return;
        if (!data?.success) throw new Error(data?.message || 'No se pudo consultar al tutor');
        const citations = Array.isArray(data.data?.citations) ? data.data.citations : [];
        const answer = data.data?.answer || 'No encontré evidencia suficiente.';

        timersRef.current.push(
          setTimeout(() => {
            if (activeRef.current) setPending((p) => (p ? { ...p, stage: 3, count: citations.length } : p));
          }, 450),
        );
        timersRef.current.push(
          setTimeout(() => {
            if (activeRef.current) setPending((p) => (p ? { ...p, stage: 4 } : p));
          }, 1350),
        );
        timersRef.current.push(
          setTimeout(() => {
            if (!activeRef.current) return;
            onAppendMessages([{ role: 'tutor', content: answer, citations }]);
            activeRef.current = false;
            setPending(null);
          }, 2000),
        );
      })
      .catch((err) => {
        if (!activeRef.current) return;
        console.error('Tutor IA — error al consultar', err.response?.data?.message || err.message);
        activeRef.current = false;
        setPending(null);
        setError({ question });
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
    activeRef.current = false;
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

  return (
    <div className="flex flex-col h-full min-h-0 bg-white">
      {/* Header */}
      <header className="shrink-0 border-b border-gray-100 px-4 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-8 h-8 rounded-full bg-titi-yellow grid place-items-center shrink-0">
            <SparklesIcon className="w-4 h-4 text-titi-dark" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-titi-dark leading-none">Tutor IA</h2>
            <div className="mt-1">
              {status && (status.enabled && status.indexed ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" aria-hidden="true" />
                  Conectado
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400" aria-hidden="true" />
                  No disponible
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
            onClick={onClose}
            aria-label="Cerrar panel"
            className="w-8 h-8 grid place-items-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors active:scale-95"
          >
            ✕
          </button>
        </div>
      </header>

      {/* Contexto de la lección */}
      <div className="shrink-0 px-4 pt-3">
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
      </div>

      {/* Cuerpo: conversación / estados */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-none px-4 py-4 flex flex-col gap-4">
        {status === null ? (
          <p className="text-sm text-gray-400 font-medium">Verificando disponibilidad del tutor…</p>
        ) : !status.enabled ? (
          <UnavailableState />
        ) : !status.indexed ? (
          <IndexingState />
        ) : conversation.length === 0 && !pending && !error ? (
          <EmptyState onAsk={(prompt) => ask(prompt)} />
        ) : (
          <>
            {conversation.map((msg, index) => (
              <MessageBubble
                key={`${index}-${msg.role}`}
                msg={msg}
                showActions={index === conversation.length - 1 && msg.role === 'tutor'}
                onAsk={(prompt) => ask(prompt)}
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
                    No pude obtener una respuesta en este momento.
                  </p>
                  <button
                    type="button"
                    onClick={() => ask(error.question, { appendUser: false })}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-titi-dark bg-white border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 transition-colors"
                  >
                    Reintentar
                  </button>
                </div>
              </div>
            )}

            <div ref={lastMsgRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-gray-100 p-3">
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
            placeholder="Preguntá sobre esta lección…"
            aria-label="Pregunta al tutor de la lección"
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
          Enter para enviar · Shift+Enter para nueva línea
        </p>
      </div>
    </div>
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
        Puedo ayudarte a comprender esta lección, darte ejemplos, generar ejercicios y resolver tus dudas usando los materiales del curso.
      </p>
      <div className="w-full grid grid-cols-2 gap-2">
        {QUICK_ACTIONS.map(({ label, Icon, prompt }) => (
          <button
            key={label}
            type="button"
            onClick={() => onAsk(prompt)}
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
function MessageBubble({ msg, showActions, onAsk, onNavigateToLesson }) {
  if (msg.role === 'user') {
    return (
      <div className="self-end max-w-[85%] bg-titi-yellow text-titi-dark rounded-2xl rounded-br-md px-4 py-2.5 text-sm font-medium whitespace-pre-wrap">
        {msg.content}
      </div>
    );
  }

  return (
    <div className="self-start w-full max-w-full">
      <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3">
        <MarkdownContent content={msg.content} format="MARKDOWN" compact codeCopy />
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
            {POST_ACTIONS.map(({ label, prompt }) => (
              <button
                key={label}
                type="button"
                onClick={() => onAsk(prompt)}
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
  const relevance = Math.round((citation.similarity || 0) * 100);

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
            Relevancia: {relevance}%
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