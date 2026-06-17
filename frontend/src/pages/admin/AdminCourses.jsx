import { useCallback, useEffect, useState } from 'react';
import client from '../../api/client.js';
import ConfirmModal from '../../components/ConfirmModal.jsx';
import { useStaggerReveal } from '../../lib/motion.js';

const FILTROS = [
  { value: 'all', label: 'Todos' },
  { value: 'true', label: 'Publicados' },
  { value: 'false', label: 'Borradores' },
];

export default function AdminCourses() {
  const [cursos, setCursos] = useState([]);
  const [filtro, setFiltro] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [confirm, setConfirm] = useState(null); // curso a borrar

  const listRef = useStaggerReveal([cursos]);

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (filtro !== 'all') params.publicado = filtro;
      const { data } = await client.get('/api/admin/courses', { params });
      if (data?.success) setCursos(data.data.cursos || []);
      else setError(data?.message || 'No se pudieron cargar los cursos');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error de red');
    } finally {
      setLoading(false);
    }
  }, [filtro]);

  useEffect(() => { fetchCourses(); }, [fetchCourses]);

  async function approve(curso) {
    setBusy(curso.id);
    try {
      const { data } = await client.put(`/api/admin/courses/${curso.id}/approve`);
      if (data?.success) setCursos((prev) => prev.map((c) => (c.id === curso.id ? { ...c, publicado: true } : c)));
      else alert(data?.message || 'No se pudo aprobar');
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Error');
    } finally {
      setBusy(null);
    }
  }

  async function remove(curso) {
    setBusy(curso.id);
    try {
      const { data } = await client.delete(`/api/admin/courses/${curso.id}`);
      if (data?.success) setCursos((prev) => prev.filter((c) => c.id !== curso.id));
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
        <h1 className="text-2xl sm:text-3xl font-extrabold text-titi-dark mb-1">Cursos</h1>
        <p className="text-sm font-medium text-gray-500">Aprobá, moderá y eliminá cursos del catálogo.</p>
      </header>

      {/* Filtro */}
      <div className="flex gap-2 mb-5">
        {FILTROS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFiltro(f.value)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              filtro === f.value
                ? 'bg-titi-yellow text-titi-dark'
                : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 h-72 animate-pulse" />
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <span className="text-red-500 text-lg" aria-hidden="true">⚠️</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-700">{error}</p>
            <button onClick={fetchCourses} className="text-sm font-bold text-titi-dark hover:text-titi-yellow-dark mt-2">
              Reintentar →
            </button>
          </div>
        </div>
      ) : cursos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400 font-semibold">
          No hay cursos con este filtro.
        </div>
      ) : (
        <div ref={listRef} className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.06)] divide-y divide-gray-100">
          {cursos.map((curso) => (
            <div key={curso.id} className="p-4 flex items-center gap-4">
              <span className="text-2xl select-none shrink-0" aria-hidden="true">{curso.categoria?.icono || '📚'}</span>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-titi-dark line-clamp-1">{curso.titulo}</p>
                <p className="text-xs text-gray-400">
                  {curso.creador?.username ? `Por @${curso.creador.username}` : 'Sin autor'}
                  {' · '}
                  {curso._count?.inscripciones ?? 0} inscritos · {curso._count?.modulos ?? 0} módulos
                </p>
              </div>
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-full shrink-0 ${
                  curso.publicado
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-gray-100 text-gray-600 border border-gray-200'
                }`}
              >
                {curso.publicado ? 'Publicado' : 'Borrador'}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                {!curso.publicado && (
                  <button
                    type="button"
                    onClick={() => approve(curso)}
                    disabled={busy === curso.id}
                    className="bg-titi-yellow text-titi-dark font-bold text-xs px-3 py-1.5 rounded-xl shadow-[0_3px_0px_#E6B800] hover:shadow-[0_1px_0px_#E6B800] hover:-translate-y-0.5 active:shadow-none active:translate-y-0 transition-all duration-150 disabled:opacity-50"
                  >
                    Aprobar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setConfirm(curso)}
                  disabled={busy === curso.id}
                  className="text-titi-red font-semibold text-xs hover:underline disabled:opacity-50"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        open={Boolean(confirm)}
        title={confirm ? `¿Eliminar "${confirm.titulo}"?` : ''}
        message="Borrado forzado de admin: elimina el curso aunque tenga inscritos, junto con sus módulos, lecciones, progresos, inscripciones y certificados. Esta acción no se puede deshacer."
        confirmText="Eliminar curso"
        cancelText="Cancelar"
        danger
        onConfirm={() => confirm && remove(confirm)}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
