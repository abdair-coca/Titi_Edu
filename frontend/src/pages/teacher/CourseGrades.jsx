import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import client from '../../api/client.js';

export default function CourseGrades() {
  const { courseId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filtroModulo, setFiltroModulo] = useState('todos');
  const [filtroLeccion, setFiltroLeccion] = useState('todos');
  const [verFinal, setVerFinal] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: res } = await client.get(`/api/courses/${courseId}/grades`);
      if (res?.success) setData(res.data);
      else setError(res?.message || 'No se pudieron cargar las notas');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error de red');
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => { fetch(); }, [fetch]);

  const filtros = useMemo(() => {
    if (!data) return { evaluaciones: [], html: [] };
    let evaluaciones = data.evaluaciones;
    let html = data.lecciones.filter((l) => l.htmlEvaluable);
    if (filtroModulo !== 'todos') {
      evaluaciones = evaluaciones.filter((e) => e.moduloId === filtroModulo);
      html = html.filter((l) => l.moduloId === filtroModulo);
    }
    if (filtroLeccion !== 'todos') {
      html = html.filter((l) => l.id === filtroLeccion);
    }
    if (verFinal) {
      evaluaciones = evaluaciones.filter((e) => e.esFinal);
    }
    return { evaluaciones, html };
  }, [data, filtroModulo, filtroLeccion, verFinal]);

  const exportCsv = () => {
    if (!data) return;
    const rows = [['Estudiante', 'Username', 'Progreso %', 'Completado', ...filtros.evaluaciones.map((e) => e.titulo), ...filtros.html.map((l) => l.titulo)]];
    data.estudiantes.forEach((est) => {
      const notasEval = filtros.evaluaciones.map((e) => {
        const nota = est.evaluaciones.find((n) => n.id === e.id);
        return nota?.mejorNota ?? '';
      });
      const notasHtml = filtros.html.map((l) => {
        const nota = est.html.find((n) => n.leccionId === l.id);
        return nota?.mejorPuntaje ?? '';
      });
      rows.push([est.usuario.nombre, est.usuario.username, est.progreso, est.completado ? 'Si' : 'No', ...notasEval, ...notasHtml]);
    });
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notas-${data.curso.titulo.replace(/\s+/g, '-').toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <Cargando />;
  if (error) return <ErrorState message={error} onRetry={fetch} />;
  if (!data) return null;

  return (
    <div className="max-w-6xl">
      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-titi-dark">Notas — {data.curso.titulo}</h1>
          <p className="text-sm font-medium text-gray-500 mt-1">
            {data.estudiantes.length} estudiante{data.estudiantes.length === 1 ? '' : 's'} inscrito{data.estudiantes.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={filtroModulo}
            onChange={(e) => { setFiltroModulo(e.target.value); setFiltroLeccion('todos'); }}
            className="titi-input"
            aria-label="Filtrar por módulo"
          >
            <option value="todos">Todos los módulos</option>
            {data.modulos.map((m) => (
              <option key={m.id} value={m.id}>{m.titulo}</option>
            ))}
          </select>
          <select
            value={filtroLeccion}
            onChange={(e) => setFiltroLeccion(e.target.value)}
            className="titi-input"
            aria-label="Filtrar por lección"
          >
            <option value="todos">Todas las lecciones</option>
            {data.lecciones
              .filter((l) => filtroModulo === 'todos' || l.moduloId === filtroModulo)
              .filter((l) => l.htmlEvaluable)
              .map((l) => (
                <option key={l.id} value={l.id}>{l.titulo}</option>
              ))}
          </select>
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-600">
            <input type="checkbox" checked={verFinal} onChange={(e) => setVerFinal(e.target.checked)} />
            Solo final
          </label>
          <button type="button" onClick={exportCsv} className="bg-titi-yellow text-titi-dark font-bold text-sm px-4 py-2.5 rounded-xl shadow-[0_4px_0px_#E6B800] hover:shadow-[0_2px_0px_#E6B800] hover:-translate-y-0.5 transition-all duration-150">
            Exportar CSV
          </button>
        </div>
      </header>

      {data.estudiantes.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center text-sm text-gray-500">
          Todavía no hay estudiantes inscritos en este curso.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.06)] overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-gray-100 text-left">
                <th className="px-4 py-3 font-bold text-titi-dark">Estudiante</th>
                <th className="px-4 py-3 font-bold text-titi-dark">Progreso</th>
                <th className="px-4 py-3 font-bold text-titi-dark">Estado</th>
                {filtros.evaluaciones.map((e) => (
                  <th key={e.id} className="px-4 py-3 font-bold text-titi-dark">
                    {e.titulo}
                    <span className="block text-xs font-medium text-gray-400">
                      {e.esFinal ? 'final' : 'módulo'} · mín {e.notaMinima}
                    </span>
                  </th>
                ))}
                {filtros.html.map((l) => (
                  <th key={l.id} className="px-4 py-3 font-bold text-titi-dark">{l.titulo}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.estudiantes.map((est) => (
                <tr key={est.usuario.id} className="border-b border-gray-50 hover:bg-titi-cream">
                  <td className="px-4 py-3">
                    <p className="font-bold text-titi-dark">{est.usuario.nombre}</p>
                    <p className="text-xs text-gray-400">@{est.usuario.username}</p>
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-600">{est.progreso}%</td>
                  <td className="px-4 py-3">
                    {est.completado ? (
                      <span className="text-xs font-bold px-2 py-1 rounded-full bg-green-50 text-green-700 border border-green-200">Completado</span>
                    ) : (
                      <span className="text-xs font-bold px-2 py-1 rounded-full bg-gray-100 text-gray-500 border border-gray-200">En curso</span>
                    )}
                  </td>
                  {filtros.evaluaciones.map((e) => {
                    const nota = est.evaluaciones.find((n) => n.id === e.id);
                    const aprobada = nota?.aprobado;
                    return (
                      <td key={e.id} className="px-4 py-3">
                        {nota?.mejorNota == null ? (
                          <span className="text-gray-300">—</span>
                        ) : (
                          <span className={`font-black tabular-nums ${aprobada ? 'text-green-600' : 'text-red-500'}`}>
                            {nota.mejorNota}
                            {aprobada ? ' ✓' : ' ✗'}
                          </span>
                        )}
                      </td>
                    );
                  })}
                  {filtros.html.map((l) => {
                    const nota = est.html.find((n) => n.leccionId === l.id);
                    return (
                      <td key={l.id} className="px-4 py-3">
                        {nota?.mejorPuntaje == null ? (
                          <span className="text-gray-300">—</span>
                        ) : (
                          <span className="font-black tabular-nums text-titi-dark">{nota.mejorPuntaje}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Cargando() {
  return (
    <div className="max-w-6xl">
      <div className="h-8 w-48 bg-gray-100 rounded animate-pulse mb-6" />
      <div className="h-64 bg-white border border-gray-100 rounded-2xl animate-pulse" />
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 max-w-2xl">
      <span className="w-8 h-8 rounded-full bg-red-500 grid place-items-center shrink-0 text-white text-sm font-black" aria-hidden="true">!</span>
      <div className="flex-1">
        <p className="text-sm font-semibold text-red-700">{message}</p>
        <button type="button" onClick={onRetry} className="text-sm font-bold text-titi-dark hover:text-titi-yellow-dark mt-2">
          Reintentar →
        </button>
      </div>
    </div>
  );
}
