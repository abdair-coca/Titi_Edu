import { useCallback, useEffect, useState } from 'react';
import client from '../api/client.js';
import { formatDate } from '../lib/format.js';
import { useStaggerReveal } from '../lib/motion.js';
import { ErrorBox } from './social/StateBlocks.jsx';
import { PanelTitle, ProgressBar, SURFACE } from './ui/v3.jsx';
import { AwardIcon, BooksIcon, CheckIcon, FireIcon, GraduationIcon, LockIcon, UsersIcon } from './icons.jsx';

// Ícono por tipo de logro. El emoji de `logro.icono` (dato) no se muestra
// (design.md §5.6): la emoción la pone el color del rol.
const TYPE_ICON = {
  curso: GraduationIcon,
  racha: FireIcon,
  evaluacion: CheckIcon,
  social: UsersIcon,
};
function logroIcon(logro) {
  if (logro.tipo === 'curso' && /lecci/i.test(logro.nombre || '')) return BooksIcon;
  return TYPE_ICON[logro.tipo] || AwardIcon;
}

/**
 * AchievementsSection — logros de un usuario (superficie v3, rediseno-plataforma-v3 R1).
 * Desbloqueados en púrpura sólido, bloqueados en gris con candado.
 * Público (GET /api/progress/:username/achievements).
 */
export default function AchievementsSection({ username, isSelf = false, className = '' }) {
  const [logros, setLogros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    if (!username) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await client.get(`/api/progress/${username}/achievements`);
      if (data?.success) setLogros(data.data?.logros || []);
      else setError(data?.message || 'No se pudieron cargar los logros');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error de red');
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  // Desbloqueados primero (los más recientes arriba), después los que faltan.
  const ordered = [...logros].sort((a, b) => {
    if (a.desbloqueado !== b.desbloqueado) return a.desbloqueado ? -1 : 1;
    return new Date(b.fechaObtenido || 0) - new Date(a.fechaObtenido || 0);
  });
  const desbloqueados = logros.filter((l) => l.desbloqueado).length;
  const gridRef = useStaggerReveal([logros.length]);

  return (
    <section aria-label="Logros" className={`${SURFACE} p-4 ${className}`}>
      <PanelTitle Icon={AwardIcon} solid="bg-titi-achievement" title="Logros" accent={isSelf ? 'tuyos' : null}>
        {!loading && !error && logros.length > 0 && (
          <span className="text-sm font-black text-titi-achievement tabular-nums">
            {desbloqueados}/{logros.length}
          </span>
        )}
      </PanelTitle>

      {!loading && !error && logros.length > 0 && (
        <ProgressBar
          value={desbloqueados}
          max={logros.length}
          color="bg-titi-achievement"
          track="bg-purple-100"
          height="h-2"
          label="Logros desbloqueados"
          className="mb-3"
        />
      )}

      {loading ? (
        <div className="flex gap-2 overflow-hidden lg:grid lg:grid-cols-2 animate-pulse motion-reduce:animate-none" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="w-36 shrink-0 lg:w-auto h-[104px] rounded-xl border-2 border-gray-100 p-2.5 flex flex-col gap-2">
              <div className="w-9 h-9 rounded-xl bg-gray-100" />
              <div className="h-3 w-3/4 bg-gray-100 rounded-full" />
              <div className="h-2.5 w-1/2 bg-gray-100 rounded-full" />
            </div>
          ))}
        </div>
      ) : error ? (
        <ErrorBox title="No pudimos cargar los logros" message={error} onRetry={fetch} />
      ) : logros.length === 0 ? (
        <p className="text-sm font-medium text-gray-500">Todavía no hay logros disponibles.</p>
      ) : (
        <ul ref={gridRef} className="flex gap-2 overflow-x-auto snap-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-4 px-4 pb-1 lg:mx-0 lg:px-0 lg:pb-0 lg:grid lg:grid-cols-2 lg:overflow-visible">
          {ordered.map((l) => {
            const Icon = logroIcon(l);
            return (
              <li
                key={l.id}
                title={l.desbloqueado ? `${l.descripcion}${l.fechaObtenido ? ` · ${formatDate(l.fechaObtenido)}` : ''}` : l.condicion}
                className={`group w-36 shrink-0 snap-start lg:w-auto flex flex-col items-start gap-1.5 p-2.5 rounded-xl border-2 ${
                  l.desbloqueado ? 'bg-purple-100 border-titi-dark' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <span
                  className={`w-9 h-9 rounded-xl border-2 grid place-items-center -rotate-6 transition-transform duration-200 group-hover:rotate-0 motion-reduce:transition-none ${
                    l.desbloqueado ? 'bg-titi-achievement border-titi-dark text-white' : 'bg-gray-200 border-gray-300 text-gray-500'
                  }`}
                  aria-hidden="true"
                >
                  {l.desbloqueado ? <Icon className="w-5 h-5" /> : <LockIcon className="w-4 h-4" />}
                </span>
                <p className={`text-sm font-extrabold leading-tight ${l.desbloqueado ? 'text-titi-dark' : 'text-gray-500'}`}>{l.nombre}</p>
                <p className={`text-xs font-semibold leading-snug line-clamp-2 ${l.desbloqueado ? 'text-titi-achievement' : 'text-gray-500'}`}>
                  {l.desbloqueado ? (l.fechaObtenido ? formatDate(l.fechaObtenido) : 'Desbloqueado') : isSelf ? l.condicion : 'Bloqueado'}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
