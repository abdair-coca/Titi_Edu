import { useCallback, useEffect, useState } from 'react';
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
      <header className="mb-6">
        <h1 className="text-3xl sm:text-4xl font-black text-titi-dark mb-1">Categorías</h1>
        <p className="text-sm font-medium text-gray-500">Creá, editá y borrá las categorías del catálogo.</p>
      </header>

      {/* Formulario crear / editar */}
      <form onSubmit={submit} className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-4 mb-6 flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="sm:w-24">
          <label className="text-xs font-bold text-gray-500 block mb-1">Icono</label>
          <input
            value={form.icono}
            onChange={(e) => setForm((f) => ({ ...f, icono: e.target.value }))}
            placeholder="💻"
            maxLength={4}
            className="w-full bg-titi-cream border border-gray-200 rounded-xl px-4 py-3 text-center text-lg focus:outline-none focus:border-titi-yellow focus:ring-2 focus:ring-titi-yellow/20"
          />
        </div>
        <div className="flex-1">
          <label className="text-xs font-bold text-gray-500 block mb-1">Nombre</label>
          <input
            value={form.nombre}
            onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
            placeholder="Programación"
            className="w-full bg-titi-cream border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-titi-dark placeholder:text-gray-300 focus:outline-none focus:border-titi-yellow focus:ring-2 focus:ring-titi-yellow/20"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="bg-titi-yellow text-titi-dark font-bold text-sm px-5 py-3 rounded-xl shadow-[0_4px_0px_#E6B800] hover:shadow-[0_2px_0px_#E6B800] hover:-translate-y-0.5 active:shadow-none active:translate-y-0 transition-all duration-150 disabled:opacity-50 whitespace-nowrap"
          >
            {saving ? 'Guardando…' : editId ? 'Guardar' : 'Crear'}
          </button>
          {editId && (
            <button
              type="button"
              onClick={cancelEdit}
              className="bg-white text-titi-dark font-semibold text-sm px-4 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-all"
            >
              Cancelar
            </button>
          )}
        </div>
      </form>
      {formError && <p className="text-sm font-semibold text-titi-red -mt-3 mb-6">{formError}</p>}

      {/* Lista */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 h-60 animate-pulse" />
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <span className="w-8 h-8 rounded-full bg-red-500 grid place-items-center shrink-0 text-white text-sm font-black" aria-hidden="true">!</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-700">{error}</p>
            <button onClick={fetchCategorias} className="text-sm font-bold text-titi-dark hover:text-titi-yellow-dark mt-2">
              Reintentar →
            </button>
          </div>
        </div>
      ) : (
        <div ref={listRef} className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.06)] divide-y divide-gray-100">
          {categorias.map((cat) => (
            <div key={cat.id} className="p-4 flex items-center gap-4">
              <span className="text-2xl select-none shrink-0" aria-hidden="true">{cat.icono}</span>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-titi-dark">{cat.nombre}</p>
                <p className="text-xs text-gray-400">
                  {cat._count?.cursos ?? 0} {cat._count?.cursos === 1 ? 'curso' : 'cursos'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => startEdit(cat)}
                className="text-titi-dark font-semibold text-xs hover:text-titi-yellow-dark"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => setConfirm(cat)}
                disabled={busy === cat.id}
                className="text-titi-red font-semibold text-xs hover:underline disabled:opacity-50"
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
