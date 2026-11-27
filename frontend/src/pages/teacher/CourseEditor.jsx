import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRightIcon, CheckIcon, ImageIcon } from '../../components/icons.jsx';
import { BackLink, PageHeader } from '../../components/ui/v3.jsx';
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

  if (loading) return <div className="max-w-2xl animate-pulse motion-reduce:animate-none" aria-busy="true" aria-label="Cargando el curso"><div className="h-9 w-56 bg-gray-100 rounded-full mb-4" /><div className="h-9 w-2/3 bg-gray-100 rounded-full mb-6" /><div className="bg-white border-2 border-gray-200 rounded-2xl p-5 sm:p-6 space-y-5"><div className="h-12 bg-gray-100 rounded-xl" /><div className="h-32 bg-gray-100 rounded-xl" /><div className="grid grid-cols-2 gap-4"><div className="h-12 bg-gray-100 rounded-xl" /><div className="h-12 bg-gray-100 rounded-xl" /></div></div></div>;

  return (
    <div className="max-w-2xl">
      <BackLink to="/teacher">Mis cursos como profe</BackLink>
      <PageHeader title={isEdit ? 'Editar' : 'Crear nuevo'} accent="curso" subtitle={published ? 'Curso publicado: sus datos quedan solo lectura.' : 'Guardá el borrador antes de publicar.'}>
        {published && <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-green-500 border-2 border-titi-dark text-xs font-extrabold text-white"><CheckIcon className="w-3.5 h-3.5" />Publicado</span>}
      </PageHeader>
      <form onSubmit={handleSubmit} className="titi-surface p-5 sm:p-6 flex flex-col gap-5">
        <Field label="Título del curso" required><input value={form.titulo} onChange={onChange('titulo')} disabled={published} maxLength={120} className="titi-input disabled:opacity-60" required /></Field>
        <Field label="Descripción" required><textarea value={form.descripcion} onChange={onChange('descripcion')} disabled={published} rows={5} maxLength={1000} className="titi-input resize-none disabled:opacity-60" required /><p className="text-xs text-gray-400 mt-1 tabular-nums">{form.descripcion.length} / 1000</p></Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nivel" required><select value={form.nivel} onChange={onChange('nivel')} disabled={published} className="titi-input capitalize disabled:opacity-60">{NIVELES.map((nivel) => <option key={nivel} value={nivel}>{nivel}</option>)}</select></Field>
          <Field label="Categoría" required><select value={form.categoriaId} onChange={onChange('categoriaId')} disabled={published} className="titi-input disabled:opacity-60" required><option value="" disabled>Elegí una categoría</option>{categorias.map((category) => <option key={category.id} value={category.id}>{category.nombre}</option>)}</select></Field>
        </div>
        <Field label="Portada del curso (opcional)">
          {form.portadaUrl && <img src={resolveMediaUrl(form.portadaUrl)} alt="Portada del curso" className="h-28 w-full object-cover rounded-xl border-2 border-titi-dark" />}
          <div className="flex flex-col sm:flex-row gap-3">
            <label className={`inline-flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 px-4 py-2.5 text-sm font-bold text-titi-dark hover:border-titi-dark hover:bg-titi-cream active:scale-[0.98] transition-all duration-150 cursor-pointer whitespace-nowrap ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={published} onChange={handlePortadaUpload} />
              <ImageIcon className="w-4 h-4" />{uploading ? 'Subiendo…' : 'Subir imagen'}
            </label>
            <input type="text" value={form.portadaUrl} onChange={onChange('portadaUrl')} disabled={published || uploading} placeholder="https://… o subí una imagen" className="titi-input disabled:opacity-60" />
          </div>
        </Field>
        <label className="flex items-start gap-3 rounded-xl bg-titi-cream border-2 border-gray-200 hover:border-titi-dark transition-colors duration-150 p-4 cursor-pointer"><input type="checkbox" checked={form.emiteCertificado} onChange={(event) => setForm((current) => ({ ...current, emiteCertificado: event.target.checked }))} disabled={published} className="mt-1 h-4 w-4 accent-titi-yellow" /><span><span className="block text-sm font-bold text-titi-dark">Emitir certificado al completar</span><span className="block text-xs font-semibold text-gray-500 mt-1">El curso otorgará certificado cuando el estudiante cumpla requisitos.</span></span></label>
        {error && <div role="alert" className="bg-red-50 border-2 border-red-500 rounded-2xl p-3 flex items-start gap-3"><span aria-hidden="true" className="w-8 h-8 rounded-full bg-red-500 grid place-items-center shrink-0 text-white text-sm font-black">!</span><p className="text-sm font-bold text-red-700 pt-1.5">{error}</p></div>}
        {success && <div role="status" className="bg-green-50 border-2 border-green-500 rounded-2xl p-3 flex items-center gap-3"><span aria-hidden="true" className="w-8 h-8 rounded-full bg-green-500 grid place-items-center shrink-0"><CheckIcon className="w-4 h-4 text-white" /></span><p className="text-sm font-bold text-green-700">{success}</p></div>}
        {!published && <div className="flex flex-col sm:flex-row gap-3 pt-2"><button type="submit" disabled={saving} className="titi-btn-outline">{saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Guardar borrador'}</button><button type="button" onClick={(event) => handleSubmit(event, { gotoContent: true })} disabled={saving} className="titi-btn-primary">Guardar y editar contenido<ArrowRightIcon className="w-4 h-4" /></button></div>}
      </form>
    </div>
  );
}

function Field({ label, required, children }) { return <label className="flex flex-col gap-1.5"><span className="text-sm font-bold text-titi-dark">{label}{required && <span className="text-red-500 ml-1">*</span>}</span>{children}</label>; }
