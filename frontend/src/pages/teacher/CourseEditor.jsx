import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import client from '../../api/client.js';

const NIVELES = ['principiante', 'intermedio', 'avanzado'];

export default function CourseEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({
    titulo: '',
    descripcion: '',
    nivel: 'principiante',
    categoriaId: '',
    portadaUrl: '',
  });
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Cargar categorías
  useEffect(() => {
    let cancelled = false;
    client
      .get('/api/categories')
      .then(({ data }) => {
        if (cancelled) return;
        if (data?.success) {
          const list = data.data?.categorias || [];
          setCategorias(list);
          setForm((f) => ({ ...f, categoriaId: f.categoriaId || list[0]?.id || '' }));
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Cargar curso en modo edit
  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    setLoading(true);
    client
      .get(`/api/courses/${id}`)
      .then(({ data }) => {
        if (cancelled) return;
        if (data?.success) {
          const c = data.data?.curso;
          setForm({
            titulo: c.titulo || '',
            descripcion: c.descripcion || '',
            nivel: c.nivel || 'principiante',
            categoriaId: c.categoriaId || c.categoria?.id || '',
            portadaUrl: c.portadaUrl || '',
          });
        } else {
          setError(data?.message || 'Curso no encontrado');
        }
      })
      .catch((err) => setError(err.response?.data?.message || err.message))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, isEdit]);

  const onChange = useCallback((field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
  }, []);

  async function handleSubmit(e, opts = {}) {
    e?.preventDefault?.();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        titulo: form.titulo.trim(),
        descripcion: form.descripcion.trim(),
        nivel: form.nivel,
        categoriaId: form.categoriaId,
        portadaUrl: form.portadaUrl.trim() || null,
      };
      if (!payload.titulo || !payload.descripcion || !payload.categoriaId) {
        setError('Título, descripción y categoría son obligatorios');
        setSaving(false);
        return;
      }

      let cursoId = id;
      if (isEdit) {
        const { data } = await client.put(`/api/courses/${id}`, payload);
        if (!data?.success) {
          setError(data?.message || 'No se pudo actualizar');
          return;
        }
      } else {
        const { data } = await client.post('/api/courses', payload);
        if (!data?.success) {
          setError(data?.message || 'No se pudo crear');
          return;
        }
        cursoId = data.data.curso.id;
      }

      if (opts.gotoContent) {
        navigate(`/teacher/courses/${cursoId}/modules`);
      } else {
        setSuccess('Cambios guardados');
        if (!isEdit) navigate(`/teacher/courses/${cursoId}/edit`, { replace: true });
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error guardando');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-8 animate-pulse max-w-2xl">
        <div className="h-5 w-1/3 bg-gray-100 rounded mb-6" />
        <div className="space-y-4">
          <div className="h-10 bg-gray-100 rounded-xl" />
          <div className="h-32 bg-gray-100 rounded-xl" />
          <div className="h-10 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <button
        type="button"
        onClick={() => navigate('/teacher')}
        className="text-sm font-semibold text-gray-500 hover:text-titi-dark mb-4 inline-flex items-center gap-1"
      >
        ← Mis cursos como profesor
      </button>

      <h1 className="text-2xl sm:text-3xl font-extrabold text-titi-dark mb-1">
        {isEdit ? 'Editar curso' : 'Crear nuevo curso'}
      </h1>
      <p className="text-sm font-medium text-gray-500 mb-6">
        Primero los datos básicos. Después agregás módulos y lecciones.
      </p>

      <form onSubmit={handleSubmit} className="bg-white border border-gray-100 rounded-2xl p-5 sm:p-6 shadow-[0_2px_8px_rgba(0,0,0,0.06)] flex flex-col gap-5">
        <Field label="Título del curso" required>
          <input
            type="text"
            value={form.titulo}
            onChange={onChange('titulo')}
            placeholder="Ej. Introducción a Python"
            maxLength={120}
            className="titi-input"
            required
          />
        </Field>

        <Field label="Descripción" required>
          <textarea
            value={form.descripcion}
            onChange={onChange('descripcion')}
            placeholder="¿De qué trata el curso? ¿A quién está dirigido?"
            rows={5}
            maxLength={1000}
            className="titi-input resize-none"
            required
          />
          <p className="text-xs text-gray-400 mt-1 tabular-nums">{form.descripcion.length} / 1000</p>
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nivel" required>
            <select value={form.nivel} onChange={onChange('nivel')} className="titi-input capitalize">
              {NIVELES.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </Field>

          <Field label="Categoría" required>
            <select value={form.categoriaId} onChange={onChange('categoriaId')} className="titi-input" required>
              <option value="" disabled>Elegí una categoría</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.icono} {c.nombre}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="URL de portada (opcional)">
          <input
            type="url"
            value={form.portadaUrl}
            onChange={onChange('portadaUrl')}
            placeholder="https://…"
            className="titi-input"
          />
          <p className="text-xs text-gray-400 mt-1">
            Pegá la URL pública de una imagen (por ejemplo de Unsplash o tu Drive).
          </p>
        </Field>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-sm font-semibold text-red-700">{error}</p>
          </div>
        )}
        {success && !error && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2">
            <span className="text-green-500">✅</span>
            <p className="text-sm font-semibold text-green-700">{success}</p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="bg-white text-titi-dark font-semibold text-sm px-5 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-all disabled:opacity-50"
          >
            {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Guardar borrador'}
          </button>
          <button
            type="button"
            onClick={(e) => handleSubmit(e, { gotoContent: true })}
            disabled={saving}
            className="bg-titi-yellow text-titi-dark font-bold text-base px-6 py-3 rounded-xl shadow-[0_4px_0px_#E6B800] hover:shadow-[0_2px_0px_#E6B800] hover:-translate-y-0.5 active:shadow-none active:translate-y-0 transition-all duration-150 disabled:opacity-50"
          >
            Guardar y editar contenido →
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-titi-dark">
        {label}
        {required && <span className="text-titi-red ml-1">*</span>}
      </span>
      {children}
    </label>
  );
}
