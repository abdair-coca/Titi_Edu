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
import { ErrorBox } from '../../components/social/StateBlocks.jsx';
import { BackLink } from '../../components/ui/v3.jsx';
import { CheckIcon, CloseIcon, CodeIcon, PlusIcon } from '../../components/icons.jsx';

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
  async function updateHtmlDeadline(module, lesson, fechaLimite) {
    return mutate('put', `/lessons/${lesson.id}/html-deadline`, {
      fechaLimite: localDateTimeToIso(fechaLimite),
      expectedFingerprint: lessonFingerprint(module.id, lesson.id),
    }, 'No se pudo actualizar la fecha límite');
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

  if (loading) return <div className="animate-pulse motion-reduce:animate-none" aria-busy="true" aria-label="Cargando el contenido"><div className="h-9 w-40 bg-gray-100 rounded-full mb-4" /><div className="h-9 w-2/3 bg-gray-100 rounded-full mb-6" /><div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6"><div className="h-80 bg-white border-2 border-gray-200 rounded-2xl" /><div className="lg:col-span-2 h-[60vh] bg-white border-2 border-gray-200 rounded-2xl" /></div></div>;
  if (error && !course) return <ErrorState message={error} onRetry={load} />;
  if (!course) return null;

  return <div>
    <BackLink to="/teacher">Mis cursos</BackLink>
    <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
      <div className="min-w-0"><p className="text-sm font-extrabold uppercase tracking-wide text-titi-streak">Contenido del curso</p><h1 className="text-3xl sm:text-4xl font-black text-titi-dark leading-tight break-words">{course.titulo}</h1><p className="text-base font-medium text-gray-500 mt-0.5 tabular-nums">{modules.length} {modules.length === 1 ? 'módulo' : 'módulos'} · {totalLessons} {totalLessons === 1 ? 'lección' : 'lecciones'}</p></div>
      <div className="flex flex-wrap gap-2"><button type="button" onClick={() => navigate(`/teacher/courses/${courseId}/edit`)} className="titi-btn-outline">Datos del curso</button><button type="button" onClick={() => navigate(`/teacher/courses/${courseId}/final-evaluation`)} className="titi-btn-outline">Evaluación final</button>{!course.publicado && <button type="button" onClick={() => startPublish('course', course)} disabled={busy} className="titi-btn-primary">Publicar curso</button>}{course.publicado && <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-500 text-white border-2 border-titi-dark text-sm font-extrabold"><CheckIcon className="w-4 h-4" />Curso publicado</span>}</div>
    </header>
    {error && <ErrorState message={error} onRetry={load} compact />}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
      <aside className="titi-surface p-4 flex flex-col gap-3 max-h-[80vh] overflow-y-auto">
        <button type="button" onClick={addModule} disabled={busy} className="w-full inline-flex items-center justify-center gap-2 bg-titi-cream text-titi-dark font-extrabold text-sm px-3 py-2.5 rounded-xl border-2 border-dashed border-gray-300 hover:border-titi-dark hover:bg-titi-yellow-light active:scale-[0.98] transition-all duration-150 disabled:opacity-50"><PlusIcon className="w-4 h-4" />Agregar módulo</button>
        {modules.length === 0 ? <p className="text-sm font-semibold text-gray-500 text-center py-6">Todavía no hay módulos. Empezá con el primero.</p> : modules.map((module) => <ModuleNode key={module.id} module={module} activeLessonId={activeLessonId} busy={busy} onSelect={setActiveLessonId} onSave={(fields) => saveModule(module, fields)} onAddLesson={() => addContent(module, 'MARKDOWN')} onAddPresentation={() => addContent(module, 'HTML')} onDelete={() => startDeletion('module', module)} onDeleteLesson={(lesson) => startDeletion('lesson', lesson)} onEditEvaluation={() => navigate(`/teacher/modules/${module.id}/evaluation`)} onPublish={() => startPublish('module', module)} onUnpublish={() => startUnpublish(module)} />)}
       </aside>
       <section className="lg:col-span-2 titi-surface p-5 sm:p-6 min-h-[60vh]">
         {!activeLesson ? <EmptyState /> : <LessonEditor key={activeLesson.id} lesson={activeLesson} readOnly={activeLesson.estado === 'ARCHIVADA'} busy={busy} onSave={(fields) => saveLesson(activeModule, activeLesson, fields)} onUpload={(file, name) => uploadMaterial(activeModule, activeLesson, file, name)} onUploadHtml={(file, evaluable, intentosMax, fechaLimite) => uploadHtml(activeModule, activeLesson, file, evaluable, intentosMax, fechaLimite)} onSaveDeadline={(fechaLimite) => updateHtmlDeadline(activeModule, activeLesson, fechaLimite)} onDeleteMaterial={(material) => deleteMaterial(activeModule, material)} onPublish={() => publishLesson(activeModule, activeLesson)} onArchive={() => setConfirmation({ action: 'archive', module: activeModule, lesson: activeLesson })} onRestore={() => restoreLesson(activeModule, activeLesson)} onRestoreRevision={(revision) => restoreRevision(activeModule, activeLesson, revision)} />}
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
  return <div className="border-2 border-gray-200 rounded-xl bg-titi-cream p-3">
    <div className="flex gap-2 items-center"><input value={title} disabled={locked} onChange={(event) => setTitle(event.target.value)} onBlur={saveTitle} className="min-w-0 flex-1 bg-transparent text-sm font-bold text-titi-dark disabled:opacity-80" /><span className={`text-xs font-bold px-2 py-1 rounded-full ${locked ? 'bg-green-500 text-white border-2 border-titi-dark' : 'bg-white text-gray-600 border-2 border-gray-200'}`}>{module.estado}</span></div>
    <div className="flex flex-wrap gap-1 mt-2">{LESSON_FILTERS.map(([value, label]) => <button key={value} type="button" onClick={() => setFilter(value)} className={`text-xs px-2.5 py-1 rounded-full font-bold border-2 active:scale-95 transition-all duration-150 ${filter === value ? 'bg-titi-yellow text-titi-dark border-titi-dark' : 'bg-white text-gray-600 border-gray-200 hover:border-titi-dark'}`}>{label}</button>)}</div>
    <ol className="mt-2 space-y-1">{lessons.map((lesson) => <li key={lesson.id} className="flex items-center gap-1"><button type="button" onClick={() => onSelect(lesson.id)} className={`flex-1 min-w-0 text-left text-sm px-2 py-1.5 rounded-lg truncate ${activeLessonId === lesson.id ? 'bg-titi-yellow text-titi-dark font-bold' : 'text-titi-dark font-medium hover:bg-titi-yellow-light'} active:scale-[0.98] transition-all duration-150`}>{lessonNumberById.get(lesson.id)}. {lesson.titulo}<span className="ml-1 text-xs opacity-70">{lesson.estado || 'BORRADOR'} · v{lesson.version || 1}</span></button><button type="button" onClick={() => onDeleteLesson(lesson)} disabled={busy} className="w-7 h-7 grid place-items-center rounded-lg text-red-500 hover:bg-red-50 active:scale-90 transition-all duration-150 disabled:opacity-50" aria-label="Eliminar lección"><CloseIcon className="w-4 h-4" /></button></li>)}</ol>
    {!lessons.length && <p className="text-xs font-semibold text-gray-500 py-2">Sin lecciones en este estado.</p>}
    <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={onAddLesson} disabled={busy} className="inline-flex items-center gap-1 text-xs font-bold text-titi-dark bg-white border-2 border-dashed border-gray-300 hover:border-titi-dark rounded-lg px-2 py-1.5 active:scale-95 transition-all duration-150"><PlusIcon className="w-3.5 h-3.5" />Lección</button><button type="button" onClick={onAddPresentation} disabled={busy} className="inline-flex items-center gap-1 text-xs font-bold text-titi-dark bg-white border-2 border-dashed border-gray-300 hover:border-titi-dark rounded-lg px-2 py-1.5 active:scale-95 transition-all duration-150"><PlusIcon className="w-3.5 h-3.5" />Presentación</button>{!locked && <><button type="button" onClick={onEditEvaluation} className="text-xs font-bold text-titi-dark bg-white border border-gray-200 rounded-lg px-2 py-1.5">Evaluación</button><button type="button" onClick={onPublish} disabled={busy} className="text-xs font-bold text-white bg-green-500 border-2 border-titi-dark rounded-lg px-2 py-1.5 active:scale-95 transition-all duration-150 disabled:opacity-50">Publicar módulo</button></>}{locked && <button type="button" onClick={onEditEvaluation} className="text-xs font-bold text-titi-dark bg-white border border-gray-200 rounded-lg px-2 py-1.5">Ver evaluación</button>}<button type="button" onClick={onDelete} disabled={busy} className="text-xs font-bold uppercase tracking-wide text-red-500 hover:text-red-600 px-1 active:scale-95 transition-all duration-150 disabled:opacity-50">Eliminar</button></div>
  </div>;
}

function LessonEditor({ lesson, readOnly, busy, onSave, onUpload, onUploadHtml, onSaveDeadline, onDeleteMaterial, onPublish, onArchive, onRestore, onRestoreRevision }) {
  const [title, setTitle] = useState(lesson.titulo || '');
  const [content, setContent] = useState(lesson.contenido || '');
  const [contextText, setContextText] = useState(lesson.contextoRag || '');
  const [contextName, setContextName] = useState(lesson.contextoRagNombre || '');
  const [contextError, setContextError] = useState(null);
  const [videoUrl, setVideoUrl] = useState(lesson.videoUrl || '');
  const [preview, setPreview] = useState(false);
  const [status, setStatus] = useState(null);
  const [htmlFile, setHtmlFile] = useState(null);
  const [evaluable, setEvaluable] = useState(Boolean(lesson.recursoHtml?.evaluable));
  const [maxAttempts, setMaxAttempts] = useState(lesson.recursoHtml?.intentosMax || 1);
  const [fechaLimite, setFechaLimite] = useState(isoToLocalDateTime(lesson.recursoHtml?.fechaLimite));
  const isHtml = lesson.formatoContenido === 'HTML';
  useEffect(() => { setTitle(lesson.titulo || ''); setContent(lesson.contenido || ''); setContextText(lesson.contextoRag || ''); setContextName(lesson.contextoRagNombre || ''); setContextError(null); setVideoUrl(lesson.videoUrl || ''); setHtmlFile(null); setEvaluable(Boolean(lesson.recursoHtml?.evaluable)); setMaxAttempts(lesson.recursoHtml?.intentosMax || 1); setFechaLimite(isoToLocalDateTime(lesson.recursoHtml?.fechaLimite)); }, [lesson]);
  const insertPython = () => setContent((current) => `${current}${current && !current.endsWith('\n') ? '\n' : ''}\n\`\`\`python\n# Escribí tu ejemplo\n\`\`\`\n`);
  async function loadContextFile(file) {
    if (!file) return;
    if (!/\.(?:txt|md)$/i.test(file.name)) { setContextError('Solo se aceptan archivos .txt o .md'); return; }
    try {
      setContextError(null);
      setContextText(await file.text());
      setContextName(file.name);
    } catch {
      setContextError('No se pudo leer el archivo de contexto');
    }
  }
  async function save() {
    setStatus(null); setContextError(null);
    const normalizedContext = contextText.trim() ? { texto: contextText, nombreOrigen: contextName.trim() || null } : null;
    const saved = await onSave({ titulo: title.trim(), contenido: content, contextoRag: normalizedContext, ...(isHtml ? {} : { videoUrl: videoUrl.trim() || null }) });
    if (saved) setStatus('Guardado como nueva versión; reindexación programada');
  }
  async function uploadHtml() { if (!htmlFile) return; setStatus(null); const uploaded = await onUploadHtml(htmlFile, evaluable, maxAttempts, fechaLimite); if (uploaded) setStatus('HTML guardado como nueva versión'); }
  async function saveDeadline() { setStatus(null); const saved = await onSaveDeadline(fechaLimite); if (saved) setStatus('Fecha límite actualizada'); }
    return <div className="flex flex-col gap-4">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><div><h2 className="text-xl font-extrabold text-titi-dark">{isHtml ? 'Presentación' : 'Lección'}</h2><p className="text-sm font-medium text-gray-500">{readOnly ? 'Lección archivada: restaurala antes de editar.' : lesson.estado === 'PUBLICADA' ? 'Edición segura: cada guardado crea una revisión.' : isHtml ? 'Archivo autocontenido, ejecutado en un iframe aislado.' : 'Markdown seguro: HTML crudo no se interpreta.'}</p></div><div className="flex flex-wrap gap-2"><StatusBadge lesson={lesson} />{!readOnly && !isHtml && <button type="button" onClick={() => setPreview((current) => !current)} className="titi-btn-outline">{preview ? 'Editar' : 'Vista previa'}</button>}{lesson.estado === 'BORRADOR' && <button type="button" onClick={onPublish} disabled={busy} className="titi-btn-primary">Publicar lección</button>}{lesson.estado === 'ARCHIVADA' && <button type="button" onClick={onRestore} disabled={busy} className="titi-btn-primary">Restaurar</button>}{lesson.estado !== 'ARCHIVADA' && <button type="button" onClick={onArchive} disabled={busy} className="titi-btn-outline !text-red-600">Archivar</button>}</div></div>
    <p className="text-xs text-gray-500">Versión {lesson.version || 1} · publicada: {formatDate(lesson.publishedAt)} · archivada: {formatDate(lesson.archivedAt)}</p>
    {preview ? <MarkdownContent content={content} format="MARKDOWN" className="min-h-56 border border-gray-100 rounded-xl p-4" /> : <><label className="flex flex-col gap-1.5"><span className="text-sm font-semibold text-titi-dark">Título</span><input value={title} onChange={(event) => setTitle(event.target.value)} disabled={readOnly} maxLength={120} className="titi-input disabled:opacity-60" /></label>{!isHtml && <label className="flex flex-col gap-1.5"><span className="text-sm font-semibold text-titi-dark">Video (opcional)</span><input value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} disabled={readOnly} className="titi-input disabled:opacity-60" /></label>}<label className="flex flex-col gap-1.5"><span className="text-sm font-semibold text-titi-dark">{isHtml ? 'Descripción Markdown' : 'Contenido Markdown'}</span><textarea value={content} onChange={(event) => setContent(event.target.value)} disabled={readOnly} rows={isHtml ? 6 : 14} className="titi-input resize-y font-mono disabled:opacity-60" /></label>{!readOnly && !isHtml && <button type="button" onClick={insertPython} className="self-start inline-flex items-center gap-2 text-sm font-bold text-titi-dark bg-titi-cream border-2 border-gray-200 hover:border-titi-dark rounded-xl px-3 py-2 active:scale-95 transition-all duration-150"><CodeIcon className="w-4 h-4" />Insertar bloque Python</button>}</>}
    <section className="border-2 border-gray-200 rounded-xl p-4 bg-titi-cream" aria-labelledby="contexto-rag-title"><h3 id="contexto-rag-title" className="text-sm font-bold text-titi-dark">Contexto pedagógico para Tutor IA</h3><p className="text-xs text-gray-500 mt-1">Opcional. Tiene prioridad sobre Markdown y HTML, y solo se usa para citas del tutor.</p>{!readOnly && <><textarea value={contextText} onChange={(event) => { setContextText(event.target.value); setContextName(''); setContextError(null); }} rows={6} placeholder="Pegá guía, conceptos o explicaciones públicas..." className="titi-input mt-3 resize-y" aria-label="Contexto autoral" /><div className="flex flex-wrap items-center gap-3 mt-3"><label className="titi-btn-outline cursor-pointer">Cargar .txt/.md<input type="file" accept=".txt,.md,text/plain,text/markdown" className="hidden" onChange={(event) => { loadContextFile(event.target.files?.[0]); event.target.value = ''; }} /></label>{contextName && <span className="text-xs font-semibold text-titi-dark">{contextName}</span>}</div></>}{contextError && <p role="alert" className="text-xs font-semibold text-red-600 mt-2">{contextError}</p>}{lesson.documentosRag?.[0] && <p className="text-xs font-semibold text-gray-600 mt-3" aria-live="polite">Índice RAG: {lesson.documentosRag[0].origen || (lesson.contextoRag ? 'AUTOR' : 'HTML_FALLBACK')} · {lesson.documentosRag[0].estado}{lesson.documentosRag[0].error ? ` · ${lesson.documentosRag[0].error}` : ''}</p>}</section>
    {!readOnly && <div className="flex items-center gap-3"><button type="button" onClick={save} disabled={busy || !title.trim() || Boolean(contextError)} className="titi-btn-primary">{busy ? 'Guardando...' : isHtml ? 'Guardar presentación' : 'Guardar lección'}</button>{status && <span className="text-xs font-bold text-green-700" role="status" aria-live="polite">{status}</span>}</div>}
    {isHtml && <HtmlResource lesson={lesson} readOnly={readOnly} busy={busy} htmlFile={htmlFile} setHtmlFile={setHtmlFile} evaluable={evaluable} setEvaluable={setEvaluable} maxAttempts={maxAttempts} setMaxAttempts={setMaxAttempts} fechaLimite={fechaLimite} setFechaLimite={setFechaLimite} uploadHtml={uploadHtml} saveDeadline={saveDeadline} />}
    {!isHtml && <Materials lesson={lesson} readOnly={readOnly} onUpload={onUpload} onDeleteMaterial={onDeleteMaterial} />}
    <RevisionHistory lesson={lesson} disabled={busy} onRestore={onRestoreRevision} />
  </div>;
}

function StatusBadge({ lesson }) { const colors = { BORRADOR: 'bg-white text-titi-dark border-gray-200', PUBLICADA: 'bg-green-500 text-white border-titi-dark', ARCHIVADA: 'bg-titi-certificate text-white border-titi-dark' }; return <span className={`self-center inline-flex items-center h-7 text-xs font-extrabold px-2.5 rounded-full border-2 ${colors[lesson.estado] || colors.BORRADOR}`}>{lesson.estado || 'BORRADOR'}</span>; }
function HtmlResource({ lesson, readOnly, busy, htmlFile, setHtmlFile, evaluable, setEvaluable, maxAttempts, setMaxAttempts, fechaLimite, setFechaLimite, uploadHtml, saveDeadline }) {
  return <section className="border-2 border-gray-200 rounded-xl p-4 bg-titi-cream"><h3 className="text-sm font-bold text-titi-dark">Presentación HTML</h3><p className="text-xs text-gray-500 mt-1">Un único archivo <code>.html</code>, sin URLs públicas. JavaScript queda aislado en iframe.</p>{lesson.recursoHtml && <p className="text-xs font-semibold text-green-700 mt-2">HTML configurado{lesson.recursoHtml.evaluable ? ` · evaluable · ${lesson.recursoHtml.intentosMax} intentos` : ' · práctica libre'}.</p>}{!readOnly && <div className="mt-3 flex flex-col gap-3"><label className="titi-btn-outline cursor-pointer self-start">Seleccionar .html<input type="file" accept=".html,text/html" className="hidden" onChange={(event) => { setHtmlFile(event.target.files?.[0] || null); event.target.value = ''; }} /></label>{htmlFile && <p className="text-xs font-semibold text-titi-dark">{htmlFile.name}</p>}<label className="flex items-center gap-2 text-sm font-semibold text-titi-dark"><input type="checkbox" checked={evaluable} onChange={(event) => setEvaluable(event.target.checked)} className="h-4 w-4 accent-titi-yellow" />Registrar puntaje de práctica</label>{evaluable && <><label className="flex items-center gap-2 text-sm font-semibold text-titi-dark">Máximo de intentos<input type="number" min="1" max="10" value={maxAttempts} onChange={(event) => setMaxAttempts(event.target.value)} className="titi-input w-24 py-1.5" /></label><label className="flex flex-col gap-1.5 text-sm font-semibold text-titi-dark">Fecha límite de entrega<span className="flex items-center gap-2"><input type="datetime-local" value={fechaLimite} onChange={(event) => setFechaLimite(event.target.value)} className="titi-input" /><button type="button" onClick={() => setFechaLimite('')} className="titi-btn-outline shrink-0">Limpiar</button></span><span className="text-xs font-medium text-gray-500">Zona horaria local; se guarda en UTC.</span>{lesson.recursoHtml && <button type="button" onClick={saveDeadline} disabled={busy} className="self-start titi-btn-outline">{busy ? 'Guardando…' : 'Guardar fecha'}</button>}</label></>}<button type="button" onClick={uploadHtml} disabled={busy || !htmlFile || (evaluable && (!Number.isInteger(Number(maxAttempts)) || Number(maxAttempts) < 1))} className="self-start titi-btn-primary">{busy ? 'Subiendo…' : lesson.recursoHtml ? 'Reemplazar HTML' : 'Subir HTML'}</button></div>}</section>;
}
function Materials({ lesson, readOnly, onUpload, onDeleteMaterial }) { return <><hr className="border-gray-100" /><div><h3 className="text-sm font-bold text-titi-dark uppercase tracking-wide mb-3">Materiales</h3>{!readOnly && <div className="flex gap-2 flex-wrap mb-3"><label className="titi-btn-outline cursor-pointer">Subir archivo<input type="file" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) onUpload(file, file.name); event.target.value = ''; }} /></label></div>}<ul className="space-y-2">{(lesson.materiales || []).map((material) => <li key={material.id} className="flex items-center gap-2 bg-titi-cream border-2 border-gray-200 rounded-xl p-3"><a href={material.url?.startsWith('/uploads/') ? resolveMediaUrl(material.url) : sanitizeMarkdownUrl(material.url)} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 truncate text-sm font-semibold text-titi-dark hover:text-titi-yellow-dark">{material.nombre}</a><span className="text-xs text-gray-500 uppercase">{material.tipo}</span>{!readOnly && <button type="button" onClick={() => onDeleteMaterial(material)} className="text-red-500 text-xs font-bold">Eliminar</button>}</li>)}</ul>{!(lesson.materiales || []).length && <p className="text-sm text-gray-400">Sin materiales.</p>}</div></>; }
function RevisionHistory({ lesson, disabled, onRestore }) { const [revisions, setRevisions] = useState([]); const [loading, setLoading] = useState(false); const [error, setError] = useState(null); const [open, setOpen] = useState(false); const load = useCallback(async () => { setLoading(true); setError(null); try { const { data } = await client.get(`/api/authoring/lessons/${lesson.id}/revisions`); if (!data?.success) throw new Error(data?.message || 'No se pudo cargar el historial'); setRevisions(data.data.revisions || []); } catch (err) { setError(authoringError(err, 'No se pudo cargar el historial')); } finally { setLoading(false); } }, [lesson.id]); useEffect(() => { setOpen(false); setRevisions([]); }, [lesson.id]); return <section className="border-2 border-gray-200 rounded-xl p-4"><div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-bold text-titi-dark">Historial de versiones</h3><p className="text-xs text-gray-500">Las ediciones y restauraciones guardan una copia recuperable.</p></div><button type="button" onClick={() => { setOpen((current) => !current); if (!open) load(); }} className="titi-btn-outline">{open ? 'Ocultar' : 'Ver revisiones'}</button></div>{open && <div className="mt-3 space-y-2">{loading && <p className="text-sm text-gray-500">Cargando historial…</p>}{error && <p className="text-sm text-red-600">{error}</p>}{!loading && !error && !revisions.length && <p className="text-sm text-gray-400">Aún no hay revisiones.</p>}{revisions.map((revision) => <div key={revision.id} className="flex flex-wrap items-center gap-2 bg-titi-cream rounded-xl p-3 text-xs"><span className="font-bold text-titi-dark">v{revision.version}</span><span className="text-gray-500">{formatDate(revision.createdAt)} · {revision.autor?.username || 'Autor'}</span><button type="button" disabled={disabled} onClick={() => onRestore(revision)} className="ml-auto font-bold uppercase tracking-wide text-blue-500 hover:text-blue-600 active:scale-95 transition-all duration-150 disabled:opacity-50">Restaurar esta versión</button></div>)}</div>}</section>; }
function ConfirmationDialog({ value, busy, onClose, onConfirm, onArchive }) { const [phrase, setPhrase] = useState(''); useEffect(() => setPhrase(''), [value]); if (!value) return null; if (value.action === 'archive') return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"><div className="bg-white rounded-2xl border-2 border-titi-dark shadow-[0_8px_0_#1A1A2E] max-w-md w-full p-6"><h2 className="text-xl font-bold text-titi-dark">Archivar lección</h2><p className="text-sm text-gray-600 mt-2">La lección dejará de mostrarse a estudiantes. Su contenido e historial quedan conservados y podés restaurarla después.</p><div className="flex justify-end gap-3 mt-5"><button type="button" onClick={onClose} className="titi-btn-outline">Cancelar</button><button type="button" onClick={onArchive} disabled={busy} className="titi-btn-primary">{busy ? 'Archivando…' : 'Archivar'}</button></div></div></div>; const expected = value.phrase; return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"><div className="bg-white rounded-2xl border-2 border-titi-dark shadow-[0_8px_0_#1A1A2E] max-w-md w-full p-6"><h2 className="text-xl font-bold text-titi-dark">{value.action === 'publish' ? 'Confirmar publicación' : 'Confirmar despublicación'}</h2><p className="text-sm text-gray-600 mt-2">Revisaste la vista previa firmada por backend. Escribí exactamente esta frase:</p><code className="block mt-3 bg-titi-cream border-2 border-dashed border-gray-300 rounded-xl p-3 text-sm font-bold text-titi-dark break-all">{expected}</code><input value={phrase} onChange={(event) => setPhrase(event.target.value)} className="titi-input mt-3" placeholder="Pegá la frase exacta" autoFocus /><div className="flex justify-end gap-3 mt-5"><button type="button" onClick={onClose} className="titi-btn-outline">Cancelar</button><button type="button" onClick={() => onConfirm(phrase)} disabled={busy || phrase !== expected} className="titi-btn-primary">{busy ? 'Procesando…' : 'Confirmar'}</button></div></div></div>; }
function ErrorState({ message, onRetry, compact = false }) { return <div className={compact ? '' : 'max-w-xl'}><ErrorBox title="Algo salió mal con el contenido" message={message} onRetry={onRetry} /></div>; }
function EmptyState() { return <div className="flex flex-col items-center justify-center text-center py-12"><TitiMascot state="pensando" size="md" message="Elegí una lección o creá un módulo." /><p className="text-sm font-medium text-gray-500 mt-2 max-w-xs">Usá la columna de la izquierda para agregar módulos, lecciones y presentaciones.</p></div>; }
