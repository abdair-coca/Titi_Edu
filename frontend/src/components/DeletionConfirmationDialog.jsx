import { useEffect, useState } from 'react';
import { usePopIn } from '../lib/motion.js';
import { AlertIcon } from './icons.jsx';
import { BTN_DANGER_SM, BTN_SECONDARY, INPUT, RoleBadge } from './ui/v3.jsx';

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
      <div ref={panelRef} className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-2xl border-2 border-titi-dark shadow-[0_8px_0_#1A1A2E] p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <RoleBadge Icon={AlertIcon} solid="bg-red-500" size="sm" />
          <h2 id="delete-confirmation-title" className="text-xl font-extrabold text-titi-dark">¿Eliminar {label} <span className="text-red-500">definitivamente</span>?</h2>
        </div>
        <p className="text-sm font-medium text-gray-600 mt-3">Esta vista previa fue calculada por el servidor. Se eliminarán los datos indicados; los certificados conservan su título histórico.</p>
        <div className="mt-4 max-h-40 overflow-y-auto rounded-xl border-2 border-red-200 bg-red-50 p-3">
          {impacts.length ? <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm font-semibold text-red-800">{impacts.map(([key, count]) => <li key={key}><strong>{count}</strong> {IMPACT_LABELS[key] || key}</li>)}</ul> : <p className="text-sm font-medium text-gray-600">No hay dependencias adicionales.</p>}
        </div>
        <p className="text-xs font-semibold text-amber-700 mt-3">Riesgo residual: archivos de materiales en Cloudinary o disco quedan retenidos hasta una limpieza reconciliada.</p>
        <p className="text-sm font-medium text-gray-600 mt-4">Escribí exactamente esta frase para confirmar:</p>
        <code className="block mt-2 rounded-xl bg-titi-cream border-2 border-dashed border-gray-300 p-3 text-sm font-bold text-titi-dark break-all">{value.phrase}</code>
        <input value={phrase} onChange={(event) => setPhrase(event.target.value)} disabled={busy} autoFocus className={`${INPUT} mt-3`} placeholder="Pegá la frase exacta" />
        <div className="flex justify-end gap-3 mt-5">
          <button type="button" onClick={onCancel} disabled={busy} className={BTN_SECONDARY}>Cancelar</button>
          <button type="button" onClick={() => onConfirm(phrase)} disabled={busy || phrase !== value.phrase} aria-busy={busy} className={`${BTN_DANGER_SM} h-11 px-4`}>{busy ? 'Eliminando…' : `Eliminar ${label}`}</button>
        </div>
      </div>
    </div>
  );
}
