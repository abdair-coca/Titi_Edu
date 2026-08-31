import { useEffect, useRef, useState } from 'react';
import client from '../api/client.js';
import TitiMascot from './TitiMascot.jsx';
import { isDeadlineExpired } from '../lib/deadline.js';
import { CalendarIcon, CheckIcon, RefreshIcon, StarIcon } from './icons.jsx';

const DEADLINE_DATE = new Intl.DateTimeFormat('es-BO', { day: '2-digit', month: 'short', year: 'numeric' });
const DEADLINE_TIME = new Intl.DateTimeFormat('es-BO', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });

function splitDeadline(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return { date: '', time: '' };
  return { date: DEADLINE_DATE.format(date).toUpperCase(), time: DEADLINE_TIME.format(date) };
}

function activityStatus({ bestScore, deadlineExpired, attemptsExhausted }) {
  if (bestScore != null) return { label: 'Completada', tone: 'bg-green-50 text-green-700 border-green-200' };
  if (deadlineExpired) return { label: 'Plazo vencido', tone: 'bg-red-50 text-red-600 border-red-200' };
  if (attemptsExhausted) return { label: 'Intentos agotados', tone: 'bg-gray-100 text-gray-600 border-gray-200' };
  return { label: 'Pendiente', tone: 'bg-gray-100 text-gray-600 border-gray-200' };
}

let mermaidPromise;
let mermaidRenderId = 0;

function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((module) => {
      const mermaid = module.default || module.mermaid || module;
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'base',
        flowchart: { curve: 'basis', padding: 10, nodeSpacing: 32, rankSpacing: 40, htmlLabels: false },
      });
      return mermaid;
    });
  }
  return mermaidPromise;
}

function decodeMermaidDefinition(value) {
  const decoder = document.createElement('textarea');
  let decoded = value;
  for (let pass = 0; pass < 3; pass += 1) {
    decoder.innerHTML = decoded;
    const next = decoder.value;
    if (next === decoded) break;
    decoded = next;
  }
  return decoded;
}

async function renderHtmlDiagrams(html) {
  if (!/class\s*=\s*["'][^"']*\bmermaid\b|data-flow\s*=/i.test(html)) return html;

  const parsedDocument = new DOMParser().parseFromString(html, 'text/html');
  const diagrams = [...parsedDocument.querySelectorAll('.mermaid, .flowchart[data-flow]')];
  if (!diagrams.length) return html;

  const mermaid = await loadMermaid();
  for (const diagram of diagrams) {
    const rawDefinition = diagram.dataset.flow || diagram.textContent.trim();
    const definition = decodeMermaidDefinition(rawDefinition).trim();
    if (!definition) continue;
    const { svg } = await mermaid.render(`titi-diagram-${++mermaidRenderId}`, definition);
    const wrapper = parsedDocument.createElement('div');
    wrapper.className = 'mermaid titi-mermaid-rendered';
    const svgDocument = new DOMParser().parseFromString(svg, 'image/svg+xml');
    svgDocument.querySelectorAll('text, tspan').forEach((node) => {
      if (!node.children.length) node.textContent = decodeMermaidDefinition(node.textContent);
    });
    wrapper.append(parsedDocument.importNode(svgDocument.documentElement, true));
    diagram.replaceWith(wrapper);
  }

  parsedDocument.querySelectorAll('script[src*="mermaid"]').forEach((script) => script.remove());
  return `<!doctype html>${parsedDocument.documentElement.outerHTML}`;
}

function withAttemptToken(html, attemptToken) {
  if (!attemptToken) return html;
  const bootstrap = `<script>window.__TITI_ATTEMPT_TOKEN=${JSON.stringify(attemptToken)};</script>`;
  if (/<head\b[^>]*>/i.test(html)) return html.replace(/<head\b[^>]*>/i, (head) => `${head}${bootstrap}`);
  return html.replace(/<html\b[^>]*>/i, (tag) => `${tag}<head>${bootstrap}</head>`);
}

export function isTitiScoreMessage(event, iframeWindow, attemptToken) {
  const message = event?.data;
  return event?.source === iframeWindow
    && message?.source === 'titi-html'
    && message?.type === 'TITI_SCORE'
    && Boolean(attemptToken)
    && message?.attemptToken === attemptToken
    && Number.isFinite(message?.score)
    && message.score >= 0
    && message.score <= 100;
}

function HtmlLessonLoading() {
  return (
    <section className="mb-6" role="status" aria-busy="true" aria-live="polite">
      <div className="min-h-[32rem] overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <div className="flex items-center gap-3 border-b border-gray-100 bg-titi-dark px-4 py-3">
          <span className="h-3 w-3 animate-pulse rounded-full bg-titi-yellow" aria-hidden="true" />
          <span className="h-3 w-40 animate-pulse rounded-full bg-white/20" aria-hidden="true" />
        </div>
        <div className="flex min-h-[28rem] flex-col items-center px-6 py-8 sm:px-10">
          <TitiMascot state="pensando" size="md" message="" className="mb-5" />
          <div className="w-full max-w-2xl space-y-4" aria-hidden="true">
            <div className="mx-auto h-8 w-3/4 animate-pulse rounded-lg bg-gray-100" />
            <div className="mx-auto h-3 w-full animate-pulse rounded-full bg-gray-100" />
            <div className="mx-auto h-3 w-5/6 animate-pulse rounded-full bg-gray-100" />
            <div className="grid grid-cols-1 gap-4 pt-4 sm:grid-cols-2">
              <div className="h-24 animate-pulse rounded-xl bg-titi-cream" />
              <div className="h-24 animate-pulse rounded-xl bg-titi-cream" />
            </div>
          </div>
          <p className="mt-6 text-sm font-semibold text-gray-500">Preparando tu presentación…</p>
        </div>
      </div>
      <span className="sr-only">Cargando actividad HTML…</span>
    </section>
  );
}

export default function HtmlLessonPlayer({ lessonId, title, onEvaluableChange, onDeadlineChange, onScoreRecorded }) {
  const iframeRef = useRef(null);
  const [srcDoc, setSrcDoc] = useState(null);
  const [attemptToken, setAttemptToken] = useState(null);
  const [evaluable, setEvaluable] = useState(false);
  const [viewOnly, setViewOnly] = useState(false);
  const [attemptsExhausted, setAttemptsExhausted] = useState(false);
  const [remainingAttempts, setRemainingAttempts] = useState(null);
  const [maxAttempts, setMaxAttempts] = useState(null);
  const [deadline, setDeadline] = useState(null);
  const [deadlineExpired, setDeadlineExpired] = useState(false);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [score, setScore] = useState(null);
  const [bestScore, setBestScore] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSrcDoc(null); setAttemptToken(null); setScore(null); setBestScore(null); setError(null); setViewOnly(false); setAttemptsExhausted(false); setRemainingAttempts(null); setMaxAttempts(null); setDeadline(null); setDeadlineExpired(false); setIsFullscreen(false); setStatus('loading');
    async function load() {
      try {
        const { data } = await client.get(`/api/lessons/${lessonId}/html`);
        if (!data?.success) throw new Error(data?.message || 'No se pudo cargar la actividad HTML');
        const resource = data.data;
        const token = resource.evaluable ? resource.attemptToken : null;
        const maxAttemptsReached = Boolean(resource.evaluable && resource.attemptsExhausted);
        const expired = Boolean(resource.evaluable && (resource.fechaLimiteExpirada || isDeadlineExpired(resource.fechaLimite)));
        const remaining = resource.evaluable ? resource.remainingAttempts : null;
        if (cancelled) return;
        setEvaluable(Boolean(resource.evaluable));
        onEvaluableChange?.(Boolean(resource.evaluable));
        setViewOnly(maxAttemptsReached);
        setAttemptsExhausted(maxAttemptsReached);
        setDeadline(resource.fechaLimite || null);
        setDeadlineExpired(expired);
        onDeadlineChange?.(expired);
        setAttemptToken(token);
        setMaxAttempts(resource.evaluable ? resource.intentosMax : null);
        setRemainingAttempts(remaining);
        setBestScore(resource.bestScore ?? null);
        const preparedHtml = await renderHtmlDiagrams(resource.html);
        if (cancelled) return;
        setViewOnly(maxAttemptsReached || expired);
        setSrcDoc(withAttemptToken(preparedHtml, maxAttemptsReached || expired ? null : token));
        setStatus('ready');
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.message || err.message || 'No se pudo cargar la actividad HTML');
          setStatus('error');
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [lessonId, onDeadlineChange, onEvaluableChange]);

  useEffect(() => {
    if (!deadline) return undefined;
    const refresh = () => {
      const expired = isDeadlineExpired(deadline);
      setDeadlineExpired(expired);
      if (expired) setViewOnly(true);
      onDeadlineChange?.(expired);
    };
    refresh();
    const timer = window.setInterval(refresh, 30_000);
    return () => window.clearInterval(timer);
  }, [deadline, onDeadlineChange]);

  useEffect(() => {
    async function receiveScore(event) {
       if (!(evaluable && !viewOnly) || deadlineExpired || attemptsExhausted || !isTitiScoreMessage(event, iframeRef.current?.contentWindow, attemptToken) || status !== 'ready') return;
      setStatus('submitting');
      try {
        const { data } = await client.post(`/api/lessons/${lessonId}/html-results`, {
          score: event.data.score,
          attemptToken,
        });
        if (!data?.success) throw new Error(data?.message || 'No se pudo registrar el puntaje');
        setScore(data.data.score);
        setBestScore(data.data.bestScore ?? data.data.score);
        setRemainingAttempts(data.data.remaining ?? null);
        setAttemptsExhausted(data.data.remaining === 0);
        setViewOnly(data.data.remaining === 0);
        setStatus('submitted');
        await onScoreRecorded?.(data.data);
      } catch (err) {
        if (err.response?.status === 409) {
          setAttemptsExhausted(true);
          setViewOnly(true);
          setRemainingAttempts(0);
        }
        setError(err.response?.data?.message || err.message || 'No se pudo registrar el puntaje');
        setStatus('ready');
      }
    }
    window.addEventListener('message', receiveScore);
    return () => window.removeEventListener('message', receiveScore);
  }, [attemptToken, attemptsExhausted, deadlineExpired, evaluable, lessonId, onScoreRecorded, status, viewOnly]);

  useEffect(() => {
    const syncFullscreenState = () => {
      setIsFullscreen(
        document.fullscreenElement === iframeRef.current
          || document.webkitFullscreenElement === iframeRef.current,
      );
    };
    document.addEventListener('fullscreenchange', syncFullscreenState);
    document.addEventListener('webkitfullscreenchange', syncFullscreenState);
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreenState);
      document.removeEventListener('webkitfullscreenchange', syncFullscreenState);
    };
  }, []);

  const handleFullscreen = () => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const isCurrentFullscreen = document.fullscreenElement === iframe
      || document.webkitFullscreenElement === iframe;
    if (isCurrentFullscreen) {
      document.exitFullscreen?.();
      return;
    }

    const requestFullscreen = iframe.requestFullscreen || iframe.webkitRequestFullscreen;
    requestFullscreen?.call(iframe);
  };

  const estado = activityStatus({ bestScore, deadlineExpired, attemptsExhausted });

  if (status === 'loading') return <HtmlLessonLoading />;
  if (status === 'error') return <p className="text-sm font-semibold text-red-600">{error}</p>;

  return (
    <section className="mb-6">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white lg:contents">
        <div className="flex flex-col gap-3 bg-titi-dark px-4 py-3 sm:flex-row sm:items-center sm:justify-between lg:hidden">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">{title || 'Presentación interactiva'}</p>
            <span className="mt-1 inline-flex rounded-full bg-white/10 px-2 py-1 text-[11px] font-bold text-titi-yellow">
              Presentación interactiva
            </span>
          </div>
          <button
            type="button"
            onClick={handleFullscreen}
            className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-white/20 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-white/10 sm:w-auto"
            aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Ver presentación en pantalla completa'}
          >
            <span aria-hidden="true">⛶</span>
            {isFullscreen ? 'Salir' : 'Pantalla completa'}
          </button>
        </div>
        <iframe
          ref={iframeRef}
          title={title || 'Actividad HTML'}
          srcDoc={srcDoc}
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          allow="fullscreen"
          allowFullScreen
          className="h-[clamp(24rem,62vh,32rem)] w-full bg-white lg:h-auto lg:min-h-[32rem] lg:rounded-2xl lg:border lg:border-gray-200"
        />
      </div>
      {evaluable && (
        <div className="mt-3 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-gray-100">
            <div className="flex items-center gap-3 px-5 py-4 transition-colors duration-150 hover:bg-gray-50">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-100 text-blue-600">
                <RefreshIcon className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-500">Intentos restantes</p>
                <p className="text-xl font-bold tabular-nums text-gray-900">
                  {remainingAttempts ?? '—'} / {maxAttempts}
                </p>
                <p className="mt-0.5 text-xs text-gray-400">
                  {attemptsExhausted
                    ? 'Agotaste tus intentos'
                    : `Puedes reintentar hasta ${maxAttempts} ${maxAttempts === 1 ? 'vez' : 'veces'}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-5 py-4 transition-colors duration-150 hover:bg-gray-50">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-purple-100 text-purple-600">
                <CalendarIcon className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-500">Entrega hasta</p>
                {deadline ? (
                  <>
                    <p className="text-xl font-bold tabular-nums text-gray-900">{splitDeadline(deadline).date}</p>
                    {deadlineExpired ? (
                      <p className="mt-0.5 text-xs font-semibold text-red-600">Plazo vencido · no se registran nuevos puntajes</p>
                    ) : (
                      <p className="mt-0.5 text-xs text-gray-400">{splitDeadline(deadline).time}</p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-xl font-bold text-gray-400">Sin límite</p>
                    <p className="mt-0.5 text-xs text-gray-400">Sin fecha de entrega</p>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 px-5 py-4 transition-colors duration-150 hover:bg-gray-50">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-green-100 text-green-600">
                <CheckIcon className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-500">Estado</p>
                <span className={`mt-1 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${estado.tone}`}>
                  {estado.label}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3 px-5 py-4 transition-colors duration-150 hover:bg-gray-50">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-titi-yellow-light text-titi-yellow-dark">
                <StarIcon className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-500">Tu nota</p>
                {status === 'submitting' ? (
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-titi-dark"
                      aria-hidden="true"
                    />
                    <span className="text-xs font-semibold text-gray-500" role="status">Registrando puntaje…</span>
                  </div>
                ) : (
                  <>
                    <p className="text-2xl font-black tabular-nums text-gray-900">
                      {bestScore != null || score != null ? `${bestScore ?? score} / 100` : '—'}
                    </p>
                    {bestScore != null && score != null && bestScore > score ? (
                      <p className="mt-0.5 text-xs text-gray-400">Mejor puntaje de tus intentos</p>
                    ) : bestScore == null && score == null ? (
                      <p className="mt-0.5 text-xs text-gray-400">Realizá la actividad para obtener tu nota</p>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {error && status === 'ready' && <p className="mt-3 text-xs font-semibold text-red-600">{error}</p>}
    </section>
  );
}
