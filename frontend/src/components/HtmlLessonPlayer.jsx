import { useEffect, useRef, useState } from 'react';
import client from '../api/client.js';

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

export default function HtmlLessonPlayer({ lessonId, onScoreRecorded }) {
  const iframeRef = useRef(null);
  const [srcDoc, setSrcDoc] = useState(null);
  const [attemptToken, setAttemptToken] = useState(null);
  const [evaluable, setEvaluable] = useState(false);
  const [viewOnly, setViewOnly] = useState(false);
  const [attemptsExhausted, setAttemptsExhausted] = useState(false);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [score, setScore] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setSrcDoc(null); setAttemptToken(null); setScore(null); setError(null); setViewOnly(false); setAttemptsExhausted(false); setStatus('loading');
    async function load() {
      try {
        const { data } = await client.get(`/api/lessons/${lessonId}/html`);
        if (!data?.success) throw new Error(data?.message || 'No se pudo cargar la actividad HTML');
        const resource = data.data;
        let token = null;
        let maxAttemptsReached = false;
        if (resource.evaluable) {
          try {
            const attempt = await client.post(`/api/lessons/${lessonId}/html-attempts`);
            if (!attempt.data?.success) throw new Error(attempt.data?.message || 'No se pudo iniciar el intento');
            token = attempt.data.data.attemptToken;
          } catch (err) {
            if (err.response?.status !== 409) throw err;
            maxAttemptsReached = true;
          }
        }
        if (cancelled) return;
        setEvaluable(Boolean(resource.evaluable));
        setViewOnly(maxAttemptsReached);
        setAttemptsExhausted(maxAttemptsReached);
        setAttemptToken(token);
        setSrcDoc(withAttemptToken(resource.html, maxAttemptsReached ? null : token));
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
  }, [lessonId]);

  useEffect(() => {
    async function receiveScore(event) {
      if (viewOnly || attemptsExhausted || !isTitiScoreMessage(event, iframeRef.current?.contentWindow, attemptToken) || status !== 'ready') return;
      setStatus('submitting');
      try {
        const { data } = await client.post(`/api/lessons/${lessonId}/html-results`, {
          score: event.data.score,
          attemptToken,
        });
        if (!data?.success) throw new Error(data?.message || 'No se pudo registrar el puntaje');
        setScore(data.data);
        setStatus('submitted');
        await onScoreRecorded?.(data.data);
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'No se pudo registrar el puntaje');
        setStatus('ready');
      }
    }
    window.addEventListener('message', receiveScore);
    return () => window.removeEventListener('message', receiveScore);
  }, [attemptToken, attemptsExhausted, lessonId, onScoreRecorded, status, viewOnly]);

  if (status === 'loading') return <p className="text-sm font-semibold text-gray-400">Cargando actividad HTML…</p>;
  if (status === 'error') return <p className="text-sm font-semibold text-red-600">{error}</p>;

  return (
    <section className="mb-6">
      <iframe
        ref={iframeRef}
        title="Actividad HTML"
        srcDoc={srcDoc}
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        className="w-full min-h-[32rem] rounded-2xl border border-gray-200 bg-white"
      />
      {attemptsExhausted && <p className="mt-3 text-xs font-semibold text-gray-500">Agotaste tus intentos. Podés revisar la presentación, pero ya no se registrará una nota.</p>}
      {evaluable && !viewOnly && <p className="mt-3 text-xs font-semibold text-gray-500">{status === 'submitting' ? 'Registrando puntaje…' : score ? `Puntaje de práctica: ${score.score}/100. Mejor: ${score.bestScore}/100.` : 'La actividad registra un puntaje de práctica.'}</p>}
      {error && status === 'ready' && <p className="mt-3 text-xs font-semibold text-red-600">{error}</p>}
    </section>
  );
}
