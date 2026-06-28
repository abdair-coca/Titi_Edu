import { useCallback, useEffect, useState } from 'react';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useGamification } from '../context/GamificationContext.jsx';
import { GotaIcon } from './icons.jsx';

/**
 * DailyMissions — panel con las 3 misiones diarias del usuario y su progreso.
 * Se refresca cuando cambian las gotas totales (una ganancia puede haber hecho
 * avanzar una misión). Pensado para el Feed.
 */
export default function DailyMissions() {
  const { isAuthenticated } = useAuth();
  const { gotas } = useGamification();
  const [misiones, setMisiones] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMisiones = useCallback(async () => {
    if (!isAuthenticated) return;
    setError(null);
    try {
      const { data } = await client.get('/api/missions/today');
      if (data?.success) setMisiones(data.data.misiones);
      else setError(data?.message || 'No se pudieron cargar las misiones');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error de red');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Carga inicial + re-fetch cuando suben las gotas totales (posible avance).
  useEffect(() => {
    fetchMisiones();
  }, [fetchMisiones, gotas.total]);

  if (!isAuthenticated) return null;

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-titi-dark">Misiones de hoy</h2>
        <span className="text-xs font-semibold text-gray-400">
          Se renuevan cada día
        </span>
      </div>

      {loading && !misiones ? (
        <div className="space-y-3 animate-pulse">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 bg-gray-100 rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <div className="flex items-center justify-between gap-3 bg-red-50 border border-red-200 rounded-xl p-3">
          <p className="text-xs text-red-600">{error}</p>
          <button
            type="button"
            onClick={fetchMisiones}
            className="text-xs font-bold text-titi-dark hover:text-titi-yellow-dark shrink-0"
          >
            Reintentar →
          </button>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {(misiones || []).map((m) => (
            <MissionRow key={m.id} mission={m} />
          ))}
        </ul>
      )}
    </section>
  );
}

function MissionRow({ mission }) {
  const { titulo, descripcion, meta, progreso, recompensa, completada } = mission;
  const pct = meta > 0 ? Math.min(100, Math.round((progreso / meta) * 100)) : 0;

  return (
    <li
      className={`rounded-xl border p-3 transition-colors ${
        completada
          ? 'bg-titi-yellow-light border-titi-yellow'
          : 'bg-titi-cream border-gray-100'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-titi-dark truncate">{titulo}</p>
          <p className="text-xs text-gray-500 truncate">{descripcion}</p>
        </div>
        <span
          className={`inline-flex items-center gap-1 text-sm font-black tabular-nums shrink-0 ${
            completada ? 'text-titi-yellow-dark' : 'text-gray-400'
          }`}
        >
          <GotaIcon className="w-4 h-4" />+{recompensa}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <div className="flex-1 h-2 rounded-full bg-white overflow-hidden border border-gray-100">
          <div
            className={`h-full rounded-full transition-[width] duration-300 ${
              completada ? 'bg-titi-yellow-dark' : 'bg-titi-yellow'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[11px] font-bold text-gray-400 tabular-nums shrink-0">
          {completada ? '¡Listo!' : `${progreso}/${meta}`}
        </span>
      </div>
    </li>
  );
}
