import { useCallback, useEffect, useState } from 'react';
import { ErrorBox } from '../../components/social/StateBlocks.jsx';
import { BackLink, BTN_SECONDARY, INPUT, PageHeader } from '../../components/ui/v3.jsx';
import { CategoryIcon, categoryTheme } from '../../components/catalog/categoryTheme.jsx';
import client from '../../api/client.js';
import ConfirmModal from '../../components/ConfirmModal.jsx';
import { useStaggerReveal } from '../../lib/motion.js';

const FORM_VACIO = { nombre: '', icono: '' };

export default function AdminCategories() {
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [form, setForm] = useState(FORM_VACIO);
  const [editId, setEditId] = useState(null); // null = crear, id = editar
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const [confirm, setConfirm] = useState(null); // categoría a borrar
  const [busy, setBusy] = useState(null);

  const listRef = useStaggerReveal([categorias.length]);

  const fetchCategorias = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await client.get('/api/categories');
      if (data?.success) setCategorias(data.data.categorias || []);
      else setError(data?.message || 'No se pudieron cargar las categorías');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error de red');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCategorias(); }, [fetchCategorias]);

  function startEdit(cat) {
    setEditId(cat.id);
    setForm({ nombre: cat.nombre, icono: cat.icono });
    setFormError(null);
  }

  function cancelEdit() {
    setEditId(null);
    setForm(FORM_VACIO);
    setFormError(null);
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.nombre.trim() || !form.icono.trim()) {
      setFormError('Nombre e icono son requeridos');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = { nombre: form.nombre.trim(), icono: form.icono.trim() };
      const { data } = editId
        ? await client.put(`/api/admin/categories/${editId}`, payload)
        : await client.post('/api/admin/categories', payload);
      if (data?.success) {
        cancelEdit();
        fetchCategorias();
      } else {
        setFormError(data?.message || 'No se pudo guardar');
      }
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || 'Error de red');
    } finally {
      setSaving(false);
    }
  }

  async function remove(cat) {
    setBusy(cat.id);
    try {
      const { data } = await client.delete(`/api/admin/categories/${cat.id}`);
      if (data?.success) setCategorias((prev) => prev.filter((c) => c.id !== cat.id));
      else alert(data?.message || 'No se pudo borrar');
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Error');
    } finally {
      setBusy(null);
      setConfirm(null);
    }
  }

  return (
    <div>
      <BackLink to="/admin">Panel de administración</BackLink>
      <PageHeader title="Categorías del" accent="catálogo" subtitle={<>Creá, editá y borrá las categorías del catálogo.</>} />

      {/* Formulario crear / editar */}
      <form onSubmit={submit} className="titi-surface p-4 mb-6 flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="sm:w-24">
          <label className="text-xs font-bold text-gray-500 block mb-1">Icono</label>
          <input
            value={form.icono}
            onChange={(e) => setForm((f) => ({ ...f, icono: e.target.value }))}
            placeholder="💻"
            maxLength={4}
            className="w-full bg-white border-2 border-gray-200 rounded-xl px-4 py-2.5 text-center text-lg hover:border-gray-300 focus:outline-none focus:border-titi-dark focus:ring-4 focus:ring-titi-yellow/40 transition-all duration-150"
          />
        </div>
        <div className="flex-1">
          <label className="text-xs font-bold text-gray-500 block mb-1">Nombre</label>
          <input
            value={form.nombre}
            onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
            placeholder="Programación"
            className={INPUT}
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="titi-btn-primary text-sm px-5 whitespace-nowrap"
          >
            {saving ? 'Guardando…' : editId ? 'Guardar' : 'Crear'}
          </button>
          {editId && (
            <button
              type="button"
              onClick={cancelEdit}
              className={BTN_SECONDARY}
            >
              Cancelar
            </button>
          )}
        </div>
      </form>
      {formError && <p role="alert" className="text-sm font-bold text-red-600 -mt-3 mb-6">{formError}</p>}

      {/* Lista */}
      {loading ? (
        <div className="bg-white rounded-2xl border-2 border-gray-200 divide-y divide-gray-100 animate-pulse motion-reduce:animate-none" aria-busy="true">{[0, 1, 2, 3].map((i) => <div key={i} className="p-4 flex items-center gap-4"><span className="w-10 h-10 rounded-xl bg-gray-100" /><span className="flex-1 h-4 bg-gray-100 rounded-full" /></div>)}</div>
      ) : error ? (
        <ErrorBox title="No pudimos cargar los datos" message={error} onRetry={fetchCategorias} />
      ) : (
        <div ref={listRef} className="titi-surface divide-y divide-gray-100">
          {categorias.map((cat) => (
            <div key={cat.id} className="p-4 flex items-center gap-4">
              <span className={`w-10 h-10 rounded-xl border-2 border-titi-dark grid place-items-center text-white shrink-0 -rotate-6 ${categoryTheme(cat.nombre).solid}`}><CategoryIcon nombre={cat.nombre} className="w-5 h-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="font-extrabold text-titi-dark">{cat.nombre}</p>
                <p className="text-xs font-semibold text-gray-500">
                  {cat._count?.cursos ?? 0} {cat._count?.cursos === 1 ? 'curso' : 'cursos'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => startEdit(cat)}
                className="text-sm font-bold uppercase tracking-wide text-blue-500 hover:text-blue-600 active:scale-95 transition-all duration-150"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => setConfirm(cat)}
                disabled={busy === cat.id}
                className="text-sm font-bold uppercase tracking-wide text-red-500 hover:text-red-600 active:scale-95 transition-all duration-150 disabled:opacity-50"
              >
                Eliminar
              </button>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        open={Boolean(confirm)}
        title={confirm ? `¿Eliminar "${confirm.nombre}"?` : ''}
        message="No se puede borrar una categoría con cursos asociados. Esta acción no se puede deshacer."
        confirmText="Eliminar"
        cancelText="Cancelar"
        danger
        onConfirm={() => confirm && remove(confirm)}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
