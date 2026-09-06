import { useCallback, useEffect, useState } from 'react';
import client from '../../api/client.js';
import { ChipIcon } from '../../components/icons.jsx';

const STATUS_FILTERS = [
  { value: 'ALL', label: 'Todos los estados' },
  { value: 'LISTO', label: 'Listo (Indexado)' },
  { value: 'FALLIDO', label: 'Con error' },
  { value: 'PENDIENTE', label: 'Pendiente' },
  { value: 'SIN_INDEXAR', label: 'Sin indexar' },
];

function formatDate(isoString) {
  if (!isoString) return 'Nunca';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return 'Fecha inválida';
  return date.toLocaleString('es-BO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatusBadge({ estado, error }) {
  if (estado === 'LISTO') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200">
        <span className="w-2 h-2 rounded-full bg-green-500" />
        Listo
      </span>
    );
  }
  if (estado === 'FALLIDO') {
    return (
      <span
        title={error || 'Error en indexación'}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200 cursor-help"
      >
        <span className="w-2 h-2 rounded-full bg-red-500" />
        Fallido
      </span>
    );
  }
  if (estado === 'PENDIENTE') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800 border border-yellow-200">
        <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
        Pendiente
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600 border border-gray-200">
      <span className="w-2 h-2 rounded-full bg-gray-400" />
      Sin indexar
    </span>
  );
}

function RagFragmentsModal({ lessonId, onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const [query, setQuery] = useState('');
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryResults, setQueryResults] = useState(null);
  const [queryError, setQueryError] = useState(null);

  const fetchFragments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await client.get(`/api/admin/rag/lessons/${lessonId}/fragments`);
      if (res.data?.success) {
        setData(res.data.data);
      } else {
        setError(res.data?.message || 'Error cargando fragmentos');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  }, [lessonId]);

  useEffect(() => {
    fetchFragments();
  }, [fetchFragments]);

  async function handleTestQuery(e) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    setQueryLoading(true);
    setQueryError(null);
    try {
      const res = await client.post(`/api/admin/rag/lessons/${lessonId}/test-query`, { query: trimmed });
      if (res.data?.success) {
        setQueryResults(res.data.data.results);
      } else {
        setQueryError(res.data?.message || 'Error en búsqueda de prueba');
      }
    } catch (err) {
      setQueryError(err.response?.data?.message || err.message || 'Error ejecutando prueba');
    } finally {
      setQueryLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-titi-dark/60 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header Modal */}
        <div className="p-4 sm:p-6 border-b border-gray-100 flex items-start justify-between gap-4 bg-titi-cream/40">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-titi-dark text-titi-yellow grid place-items-center">
                <ChipIcon className="w-4 h-4" />
              </span>
              <h2 className="text-xl font-black text-titi-dark">
                {data?.lesson?.titulo || 'Contenido indexado'}
              </h2>
            </div>
            {data?.lesson && (
              <p className="text-xs font-semibold text-gray-500 mt-1">
                Curso: <span className="text-titi-dark">{data.lesson.courseTitle}</span> · Módulo:{' '}
                <span className="text-titi-dark">{data.lesson.moduleTitle}</span>
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold grid place-items-center transition-colors"
            aria-label="Cerrar modal"
          >
            ✕
          </button>
        </div>

        {/* Body Modal */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-3 border-titi-yellow border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-semibold text-gray-500">Recuperando fragmentos vectoriales…</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-semibold">
              {error}
            </div>
          ) : (
            <>
              {/* Metadatos del Documento RAG */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 p-4 rounded-xl border border-gray-100 text-xs">
                <div>
                  <span className="text-gray-400 font-medium block">Estado RAG:</span>
                  <StatusBadge estado={data?.document?.estado} error={data?.document?.error} />
                </div>
                <div>
                  <span className="text-gray-400 font-medium block">Modelo:</span>
                  <span className="font-bold text-titi-dark truncate block" title={data?.document?.modelo || '—'}>
                    {data?.document?.modelo || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 font-medium block">Indexado el:</span>
                  <span className="font-bold text-titi-dark block">
                    {formatDate(data?.document?.indexadoAt)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 font-medium block">Fragmentos:</span>
                  <span className="font-black text-titi-dark block text-sm">
                    {data?.fragments?.length ?? 0} chunks
                  </span>
                </div>
              </div>

              {/* Alerta si hubo error */}
              {data?.document?.error && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs">
                  <p className="font-bold text-red-800 mb-1">Detalle del error al indexar:</p>
                  <p className="font-mono text-red-700 break-words">{data.document.error}</p>
                </div>
              )}

              {/* Simulador de Búsqueda Semántica */}
              <section className="p-4 rounded-xl border border-titi-yellow/40 bg-titi-cream/30 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-titi-dark flex items-center gap-1.5">
                    🔍 Simulador de búsqueda semántica
                  </h3>
                  <span className="text-[11px] font-semibold text-gray-500">Sin gasto de tokens LLM</span>
                </div>
                <form onSubmit={handleTestQuery} className="flex gap-2">
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Escribí una pregunta de prueba para ver qué fragmentos recupera el tutor…"
                    className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-titi-dark"
                  />
                  <button
                    type="submit"
                    disabled={queryLoading || !query.trim()}
                    className="px-4 py-2 rounded-xl bg-titi-dark text-white font-bold text-sm hover:bg-gray-800 disabled:opacity-50 transition-colors shrink-0"
                  >
                    {queryLoading ? 'Buscando…' : 'Probar'}
                  </button>
                </form>

                {queryError && (
                  <p className="text-xs font-semibold text-red-600">{queryError}</p>
                )}

                {queryResults && (
                  <div className="mt-3 space-y-2 border-t border-gray-200 pt-3">
                    <p className="text-xs font-bold text-titi-dark">
                      Resultados recuperados ({queryResults.length}):
                    </p>
                    {queryResults.length === 0 ? (
                      <p className="text-xs text-gray-500 italic">No se encontraron fragmentos relevantes para esta consulta.</p>
                    ) : (
                      queryResults.map((res) => (
                        <div key={res.chunkId} className="p-3 bg-white rounded-lg border border-gray-200 text-xs space-y-1">
                          <div className="flex items-center justify-between font-bold">
                            <span className="text-titi-dark">
                              Fragmento #{res.orden} · {res.lessonTitle}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[11px] font-black ${
                              res.similarity >= 0.75
                                ? 'bg-green-100 text-green-800'
                                : res.similarity >= 0.5
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                              Similitud: {(res.similarity * 100).toFixed(1)}% ({res.similarity})
                            </span>
                          </div>
                          <p className="text-gray-700 font-sans leading-relaxed">{res.contenido}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </section>

              {/* Lista completa de Chunks de la lección */}
              <div>
                <h3 className="text-sm font-black text-titi-dark mb-3">
                  Fragmentos almacenados en PostgreSQL (pgvector)
                </h3>
                {data?.fragments?.length === 0 ? (
                  <div className="p-6 text-center text-gray-400 font-medium text-sm bg-gray-50 rounded-xl">
                    Esta lección aún no tiene fragmentos vectorizados. Tocá "Reindexar" en la tabla para generarlos.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.fragments.map((frag) => (
                      <div
                        key={frag.id}
                        className="p-4 rounded-xl border border-gray-200 bg-white shadow-xs space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs font-bold text-gray-500 border-b border-gray-100 pb-1.5">
                          <span className="text-titi-dark">Chunk #{frag.orden}</span>
                          <span className="font-mono text-gray-400">{frag.longitud} caracteres</span>
                        </div>
                        <p className="text-xs text-gray-800 font-sans leading-relaxed whitespace-pre-wrap">
                          {frag.contenido}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer Modal */}
        <div className="p-4 border-t border-gray-100 flex justify-end bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-titi-dark font-bold text-sm transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminRag() {
  const [lessons, setLessons] = useState([]);
  const [courses, setCourses] = useState([]);
  const [summary, setSummary] = useState({
    totalLessons: 0,
    ready: 0,
    failed: 0,
    pending: 0,
    unindexed: 0,
  });

  const [courseFilter, setCourseFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reindexingId, setReindexingId] = useState(null);
  const [selectedLessonId, setSelectedLessonId] = useState(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Cargar cursos para el dropdown de filtro
  useEffect(() => {
    async function loadCourses() {
      try {
        const res = await client.get('/api/admin/rag/courses');
        if (res.data?.success) setCourses(res.data.data.courses || []);
      } catch (err) {
        console.error('Error cargando cursos en admin RAG', err);
      }
    }
    loadCourses();
  }, []);

  // Cargar lecciones y estadísticas
  const fetchLessons = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        pageSize,
      };
      if (courseFilter) params.courseId = courseFilter;
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();

      const res = await client.get('/api/admin/rag/lessons', { params });
      if (res.data?.success) {
        setLessons(res.data.data.lessons || []);
        setTotal(res.data.data.total || 0);
        if (res.data.data.summary) {
          setSummary(res.data.data.summary);
        }
      } else {
        setError(res.data?.message || 'Error cargando lecciones');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  }, [courseFilter, debouncedSearch, page, pageSize, statusFilter]);

  useEffect(() => {
    fetchLessons();
  }, [fetchLessons]);

  // Reindexación sincrónica inmediata
  async function handleReindex(lessonId) {
    setReindexingId(lessonId);
    try {
      const res = await client.post(`/api/admin/rag/lessons/${lessonId}/reindex`);
      if (res.data?.success) {
        // Refrescar el estado de la fila y los KPIs
        await fetchLessons();
      } else {
        alert(res.data?.message || 'No se pudo reindexar la lección');
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Error al ejecutar la reindexación');
    } finally {
      setReindexingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <header>
        <div className="flex items-center gap-3 mb-1">
          <span className="w-10 h-10 rounded-xl bg-titi-dark text-titi-yellow grid place-items-center shadow-xs">
            <ChipIcon className="w-5 h-5" />
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-titi-dark">Control RAG</h1>
        </div>
        <p className="text-sm font-medium text-gray-500">
          Supervisá el estado de la indexación vectorial, auditá fragmentos y probá búsquedas semánticas para el tutor IA.
        </p>
      </header>

      {/* Tarjetas KPI de Resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Publicadas</p>
          <p className="text-3xl font-black text-titi-dark mt-1 tabular-nums">{summary.totalLessons}</p>
          <span className="text-[11px] font-semibold text-gray-500">Lecciones activas</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs">
          <p className="text-xs font-bold text-green-700 uppercase tracking-wider">Listas (Indexadas)</p>
          <p className="text-3xl font-black text-green-600 mt-1 tabular-nums">{summary.ready}</p>
          <span className="text-[11px] font-semibold text-green-700">En base vectorial</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs">
          <p className="text-xs font-bold text-red-700 uppercase tracking-wider">Con Error</p>
          <p className="text-3xl font-black text-red-600 mt-1 tabular-nums">{summary.failed}</p>
          <span className="text-[11px] font-semibold text-red-700">Requieren reindexar</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs">
          <p className="text-xs font-bold text-yellow-700 uppercase tracking-wider">Sin Indexar</p>
          <p className="text-3xl font-black text-yellow-600 mt-1 tabular-nums">
            {summary.unindexed + summary.pending}
          </p>
          <span className="text-[11px] font-semibold text-yellow-700">Pendientes de proceso</span>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex flex-wrap gap-2 flex-1 items-center">
          {/* Selector de Curso */}
          <select
            value={courseFilter}
            onChange={(e) => {
              setCourseFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold text-titi-dark bg-white focus:outline-none focus:border-titi-dark"
          >
            <option value="">Todos los cursos</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.titulo}
              </option>
            ))}
          </select>

          {/* Selector de Estado */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold text-titi-dark bg-white focus:outline-none focus:border-titi-dark"
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          {/* Buscador de texto */}
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por lección o curso…"
            className="px-3 py-2 rounded-xl border border-gray-200 text-xs font-medium text-titi-dark min-w-[200px] flex-1 sm:flex-initial focus:outline-none focus:border-titi-dark"
          />
        </div>

        <button
          type="button"
          onClick={fetchLessons}
          className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-titi-dark font-bold text-xs transition-colors shrink-0"
        >
          Refrescar
        </button>
      </div>

      {/* Tabla de Lecciones */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-3 border-titi-yellow border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold text-gray-500">Cargando estado RAG de las lecciones…</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-600 font-semibold text-sm">
            {error}
          </div>
        ) : lessons.length === 0 ? (
          <div className="py-16 text-center text-gray-400 font-medium text-sm">
            No se encontraron lecciones publicadas que coincidan con los filtros seleccionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-100 text-gray-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Curso / Módulo</th>
                  <th className="py-3 px-4">Lección</th>
                  <th className="py-3 px-4">Estado RAG</th>
                  <th className="py-3 px-4">Última Indexación</th>
                  <th className="py-3 px-4">Modelo</th>
                  <th className="py-3 px-4">Fragmentos</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lessons.map((lesson) => {
                  const doc = lesson.documentoRag;
                  const isReindexing = reindexingId === lesson.id;

                  return (
                    <tr key={lesson.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-gray-600 max-w-[200px] truncate">
                        <div className="font-bold text-titi-dark truncate" title={lesson.modulo?.curso?.titulo}>
                          {lesson.modulo?.curso?.titulo}
                        </div>
                        <div className="text-[11px] text-gray-400 truncate" title={lesson.modulo?.titulo}>
                          {lesson.modulo?.titulo}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-titi-dark max-w-[220px]">
                        <div className="truncate" title={lesson.titulo}>
                          {lesson.titulo}
                        </div>
                        {lesson.recursoHtml && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 mt-0.5">
                            🎮 Presentación HTML
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge estado={doc?.estado} error={doc?.error} />
                      </td>
                      <td className="py-3.5 px-4 font-medium text-gray-500 whitespace-nowrap">
                        {formatDate(doc?.indexadoAt)}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-gray-500 max-w-[150px] truncate" title={doc?.modelo || '—'}>
                        {doc?.modelo || '—'}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-titi-dark tabular-nums whitespace-nowrap">
                        {doc ? `${doc.fragmentosCount} chunks` : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap space-x-2">
                        <button
                          type="button"
                          onClick={() => setSelectedLessonId(lesson.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-titi-dark font-bold text-xs transition-colors"
                        >
                          Ver fragmentos
                        </button>
                        <button
                          type="button"
                          disabled={isReindexing}
                          onClick={() => handleReindex(lesson.id)}
                          className="px-3 py-1.5 rounded-lg bg-titi-yellow hover:bg-yellow-400 text-titi-dark font-black text-xs disabled:opacity-50 transition-colors inline-flex items-center gap-1"
                        >
                          {isReindexing ? (
                            <>
                              <span className="w-3 h-3 border-2 border-titi-dark border-t-transparent rounded-full animate-spin" />
                              Reindexando…
                            </>
                          ) : (
                            'Reindexar'
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        {total > pageSize && (
          <div className="p-4 border-t border-gray-100 flex items-center justify-between text-xs font-bold text-gray-500 bg-gray-50">
            <span>
              Mostrando {(page - 1) * pageSize + 1} a {Math.min(page * pageSize, total)} de {total} lecciones
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 disabled:opacity-40 hover:bg-gray-100 transition-colors"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={page * pageSize >= total}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 disabled:opacity-40 hover:bg-gray-100 transition-colors"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Fragmentos y Búsqueda */}
      {selectedLessonId && (
        <RagFragmentsModal
          lessonId={selectedLessonId}
          onClose={() => setSelectedLessonId(null)}
        />
      )}
    </div>
  );
}
