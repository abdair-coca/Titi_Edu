import { useCallback, useEffect, useMemo, useState } from 'react';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import TitiMascot from './TitiMascot.jsx';

/**
 * EvaluationQuiz — el estudiante rinde una evaluación.
 *
 * Fases: loading → intro → quiz → result (o passed/blocked directo).
 *
 * Props:
 *  - evaluationId (string)
 *  - onResult (fn): recibe el data completo del intento (racha, logros,
 *    cursoCompletado) para que el padre dispare toasts y banners.
 */
export default function EvaluationQuiz({ evaluationId, onResult }) {
  const { isAuthenticated } = useAuth();

  const [evaluacion, setEvaluacion] = useState(null);
  const [attemptsInfo, setAttemptsInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [phase, setPhase] = useState('intro'); // intro | quiz | result
  const [answers, setAnswers] = useState({}); // preguntaId → { opcionId | texto }
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [intentoExtra, setIntentoExtra] = useState(0); // cuántos 'intento_extra' tengo en inventario
  const [usarExtra, setUsarExtra] = useState(false); // si el próximo submit debe consumir uno

  const fetchIntentoExtra = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const { data } = await client.get('/api/shop/inventory');
      if (data?.success) {
        const item = (data.data.items || []).find((i) => i.codigo === 'intento_extra');
        setIntentoExtra(item?.cantidad ?? 0);
      }
    } catch {
      // silencioso — no bloquea la evaluación si la tienda falla
    }
  }, [isAuthenticated]);

  const fetchAll = useCallback(async () => {
    if (!evaluationId) return;
    setLoading(true);
    setError(null);
    setPhase('intro');
    setAnswers({});
    setResult(null);
    setUsarExtra(false);
    try {
      const [evRes, attRes] = await Promise.all([
        client.get(`/api/evaluations/${evaluationId}`),
        isAuthenticated
          ? client.get(`/api/evaluations/${evaluationId}/my-attempts`).catch(() => ({ data: null }))
          : Promise.resolve({ data: null }),
      ]);
      if (evRes.data?.success) {
        setEvaluacion(evRes.data.data.evaluacion);
      } else {
        setError(evRes.data?.message || 'No se pudo cargar la evaluación');
      }
      if (attRes.data?.success) {
        setAttemptsInfo(attRes.data.data);
      } else {
        setAttemptsInfo(null);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error de red');
    } finally {
      setLoading(false);
    }
  }, [evaluationId, isAuthenticated]);

  useEffect(() => {
    fetchAll();
    fetchIntentoExtra();
  }, [fetchAll, fetchIntentoExtra]);

  function handleUseExtra() {
    setUsarExtra(true);
    setAnswers({});
    setResult(null);
    setError(null);
    // `bloqueado` se deriva de attemptsInfo.bloqueado — hay que limpiarlo acá,
    // si no el guard de "bloqueado" sigue ganando aunque cambiemos de fase.
    setAttemptsInfo((prev) => (prev ? { ...prev, bloqueado: false } : prev));
    setPhase('quiz');
  }

  const totalPreguntas = evaluacion?.preguntas?.length ?? 0;
  const answeredCount = useMemo(
    () =>
      (evaluacion?.preguntas || []).filter((p) => {
        const a = answers[p.id];
        if (!a) return false;
        if (p.tipo === 'RESPUESTA_CORTA') return Boolean(a.texto?.trim());
        return Boolean(a.opcionId);
      }).length,
    [answers, evaluacion],
  );
  const allAnswered = totalPreguntas > 0 && answeredCount === totalPreguntas;

  async function handleSubmit() {
    if (!allAnswered || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const respuestas = evaluacion.preguntas.map((p) => {
        const a = answers[p.id] || {};
        return p.tipo === 'RESPUESTA_CORTA'
          ? { preguntaId: p.id, texto: a.texto?.trim() || '' }
          : { preguntaId: p.id, opcionId: a.opcionId || null };
      });
      const { data } = await client.post(`/api/evaluations/${evaluationId}/attempt`, {
        respuestas,
        ...(usarExtra ? { usarIntentoExtra: true } : {}),
      });
      if (data?.success) {
        setResult(data.data);
        setPhase('result');
        // Refrescar info de intentos para estados passed/blocked
        setAttemptsInfo((prev) =>
          prev
            ? {
                ...prev,
                aprobado: data.data.intento.aprobado || prev.aprobado,
                intentosRestantes: data.data.intentosRestantes,
                bloqueado: data.data.bloqueado,
                intentos: [...(prev.intentos || []), data.data.intento],
              }
            : prev,
        );
        if (usarExtra) {
          setUsarExtra(false);
          fetchIntentoExtra();
        }
        onResult?.(data.data);
      } else {
        setError(data?.message || 'No se pudo enviar el intento');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error enviando el intento');
    } finally {
      setSubmitting(false);
    }
  }

  function handleRetry() {
    setAnswers({});
    setResult(null);
    setError(null);
    setPhase('quiz');
  }

  // ---- Render ----
  if (loading) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-8 animate-pulse">
        <div className="h-5 w-1/2 bg-gray-100 rounded mb-6" />
        <div className="space-y-4">
          <div className="h-16 bg-gray-100 rounded-xl" />
          <div className="h-16 bg-gray-100 rounded-xl" />
          <div className="h-16 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error && !evaluacion) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
        <span className="text-red-500 text-lg" aria-hidden="true">⚠️</span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-red-700">No pudimos cargar la evaluación</p>
          <p className="text-xs text-red-500 mt-0.5">{error}</p>
          <button
            type="button"
            onClick={fetchAll}
            className="text-sm font-bold text-titi-dark hover:text-titi-yellow-dark mt-2"
          >
            Reintentar →
          </button>
        </div>
      </div>
    );
  }

  if (!evaluacion) return null;

  const yaAprobado = attemptsInfo?.aprobado && phase !== 'result';
  const bloqueado = attemptsInfo?.bloqueado && phase !== 'result';

  // --- Ya aprobada ---
  if (yaAprobado) {
    const mejorNota = Math.max(0, ...(attemptsInfo.intentos || []).map((i) => i.nota));
    return (
      <QuizShell evaluacion={evaluacion}>
        <div className="flex flex-col items-center text-center py-8">
          <TitiMascot mood="celebrating" message="¡Ya aprobaste esta evaluación!" size="md" />
          <p className="mt-4 text-4xl font-black text-green-600 tabular-nums">{mejorNota}%</p>
          <p className="text-sm font-semibold text-gray-500 mt-1">Tu mejor nota</p>
        </div>
      </QuizShell>
    );
  }

  // --- Bloqueada (agotó intentos) ---
  if (bloqueado) {
    return (
      <QuizShell evaluacion={evaluacion}>
        <div className="flex flex-col items-center text-center py-8">
          <TitiMascot
            mood="sad"
            message="Alcanzaste el máximo de intentos. Hablá con tu profesor para desbloquearla."
            size="md"
          />
          <p className="mt-4 text-sm font-semibold text-gray-500">
            {attemptsInfo.intentos.length} de {attemptsInfo.intentosMax} intentos usados
          </p>
          {intentoExtra > 0 && (
            <ExtraAttemptCta cantidad={intentoExtra} onUse={handleUseExtra} />
          )}
        </div>
      </QuizShell>
    );
  }

  // --- Intro ---
  if (phase === 'intro') {
    const usados = attemptsInfo?.intentos?.length ?? 0;
    return (
      <QuizShell evaluacion={evaluacion}>
        <div className="flex flex-col items-center text-center py-6">
          <TitiMascot mood="motivating" message="¡Vos podés! Leé con calma cada pregunta." size="md" />
          <dl className="grid grid-cols-3 gap-2 sm:gap-4 mt-6 w-full max-w-md">
            <InfoStat label="Preguntas" value={totalPreguntas} />
            <InfoStat label="Nota mínima" value={`${evaluacion.notaMinima}%`} />
            <InfoStat
              label="Intentos"
              value={`${usados}/${attemptsInfo?.intentosMax ?? evaluacion.intentosMax}`}
            />
          </dl>
          {usados > 0 && (
            <p className="text-xs font-semibold text-gray-400 mt-3">
              Ya usaste {usados} {usados === 1 ? 'intento' : 'intentos'}.
            </p>
          )}
          <button
            type="button"
            onClick={() => setPhase('quiz')}
            className="mt-6 bg-titi-yellow text-titi-dark font-bold text-base px-8 py-3 rounded-xl shadow-[0_4px_0px_#E6B800] hover:shadow-[0_2px_0px_#E6B800] hover:-translate-y-0.5 active:shadow-none active:translate-y-0 transition-all duration-150"
          >
            Comenzar intento
          </button>
        </div>
      </QuizShell>
    );
  }

  // --- Resultado ---
  if (phase === 'result' && result) {
    const aprobado = result.intento.aprobado;
    return (
      <QuizShell evaluacion={evaluacion}>
        <div className="flex flex-col items-center text-center py-6">
          {aprobado ? (
            <TitiMascot mood="celebrating" message="¡Lo lograste!" size="md" />
          ) : result.bloqueado ? (
            <>
              <TitiMascot
                mood="sad"
                message="Se acabaron los intentos. Hablá con tu profesor."
                size="md"
              />
              {intentoExtra > 0 && (
                <ExtraAttemptCta cantidad={intentoExtra} onUse={handleUseExtra} />
              )}
            </>
          ) : (
            <TitiMascot
              mood="motivating"
              message="No te rindas, tenés más intentos. ¡Revisá el material y volvé!"
              size="md"
            />
          )}

          <p
            className={`mt-4 text-5xl font-black tabular-nums ${
              aprobado ? 'text-green-600' : 'text-titi-red'
            }`}
          >
            {result.intento.nota}%
          </p>
          <p className="text-sm font-semibold text-gray-500 mt-1">
            {result.correctas} de {result.total} correctas · nota mínima {evaluacion.notaMinima}%
          </p>
          {!aprobado && !result.bloqueado && (
            <p className="text-xs font-bold text-gray-400 mt-1">
              Te {result.intentosRestantes === 1 ? 'queda' : 'quedan'} {result.intentosRestantes}{' '}
              {result.intentosRestantes === 1 ? 'intento' : 'intentos'}
            </p>
          )}

          {/* Feedback por pregunta */}
          <ul className="w-full max-w-md mt-6 space-y-2 text-left">
            {evaluacion.preguntas.map((p, i) => {
              const d = result.detalle?.find((x) => x.preguntaId === p.id);
              const ok = Boolean(d?.correcta);
              return (
                <li
                  key={p.id}
                  className={`flex items-start gap-2 sm:gap-3 rounded-xl border px-3 py-2 ${
                    ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                  }`}
                >
                  <span
                    className={`text-sm font-black shrink-0 leading-relaxed ${ok ? 'text-green-600' : 'text-titi-red'}`}
                    aria-label={ok ? 'Correcta' : 'Incorrecta'}
                  >
                    {ok ? '✓' : '✗'}
                  </span>
                  <span className="text-sm font-medium text-titi-dark min-w-0 break-words">
                    <span className="text-gray-400 tabular-nums mr-1">{i + 1}.</span>
                    {p.texto}
                  </span>
                </li>
              );
            })}
          </ul>

          {!aprobado && !result.bloqueado && (
            <button
              type="button"
              onClick={handleRetry}
              className="mt-6 bg-titi-yellow text-titi-dark font-bold text-base px-8 py-3 rounded-xl shadow-[0_4px_0px_#E6B800] hover:shadow-[0_2px_0px_#E6B800] hover:-translate-y-0.5 active:shadow-none active:translate-y-0 transition-all duration-150"
            >
              Reintentar
            </button>
          )}
        </div>
      </QuizShell>
    );
  }

  // --- Quiz (formulario) ---
  return (
    <QuizShell evaluacion={evaluacion}>
      <div className="flex flex-col gap-5">
        {usarExtra && (
          <p className="text-xs font-semibold text-titi-yellow-dark bg-titi-yellow-light border border-titi-yellow rounded-xl px-3 py-2">
            🔁 Este intento va a consumir tu "intento extra" de la tienda.
          </p>
        )}
        {evaluacion.preguntas.map((p, i) => (
          <QuestionCard
            key={p.id}
            pregunta={p}
            index={i}
            answer={answers[p.id]}
            onAnswer={(a) => setAnswers((prev) => ({ ...prev, [p.id]: a }))}
          />
        ))}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-sm font-semibold text-red-700">{error}</p>
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
          <span className="text-sm font-semibold text-gray-400 tabular-nums text-center sm:text-left">
            {answeredCount} / {totalPreguntas} respondidas
          </span>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!allAnswered || submitting}
            className="w-full sm:w-auto bg-titi-yellow text-titi-dark font-bold text-base px-6 sm:px-8 py-3 rounded-xl shadow-[0_4px_0px_#E6B800] hover:shadow-[0_2px_0px_#E6B800] hover:-translate-y-0.5 active:shadow-none active:translate-y-0 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Enviando…' : 'Enviar respuestas'}
          </button>
        </div>
      </div>
    </QuizShell>
  );
}

// ---- CTA para destrabar con un ítem 'intento_extra' de la tienda ----
function ExtraAttemptCta({ cantidad, onUse }) {
  return (
    <div className="mt-5 flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={onUse}
        className="bg-titi-yellow text-titi-dark font-bold text-sm px-6 py-2.5 rounded-xl shadow-[0_3px_0px_#E6B800] hover:shadow-[0_1px_0px_#E6B800] hover:-translate-y-0.5 active:shadow-none active:translate-y-0 transition-all duration-150"
      >
        🔁 Usar intento extra
      </button>
      <span className="text-xs font-semibold text-gray-400 tabular-nums">
        Te quedan {cantidad} en la tienda
      </span>
    </div>
  );
}

// ---- Carcasa con título ----
function QuizShell({ evaluacion, children }) {
  return (
    <section className="bg-white border border-gray-100 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-4 sm:p-6">
      <header className="mb-4 sm:mb-5">
        <p className="text-xs font-extrabold uppercase tracking-wide text-titi-achievement">
          {evaluacion.esFinal ? 'Evaluación final' : 'Evaluación de módulo'}
        </p>
        <h2 className="text-lg sm:text-2xl font-bold text-titi-dark mt-0.5 leading-snug">
          {evaluacion.titulo}
        </h2>
      </header>
      {children}
    </section>
  );
}

function InfoStat({ label, value }) {
  return (
    <div className="bg-titi-cream rounded-xl px-2 py-2 sm:px-3 sm:py-2.5">
      <dt className="text-[10px] font-bold uppercase tracking-wide text-gray-400 leading-tight">
        {label}
      </dt>
      <dd className="text-base sm:text-lg font-extrabold text-titi-dark tabular-nums mt-0.5">
        {value}
      </dd>
    </div>
  );
}

// ---- Una pregunta del formulario ----
function QuestionCard({ pregunta, index, answer, onAnswer }) {
  return (
    <fieldset className="bg-titi-cream/60 border border-titi-border rounded-2xl p-3 sm:p-4">
      <legend className="sr-only">Pregunta {index + 1}</legend>
      <p className="text-sm sm:text-base font-bold text-titi-dark mb-3 break-words">
        <span className="text-gray-400 tabular-nums mr-1.5">{index + 1}.</span>
        {pregunta.texto}
      </p>

      {pregunta.tipo === 'RESPUESTA_CORTA' ? (
        <input
          type="text"
          value={answer?.texto || ''}
          onChange={(e) => onAnswer({ texto: e.target.value })}
          placeholder="Escribí tu respuesta…"
          maxLength={200}
          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-titi-dark placeholder:text-gray-300 focus:outline-none focus:border-titi-yellow focus:ring-2 focus:ring-titi-yellow/20 transition-all duration-150"
        />
      ) : (
        <div className="flex flex-col gap-2">
          {pregunta.opciones.map((o) => {
            const selected = answer?.opcionId === o.id;
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => onAnswer({ opcionId: o.id })}
                aria-pressed={selected}
                className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-semibold transition-all duration-150 ${
                  selected
                    ? 'bg-titi-yellow border-titi-yellow text-titi-dark shadow-[0_3px_0px_#E6B800]'
                    : 'bg-white border-gray-200 text-titi-dark hover:border-titi-yellow hover:bg-titi-yellow-light'
                }`}
              >
                <span
                  className={`inline-block w-4 h-4 rounded-full border-2 mr-2 align-middle ${
                    selected ? 'border-titi-dark bg-titi-dark' : 'border-gray-300 bg-white'
                  }`}
                  aria-hidden="true"
                />
                {o.texto}
              </button>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}
