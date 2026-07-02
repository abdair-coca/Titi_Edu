import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import client from '../../api/client.js';
import ConfirmModal from '../../components/ConfirmModal.jsx';
import { CheckIcon, ListIcon, PencilIcon } from '../../components/icons.jsx';

const TIPOS = [
  { value: 'OPCION_MULTIPLE', label: 'Opción múltiple', Icon: ListIcon },
  { value: 'VERDADERO_FALSO', label: 'Verdadero / Falso', Icon: CheckIcon },
  { value: 'RESPUESTA_CORTA', label: 'Respuesta corta', Icon: PencilIcon },
];

function emptyQuestion(tipo) {
  if (tipo === 'VERDADERO_FALSO') {
    return {
      texto: '',
      tipo,
      opciones: [
        { texto: 'Verdadero', esCorrecta: true },
        { texto: 'Falso', esCorrecta: false },
      ],
    };
  }
  if (tipo === 'RESPUESTA_CORTA') {
    return { texto: '', tipo, opciones: [{ texto: '', esCorrecta: true }] };
  }
  return {
    texto: '',
    tipo: 'OPCION_MULTIPLE',
    opciones: [
      { texto: '', esCorrecta: true },
      { texto: '', esCorrecta: false },
    ],
  };
}

/**
 * EvaluationEditor — crea/edita la evaluación de un módulo o la final del curso.
 * mode="module" → /teacher/modules/:moduleId/evaluation
 * mode="final"  → /teacher/courses/:id/final-evaluation
 */
export default function EvaluationEditor({ mode = 'module' }) {
  const params = useParams();
  const navigate = useNavigate();
  const moduleId = params.moduleId;
  const courseId = params.id;

  const isFinal = mode === 'final';
  const getUrl = isFinal
    ? `/api/courses/${courseId}/final-evaluation`
    : `/api/modules/${moduleId}/evaluation`;

  const [evalId, setEvalId] = useState(null); // null → crear
  const [titulo, setTitulo] = useState('');
  const [intentosMax, setIntentosMax] = useState(3);
  const [notaMinima, setNotaMinima] = useState(70);
  const [preguntas, setPreguntas] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Cargar evaluación existente (404 = modo crear)
  const fetchExisting = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await client.get(getUrl);
      if (data?.success) {
        const ev = data.data.evaluacion;
        setEvalId(ev.id);
        setTitulo(ev.titulo || '');
        setIntentosMax(ev.intentosMax ?? 3);
        setNotaMinima(ev.notaMinima ?? 70);
        setPreguntas(
          (ev.preguntas || []).map((p) => ({
            texto: p.texto,
            tipo: p.tipo,
            opciones: (p.opciones || []).map((o) => ({
              texto: o.texto,
              esCorrecta: Boolean(o.esCorrecta),
            })),
          })),
        );
      }
    } catch (err) {
      if (err.response?.status === 404) {
        // No existe todavía: modo crear con una pregunta inicial
        setEvalId(null);
        setPreguntas([emptyQuestion('OPCION_MULTIPLE')]);
      } else {
        setError(err.response?.data?.message || err.message || 'Error de red');
      }
    } finally {
      setLoading(false);
    }
  }, [getUrl]);

  useEffect(() => {
    fetchExisting();
  }, [fetchExisting]);

  // --- Mutadores de preguntas ---
  function addQuestion(tipo) {
    setPreguntas((prev) => [...prev, emptyQuestion(tipo)]);
  }
  function updateQuestion(idx, patch) {
    setPreguntas((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  }
  function removeQuestion(idx) {
    setPreguntas((prev) => prev.filter((_, i) => i !== idx));
  }

  function validate() {
    if (!titulo.trim()) return 'El título es obligatorio';
    if (preguntas.length === 0) return 'Agregá al menos una pregunta';
    for (let i = 0; i < preguntas.length; i++) {
      const p = preguntas[i];
      const n = i + 1;
      if (!p.texto.trim()) return `La pregunta ${n} no tiene texto`;
      if (p.tipo === 'RESPUESTA_CORTA') {
        if (!p.opciones.some((o) => o.texto.trim())) {
          return `La pregunta ${n} necesita al menos una respuesta aceptada`;
        }
      } else {
        if (p.opciones.some((o) => !o.texto.trim())) {
          return `La pregunta ${n} tiene opciones sin texto`;
        }
        if (p.opciones.filter((o) => o.esCorrecta).length !== 1) {
          return `La pregunta ${n} debe tener una opción correcta marcada`;
        }
        if (p.tipo === 'OPCION_MULTIPLE' && p.opciones.length < 2) {
          return `La pregunta ${n} necesita al menos 2 opciones`;
        }
      }
    }
    return null;
  }

  async function handleSave() {
    const v = validate();
    if (v) {
      setError(v);
      setSuccess(null);
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        titulo: titulo.trim(),
        intentosMax: Number(intentosMax),
        notaMinima: Number(notaMinima),
        preguntas: preguntas.map((p) => ({
          texto: p.texto.trim(),
          tipo: p.tipo,
          opciones: p.opciones
            .filter((o) => o.texto.trim())
            .map((o) => ({ texto: o.texto.trim(), esCorrecta: o.esCorrecta })),
        })),
      };

      const { data } = evalId
        ? await client.put(`/api/evaluations/${evalId}`, payload)
        : await client.post(getUrl, payload);

      if (data?.success) {
        setEvalId(data.data.evaluacion.id);
        setSuccess('Evaluación guardada');
      } else {
        setError(data?.message || 'No se pudo guardar');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error guardando');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!evalId) return;
    try {
      const { data } = await client.delete(`/api/evaluations/${evalId}`);
      if (data?.success) {
        navigate(-1);
      } else {
        setError(data?.message || 'No se pudo borrar');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error borrando');
    } finally {
      setConfirmDelete(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-8 animate-pulse max-w-3xl">
        <div className="h-5 w-1/3 bg-gray-100 rounded mb-6" />
        <div className="space-y-4">
          <div className="h-10 bg-gray-100 rounded-xl" />
          <div className="h-28 bg-gray-100 rounded-xl" />
          <div className="h-28 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="text-sm font-semibold text-gray-500 hover:text-titi-dark mb-4 inline-flex items-center gap-1"
      >
        ← Volver al contenido
      </button>

      <h1 className="text-xl sm:text-3xl font-extrabold text-titi-dark mb-1 leading-tight">
        {isFinal ? 'Evaluación final del curso' : 'Evaluación del módulo'}
      </h1>
      <p className="text-sm font-medium text-gray-500 mb-5 sm:mb-6">
        {evalId
          ? 'Editá las preguntas. Al guardar se reemplazan por esta versión.'
          : 'Creá las preguntas. Podés combinar los 3 tipos.'}
      </p>

      <div className="bg-white border border-gray-100 rounded-2xl p-4 sm:p-6 shadow-[0_2px_8px_rgba(0,0,0,0.06)] flex flex-col gap-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-titi-dark">
            Título <span className="text-red-500">*</span>
          </span>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder={isFinal ? 'Ej. Evaluación final' : 'Ej. Repaso del módulo 1'}
            maxLength={120}
            className="titi-input"
          />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-titi-dark">Intentos máximos</span>
            <input
              type="number"
              min={1}
              max={10}
              value={intentosMax}
              onChange={(e) => setIntentosMax(e.target.value)}
              className="titi-input"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-titi-dark">Nota mínima (%)</span>
            <input
              type="number"
              min={0}
              max={100}
              value={notaMinima}
              onChange={(e) => setNotaMinima(e.target.value)}
              className="titi-input"
            />
          </label>
        </div>

        <hr className="border-gray-100" />

        {/* Preguntas */}
        {preguntas.length === 0 ? (
          <p className="text-sm text-gray-400 font-medium text-center py-4">
            Todavía no hay preguntas. Agregá la primera 👇
          </p>
        ) : (
          preguntas.map((p, idx) => (
            <QuestionEditor
              key={idx}
              pregunta={p}
              index={idx}
              onChange={(patch) => updateQuestion(idx, patch)}
              onRemove={() => removeQuestion(idx)}
            />
          ))
        )}

        {/* Agregar pregunta */}
        <div className="flex flex-wrap gap-2">
          {TIPOS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => addQuestion(t.value)}
              className="inline-flex items-center gap-1.5 bg-titi-cream text-titi-dark font-bold text-sm px-3 py-2 rounded-xl border border-dashed border-titi-yellow hover:bg-titi-yellow-light active:scale-[0.96] transition-all duration-150"
            >
              + <t.Icon className="w-4 h-4 shrink-0" aria-hidden="true" /> {t.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-sm font-semibold text-red-700">{error}</p>
          </div>
        )}
        {success && !error && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-green-500 grid place-items-center shrink-0" aria-hidden="true">
              <CheckIcon className="w-3.5 h-3.5 text-white" />
            </span>
            <p className="text-sm font-semibold text-green-700">{success}</p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full sm:w-auto bg-titi-yellow text-titi-dark font-bold text-base px-6 py-3 rounded-xl shadow-[0_4px_0px_#E6B800] hover:shadow-[0_2px_0px_#E6B800] hover:-translate-y-0.5 active:shadow-none active:translate-y-0 transition-all duration-150 disabled:opacity-50"
          >
            {saving ? 'Guardando…' : evalId ? 'Guardar cambios' : 'Crear evaluación'}
          </button>
          {evalId && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="w-full sm:w-auto text-red-500 font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-red-50 transition-all"
            >
              Eliminar evaluación
            </button>
          )}
        </div>
      </div>

      <ConfirmModal
        open={confirmDelete}
        title="¿Eliminar esta evaluación?"
        message="Se borrarán las preguntas y todos los intentos de los estudiantes. Esta acción no se puede deshacer."
        confirmText="Eliminar"
        cancelText="Cancelar"
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}

// ---- Editor de una pregunta ----
function QuestionEditor({ pregunta, index, onChange, onRemove }) {
  const tipo = TIPOS.find((t) => t.value === pregunta.tipo);

  function updateOpcion(idx, patch) {
    onChange({
      opciones: pregunta.opciones.map((o, i) => (i === idx ? { ...o, ...patch } : o)),
    });
  }
  function markCorrect(idx) {
    onChange({
      opciones: pregunta.opciones.map((o, i) => ({ ...o, esCorrecta: i === idx })),
    });
  }
  function addOpcion() {
    onChange({ opciones: [...pregunta.opciones, { texto: '', esCorrecta: false }] });
  }
  function addRespuesta() {
    onChange({ opciones: [...pregunta.opciones, { texto: '', esCorrecta: true }] });
  }
  function removeOpcion(idx) {
    onChange({ opciones: pregunta.opciones.filter((_, i) => i !== idx) });
  }

  return (
    <div className="bg-titi-cream/50 border border-gray-100 rounded-2xl p-3 sm:p-4">
      <div className="flex items-start gap-2 mb-3">
        <span className="shrink-0 w-7 h-7 rounded-full bg-titi-yellow-light text-titi-dark grid place-items-center text-xs font-extrabold mt-1">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <span className="text-xs sm:text-xs font-bold text-titi-achievement uppercase tracking-wide block">
            {tipo?.icon} {tipo?.label}
          </span>
          <textarea
            value={pregunta.texto}
            onChange={(e) => onChange({ texto: e.target.value })}
            placeholder="Escribí la pregunta…"
            rows={2}
            maxLength={300}
            className="titi-input resize-none mt-1"
          />
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Eliminar pregunta"
          className="shrink-0 w-8 h-8 grid place-items-center rounded-lg text-red-500 hover:bg-red-50 mt-1"
        >
          ✕
        </button>
      </div>

      {/* Opciones según tipo */}
      {pregunta.tipo === 'RESPUESTA_CORTA' ? (
        <div className="pl-2 sm:pl-9 flex flex-col gap-2">
          <p className="text-xs font-semibold text-gray-500">
            Respuestas aceptadas (no distingue mayúsculas ni tildes):
          </p>
          {pregunta.opciones.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={o.texto}
                onChange={(e) => updateOpcion(i, { texto: e.target.value })}
                placeholder={`Respuesta aceptada ${i + 1}`}
                maxLength={200}
                className="titi-input flex-1"
              />
              {pregunta.opciones.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeOpcion(i)}
                  aria-label="Quitar respuesta"
                  className="w-7 h-7 grid place-items-center rounded text-red-500 hover:bg-red-50 shrink-0"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addRespuesta}
            className="self-start text-xs font-bold text-titi-dark bg-white border border-dashed border-gray-100 hover:border-titi-yellow rounded-lg px-3 py-1.5"
          >
            + Otra respuesta aceptada
          </button>
        </div>
      ) : (
        <div className="pl-2 sm:pl-9 flex flex-col gap-2">
          <p className="text-xs font-semibold text-gray-500">
            Marcá la opción correcta:
          </p>
          {pregunta.opciones.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => markCorrect(i)}
                aria-pressed={o.esCorrecta}
                aria-label={o.esCorrecta ? 'Opción correcta' : 'Marcar como correcta'}
                className={`w-6 h-6 rounded-full border-2 grid place-items-center shrink-0 transition-colors ${
                  o.esCorrecta
                    ? 'bg-green-500 border-green-500 text-white'
                    : 'bg-white border-gray-300 text-transparent hover:border-green-400'
                }`}
              >
                ✓
              </button>
              <input
                value={o.texto}
                onChange={(e) => updateOpcion(i, { texto: e.target.value })}
                placeholder={`Opción ${i + 1}`}
                maxLength={200}
                disabled={pregunta.tipo === 'VERDADERO_FALSO'}
                className="titi-input flex-1 disabled:opacity-70"
              />
              {pregunta.tipo === 'OPCION_MULTIPLE' && pregunta.opciones.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeOpcion(i)}
                  aria-label="Quitar opción"
                  className="w-7 h-7 grid place-items-center rounded text-red-500 hover:bg-red-50 shrink-0"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          {pregunta.tipo === 'OPCION_MULTIPLE' && pregunta.opciones.length < 6 && (
            <button
              type="button"
              onClick={addOpcion}
              className="self-start text-xs font-bold text-titi-dark bg-white border border-dashed border-gray-100 hover:border-titi-yellow rounded-lg px-3 py-1.5"
            >
              + Agregar opción
            </button>
          )}
        </div>
      )}
    </div>
  );
}
