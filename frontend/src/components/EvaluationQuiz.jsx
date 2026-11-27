import { useCallback, useEffect, useMemo, useState } from 'react';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import TitiMascot from './TitiMascot.jsx';
import { formatDeadline, isDeadlineExpired } from '../lib/deadline.js';
import { useCountUp, usePopIn, useStaggerReveal } from '../lib/motion.js';
import {
  AwardIcon,
  CheckIcon,
  ClockIcon,
  CloseIcon,
  ListIcon,
  LockIcon,
  PlayIcon,
  RefreshIcon,
  SendIcon,
  TargetIcon,
  TrophyIcon,
} from './icons.jsx';
import { ErrorBox } from './social/StateBlocks.jsx';
import { INPUT, ProgressBar, RoleBadge, SkeletonLine, SURFACE } from './ui/v3.jsx';

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
  const [, refreshDeadline] = useState(0);
  // Las correcciones entran escalonadas cuando aparece el resultado (§10).
  const feedbackRef = useStaggerReveal([phase === 'result' ? result?.intento?.nota : null]);

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

  useEffect(() => {
    if (!evaluacion?.fechaLimite) return undefined;
    const timer = window.setInterval(() => refreshDeadline((value) => value + 1), 30_000);
    return () => window.clearInterval(timer);
  }, [evaluacion?.fechaLimite]);

  function handleUseExtra() {
    if (plazoVencido) return;
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
    if (!allAnswered || submitting || plazoVencido) return;
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
      <div className={`${SURFACE} p-5 sm:p-6 animate-pulse`} role="status" aria-busy="true">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gray-100" />
          <div className="flex-1 space-y-2">
            <SkeletonLine className="h-3 w-32" />
            <SkeletonLine className="h-6 w-2/3" />
          </div>
        </div>
        <div className="space-y-3">
          <div className="h-16 bg-gray-100 rounded-xl" />
          <div className="h-16 bg-gray-100 rounded-xl" />
          <div className="h-16 bg-gray-100 rounded-xl" />
        </div>
        <span className="sr-only">Cargando evaluación…</span>
      </div>
    );
  }

  if (error && !evaluacion) {
    return <ErrorBox title="No pudimos cargar la evaluación" message={error} onRetry={fetchAll} />;
  }

  if (!evaluacion) return null;

  const yaAprobado = attemptsInfo?.aprobado && phase !== 'result';
  const bloqueado = attemptsInfo?.bloqueado && phase !== 'result';
  const plazoVencido = isDeadlineExpired(evaluacion.fechaLimite) || Boolean(attemptsInfo?.fechaLimiteExpirada);

  // --- Ya aprobada ---
  if (yaAprobado) {
    const mejorNota = Math.max(0, ...(attemptsInfo.intentos || []).map((i) => i.nota));
    return (
      <QuizShell evaluacion={evaluacion}>
        <div className="flex flex-col items-center text-center py-4">
          <TitiMascot state="celebra" message="¡Ya aprobaste esta evaluación!" size="md" />
          <ScoreNumber value={mejorNota} passed className="mt-4" />
          <p className="text-sm font-bold text-gray-500 mt-1">Tu mejor nota</p>
        </div>
      </QuizShell>
    );
  }

  // --- Bloqueada (agotó intentos) ---
  if (bloqueado) {
    return (
      <QuizShell evaluacion={evaluacion}>
        <div className="flex flex-col items-center text-center py-4">
          <TitiMascot
            state="triste"
            message="Alcanzaste el máximo de intentos. Hablá con tu profesor para desbloquearla."
            size="md"
          />
          <p className="mt-4 inline-flex items-center gap-2 h-9 px-3 rounded-full bg-red-50 border-2 border-red-500 text-sm font-extrabold text-red-700 tabular-nums">
            <LockIcon className="w-4 h-4" />
            {attemptsInfo.intentos.length} de {attemptsInfo.intentosMax} intentos usados
          </p>
          {intentoExtra > 0 && !plazoVencido && (
            <ExtraAttemptCta cantidad={intentoExtra} onUse={handleUseExtra} />
          )}
        </div>
      </QuizShell>
    );
  }

  // --- Intro ---
  if (phase === 'intro') {
    const usados = attemptsInfo?.intentos?.length ?? 0;
    const maximo = attemptsInfo?.intentosMax ?? evaluacion.intentosMax;
    return (
      <QuizShell evaluacion={evaluacion}>
        <div className="flex flex-col items-center text-center py-2">
          <TitiMascot state="saludo" message="¡Vos podés! Leé con calma cada pregunta." size="md" />
          <ul className="grid grid-cols-3 gap-2 sm:gap-3 mt-6 w-full max-w-md">
            <InfoStat Icon={ListIcon} solid="bg-blue-500" label="Preguntas" value={totalPreguntas} />
            <InfoStat Icon={TargetIcon} solid="bg-green-500" label="Nota mínima" value={evaluacion.notaMinima} suffix="%" />
            <InfoStat Icon={RefreshIcon} solid="bg-titi-achievement" label="Intentos" text={`${usados}/${maximo}`} />
          </ul>
          {usados > 0 && (
            <p className="text-sm font-semibold text-gray-500 mt-3">
              Ya usaste {usados} {usados === 1 ? 'intento' : 'intentos'}.
            </p>
          )}
          <button
            type="button"
            onClick={() => setPhase('quiz')}
            disabled={plazoVencido}
            className="titi-btn-primary mt-6 px-8 py-3 text-base"
          >
            {!plazoVencido && <PlayIcon className="w-5 h-5" />}
            {plazoVencido ? 'Plazo vencido' : 'Comenzar intento'}
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
        <div className="flex flex-col items-center text-center py-2">
          {aprobado ? (
            <TitiMascot state="celebra" message="¡Lo lograste!" size="md" />
          ) : result.bloqueado ? (
            <TitiMascot
              state="triste"
              message="Se acabaron los intentos. Hablá con tu profesor."
              size="md"
            />
          ) : (
            <TitiMascot
              state="pensando"
              message="No te rindas, tenés más intentos. ¡Revisá el material y volvé!"
              size="md"
            />
          )}

          <ScoreNumber value={result.intento.nota} passed={aprobado} className="mt-4" />
          <span
            className={`mt-2 inline-flex items-center gap-1.5 h-8 px-3 rounded-full border-2 text-sm font-extrabold ${
              aprobado ? 'bg-green-50 border-green-500 text-green-700' : 'bg-red-50 border-red-500 text-red-700'
            }`}
          >
            {aprobado ? <CheckIcon className="w-4 h-4" /> : <CloseIcon className="w-4 h-4" />}
            {aprobado ? 'Aprobada' : 'No aprobada'}
          </span>
          <p className="text-sm font-semibold text-gray-500 mt-2">
            {result.correctas} de {result.total} correctas · nota mínima {evaluacion.notaMinima}%
          </p>
          {!aprobado && !result.bloqueado && !plazoVencido && (
            <p className="text-sm font-bold text-gray-500 mt-0.5">
              Te {result.intentosRestantes === 1 ? 'queda' : 'quedan'} {result.intentosRestantes}{' '}
              {result.intentosRestantes === 1 ? 'intento' : 'intentos'}
            </p>
          )}
          {result.bloqueado && intentoExtra > 0 && !plazoVencido && (
            <ExtraAttemptCta cantidad={intentoExtra} onUse={handleUseExtra} />
          )}

          {/* Corrección por pregunta */}
          <ul ref={feedbackRef} className="w-full max-w-lg mt-6 space-y-2 text-left">
            {evaluacion.preguntas.map((p, i) => {
              const d = result.detalle?.find((x) => x.preguntaId === p.id);
              const ok = Boolean(d?.correcta);
              return (
                <li
                  key={p.id}
                  className={`flex items-start gap-3 rounded-xl border-2 px-3 py-2.5 ${
                    ok ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'
                  }`}
                >
                  <span
                    className={`w-7 h-7 rounded-full grid place-items-center shrink-0 text-white ${ok ? 'bg-green-500' : 'bg-red-500'}`}
                    aria-hidden="true"
                  >
                    {ok ? <CheckIcon className="w-3.5 h-3.5" /> : <CloseIcon className="w-3.5 h-3.5" />}
                  </span>
                  <span className="text-sm font-semibold text-titi-dark min-w-0 break-words pt-0.5">
                    <span className="sr-only">{ok ? 'Correcta: ' : 'Incorrecta: '}</span>
                    <span className="text-gray-500 tabular-nums mr-1">{i + 1}.</span>
                    {p.texto}
                  </span>
                </li>
              );
            })}
          </ul>

          {!aprobado && !result.bloqueado && !plazoVencido && (
            <button
              type="button"
              onClick={handleRetry}
              className="titi-btn-primary mt-6 px-8 py-3 text-base"
            >
              <RefreshIcon className="w-5 h-5" />
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
      <div className="flex flex-col gap-4">
        {/* Avance de respuestas */}
        <div className="rounded-xl bg-titi-cream border-2 border-gray-200 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-sm font-extrabold text-titi-dark tabular-nums">
              {answeredCount} de {totalPreguntas} respondidas
            </span>
            {allAnswered && (
              <span className="inline-flex items-center gap-1 text-xs font-extrabold text-green-700">
                <CheckIcon className="w-3.5 h-3.5" />
                Listo para enviar
              </span>
            )}
          </div>
          <ProgressBar value={answeredCount} max={totalPreguntas || 1} color={allAnswered ? 'bg-green-500' : 'bg-titi-yellow'} track="bg-white" label="Preguntas respondidas" />
        </div>

        {usarExtra && (
          <p className="flex items-center gap-2 rounded-xl border-2 border-titi-dark bg-titi-yellow-light px-3 py-2 text-sm font-bold text-titi-dark">
            <span className="w-7 h-7 rounded-lg bg-titi-yellow border-2 border-titi-dark grid place-items-center shrink-0" aria-hidden="true">
              <RefreshIcon className="w-4 h-4" />
            </span>
            Este intento va a consumir tu "intento extra" de la tienda.
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

        {error && <ErrorBox title="No pudimos enviar tus respuestas" message={error} onRetry={handleSubmit} />}

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
          <span className="text-sm font-semibold text-gray-500 tabular-nums text-center sm:text-left">
            {allAnswered ? 'Revisá tus respuestas y enviá.' : `Te ${totalPreguntas - answeredCount === 1 ? 'falta' : 'faltan'} ${totalPreguntas - answeredCount} por responder.`}
          </span>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!allAnswered || submitting || plazoVencido}
            className="titi-btn-primary w-full sm:w-auto px-6 sm:px-8 py-3 text-base"
          >
            <SendIcon className="w-5 h-5" />
            {submitting ? 'Enviando…' : 'Enviar respuestas'}
          </button>
        </div>
      </div>
    </QuizShell>
  );
}

// ---- Nota grande con conteo (verde si aprobó, roja si no) ----
function ScoreNumber({ value, passed, className = '' }) {
  const shown = useCountUp(value);
  return (
    <p className={`text-5xl sm:text-6xl font-black tabular-nums leading-none ${passed ? 'text-green-600' : 'text-red-500'} ${className}`}>
      {shown}%
    </p>
  );
}

// ---- CTA para destrabar con un ítem 'intento_extra' de la tienda ----
function ExtraAttemptCta({ cantidad, onUse }) {
  return (
    <div className="mt-5 flex flex-col items-center gap-1.5">
      <button type="button" onClick={onUse} className="titi-btn-primary text-sm px-6 py-2.5">
        <RefreshIcon className="w-4 h-4" />
        Usar intento extra
      </button>
      <span className="text-sm font-semibold text-gray-500 tabular-nums">
        Te {cantidad === 1 ? 'queda' : 'quedan'} {cantidad} en la tienda
      </span>
    </div>
  );
}

// ---- Carcasa con título ----
function QuizShell({ evaluacion, children }) {
  const deadlineExpired = isDeadlineExpired(evaluacion.fechaLimite);
  const ref = usePopIn([evaluacion.id]);
  return (
    <section ref={ref} className={`${SURFACE} p-4 sm:p-6`}>
      <header className="flex items-start gap-3 mb-5">
        <RoleBadge Icon={evaluacion.esFinal ? TrophyIcon : AwardIcon} solid="bg-titi-achievement" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-extrabold uppercase tracking-wide text-titi-achievement">
            {evaluacion.esFinal ? 'Evaluación final' : 'Evaluación de módulo'}
          </p>
          <h2 className="text-xl sm:text-2xl font-black text-titi-dark mt-0.5 leading-tight break-words">
            {evaluacion.titulo}
          </h2>
          {evaluacion.fechaLimite && (
            <div className="mt-2.5">
              <span
                className={`inline-flex items-center gap-1.5 min-h-8 px-3 py-1 rounded-full border-2 text-xs font-extrabold ${
                  deadlineExpired ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 bg-titi-cream text-titi-dark'
                }`}
              >
                <ClockIcon className="w-4 h-4 shrink-0" />
                {deadlineExpired ? 'Plazo vencido' : 'Entrega hasta'}: {formatDeadline(evaluacion.fechaLimite)}
              </span>
              {deadlineExpired && (
                <p className="mt-1.5 text-sm font-semibold text-gray-500">
                  Podés revisar contenido, notas y resúmenes, pero no enviar nuevos intentos.
                </p>
              )}
            </div>
          )}
        </div>
      </header>
      {children}
    </section>
  );
}

function InfoStat({ Icon, solid, label, value, suffix = '', text }) {
  const shown = useCountUp(value ?? 0);
  return (
    <li className="flex flex-col items-center text-center gap-1 p-2.5 rounded-xl bg-titi-cream border-2 border-gray-200">
      <span className={`w-8 h-8 rounded-lg border-2 border-titi-dark grid place-items-center text-white -rotate-6 ${solid}`} aria-hidden="true">
        <Icon className="w-4 h-4" />
      </span>
      <span className="text-xl font-black text-titi-dark tabular-nums leading-none mt-1">
        {text ?? `${shown}${suffix}`}
      </span>
      <span className="text-xs font-bold text-gray-500 leading-tight">{label}</span>
    </li>
  );
}

// ---- Una pregunta del formulario ----
const LETTERS = 'ABCDEFGHIJ';

function QuestionCard({ pregunta, index, answer, onAnswer }) {
  const answered = pregunta.tipo === 'RESPUESTA_CORTA' ? Boolean(answer?.texto?.trim()) : Boolean(answer?.opcionId);
  return (
    <fieldset
      className={`rounded-2xl border-2 bg-white p-4 sm:p-5 transition-colors duration-150 ${answered ? 'border-titi-dark' : 'border-gray-200'}`}
    >
      <legend className="sr-only">Pregunta {index + 1}</legend>
      <div className="flex items-start gap-3 mb-3">
        <span
          aria-hidden="true"
          className={`w-8 h-8 shrink-0 rounded-lg border-2 border-titi-dark grid place-items-center text-sm font-black tabular-nums -rotate-6 ${
            answered ? 'bg-titi-yellow text-titi-dark' : 'bg-white text-titi-dark'
          }`}
        >
          {index + 1}
        </span>
        <p className="text-base font-extrabold text-titi-dark break-words min-w-0 pt-0.5">{pregunta.texto}</p>
      </div>

      {pregunta.tipo === 'RESPUESTA_CORTA' ? (
        <input
          type="text"
          value={answer?.texto || ''}
          onChange={(e) => onAnswer({ texto: e.target.value })}
          placeholder="Escribí tu respuesta…"
          maxLength={200}
          aria-label={`Respuesta a la pregunta ${index + 1}`}
          className={INPUT}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {pregunta.opciones.map((o, oIndex) => {
            const selected = answer?.opcionId === o.id;
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => onAnswer({ opcionId: o.id })}
                aria-pressed={selected}
                className={[
                  'group w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-xl border-2 text-sm font-bold text-titi-dark',
                  'transition-all duration-150 active:translate-y-0.5 active:shadow-none motion-reduce:transition-none',
                  'focus:outline-none focus-visible:ring-4 focus-visible:ring-titi-yellow/60',
                  selected
                    ? 'bg-titi-yellow border-titi-dark shadow-[0_3px_0_#1A1A2E]'
                    : 'bg-white border-gray-200 hover:border-titi-dark hover:bg-titi-cream',
                ].join(' ')}
              >
                <span
                  aria-hidden="true"
                  className={`w-7 h-7 shrink-0 rounded-lg border-2 grid place-items-center text-xs font-black transition-colors duration-150 ${
                    selected
                      ? 'bg-titi-dark border-titi-dark text-white'
                      : 'bg-white border-gray-300 text-gray-500 group-hover:border-titi-dark group-hover:text-titi-dark'
                  }`}
                >
                  {LETTERS[oIndex] || oIndex + 1}
                </span>
                <span className="min-w-0 break-words">{o.texto}</span>
              </button>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}
