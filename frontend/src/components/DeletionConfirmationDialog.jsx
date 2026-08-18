import { useEffect, useState } from 'react';
import { usePopIn } from '../lib/motion.js';

const IMPACT_LABELS = {
  modulos: 'módulos', lecciones: 'lecciones', materiales: 'materiales', recursosHtml: 'recursos HTML',
  intentosHtml: 'intentos HTML', resultadosHtml: 'resultados HTML', revisionesLeccion: 'revisiones',
  progresos: 'progresos', notasLeccion: 'notas', comentariosLeccion: 'comentarios',
  evaluaciones: 'evaluaciones', preguntas: 'preguntas', opciones: 'opciones', intentosEvaluacion: 'intentos de evaluación',
  inscripciones: 'inscripciones', certificadosPreservados: 'certificados preservados', profesoresAsignados: 'profesores asignados',
};

export default function DeletionConfirmationDialog({ value, busy = false, onCancel, onConfirm }) {
  const [phrase, setPhrase] = useState('');
  const panelRef = usePopIn([Boolean(value)]);
  useEffect(() => setPhrase(''), [value]);
  if (!value) return null;
  const impacts = Object.entries(value.impact || {}).filter(([, count]) => Number(count) > 0);
  const label = { course: 'curso', module: 'módulo', lesson: 'lección' }[value.kind] || 'recurso';

  return (
    <div className="titi-backdrop-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-confirmation-title">
      <div ref={panelRef} className="titi-card w-full max-w-lg p-6">
        <h2 id="delete-confirmation-title" className="text-xl font-bold text-titi-dark">¿Eliminar {label} definitivamente?</h2>
        <p className="text-sm text-gray-600 mt-2">Esta vista previa fue calculada por el servidor. Se eliminarán los datos indicados; los certificados conservan su título histórico.</p>
        <div className="mt-4 max-h-40 overflow-y-auto rounded-xl border border-red-100 bg-red-50 p-3">
          {impacts.length ? <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-red-800">{impacts.map(([key, count]) => <li key={key}><strong>{count}</strong> {IMPACT_LABELS[key] || key}</li>)}</ul> : <p className="text-xs text-gray-600">No hay dependencias adicionales.</p>}
        </div>
        <p className="text-xs text-amber-700 mt-3">Riesgo residual: archivos de materiales en Cloudinary o disco quedan retenidos hasta una limpieza reconciliada.</p>
        <p className="text-sm text-gray-600 mt-4">Escribí exactamente esta frase para confirmar:</p>
        <code className="block mt-2 rounded-xl bg-titi-cream p-3 text-sm break-all">{value.phrase}</code>
        <input value={phrase} onChange={(event) => setPhrase(event.target.value)} disabled={busy} autoFocus className="titi-input mt-3" placeholder="Pegá la frase exacta" />
        <div className="flex justify-end gap-3 mt-5">
          <button type="button" onClick={onCancel} disabled={busy} className="titi-btn-ghost">Cancelar</button>
          <button type="button" onClick={() => onConfirm(phrase)} disabled={busy || phrase !== value.phrase} aria-busy={busy} className="px-4 py-2 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed">{busy ? 'Eliminando…' : `Eliminar ${label}`}</button>
        </div>
      </div>
    </div>
  );
}
