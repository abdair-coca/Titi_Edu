import { useCallback, useEffect, useState } from 'react';
import client from '../api/client.js';
import { formatDate } from '../lib/format.js';
import { useStaggerReveal } from '../lib/motion.js';
import { AwardIcon } from './icons.jsx';

/**
 * AchievementsSection — grid de logros de un usuario para la página de perfil.
 * Desbloqueados a color, bloqueados en gris. Público (GET /api/progress/:username/achievements).
 */
export default function AchievementsSection({ username, isSelf = false }) {
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

  const desbloqueados = logros.filter((l) => l.desbloqueado).length;

  const gridRef = useStaggerReveal([logros.length]);

  return (
    <section aria-label="Logros" className="titi-card p-4 sm:p-6 mb-6">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h2 className="text-base sm:text-lg font-bold text-titi-dark flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-titi-achievement grid place-items-center shrink-0" aria-hidden="true">
            <AwardIcon className="w-4 h-4 text-white" />
          </span>
          Logros
        </h2>
        {!loading && !error && (
          <span className="text-xs font-extrabold text-titi-achievement bg-purple-50 px-3 py-1 rounded-full tabular-nums">
            {desbloqueados} / {logros.length}
          </span>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-red-700">{error}</p>
          <button
            type="button"
            onClick={fetch}
            className="text-sm font-bold text-titi-dark hover:text-titi-yellow-dark shrink-0"
          >
            Reintentar
          </button>
        </div>
      ) : logros.length === 0 ? (
        <p className="text-sm text-gray-400 font-medium">
          Todavía no hay logros disponibles.
        </p>
      ) : (
        <div ref={gridRef} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
          {logros.map((l) => (
            <div
              key={l.id}
              title={
                l.desbloqueado
                  ? `${l.descripcion}${l.fechaObtenido ? ` · ${formatDate(l.fechaObtenido)}` : ''}`
                  : l.condicion
              }
              className={`rounded-xl border p-2 sm:p-3 text-center transition-colors duration-150 ${
                l.desbloqueado
                  ? 'bg-purple-50 border-purple-200 shadow-[0_2px_8px_rgba(0,0,0,0.06)]'
                  : 'bg-gray-50 border-gray-200 opacity-60 grayscale'
              }`}
            >
              <span className="text-2xl sm:text-3xl block select-none" aria-hidden="true">
                {l.icono}
              </span>
              <p className="text-[11px] sm:text-xs font-bold text-titi-dark mt-1 sm:mt-1.5 leading-tight">
                {l.nombre}
              </p>
              {l.desbloqueado ? (
                <p className="text-[10px] font-semibold text-titi-achievement mt-0.5">
                  {l.fechaObtenido ? formatDate(l.fechaObtenido) : 'Desbloqueado'}
                </p>
              ) : (
                <p className="text-[10px] font-semibold text-gray-400 mt-0.5 line-clamp-2">
                  {isSelf ? l.condicion : 'Bloqueado'}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
