import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckIcon } from '../../components/icons.jsx';
import { resolveMediaUrl } from '../../lib/format.js';
import { authoringError, authoringMutation } from '../../lib/authoring.js';
import client from '../../api/client.js';

const NIVELES = ['principiante', 'intermedio', 'avanzado'];
const EMPTY_FORM = { titulo: '', descripcion: '', nivel: 'principiante', categoriaId: '', portadaUrl: '', portadaPublicId: '', emiteCertificado: true };

export default function CourseEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [form, setForm] = useState(EMPTY_FORM);
  const [categorias, setCategorias] = useState([]);
  const [fingerprint, setFingerprint] = useState(null);
  const [published, setPublished] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    let cancelled = false;
    client.get('/api/authoring/categories')
      .then(({ data }) => {
        if (!cancelled && data?.success) {
          const list = data.data?.categories || [];
          setCategorias(list);
          setForm((current) => ({ ...current, categoriaId: current.categoriaId || list[0]?.id || '' }));
        }
      })
      .catch((err) => !cancelled && setError(authoringError(err, 'No se pudieron cargar las categorías')));
    return () => { cancelled = true; };
  }, []);

  const loadCourse = useCallback(async () => {
    if (!id) return;
    setLoading(true); setError(null);
    try {
      const { data } = await client.get(`/api/authoring/courses/${id}`);
      if (!data?.success) throw new Error(data?.message || 'Curso no encontrado');
      const course = data.data.course;
      setForm({
        titulo: course.titulo || '', descripcion: course.descripcion || '', nivel: course.nivel || 'principiante',
        categoriaId: course.categoriaId || '', portadaUrl: course.portadaUrl || '', portadaPublicId: course.portadaPublicId || '', emiteCertificado: Boolean(course.emiteCertificado),
      });
      setFingerprint(data.data.fingerprint);
      setPublished(Boolean(course.publicado));
    } catch (err) { setError(authoringError(err, 'No se pudo cargar el curso')); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { loadCourse(); }, [loadCourse]);
  const onChange = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  async function handlePortadaUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true); setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await client.post('/api/authoring/uploads/portada', formData);
      if (!data?.success) throw new Error(data?.message || 'No se pudo subir la imagen');
      setForm((current) => ({ ...current, portadaUrl: data.data.url, portadaPublicId: data.data.publicId || '' }));
    } catch (err) { setError(authoringError(err, 'No se pudo subir la imagen')); }
    finally { setUploading(false); }
  }

  async function handleSubmit(event, { gotoContent = false } = {}) {
    event?.preventDefault?.();
    const payload = { ...form, titulo: form.titulo.trim(), descripcion: form.descripcion.trim(), portadaUrl: form.portadaUrl.trim() || null, portadaPublicId: form.portadaPublicId?.trim() || null };
    if (!payload.titulo || !payload.descripcion || !payload.categoriaId) { setError('Título, descripción y categoría son obligatorios'); return; }
    setSaving(true); setError(null); setSuccess(null);
    try {
      const response = isEdit
        ? await authoringMutation('put', `/courses/${id}`, { ...payload, expectedFingerprint: fingerprint })
        : await authoringMutation('post', '/courses', payload);
      const data = response.data;
      if (!data?.success) throw new Error(data?.message || 'No se pudo guardar');
      const course = data.data.course;
      if (isEdit) {
        await loadCourse();
      }
      const courseId = course.id;
      if (gotoContent) navigate(`/teacher/courses/${courseId}/modules`);
      else if (!isEdit) navigate(`/teacher/courses/${courseId}/edit`, { replace: true });
      else setSuccess('Cambios guardados');
    } catch (err) { setError(authoringError(err, 'No se pudo guardar')); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="bg-white border border-gray-100 rounded-2xl p-8 animate-pulse max-w-2xl"><div className="h-5 w-1/3 bg-gray-100 rounded mb-6" /><div className="space-y-4"><div className="h-10 bg-gray-100 rounded-xl" /><div className="h-32 bg-gray-100 rounded-xl" /></div></div>;

  return (
    <div className="max-w-2xl">
      <button type="button" onClick={() => navigate('/teacher')} className="text-sm font-semibold text-gray-500 hover:text-titi-dark mb-4 inline-flex items-center gap-1">← Mis cursos como profesor</button>
      <h1 className="text-3xl sm:text-4xl font-black text-titi-dark mb-1">{isEdit ? 'Editar curso' : 'Crear nuevo curso'}</h1>
      <p className="text-sm font-medium text-gray-500 mb-6">{published ? 'Curso publicado: sus datos quedan solo lectura.' : 'Guardá el borrador antes de publicar.'}</p>
      <form onSubmit={handleSubmit} className="bg-white border border-gray-100 rounded-2xl p-5 sm:p-6 shadow-[0_2px_8px_rgba(0,0,0,0.06)] flex flex-col gap-5">
        <Field label="Título del curso" required><input value={form.titulo} onChange={onChange('titulo')} disabled={published} maxLength={120} className="titi-input disabled:opacity-60" required /></Field>
        <Field label="Descripción" required><textarea value={form.descripcion} onChange={onChange('descripcion')} disabled={published} rows={5} maxLength={1000} className="titi-input resize-none disabled:opacity-60" required /><p className="text-xs text-gray-400 mt-1 tabular-nums">{form.descripcion.length} / 1000</p></Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nivel" required><select value={form.nivel} onChange={onChange('nivel')} disabled={published} className="titi-input capitalize disabled:opacity-60">{NIVELES.map((nivel) => <option key={nivel} value={nivel}>{nivel}</option>)}</select></Field>
          <Field label="Categoría" required><select value={form.categoriaId} onChange={onChange('categoriaId')} disabled={published} className="titi-input disabled:opacity-60" required><option value="" disabled>Elegí una categoría</option>{categorias.map((category) => <option key={category.id} value={category.id}>{category.icono} {category.nombre}</option>)}</select></Field>
        </div>
        <Field label="Portada del curso (opcional)">
          {form.portadaUrl && <img src={resolveMediaUrl(form.portadaUrl)} alt="Portada del curso" className="h-28 w-full object-cover rounded-xl border border-gray-100" />}
          <div className="flex flex-col sm:flex-row gap-3">
            <label className={`inline-flex items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:border-titi-yellow hover:text-titi-dark cursor-pointer ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={published} onChange={handlePortadaUpload} />
              {uploading ? 'Subiendo…' : 'Subir imagen'}
            </label>
            <input type="url" value={form.portadaUrl} onChange={onChange('portadaUrl')} disabled={published || uploading} placeholder="https://… o subí una imagen" className="titi-input disabled:opacity-60" />
          </div>
        </Field>
        <label className="flex items-start gap-3 rounded-xl bg-titi-cream border border-gray-100 p-4 cursor-pointer"><input type="checkbox" checked={form.emiteCertificado} onChange={(event) => setForm((current) => ({ ...current, emiteCertificado: event.target.checked }))} disabled={published} className="mt-1 h-4 w-4 accent-titi-yellow" /><span><span className="block text-sm font-bold text-titi-dark">Emitir certificado al completar</span><span className="block text-xs text-gray-500 mt-1">El curso otorgará certificado cuando el estudiante cumpla requisitos.</span></span></label>
        {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3"><p className="text-sm font-semibold text-red-700">{error}</p></div>}
        {success && <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2"><CheckIcon className="w-4 h-4 text-green-700" /><p className="text-sm font-semibold text-green-700">{success}</p></div>}
        {!published && <div className="flex flex-col sm:flex-row gap-3 pt-2"><button type="submit" disabled={saving} className="titi-btn-ghost">{saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Guardar borrador'}</button><button type="button" onClick={(event) => handleSubmit(event, { gotoContent: true })} disabled={saving} className="titi-btn-primary">Guardar y editar contenido →</button></div>}
      </form>
    </div>
  );
}

function Field({ label, required, children }) { return <label className="flex flex-col gap-1.5"><span className="text-sm font-semibold text-titi-dark">{label}{required && <span className="text-red-500 ml-1">*</span>}</span>{children}</label>; }
