import { useEffect, useState } from 'react';
import client from '../api/client.js';

const SUGGESTIONS = [
  'Explicame este tema de forma sencilla',
  'Dame un ejemplo práctico',
  'Hazme una pregunta de práctica',
];

export default function RagTutorCard({ lessonId }) {
  const [enabled, setEnabled] = useState(null);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [answer, setAnswer] = useState(null);
  const [citations, setCitations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    client.get(`/api/lessons/${lessonId}/chat/status`)
      .then(({ data }) => {
        if (!cancelled) setEnabled(Boolean(data?.success && data.data?.enabled && data.data?.indexed));
      })
      .catch(() => {
        if (!cancelled) setEnabled(false);
      });
    return () => { cancelled = true; };
  }, [lessonId]);

  const ask = async (prompt = message) => {
    const question = prompt.trim();
    if (!question || loading) return;
    setMessage(question);
    setLoading(true);
    setError(null);
    try {
      const { data } = await client.post(`/api/lessons/${lessonId}/chat`, { message: question });
      if (!data?.success) throw new Error(data?.message || 'No se pudo consultar al tutor');
      setAnswer(data.data?.answer || 'No encontré evidencia suficiente.');
      setCitations(data.data?.citations || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'No se pudo consultar al tutor');
    } finally {
      setLoading(false);
    }
  };

  if (enabled !== true) return null;

  return (
    <section className="mb-6 rounded-2xl border border-titi-yellow/40 bg-titi-yellow-light/60">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 p-4 text-left sm:p-5">
        <span>
          <span className="flex items-center gap-2 text-base font-bold text-titi-dark">✨ Tutor de la lección</span>
          <span className="mt-1 block text-xs font-medium text-gray-500">Responde usando los materiales publicados.</span>
        </span>
        <span className="text-sm text-titi-dark" aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className="border-t border-titi-yellow/30 px-4 pb-5 pt-4 sm:px-5">
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((suggestion) => (
              <button key={suggestion} type="button" onClick={() => ask(suggestion)} disabled={loading} className="rounded-full border border-titi-yellow/60 bg-white px-3 py-2 text-xs font-bold text-titi-dark hover:bg-titi-yellow disabled:opacity-50">
                {suggestion}
              </button>
            ))}
          </div>
          <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); ask(); }}>
            <input value={message} onChange={(event) => setMessage(event.target.value)} maxLength={1000} placeholder="Preguntá sobre esta lección…" className="titi-input min-w-0 flex-1" aria-label="Pregunta al tutor de la lección" />
            <button type="submit" disabled={loading || !message.trim()} className="titi-btn-primary disabled:opacity-50">{loading ? 'Consultando…' : 'Preguntar'}</button>
          </form>
          {error && <p className="mt-3 text-xs font-semibold text-red-600">{error}</p>}
          {answer && (
            <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
              <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700">{answer}</p>
              {citations.length > 0 && <div className="mt-4 border-t border-gray-100 pt-3"><p className="text-xs font-bold uppercase tracking-wide text-gray-500">Fuentes</p><ul className="mt-2 space-y-1">{citations.map((citation) => <li key={`${citation.lessonId}-${citation.number}`} className="text-xs text-gray-600">[{citation.number}] {citation.title}</li>)}</ul></div>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
