import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import client from '../../api/client.js';
import ConfirmModal from '../../components/ConfirmModal.jsx';
import { resolveMediaUrl } from '../../lib/format.js';

const TIPOS_MATERIAL = ['pdf', 'word', 'imagen', 'codigo', 'otro'];
const TIPO_ICON = { pdf: '📄', word: '📝', imagen: '🖼️', codigo: '💻', otro: '📎' };

export default function ModulesEditor() {
  const { id: courseId } = useParams();
  const navigate = useNavigate();

  const [curso, setCurso] = useState(null);
  const [modulos, setModulos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // Selección actual
  const [activeLessonId, setActiveLessonId] = useState(null);
  const [activeLesson, setActiveLesson] = useState(null); // con materiales
  const [lessonLoading, setLessonLoading] = useState(false);

  // Confirm
  const [confirm, setConfirm] = useState(null); // { kind, item, title, message }

  // --- Cargar curso completo ---
  const fetchCourse = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data } = await client.get(`/api/courses/${courseId}`);
      if (data?.success) {
        const c = data.data?.curso;
        setCurso(c);
        const m = (c.modulos || []).map((mod) => ({
          ...mod,
          lecciones: (mod.lecciones || []).sort((a, b) => a.orden - b.orden),
        }));
        setModulos(m);
        // Seleccionar primera lección por defecto
        const first = m[0]?.lecciones?.[0];
        if (first && !activeLessonId) setActiveLessonId(first.id);
      } else {
        setError(data?.message || 'No se pudo cargar el curso');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [courseId, activeLessonId]);

  useEffect(() => { fetchCourse(); }, [courseId]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Cargar lección activa con materiales ---
  useEffect(() => {
    if (!activeLessonId) { setActiveLesson(null); return; }
    let cancelled = false;
    setLessonLoading(true);
    client
      .get(`/api/lessons/${activeLessonId}`)
      .then(({ data }) => {
        if (cancelled) return;
        if (data?.success) setActiveLesson(data.data.leccion);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLessonLoading(false); });
    return () => { cancelled = true; };
  }, [activeLessonId]);

  const totalLessons = useMemo(
    () => modulos.reduce((acc, m) => acc + m.lecciones.length, 0),
    [modulos],
  );

  // --- Acciones módulos ---
  async function addModule() {
    setBusy(true);
    try {
      const orden = (modulos[modulos.length - 1]?.orden ?? 0) + 1;
      const { data } = await client.post(`/api/courses/${courseId}/modules`, {
        titulo: `Módulo ${orden}`,
        orden,
      });
      if (data?.success) {
        setModulos((prev) => [...prev, { ...data.data.modulo, lecciones: [] }]);
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setBusy(false);
    }
  }

  async function updateModule(moduloId, fields) {
    try {
      const { data } = await client.put(`/api/modules/${moduloId}`, fields);
      if (data?.success) {
        setModulos((prev) => prev.map((m) => (m.id === moduloId ? { ...m, ...data.data.modulo } : m)));
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  }

  async function deleteModule(modulo) {
    try {
      const { data } = await client.delete(`/api/modules/${modulo.id}`);
      if (data?.success) {
        setModulos((prev) => prev.filter((m) => m.id !== modulo.id));
        if (modulo.lecciones?.some((l) => l.id === activeLessonId)) setActiveLessonId(null);
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  }

  async function moveModule(idx, dir) {
    const target = idx + dir;
    if (target < 0 || target >= modulos.length) return;
    const a = modulos[idx];
    const b = modulos[target];
    await Promise.all([
      updateModule(a.id, { orden: b.orden }),
      updateModule(b.id, { orden: a.orden }),
    ]);
    setModulos((prev) => {
      const next = [...prev];
      [next[idx], next[target]] = [{ ...next[target], orden: a.orden }, { ...next[idx], orden: b.orden }];
      return next;
    });
  }

  // --- Acciones lecciones ---
  async function addLesson(modulo) {
    setBusy(true);
    try {
      const orden = (modulo.lecciones[modulo.lecciones.length - 1]?.orden ?? 0) + 1;
      const { data } = await client.post(`/api/modules/${modulo.id}/lessons`, {
        titulo: `Nueva lección ${orden}`,
        contenido: 'Escribí el contenido de la lección…',
        orden,
      });
      if (data?.success) {
        const newLesson = data.data.leccion;
        setModulos((prev) =>
          prev.map((m) => (m.id === modulo.id ? { ...m, lecciones: [...m.lecciones, newLesson] } : m)),
        );
        setActiveLessonId(newLesson.id);
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setBusy(false);
    }
  }

  async function updateLesson(lessonId, fields) {
    try {
      const { data } = await client.put(`/api/lessons/${lessonId}`, fields);
      if (data?.success) {
        const updated = data.data.leccion;
        setModulos((prev) =>
          prev.map((m) => ({
            ...m,
            lecciones: m.lecciones.map((l) => (l.id === lessonId ? { ...l, ...updated } : l)),
          })),
        );
        setActiveLesson((cur) => (cur?.id === lessonId ? { ...cur, ...updated } : cur));
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  }

  async function deleteLesson(lesson) {
    try {
      const { data } = await client.delete(`/api/lessons/${lesson.id}`);
      if (data?.success) {
        setModulos((prev) =>
          prev.map((m) => ({ ...m, lecciones: m.lecciones.filter((l) => l.id !== lesson.id) })),
        );
        if (activeLessonId === lesson.id) setActiveLessonId(null);
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  }

  async function moveLesson(moduloId, idx, dir) {
    const modulo = modulos.find((m) => m.id === moduloId);
    const target = idx + dir;
    if (!modulo || target < 0 || target >= modulo.lecciones.length) return;
    const a = modulo.lecciones[idx];
    const b = modulo.lecciones[target];
    await Promise.all([
      updateLesson(a.id, { orden: b.orden }),
      updateLesson(b.id, { orden: a.orden }),
    ]);
  }

  // --- Materiales ---
  async function uploadMaterial(lessonId, file, tipo) {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('tipo', tipo || 'otro');
    fd.append('nombre', file.name);
    try {
      const { data } = await client.post(`/api/lessons/${lessonId}/materials`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (data?.success) {
        setActiveLesson((cur) =>
          cur && cur.id === lessonId
            ? { ...cur, materiales: [...(cur.materiales || []), data.data.material] }
            : cur,
        );
      } else {
        alert(data?.message || 'No se pudo subir');
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  }

  async function deleteMaterial(material) {
    try {
      const { data } = await client.delete(`/api/materials/${material.id}`);
      if (data?.success) {
        setActiveLesson((cur) =>
          cur ? { ...cur, materiales: (cur.materiales || []).filter((m) => m.id !== material.id) } : cur,
        );
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  }

  // --- Publicar ---
  async function togglePublish() {
    setBusy(true);
    try {
      const url = curso.publicado
        ? `/api/courses/${courseId}/unpublish`
        : `/api/courses/${courseId}/publish`;
      const { data } = await client.post(url);
      if (data?.success) {
        setCurso((c) => ({ ...c, publicado: !c.publicado }));
      } else {
        alert(data?.message || 'No se pudo cambiar el estado');
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-titi-yellow-light border-t-titi-yellow rounded-full animate-spin" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 max-w-xl">
        <p className="text-sm font-semibold text-red-700">{error}</p>
      </div>
    );
  }
  if (!curso) return null;

  const canPublish = modulos.length > 0 && totalLessons > 0;

  return (
    <div>
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => navigate('/teacher')}
            className="text-sm font-semibold text-gray-500 hover:text-titi-dark mb-2 inline-flex items-center gap-1"
          >
            ← Mis cursos
          </button>
          <h1 className="text-2xl sm:text-3xl font-black text-titi-dark line-clamp-2">{curso.titulo}</h1>
          <p className="text-sm font-medium text-gray-500 mt-1">
            {modulos.length} {modulos.length === 1 ? 'módulo' : 'módulos'} · {totalLessons}{' '}
            {totalLessons === 1 ? 'lección' : 'lecciones'}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => navigate(`/teacher/courses/${courseId}/edit`)}
            className="bg-white text-titi-dark font-semibold text-sm px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-50"
          >
            Datos del curso
          </button>
          <button
            type="button"
            onClick={() => navigate(`/teacher/courses/${courseId}/final-evaluation`)}
            className="bg-white text-titi-achievement font-semibold text-sm px-4 py-2 rounded-xl border border-titi-achievement/30 hover:bg-purple-50"
          >
            🏁 Evaluación final
          </button>
          <button
            type="button"
            onClick={togglePublish}
            disabled={busy || (!canPublish && !curso.publicado)}
            className="bg-titi-yellow text-titi-dark font-bold text-sm px-5 py-2.5 rounded-xl shadow-[0_4px_0px_#E6B800] hover:shadow-[0_2px_0px_#E6B800] hover:-translate-y-0.5 active:shadow-none active:translate-y-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title={!canPublish && !curso.publicado ? 'Agregá al menos una lección antes de publicar' : ''}
          >
            {curso.publicado ? 'Despublicar' : 'Publicar curso'}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        {/* Columna izquierda — árbol */}
        <aside className="lg:col-span-1 bg-white border border-gray-100 rounded-2xl p-4 flex flex-col gap-3 max-h-[80vh] overflow-y-auto">
          <button
            type="button"
            onClick={addModule}
            disabled={busy}
            className="w-full bg-titi-cream text-titi-dark font-bold text-sm px-3 py-2 rounded-xl border border-dashed border-titi-yellow hover:bg-titi-yellow-light transition-all disabled:opacity-50"
          >
            + Agregar módulo
          </button>

          {modulos.length === 0 ? (
            <p className="text-sm text-gray-400 font-medium text-center py-6">
              Todavía no hay módulos.
            </p>
          ) : (
            modulos.map((m, idx) => (
              <ModuleNode
                key={m.id}
                modulo={m}
                index={idx}
                total={modulos.length}
                activeLessonId={activeLessonId}
                onMoveUp={() => moveModule(idx, -1)}
                onMoveDown={() => moveModule(idx, +1)}
                onUpdate={(fields) => updateModule(m.id, fields)}
                onDelete={() =>
                  setConfirm({
                    kind: 'module',
                    item: m,
                    title: `¿Eliminar módulo "${m.titulo}"?`,
                    message: 'Se borrarán también todas sus lecciones, materiales y comentarios.',
                  })
                }
                onAddLesson={() => addLesson(m)}
                onEditEvaluation={() => navigate(`/teacher/modules/${m.id}/evaluation`)}
                onSelectLesson={setActiveLessonId}
                onMoveLesson={(idxL, dir) => moveLesson(m.id, idxL, dir)}
                onDeleteLesson={(l) =>
                  setConfirm({
                    kind: 'lesson',
                    item: l,
                    title: `¿Eliminar lección "${l.titulo}"?`,
                    message: 'Se borrarán también materiales y comentarios.',
                  })
                }
              />
            ))
          )}
        </aside>

        {/* Columna derecha — editor de lección */}
        <section className="lg:col-span-2 bg-white border border-gray-100 rounded-2xl p-5 sm:p-6 min-h-[60vh]">
          {!activeLessonId ? (
            <EmptyLessonPanel />
          ) : lessonLoading || !activeLesson ? (
            <p className="text-sm text-gray-400 font-medium">Cargando lección…</p>
          ) : (
            <LessonEditor
              key={activeLesson.id}
              leccion={activeLesson}
              onSave={(fields) => updateLesson(activeLesson.id, fields)}
              onUpload={(file, tipo) => uploadMaterial(activeLesson.id, file, tipo)}
              onDeleteMaterial={(m) => deleteMaterial(m)}
            />
          )}
        </section>
      </div>

      <ConfirmModal
        open={Boolean(confirm)}
        title={confirm?.title || ''}
        message={confirm?.message || ''}
        confirmText="Eliminar"
        cancelText="Cancelar"
        danger
        onConfirm={async () => {
          if (!confirm) return;
          if (confirm.kind === 'module') await deleteModule(confirm.item);
          else if (confirm.kind === 'lesson') await deleteLesson(confirm.item);
          setConfirm(null);
        }}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

// ---- Nodo de módulo (con sus lecciones) ----
function ModuleNode({ modulo, index, total, activeLessonId, onMoveUp, onMoveDown, onUpdate, onDelete, onAddLesson, onEditEvaluation, onSelectLesson, onMoveLesson, onDeleteLesson }) {
  const [editing, setEditing] = useState(false);
  const [titulo, setTitulo] = useState(modulo.titulo);

  useEffect(() => { setTitulo(modulo.titulo); }, [modulo.titulo]);

  function saveTitle() {
    const t = titulo.trim();
    if (t && t !== modulo.titulo) onUpdate({ titulo: t });
    setEditing(false);
  }

  return (
    <div className="border border-gray-100 rounded-xl bg-titi-cream/40 p-3">
      <div className="flex items-center gap-2">
        <span className="shrink-0 w-7 h-7 rounded-full bg-titi-yellow-light text-titi-dark grid place-items-center text-xs font-extrabold">
          {index + 1}
        </span>
        {editing ? (
          <input
            autoFocus
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => e.key === 'Enter' && saveTitle()}
            className="flex-1 min-w-0 text-sm font-bold bg-white border border-titi-yellow rounded-lg px-2 py-1"
            maxLength={100}
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex-1 min-w-0 text-left text-sm font-bold text-titi-dark hover:text-titi-yellow-dark truncate"
            title={modulo.titulo}
          >
            {modulo.titulo}
          </button>
        )}
        <div className="flex items-center gap-0.5 text-titi-muted shrink-0">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            className="w-6 h-6 grid place-items-center rounded hover:bg-titi-yellow-light disabled:opacity-30"
            aria-label="Subir módulo"
          >↑</button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="w-6 h-6 grid place-items-center rounded hover:bg-titi-yellow-light disabled:opacity-30"
            aria-label="Bajar módulo"
          >↓</button>
          <button
            type="button"
            onClick={onDelete}
            className="w-6 h-6 grid place-items-center rounded text-titi-red hover:bg-red-50"
            aria-label="Eliminar módulo"
          >✕</button>
        </div>
      </div>

      <ol className="mt-2 space-y-1">
        {modulo.lecciones.map((l, idx) => {
          const isActive = l.id === activeLessonId;
          return (
            <li key={l.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onSelectLesson(l.id)}
                className={`flex-1 min-w-0 text-left text-sm px-2 py-1.5 rounded-lg truncate ${
                  isActive
                    ? 'bg-titi-yellow text-titi-dark font-bold'
                    : 'text-titi-dark hover:bg-titi-yellow-light'
                }`}
              >
                <span className="text-xs text-gray-400 tabular-nums mr-1">{idx + 1}.</span>
                {l.titulo}
              </button>
              <button
                type="button"
                onClick={() => onMoveLesson(idx, -1)}
                disabled={idx === 0}
                className="w-5 h-5 grid place-items-center text-xs text-titi-muted hover:bg-titi-yellow-light rounded disabled:opacity-30"
                aria-label="Subir lección"
              >↑</button>
              <button
                type="button"
                onClick={() => onMoveLesson(idx, +1)}
                disabled={idx === modulo.lecciones.length - 1}
                className="w-5 h-5 grid place-items-center text-xs text-titi-muted hover:bg-titi-yellow-light rounded disabled:opacity-30"
                aria-label="Bajar lección"
              >↓</button>
              <button
                type="button"
                onClick={() => onDeleteLesson(l)}
                className="w-5 h-5 grid place-items-center text-xs text-titi-red hover:bg-red-50 rounded"
                aria-label="Eliminar lección"
              >✕</button>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={onAddLesson}
            className="w-full text-xs font-bold text-titi-dark bg-white border border-dashed border-titi-border hover:border-titi-yellow rounded-lg px-2 py-1.5 mt-1"
          >
            + Lección
          </button>
        </li>
        <li>
          <button
            type="button"
            onClick={onEditEvaluation}
            className="w-full text-xs font-bold text-titi-achievement bg-white border border-dashed border-titi-achievement/40 hover:border-titi-achievement hover:bg-purple-50 rounded-lg px-2 py-1.5 mt-1"
          >
            📝 {modulo.evaluacion ? 'Editar evaluación' : 'Crear evaluación'}
          </button>
        </li>
      </ol>
    </div>
  );
}

// ---- Editor de la lección activa ----
function LessonEditor({ leccion, onSave, onUpload, onDeleteMaterial }) {
  const [titulo, setTitulo] = useState(leccion.titulo || '');
  const [contenido, setContenido] = useState(leccion.contenido || '');
  const [videoUrl, setVideoUrl] = useState(leccion.videoUrl || '');
  const [tipo, setTipo] = useState('otro');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);

  useEffect(() => {
    setTitulo(leccion.titulo || '');
    setContenido(leccion.contenido || '');
    setVideoUrl(leccion.videoUrl || '');
    setSavedAt(null);
  }, [leccion.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    setSaving(true);
    await onSave({
      titulo: titulo.trim(),
      contenido,
      videoUrl: videoUrl.trim() || null,
    });
    setSaving(false);
    setSavedAt(new Date());
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-titi-dark">Título de la lección</span>
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          className="titi-input"
          maxLength={120}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-titi-dark">Video (YouTube)</span>
        <input
          type="url"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=…"
          className="titi-input"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-titi-dark">Contenido</span>
        <textarea
          value={contenido}
          onChange={(e) => setContenido(e.target.value)}
          rows={10}
          className="titi-input resize-y"
        />
      </label>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="bg-titi-yellow text-titi-dark font-bold text-sm px-5 py-2.5 rounded-xl shadow-[0_4px_0px_#E6B800] hover:shadow-[0_2px_0px_#E6B800] hover:-translate-y-0.5 active:shadow-none active:translate-y-0 transition-all disabled:opacity-50"
        >
          {saving ? 'Guardando…' : 'Guardar lección'}
        </button>
        {savedAt && (
          <span className="text-xs text-green-600 font-semibold">
            ✓ Guardado {savedAt.toLocaleTimeString()}
          </span>
        )}
      </div>

      <hr className="border-titi-border" />

      {/* Materiales */}
      <div>
        <h3 className="text-sm font-bold text-titi-dark uppercase tracking-wide mb-3">Materiales</h3>

        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="titi-input w-auto">
            {TIPOS_MATERIAL.map((t) => (
              <option key={t} value={t}>{TIPO_ICON[t]} {t}</option>
            ))}
          </select>
          <label className="bg-white text-titi-dark font-semibold text-sm px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 cursor-pointer">
            Subir archivo
            <input
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUpload(file, tipo);
                e.target.value = '';
              }}
            />
          </label>
        </div>

        {leccion.materiales?.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {leccion.materiales.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-3 bg-titi-cream border border-titi-border rounded-xl px-3 py-2"
              >
                <span className="text-xl shrink-0">{TIPO_ICON[m.tipo] || '📎'}</span>
                <a
                  href={m.url?.startsWith('/uploads/') ? resolveMediaUrl(m.url) : m.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 min-w-0 text-sm font-semibold text-titi-dark hover:text-titi-yellow-dark truncate"
                >
                  {m.nombre}
                </a>
                <span className="text-xs text-gray-400 uppercase tracking-wide shrink-0">{m.tipo}</span>
                <button
                  type="button"
                  onClick={() => onDeleteMaterial(m)}
                  className="text-titi-red text-sm font-bold hover:underline shrink-0"
                >
                  Eliminar
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-400 font-medium">Esta lección no tiene materiales.</p>
        )}
      </div>
    </div>
  );
}

function EmptyLessonPanel() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12">
      <img
        src="/Titi.png"
        alt="Titi"
        className="w-20 h-20 mb-3 object-contain drop-shadow-sm select-none"
        draggable={false}
      />
      <h3 className="text-base font-bold text-titi-dark mb-1">Elegí una lección para editarla</h3>
      <p className="text-sm text-gray-400 max-w-xs">
        O agregá un módulo nuevo desde el panel de la izquierda.
      </p>
    </div>
  );
}
