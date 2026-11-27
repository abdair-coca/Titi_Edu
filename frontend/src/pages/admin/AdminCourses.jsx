import { useCallback, useEffect, useState } from 'react';
import { ErrorBox } from '../../components/social/StateBlocks.jsx';
import { BackLink, PageHeader } from '../../components/ui/v3.jsx';
import { Pill } from '../../components/catalog/CatalogFilters.jsx';
import { CategoryIcon, categoryTheme } from '../../components/catalog/categoryTheme.jsx';
import { BooksIcon } from '../../components/icons.jsx';
import client from '../../api/client.js';
import DeletionConfirmationDialog from '../../components/DeletionConfirmationDialog.jsx';
import { useStaggerReveal } from '../../lib/motion.js';
import { authoringHeaders } from '../../lib/authoring.js';

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
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const listRef = useStaggerReveal([cursos.length]);

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

  async function startDelete(curso) {
    setBusy(curso.id);
    try {
      const { data } = await client.post(`/api/admin/courses/${curso.id}/preview-deletion`);
      if (!data?.success) throw new Error(data?.message || 'No se pudo preparar el borrado');
      setDeleteConfirm({ kind: 'course', curso, ...data.data });
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'No se pudo preparar el borrado');
    } finally {
      setBusy(null);
    }
  }

  async function remove(phrase) {
    if (!deleteConfirm) return;
    const { curso, fingerprint, confirmationToken } = deleteConfirm;
    setBusy(curso.id);
    try {
      const { data } = await client.delete(`/api/admin/courses/${curso.id}`, {
        data: { expectedFingerprint: fingerprint, confirmationToken, phrase },
        headers: authoringHeaders(),
      });
      if (data?.success) {
        setCursos((prev) => prev.filter((c) => c.id !== curso.id));
        setDeleteConfirm(null);
      } else throw new Error(data?.message || 'No se pudo borrar');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'No se pudo borrar');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <BackLink to="/admin">Panel de administración</BackLink>
      <PageHeader title="Cursos de la" accent="comunidad" subtitle={<>Aprobá, moderá y eliminá cursos del catálogo.</>} />

      {/* Filtro */}
      <div role="group" aria-label="Filtrar cursos" className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-4 px-4 sm:mx-0 sm:px-0 py-1 mb-5">
        {FILTROS.map((f) => (
          <Pill key={f.value} active={filtro === f.value} onClick={() => setFiltro(f.value)} className="pl-4">
            {f.label}
          </Pill>
        ))}
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border-2 border-gray-200 divide-y divide-gray-100 animate-pulse motion-reduce:animate-none" aria-busy="true">{[0, 1, 2, 3].map((i) => <div key={i} className="p-4 flex items-center gap-4"><span className="w-10 h-10 rounded-xl bg-gray-100" /><span className="flex-1 flex flex-col gap-2"><span className="h-4 w-1/2 bg-gray-100 rounded-full" /><span className="h-3 w-1/3 bg-gray-100 rounded-full" /></span></div>)}</div>
      ) : error ? (
        <ErrorBox title="No pudimos cargar los datos" message={error} onRetry={fetchCourses} />
      ) : cursos.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-300 py-10 px-6 text-center">
          <span className="mx-auto w-12 h-12 rounded-xl border-2 border-titi-dark bg-titi-yellow text-titi-dark grid place-items-center -rotate-6 mb-3">
            <BooksIcon className="w-6 h-6" />
          </span>
          <h2 className="text-lg font-extrabold text-titi-dark">No hay cursos con este filtro</h2>
          <p className="text-sm font-medium text-gray-500 mt-1">Probá con otro estado.</p>
        </div>
      ) : (
        <div ref={listRef} className="titi-surface divide-y divide-gray-100">
          {cursos.map((curso) => (
            <div key={curso.id} className="p-4 flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-4">
              <span className={`w-10 h-10 rounded-xl border-2 border-titi-dark grid place-items-center text-white shrink-0 -rotate-6 ${categoryTheme(curso.categoria?.nombre).solid}`} aria-hidden="true"><CategoryIcon nombre={curso.categoria?.nombre} className="w-5 h-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="font-extrabold text-titi-dark line-clamp-1">{curso.titulo}</p>
                <p className="text-xs font-semibold text-gray-500">
                  {curso.creador?.username ? `Por @${curso.creador.username}` : 'Sin autor'}
                  {' · '}
                  {curso._count?.inscripciones ?? 0} inscritos · {curso._count?.modulos ?? 0} módulos
                </p>
              </div>
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-full shrink-0 ${
                  curso.publicado
                    ? 'bg-green-500 text-white border-2 border-titi-dark'
                    : 'bg-white text-titi-dark border-2 border-gray-200'
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
                    className="titi-btn-primary text-sm px-3 py-1.5"
                  >
                    Aprobar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => startDelete(curso)}
                  disabled={busy === curso.id}
                  className="text-sm font-bold uppercase tracking-wide text-red-500 hover:text-red-600 active:scale-95 transition-all duration-150 disabled:opacity-50"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <DeletionConfirmationDialog
        value={deleteConfirm}
        busy={Boolean(busy)}
        onConfirm={remove}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}
