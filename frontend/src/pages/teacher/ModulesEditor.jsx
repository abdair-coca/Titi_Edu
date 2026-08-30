import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import MarkdownContent from '../../components/MarkdownContent.jsx';
import TitiMascot from '../../components/TitiMascot.jsx';
import DeletionConfirmationDialog from '../../components/DeletionConfirmationDialog.jsx';
import { authoringError, authoringMutation } from '../../lib/authoring.js';
import { resolveMediaUrl } from '../../lib/format.js';
import { sanitizeMarkdownUrl } from '../../lib/markdown.js';
import { isoToLocalDateTime, localDateTimeToIso } from '../../lib/deadline.js';
import client from '../../api/client.js';

const LESSON_FILTERS = [
  ['ALL', 'Todas'], ['BORRADOR', 'Borradores'], ['PUBLICADA', 'Publicadas'], ['ARCHIVADA', 'Archivadas'],
];

function formatDate(value) {
  return value ? new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Sin fecha';
}

export default function ModulesEditor() {
  const { id: courseId } = useParams();
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = useState(null);
  const [activeLessonId, setActiveLessonId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [deletionConfirm, setDeletionConfirm] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data } = await client.get(`/api/authoring/courses/${courseId}`);
      if (!data?.success) throw new Error(data?.message || 'No se pudo cargar el curso');
      setSnapshot(data.data);
      const first = data.data.course?.modulos?.flatMap((module) => module.lecciones || [])[0];
      setActiveLessonId((current) => current || first?.id || null);
    } catch (err) { setError(authoringError(err, 'No se pudo cargar el curso')); }
    finally { setLoading(false); }
  }, [courseId]);
  useEffect(() => { load(); }, [load]);

  const course = snapshot?.course;
  const modules = course?.modulos || [];
  const activeModule = modules.find((module) => module.lecciones?.some((lesson) => lesson.id === activeLessonId));
  const activeLesson = activeModule?.lecciones?.find((lesson) => lesson.id === activeLessonId) || null;
  const totalLessons = useMemo(() => modules.reduce((sum, module) => sum + (module.lecciones?.length || 0), 0), [modules]);

  async function mutate(method, url, body, fallback) {
    setBusy(true); setError(null);
    try {
      const { data } = await authoringMutation(method, url, body);
      if (!data?.success) throw new Error(data?.message || fallback);
      await load();
      return data.data;
    } catch (err) { setError(authoringError(err, fallback)); return null; }
    finally { setBusy(false); }
  }

  function moduleFingerprint(moduleId) { return snapshot?.resources?.[moduleId]?.module; }
  function lessonFingerprint(moduleId, lessonId) { return snapshot?.resources?.[moduleId]?.lessons?.[lessonId]; }
  function materialFingerprint(moduleId, materialId) { return snapshot?.resources?.[moduleId]?.materials?.[materialId]; }

  async function addModule() {
    const order = (modules.at(-1)?.orden ?? 0) + 1;
    await mutate('post', `/courses/${courseId}/modules`, { titulo: `Módulo ${order}`, orden: order, expectedFingerprint: snapshot.fingerprint }, 'No se pudo crear el módulo');
  }
  async function addContent(module, formatoContenido) {
    const orden = (module.lecciones?.at(-1)?.orden ?? 0) + 1;
    const isPresentation = formatoContenido === 'HTML';
    const data = await mutate('post', `/modules/${module.id}/lessons`, {
      titulo: `${isPresentation ? 'Nueva presentación' : 'Nueva lección'} ${orden}`,
      contenido: '', orden, formatoContenido, expectedFingerprint: moduleFingerprint(module.id),
    }, isPresentation ? 'No se pudo crear la presentación' : 'No se pudo crear la lección');
    if (data?.lesson?.id) setActiveLessonId(data.lesson.id);
  }
  async function saveModule(module, fields) { await mutate('put', `/modules/${module.id}`, { ...fields, expectedFingerprint: moduleFingerprint(module.id) }, 'No se pudo guardar el módulo'); }
  async function saveLesson(module, lesson, fields) { return mutate('put', `/lessons/${lesson.id}`, { ...fields, expectedFingerprint: lessonFingerprint(module.id, lesson.id) }, 'No se pudo guardar la lección'); }
  async function startDeletion(kind, resource) {
    setBusy(true); setError(null);
    try {
      const plural = kind === 'module' ? 'modules' : 'lessons';
      const { data } = await authoringMutation('post', `/${plural}/${resource.id}/preview-deletion`, {});
      if (!data?.success) throw new Error(data?.message || 'No se pudo preparar el borrado');
      setDeletionConfirm({ kind, resource, ...data.data });
    } catch (err) { setError(authoringError(err, 'No se pudo preparar el borrado')); }
    finally { setBusy(false); }
  }
  async function finishDeletion(phrase) {
    if (!deletionConfirm) return;
    const { kind, resource, fingerprint, confirmationToken } = deletionConfirm;
    const plural = kind === 'module' ? 'modules' : 'lessons';
    const result = await mutate('delete', `/${plural}/${resource.id}`, { expectedFingerprint: fingerprint, confirmationToken, phrase }, 'No se pudo eliminar el recurso');
    if (result) {
      if (kind === 'lesson') setActiveLessonId(null);
      setDeletionConfirm(null);
    }
  }
  async function publishLesson(module, lesson) { await mutate('post', `/lessons/${lesson.id}/publish`, { expectedFingerprint: lessonFingerprint(module.id, lesson.id) }, 'No se pudo publicar la lección'); }
  async function archiveLesson(module, lesson) { const result = await mutate('post', `/lessons/${lesson.id}/archive`, { expectedFingerprint: lessonFingerprint(module.id, lesson.id) }, 'No se pudo archivar la lección'); if (result) setConfirmation(null); }
  async function restoreLesson(module, lesson) { await mutate('post', `/lessons/${lesson.id}/restore`, { expectedFingerprint: lessonFingerprint(module.id, lesson.id) }, 'No se pudo restaurar la lección'); }
  async function restoreRevision(module, lesson, revision) { await mutate('post', `/lessons/${lesson.id}/revisions/${revision.id}/restore`, { expectedFingerprint: lessonFingerprint(module.id, lesson.id) }, 'No se pudo restaurar la revisión'); }
  async function uploadMaterial(module, lesson, file, nombre) {
    const formData = new FormData(); formData.append('file', file); formData.append('nombre', nombre || file.name); formData.append('expectedFingerprint', lessonFingerprint(module.id, lesson.id));
    await mutate('post', `/lessons/${lesson.id}/materials`, formData, 'No se pudo subir el material');
  }
  async function uploadHtml(module, lesson, file, evaluable, intentosMax, fechaLimite) {
    let html;
    try { html = await file.text(); } catch { setError('No se pudo leer el archivo HTML'); return null; }
    return mutate('post', `/lessons/${lesson.id}/html`, { html, evaluable, intentosMax: evaluable ? Number(intentosMax) : null, fechaLimite: evaluable ? localDateTimeToIso(fechaLimite) : null, expectedFingerprint: lessonFingerprint(module.id, lesson.id) }, 'No se pudo guardar el HTML');
  }
  async function deleteMaterial(module, material) { await mutate('delete', `/materials/${material.id}`, { expectedFingerprint: materialFingerprint(module.id, material.id) }, 'No se pudo eliminar el material'); }

  async function startPublish(resourceType, resource) {
    setBusy(true); setError(null);
    try {
      const { data } = await authoringMutation('post', `/${resourceType === 'course' ? 'courses' : 'modules'}/${resource.id}/preview-publication`, {});
      if (!data?.success) throw new Error(data?.message || 'No se pudo preparar la publicación');
      setConfirmation({ action: 'publish', resourceType, resource, ...data.data });
    } catch (err) { setError(authoringError(err, 'No se pudo preparar la publicación')); }
    finally { setBusy(false); }
  }
  async function startUnpublish(resource) {
    setBusy(true); setError(null);
    try {
      const { data } = await authoringMutation('post', `/modules/${resource.id}/preview-unpublish`, {});
      if (!data?.success) throw new Error(data?.message || 'No se pudo preparar la despublicación');
      setConfirmation({ action: 'unpublish', resourceType: 'module', resource, ...data.data });
    } catch (err) { setError(authoringError(err, 'No se pudo preparar la despublicación')); }
    finally { setBusy(false); }
  }
  async function finishConfirmation(phrase) {
    if (!confirmation) return;
    const { action, resourceType, resource, confirmationToken, fingerprint } = confirmation;
    const plural = resourceType === 'course' ? 'courses' : 'modules';
    const url = action === 'publish' ? `/${plural}/${resource.id}/publish` : `/modules/${resource.id}/unpublish`;
    const result = await mutate('post', url, { expectedFingerprint: fingerprint, confirmationToken, phrase }, action === 'publish' ? 'No se pudo publicar' : 'No se pudo despublicar');
    if (result) setConfirmation(null);
  }

  if (loading) return <div className="flex justify-center py-20"><div className="w-12 h-12 border-4 border-titi-yellow-light border-t-titi-yellow rounded-full animate-spin" /></div>;
  if (error && !course) return <ErrorState message={error} onRetry={load} />;
  if (!course) return null;

  return <div>
    <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
      <div><button type="button" onClick={() => navigate('/teacher')} className="text-sm font-semibold text-gray-500 hover:text-titi-dark mb-2">← Mis cursos</button><h1 className="text-2xl sm:text-3xl font-black text-titi-dark">{course.titulo}</h1><p className="text-sm font-medium text-gray-500 mt-1">{modules.length} módulos · {totalLessons} lecciones</p></div>
      <div className="flex flex-wrap gap-2"><button type="button" onClick={() => navigate(`/teacher/courses/${courseId}/edit`)} className="titi-btn-ghost">Datos del curso</button><button type="button" onClick={() => navigate(`/teacher/courses/${courseId}/final-evaluation`)} className="titi-btn-ghost">Evaluación final</button>{!course.publicado && <button type="button" onClick={() => startPublish('course', course)} disabled={busy} className="titi-btn-primary">Publicar curso</button>}{course.publicado && <span className="px-3 py-2 rounded-xl bg-green-50 text-green-700 border border-green-200 text-sm font-bold">Curso publicado</span>}</div>
    </header>
    {error && <ErrorState message={error} onRetry={load} compact />}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
      <aside className="bg-white border border-gray-100 rounded-2xl p-4 flex flex-col gap-3 max-h-[80vh] overflow-y-auto">
        <button type="button" onClick={addModule} disabled={busy} className="w-full bg-titi-cream text-titi-dark font-bold text-sm px-3 py-2 rounded-xl border border-dashed border-titi-yellow hover:bg-titi-yellow-light disabled:opacity-50">+ Agregar módulo</button>
        {modules.length === 0 ? <p className="text-sm text-gray-400 text-center py-6">Todavía no hay módulos.</p> : modules.map((module) => <ModuleNode key={module.id} module={module} activeLessonId={activeLessonId} busy={busy} onSelect={setActiveLessonId} onSave={(fields) => saveModule(module, fields)} onAddLesson={() => addContent(module, 'MARKDOWN')} onAddPresentation={() => addContent(module, 'HTML')} onDelete={() => startDeletion('module', module)} onDeleteLesson={(lesson) => startDeletion('lesson', lesson)} onEditEvaluation={() => navigate(`/teacher/modules/${module.id}/evaluation`)} onPublish={() => startPublish('module', module)} onUnpublish={() => startUnpublish(module)} />)}
       </aside>
       <section className="lg:col-span-2 bg-white border border-gray-100 rounded-2xl p-5 sm:p-6 min-h-[60vh]">
         {!activeLesson ? <EmptyState /> : <LessonEditor key={activeLesson.id} lesson={activeLesson} readOnly={activeLesson.estado === 'ARCHIVADA'} busy={busy} onSave={(fields) => saveLesson(activeModule, activeLesson, fields)} onUpload={(file, name) => uploadMaterial(activeModule, activeLesson, file, name)} onUploadHtml={(file, evaluable, intentosMax, fechaLimite) => uploadHtml(activeModule, activeLesson, file, evaluable, intentosMax, fechaLimite)} onDeleteMaterial={(material) => deleteMaterial(activeModule, material)} onPublish={() => publishLesson(activeModule, activeLesson)} onArchive={() => setConfirmation({ action: 'archive', module: activeModule, lesson: activeLesson })} onRestore={() => restoreLesson(activeModule, activeLesson)} onRestoreRevision={(revision) => restoreRevision(activeModule, activeLesson, revision)} />}
      </section>
    </div>
    <ConfirmationDialog value={confirmation} busy={busy} onClose={() => setConfirmation(null)} onConfirm={finishConfirmation} onArchive={() => archiveLesson(confirmation.module, confirmation.lesson)} />
    <DeletionConfirmationDialog value={deletionConfirm} busy={busy} onCancel={() => setDeletionConfirm(null)} onConfirm={finishDeletion} />
  </div>;
}

function ModuleNode({ module, activeLessonId, busy, onSelect, onSave, onAddLesson, onAddPresentation, onDelete, onDeleteLesson, onEditEvaluation, onPublish, onUnpublish }) {
  const [title, setTitle] = useState(module.titulo);
  const [filter, setFilter] = useState('ALL');
  const locked = module.estado === 'PUBLICADO';
  useEffect(() => setTitle(module.titulo), [module.titulo]);
  const lessons = (module.lecciones || []).filter((lesson) => filter === 'ALL' || lesson.estado === filter);
  const lessonNumberById = new Map((module.lecciones || []).map((lesson, index) => [lesson.id, index + 1]));
  const saveTitle = () => { if (!locked && title.trim() && title.trim() !== module.titulo) onSave({ titulo: title.trim() }); };
  return <div className="border border-gray-100 rounded-xl bg-titi-cream/40 p-3">
    <div className="flex gap-2 items-center"><input value={title} disabled={locked} onChange={(event) => setTitle(event.target.value)} onBlur={saveTitle} className="min-w-0 flex-1 bg-transparent text-sm font-bold text-titi-dark disabled:opacity-80" /><span className={`text-[11px] font-bold px-2 py-1 rounded-full ${locked ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-600 border border-gray-200'}`}>{module.estado}</span></div>
    <div className="flex flex-wrap gap-1 mt-2">{LESSON_FILTERS.map(([value, label]) => <button key={value} type="button" onClick={() => setFilter(value)} className={`text-[10px] px-2 py-1 rounded-full font-bold ${filter === value ? 'bg-titi-yellow text-titi-dark' : 'bg-white text-gray-600 border border-gray-200'}`}>{label}</button>)}</div>
    <ol className="mt-2 space-y-1">{lessons.map((lesson) => <li key={lesson.id} className="flex items-center gap-1"><button type="button" onClick={() => onSelect(lesson.id)} className={`flex-1 min-w-0 text-left text-sm px-2 py-1.5 rounded-lg truncate ${activeLessonId === lesson.id ? 'bg-titi-yellow text-titi-dark font-bold' : 'text-titi-dark hover:bg-titi-yellow-light'}`}>{lessonNumberById.get(lesson.id)}. {lesson.titulo}<span className="ml-1 text-[10px] opacity-70">{lesson.estado || 'BORRADOR'} · v{lesson.version || 1}</span></button><button type="button" onClick={() => onDeleteLesson(lesson)} disabled={busy} className="text-red-500 text-xs font-bold px-1" aria-label="Eliminar lección">×</button></li>)}</ol>
    {!lessons.length && <p className="text-xs text-gray-400 py-2">Sin lecciones en este estado.</p>}
    <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={onAddLesson} disabled={busy} className="text-xs font-bold text-titi-dark bg-white border border-dashed border-titi-yellow rounded-lg px-2 py-1.5">+ Lección</button><button type="button" onClick={onAddPresentation} disabled={busy} className="text-xs font-bold text-titi-dark bg-white border border-dashed border-titi-yellow rounded-lg px-2 py-1.5">+ Presentación</button>{!locked && <><button type="button" onClick={onEditEvaluation} className="text-xs font-bold text-titi-dark bg-white border border-gray-200 rounded-lg px-2 py-1.5">Evaluación</button><button type="button" onClick={onPublish} disabled={busy} className="text-xs font-bold text-green-700 bg-green-50 border border-green-200 rounded-lg px-2 py-1.5">Publicar módulo</button></>}{locked && <button type="button" onClick={onEditEvaluation} className="text-xs font-bold text-titi-dark bg-white border border-gray-200 rounded-lg px-2 py-1.5">Ver evaluación</button>}<button type="button" onClick={onDelete} disabled={busy} className="text-xs font-bold text-red-500 px-1">Eliminar</button></div>
  </div>;
}

function LessonEditor({ lesson, readOnly, busy, onSave, onUpload, onUploadHtml, onDeleteMaterial, onPublish, onArchive, onRestore, onRestoreRevision }) {
  const [title, setTitle] = useState(lesson.titulo || '');
  const [content, setContent] = useState(lesson.contenido || '');
  const [videoUrl, setVideoUrl] = useState(lesson.videoUrl || '');
  const [preview, setPreview] = useState(false);
  const [status, setStatus] = useState(null);
  const [htmlFile, setHtmlFile] = useState(null);
  const [evaluable, setEvaluable] = useState(Boolean(lesson.recursoHtml?.evaluable));
  const [maxAttempts, setMaxAttempts] = useState(lesson.recursoHtml?.intentosMax || 1);
  const [fechaLimite, setFechaLimite] = useState(isoToLocalDateTime(lesson.recursoHtml?.fechaLimite));
  const isHtml = lesson.formatoContenido === 'HTML';
  useEffect(() => { setTitle(lesson.titulo || ''); setContent(lesson.contenido || ''); setVideoUrl(lesson.videoUrl || ''); setHtmlFile(null); setEvaluable(Boolean(lesson.recursoHtml?.evaluable)); setMaxAttempts(lesson.recursoHtml?.intentosMax || 1); setFechaLimite(isoToLocalDateTime(lesson.recursoHtml?.fechaLimite)); }, [lesson]);
  const insertPython = () => setContent((current) => `${current}${current && !current.endsWith('\n') ? '\n' : ''}\n\`\`\`python\n# Escribí tu ejemplo\n\`\`\`\n`);
  async function save() { setStatus(null); const saved = await onSave({ titulo: title.trim(), contenido: content, ...(isHtml ? {} : { videoUrl: videoUrl.trim() || null }) }); if (saved) setStatus('Guardado como nueva versión'); }
  async function uploadHtml() { if (!htmlFile) return; setStatus(null); const uploaded = await onUploadHtml(htmlFile, evaluable, maxAttempts, fechaLimite); if (uploaded) setStatus('HTML guardado como nueva versión'); }
  return <div className="flex flex-col gap-4">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><div><h2 className="text-lg font-bold text-titi-dark">{isHtml ? 'Presentación' : 'Lección'}</h2><p className="text-xs text-gray-500">{readOnly ? 'Lección archivada: restaurala antes de editar.' : lesson.estado === 'PUBLICADA' ? 'Edición segura: cada guardado crea una revisión.' : isHtml ? 'Archivo autocontenido, ejecutado en un iframe aislado.' : 'Markdown seguro: HTML crudo no se interpreta.'}</p></div><div className="flex flex-wrap gap-2"><StatusBadge lesson={lesson} />{!readOnly && !isHtml && <button type="button" onClick={() => setPreview((current) => !current)} className="titi-btn-ghost">{preview ? 'Editar' : 'Vista previa'}</button>}{lesson.estado === 'BORRADOR' && <button type="button" onClick={onPublish} disabled={busy} className="titi-btn-primary">Publicar lección</button>}{lesson.estado === 'ARCHIVADA' && <button type="button" onClick={onRestore} disabled={busy} className="titi-btn-primary">Restaurar</button>}{lesson.estado !== 'ARCHIVADA' && <button type="button" onClick={onArchive} disabled={busy} className="titi-btn-ghost text-red-600">Archivar</button>}</div></div>
    <p className="text-xs text-gray-500">Versión {lesson.version || 1} · publicada: {formatDate(lesson.publishedAt)} · archivada: {formatDate(lesson.archivedAt)}</p>
    {preview ? <MarkdownContent content={content} format="MARKDOWN" className="min-h-56 border border-gray-100 rounded-xl p-4" /> : <><label className="flex flex-col gap-1.5"><span className="text-sm font-semibold text-titi-dark">Título</span><input value={title} onChange={(event) => setTitle(event.target.value)} disabled={readOnly} maxLength={120} className="titi-input disabled:opacity-60" /></label>{!isHtml && <label className="flex flex-col gap-1.5"><span className="text-sm font-semibold text-titi-dark">Video (opcional)</span><input value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} disabled={readOnly} className="titi-input disabled:opacity-60" /></label>}<label className="flex flex-col gap-1.5"><span className="text-sm font-semibold text-titi-dark">{isHtml ? 'Descripción Markdown' : 'Contenido Markdown'}</span><textarea value={content} onChange={(event) => setContent(event.target.value)} disabled={readOnly} rows={isHtml ? 6 : 14} className="titi-input resize-y font-mono disabled:opacity-60" /></label>{!readOnly && !isHtml && <button type="button" onClick={insertPython} className="self-start text-sm font-bold text-titi-dark bg-titi-cream border border-titi-yellow rounded-xl px-3 py-2">Insertar bloque Python</button>}</>}
    {!readOnly && <div className="flex items-center gap-3"><button type="button" onClick={save} disabled={busy || !title.trim()} className="titi-btn-primary">{busy ? 'Guardando...' : isHtml ? 'Guardar presentación' : 'Guardar lección'}</button>{status && <span className="text-xs font-bold text-green-700">{status}</span>}</div>}
    {isHtml && <HtmlResource lesson={lesson} readOnly={readOnly} busy={busy} htmlFile={htmlFile} setHtmlFile={setHtmlFile} evaluable={evaluable} setEvaluable={setEvaluable} maxAttempts={maxAttempts} setMaxAttempts={setMaxAttempts} fechaLimite={fechaLimite} setFechaLimite={setFechaLimite} uploadHtml={uploadHtml} />}
    {!isHtml && <Materials lesson={lesson} readOnly={readOnly} onUpload={onUpload} onDeleteMaterial={onDeleteMaterial} />}
    <RevisionHistory lesson={lesson} disabled={busy} onRestore={onRestoreRevision} />
  </div>;
}

function StatusBadge({ lesson }) { const colors = { BORRADOR: 'bg-gray-100 text-gray-700', PUBLICADA: 'bg-green-50 text-green-700', ARCHIVADA: 'bg-amber-50 text-amber-700' }; return <span className={`text-xs font-bold px-2 py-1 rounded-full ${colors[lesson.estado] || colors.BORRADOR}`}>{lesson.estado || 'BORRADOR'}</span>; }
function HtmlResource({ lesson, readOnly, busy, htmlFile, setHtmlFile, evaluable, setEvaluable, maxAttempts, setMaxAttempts, fechaLimite, setFechaLimite, uploadHtml }) {
  return <section className="border border-gray-100 rounded-xl p-4 bg-titi-cream/40"><h3 className="text-sm font-bold text-titi-dark">Presentación HTML</h3><p className="text-xs text-gray-500 mt-1">Un único archivo <code>.html</code>, sin URLs públicas. JavaScript queda aislado en iframe.</p>{lesson.recursoHtml && <p className="text-xs font-semibold text-green-700 mt-2">HTML configurado{lesson.recursoHtml.evaluable ? ` · evaluable · ${lesson.recursoHtml.intentosMax} intentos` : ' · práctica libre'}.</p>}{!readOnly && <div className="mt-3 flex flex-col gap-3"><label className="titi-btn-ghost cursor-pointer self-start">Seleccionar .html<input type="file" accept=".html,text/html" className="hidden" onChange={(event) => { setHtmlFile(event.target.files?.[0] || null); event.target.value = ''; }} /></label>{htmlFile && <p className="text-xs font-semibold text-titi-dark">{htmlFile.name}</p>}<label className="flex items-center gap-2 text-sm font-semibold text-titi-dark"><input type="checkbox" checked={evaluable} onChange={(event) => setEvaluable(event.target.checked)} className="h-4 w-4 accent-titi-yellow" />Registrar puntaje de práctica</label>{evaluable && <><label className="flex items-center gap-2 text-sm font-semibold text-titi-dark">Máximo de intentos<input type="number" min="1" max="10" value={maxAttempts} onChange={(event) => setMaxAttempts(event.target.value)} className="titi-input w-24 py-1.5" /></label><label className="flex flex-col gap-1.5 text-sm font-semibold text-titi-dark">Fecha límite de entrega<span className="flex items-center gap-2"><input type="datetime-local" value={fechaLimite} onChange={(event) => setFechaLimite(event.target.value)} className="titi-input" /><button type="button" onClick={() => setFechaLimite('')} className="titi-btn-ghost shrink-0">Limpiar</button></span><span className="text-xs font-medium text-gray-500">Zona horaria local; se guarda en UTC.</span></label></>}<button type="button" onClick={uploadHtml} disabled={busy || !htmlFile || (evaluable && (!Number.isInteger(Number(maxAttempts)) || Number(maxAttempts) < 1))} className="self-start titi-btn-primary">{busy ? 'Subiendo…' : lesson.recursoHtml ? 'Reemplazar HTML' : 'Subir HTML'}</button></div>}</section>;
}
function Materials({ lesson, readOnly, onUpload, onDeleteMaterial }) { return <><hr className="border-gray-100" /><div><h3 className="text-sm font-bold text-titi-dark uppercase tracking-wide mb-3">Materiales</h3>{!readOnly && <div className="flex gap-2 flex-wrap mb-3"><label className="titi-btn-ghost cursor-pointer">Subir archivo<input type="file" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) onUpload(file, file.name); event.target.value = ''; }} /></label></div>}<ul className="space-y-2">{(lesson.materiales || []).map((material) => <li key={material.id} className="flex items-center gap-2 bg-titi-cream border border-gray-100 rounded-xl p-3"><a href={material.url?.startsWith('/uploads/') ? resolveMediaUrl(material.url) : sanitizeMarkdownUrl(material.url)} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 truncate text-sm font-semibold text-titi-dark hover:text-titi-yellow-dark">{material.nombre}</a><span className="text-xs text-gray-500 uppercase">{material.tipo}</span>{!readOnly && <button type="button" onClick={() => onDeleteMaterial(material)} className="text-red-500 text-xs font-bold">Eliminar</button>}</li>)}</ul>{!(lesson.materiales || []).length && <p className="text-sm text-gray-400">Sin materiales.</p>}</div></>; }
function RevisionHistory({ lesson, disabled, onRestore }) { const [revisions, setRevisions] = useState([]); const [loading, setLoading] = useState(false); const [error, setError] = useState(null); const [open, setOpen] = useState(false); const load = useCallback(async () => { setLoading(true); setError(null); try { const { data } = await client.get(`/api/authoring/lessons/${lesson.id}/revisions`); if (!data?.success) throw new Error(data?.message || 'No se pudo cargar el historial'); setRevisions(data.data.revisions || []); } catch (err) { setError(authoringError(err, 'No se pudo cargar el historial')); } finally { setLoading(false); } }, [lesson.id]); useEffect(() => { setOpen(false); setRevisions([]); }, [lesson.id]); return <section className="border border-gray-100 rounded-xl p-4"><div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-bold text-titi-dark">Historial de versiones</h3><p className="text-xs text-gray-500">Las ediciones y restauraciones guardan una copia recuperable.</p></div><button type="button" onClick={() => { setOpen((current) => !current); if (!open) load(); }} className="titi-btn-ghost">{open ? 'Ocultar' : 'Ver revisiones'}</button></div>{open && <div className="mt-3 space-y-2">{loading && <p className="text-sm text-gray-500">Cargando historial…</p>}{error && <p className="text-sm text-red-600">{error}</p>}{!loading && !error && !revisions.length && <p className="text-sm text-gray-400">Aún no hay revisiones.</p>}{revisions.map((revision) => <div key={revision.id} className="flex flex-wrap items-center gap-2 bg-titi-cream rounded-xl p-3 text-xs"><span className="font-bold text-titi-dark">v{revision.version}</span><span className="text-gray-500">{formatDate(revision.createdAt)} · {revision.autor?.username || 'Autor'}</span><button type="button" disabled={disabled} onClick={() => onRestore(revision)} className="ml-auto font-bold text-titi-dark underline disabled:opacity-50">Restaurar esta versión</button></div>)}</div>}</section>; }
function ConfirmationDialog({ value, busy, onClose, onConfirm, onArchive }) { const [phrase, setPhrase] = useState(''); useEffect(() => setPhrase(''), [value]); if (!value) return null; if (value.action === 'archive') return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"><div className="bg-white rounded-2xl max-w-md w-full p-6"><h2 className="text-xl font-bold text-titi-dark">Archivar lección</h2><p className="text-sm text-gray-600 mt-2">La lección dejará de mostrarse a estudiantes. Su contenido e historial quedan conservados y podés restaurarla después.</p><div className="flex justify-end gap-3 mt-5"><button type="button" onClick={onClose} className="titi-btn-ghost">Cancelar</button><button type="button" onClick={onArchive} disabled={busy} className="titi-btn-primary">{busy ? 'Archivando…' : 'Archivar'}</button></div></div></div>; const expected = value.phrase; return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"><div className="bg-white rounded-2xl max-w-md w-full p-6"><h2 className="text-xl font-bold text-titi-dark">{value.action === 'publish' ? 'Confirmar publicación' : 'Confirmar despublicación'}</h2><p className="text-sm text-gray-600 mt-2">Revisaste la vista previa firmada por backend. Escribí exactamente esta frase:</p><code className="block mt-3 bg-titi-cream rounded-xl p-3 text-sm break-all">{expected}</code><input value={phrase} onChange={(event) => setPhrase(event.target.value)} className="titi-input mt-3" placeholder="Pegá la frase exacta" autoFocus /><div className="flex justify-end gap-3 mt-5"><button type="button" onClick={onClose} className="titi-btn-ghost">Cancelar</button><button type="button" onClick={() => onConfirm(phrase)} disabled={busy || phrase !== expected} className="titi-btn-primary">{busy ? 'Procesando…' : 'Confirmar'}</button></div></div></div>; }
function ErrorState({ message, onRetry, compact = false }) { return <div className={`bg-red-50 border border-red-200 rounded-xl p-4 ${compact ? 'mb-4' : 'max-w-xl'}`}><p className="text-sm font-semibold text-red-700">{message}</p><button type="button" onClick={onRetry} className="text-sm font-bold text-titi-dark mt-2">Reintentar</button></div>; }
function EmptyState() { return <div className="flex flex-col items-center justify-center text-center py-12"><TitiMascot mood="idle" size="md" message="Elegí una lección o creá un módulo." /></div>; }
