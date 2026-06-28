import { useCallback, useEffect, useState } from 'react';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import TitiMascot from '../components/TitiMascot.jsx';
import { GotaIcon } from '../components/icons.jsx';

/**
 * Leaderboard — ranking semanal de gotas entre amigos (gente que sigo).
 * Solo amigos, nunca extraños. Mi fila queda resaltada.
 */
export default function Leaderboard() {
  const { isAuthenticated } = useAuth();
  const [tabla, setTabla] = useState([]);
  const [miPosicion, setMiPosicion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRanking = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await client.get('/api/ranking/friends');
      if (data?.success) {
        setTabla(data.data.tabla || []);
        setMiPosicion(data.data.miPosicion || 0);
      } else {
        setError(data?.message || 'No se pudo cargar el ranking');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error de red');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchRanking();
  }, [fetchRanking]);

  return (
    <div className="max-w-2xl mx-auto">
      <header className="mb-5">
        <h1 className="text-3xl font-extrabold text-titi-dark">Ranking semanal</h1>
        <p className="text-sm font-medium text-gray-500 mt-1">
          Gotas de la semana entre vos y la gente que seguís. Se reinicia cada lunes.
        </p>
      </header>

      {loading ? (
        <ul className="space-y-2 animate-pulse">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="h-16 bg-gray-100 rounded-2xl" />
          ))}
        </ul>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between gap-3">
          <p className="text-sm text-red-600">{error}</p>
          <button
            type="button"
            onClick={fetchRanking}
            className="text-sm font-bold text-titi-dark hover:text-titi-yellow-dark shrink-0"
          >
            Reintentar →
          </button>
        </div>
      ) : tabla.length <= 1 ? (
        <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
          <TitiMascot state="idle" size="lg" message="" />
          <h3 className="text-xl font-bold text-titi-dark mt-4 mb-2">
            Aún no hay con quién competir
          </h3>
          <p className="text-sm text-gray-400 max-w-xs">
            Seguí a tus compañeros para ver quién junta más gotas esta semana.
          </p>
        </div>
      ) : (
        <>
          {miPosicion > 0 && (
            <p className="text-sm font-semibold text-gray-500 mb-3">
              Vas en el puesto{' '}
              <span className="text-titi-dark font-extrabold">#{miPosicion}</span>{' '}
              de {tabla.length}.
            </p>
          )}
          <ul className="space-y-2">
            {tabla.map((fila, i) => (
              <RankRow key={fila.usuarioId} fila={fila} puesto={i + 1} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

const MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' };

function RankRow({ fila, puesto }) {
  const { username, gotasSemana, esYo } = fila;
  return (
    <li
      className={`flex items-center gap-3 rounded-2xl border p-3 sm:p-4 transition-colors ${
        esYo
          ? 'bg-titi-yellow-light border-titi-yellow'
          : 'bg-white border-gray-100'
      }`}
    >
      <span className="w-8 text-center text-lg font-black text-titi-dark tabular-nums shrink-0">
        {MEDALS[puesto] || puesto}
      </span>
      <div className="w-9 h-9 rounded-full bg-titi-yellow text-titi-dark grid place-items-center font-extrabold shrink-0">
        {username?.[0]?.toUpperCase() ?? '?'}
      </div>
      <p className="min-w-0 flex-1 font-bold text-titi-dark truncate">
        @{username}
        {esYo && (
          <span className="ml-2 text-xs font-semibold text-titi-yellow-dark">
            (vos)
          </span>
        )}
      </p>
      <span className="inline-flex items-center gap-1 text-titi-yellow-dark font-black tabular-nums shrink-0">
        <GotaIcon className="w-4 h-4" />
        {gotasSemana}
      </span>
    </li>
  );
}
