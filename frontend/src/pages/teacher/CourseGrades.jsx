import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ErrorBox } from '../../components/social/StateBlocks.jsx';
import { BackLink, EmptyState, INPUT } from '../../components/ui/v3.jsx';
import { CheckIcon, CloseIcon, FileIcon } from '../../components/icons.jsx';
import client from '../../api/client.js';
import { formatDeadline, isDeadlineExpired } from '../../lib/deadline.js';

export default function CourseGrades() {
  const { id: courseId } = useParams();
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
    const rows = [['Usuario', 'Email', 'Progreso %', 'Completado', ...filtros.evaluaciones.map((e) => e.titulo), ...filtros.html.map((l) => l.titulo)]];
    data.estudiantes.forEach((est) => {
      const notasEval = filtros.evaluaciones.map((e) => {
        const nota = est.evaluaciones.find((n) => n.id === e.id);
        return nota?.mejorNota ?? '';
      });
      const notasHtml = filtros.html.map((l) => {
        const nota = est.html.find((n) => n.leccionId === l.id);
        return nota?.mejorPuntaje ?? '';
      });
      rows.push([est.usuario.username, est.usuario.email || '', est.progreso, est.completado ? 'Si' : 'No', ...notasEval, ...notasHtml]);
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
      <BackLink to="/teacher">Mis cursos</BackLink>
      <header className="flex flex-col gap-3 mb-6">
        <div className="min-w-0">
          <p className="text-sm font-extrabold uppercase tracking-wide text-titi-streak">Notas del curso</p>
          <h1 className="text-3xl sm:text-4xl font-black text-titi-dark leading-tight break-words">{data.curso.titulo}</h1>
          <p className="text-base font-medium text-gray-500 mt-0.5">
            {data.estudiantes.length} estudiante{data.estudiantes.length === 1 ? '' : 's'} inscrito{data.estudiantes.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filtroModulo}
            onChange={(e) => { setFiltroModulo(e.target.value); setFiltroLeccion('todos'); }}
            className={`${INPUT.replace("w-full ", "")} w-full sm:w-auto max-w-full`}
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
            className={`${INPUT.replace("w-full ", "")} w-full sm:w-auto max-w-full`}
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
          <label className="flex items-center gap-2 h-11 px-3 rounded-xl border-2 border-gray-200 bg-white text-sm font-bold text-titi-dark cursor-pointer hover:border-titi-dark transition-colors duration-150">
            <input type="checkbox" checked={verFinal} onChange={(e) => setVerFinal(e.target.checked)} className="h-4 w-4 accent-titi-yellow" />
            Solo final
          </label>
          <button type="button" onClick={exportCsv} className="titi-btn-primary text-sm px-4 sm:ml-auto">
            <FileIcon className="w-4 h-4" />
            Exportar CSV
          </button>
        </div>
      </header>

      {data.estudiantes.length === 0 ? (
        <EmptyState state="pensando" title="Todavía no hay" accent="estudiantes" text="Cuando alguien se inscriba en este curso, sus notas aparecen acá." />
      ) : (
        <div className="bg-white rounded-2xl border-2 border-titi-dark shadow-[0_2px_8px_rgba(0,0,0,0.06)] overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b-2 border-titi-dark bg-titi-cream text-left">
                <th className="px-4 py-3 font-bold text-titi-dark">Usuario</th>
                <th className="px-4 py-3 font-bold text-titi-dark">Progreso</th>
                <th className="px-4 py-3 font-bold text-titi-dark">Estado</th>
                {filtros.evaluaciones.map((e) => (
                  <th key={e.id} className="px-4 py-3 font-bold text-titi-dark">
                    {e.titulo}
                    <span className="block text-xs font-semibold text-gray-500">
                      {e.esFinal ? 'final' : 'módulo'} · mín {e.notaMinima}
                      {e.fechaLimite && ` · ${isDeadlineExpired(e.fechaLimite) ? 'vencida' : `hasta ${formatDeadline(e.fechaLimite)}`}`}
                    </span>
                  </th>
                ))}
                {filtros.html.map((l) => (
                  <th key={l.id} className="px-4 py-3 font-bold text-titi-dark">
                    {l.titulo}
                    {l.fechaLimite && (
                      <span className="block text-xs font-semibold text-gray-500">
                        {isDeadlineExpired(l.fechaLimite) ? 'vencida' : `hasta ${formatDeadline(l.fechaLimite)}`}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.estudiantes.map((est) => (
                <tr key={est.usuario.id} className="border-b border-gray-100 last:border-0 hover:bg-titi-cream transition-colors duration-150">
                  <td className="px-4 py-3">
                    <p className="font-bold text-titi-dark">{est.usuario.username}</p>
                    {est.usuario.email && <p className="text-xs font-medium text-gray-500">{est.usuario.email}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 min-w-[110px]">
                      <span className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden" role="progressbar" aria-valuenow={est.progreso} aria-valuemin={0} aria-valuemax={100} aria-label={`Progreso de ${est.usuario.username}`}>
                        <span className={`block h-full rounded-full ${est.completado ? 'bg-green-500' : 'bg-titi-yellow'}`} style={{ width: `${est.progreso}%` }} />
                      </span>
                      <span className="text-xs font-extrabold tabular-nums text-titi-dark">{est.progreso}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {est.completado ? (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-green-500 text-white border-2 border-titi-dark whitespace-nowrap">Completado</span>
                    ) : (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-white text-titi-dark border-2 border-gray-200 whitespace-nowrap">En curso</span>
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
                          <span className={`inline-flex items-center gap-1 font-black tabular-nums ${aprobada ? 'text-green-600' : 'text-red-500'}`} title={aprobada ? 'Aprobada' : 'No aprobada'}>
                            {nota.mejorNota}
                            {aprobada ? <CheckIcon className="w-3.5 h-3.5" /> : <CloseIcon className="w-3.5 h-3.5" />}
                            <span className="sr-only">{aprobada ? 'aprobada' : 'no aprobada'}</span>
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
      <div className="h-9 w-40 bg-gray-100 rounded-full animate-pulse mb-4" />
      <div className="h-9 w-2/3 bg-gray-100 rounded-full animate-pulse mb-6" />
      <div className="h-64 bg-white border-2 border-gray-200 rounded-2xl animate-pulse" aria-busy="true" aria-label="Cargando notas" />
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="max-w-2xl">
      <ErrorBox title="No pudimos cargar las notas" message={message} onRetry={onRetry} />
    </div>
  );
}
