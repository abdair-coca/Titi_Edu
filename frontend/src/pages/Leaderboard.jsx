import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useStaggerReveal } from '../lib/motion.js';
import TitiMascot from '../components/TitiMascot.jsx';
import {
  GotaIcon,
  TrophyIcon,
  CalendarIcon,
  ClockIcon,
} from '../components/icons.jsx';

// Cuántas filas se ven antes de "Ver todos".
const TOP_VISIBLE = 10;

// Tiempo restante hasta el próximo lunes a las 00:00 (reset del ranking).
function tiempoHastaLunes() {
  const now = new Date();
  const next = new Date(now);
  const daysToMonday = (8 - now.getDay()) % 7 || 7;
  next.setDate(now.getDate() + daysToMonday);
  next.setHours(0, 0, 0, 0);
  const ms = next - now;
  const dias = Math.floor(ms / 86400000);
  const horas = Math.floor((ms % 86400000) / 3600000);
  return { dias, horas };
}

/**
 * Leaderboard — ranking semanal de gotas entre amigos (gente que sigo).
 * Solo amigos, nunca extraños. Mi fila queda resaltada.
 */
export default function Leaderboard() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [tabla, setTabla] = useState([]);
  const [miPosicion, setMiPosicion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);

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

  const showToggle = tabla.length > TOP_VISIBLE;
  const visible = expanded ? tabla : tabla.slice(0, TOP_VISIBLE);
  const listRef = useStaggerReveal([visible.length, expanded]);

  return (
    <div className="max-w-2xl mx-auto">
      <header className="mb-5">
        <h1 className="text-3xl sm:text-4xl font-black text-titi-dark">Ranking semanal</h1>
        <p className="text-base font-medium text-gray-500 mt-1">
          Gotas de la semana entre vos y la gente que seguís.
        </p>
      </header>

      <SeasonCard />

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
            className="text-sm font-bold text-titi-dark hover:text-titi-yellow-dark active:scale-95 transition-all duration-150 shrink-0"
          >
            Reintentar →
          </button>
        </div>
      ) : tabla.length <= 1 ? (
        <div className="flex flex-col items-center justify-center py-10 px-8 text-center">
          <TitiMascot state="idle" size="lg" message="" />
          <h3 className="text-xl font-bold text-titi-dark mt-4 mb-2">
            Aún no hay con quién competir
          </h3>
          <p className="text-base font-medium text-gray-500 max-w-xs">
            Seguí a tus compañeros para ver quién junta más gotas esta semana.
          </p>
        </div>
      ) : (
        <>
          {/* Top de la semana */}
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-xl sm:text-2xl font-extrabold text-titi-dark">
              Top {Math.min(tabla.length, TOP_VISIBLE)} de la semana
            </h2>
            {showToggle && (
              <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                className="text-sm font-bold text-blue-500 hover:text-blue-600 uppercase tracking-wide transition-all duration-150 active:scale-95 whitespace-nowrap"
              >
                {expanded ? 'Ver menos' : 'Ver todos'}
              </button>
            )}
          </div>
          {miPosicion > 0 && (
            <p className="text-sm font-semibold text-gray-500 mb-3">
              Vas en el puesto{' '}
              <span className="text-titi-dark font-extrabold">#{miPosicion}</span> de{' '}
              {tabla.length}.
            </p>
          )}

          {/* Encabezados de columna (mockup) */}
          <div className="flex items-center gap-3 px-3 sm:px-4 mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
            <span className="w-8 text-center shrink-0">Pos.</span>
            <span>Usuario</span>
            <span className="ml-auto">Gotas semanales</span>
          </div>

          <ul ref={listRef} className="space-y-2">
            {visible.map((fila, i) => (
              <RankRow key={fila.usuarioId} fila={fila} puesto={i + 1} />
            ))}
          </ul>

          <BottomBanner onExplore={() => navigate('/courses')} />
        </>
      )}
    </div>
  );
}

// ---- Card de temporada: reset semanal + cuenta regresiva ----
function SeasonCard() {
  const { dias, horas } = tiempoHastaLunes();
  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-4 sm:p-5 mb-6 flex items-center gap-4">
      <span className="w-12 h-12 rounded-xl bg-titi-yellow shadow-sm grid place-items-center shrink-0">
        <CalendarIcon className="w-6 h-6 text-titi-dark" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-lg font-bold text-titi-dark leading-tight">Temporada semanal</h2>
        <p className="text-sm font-medium text-gray-500">
          Los rankings se reinician cada lunes.
        </p>
        <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-bold text-titi-yellow-dark">
          <ClockIcon className="w-4 h-4" />
          Termina en {dias} {dias === 1 ? 'día' : 'días'}, {horas}{' '}
          {horas === 1 ? 'hora' : 'horas'}
        </p>
      </div>
      <span className="hidden sm:grid w-14 h-14 rounded-full bg-titi-yellow-light place-items-center shrink-0">
        <TrophyIcon className="w-8 h-8 text-titi-certificate" />
      </span>
    </section>
  );
}

// Medallas planas para el top 3: oro (amarillo), plata (gris), bronce (streak).
const MEDAL_TINTS = {
  1: 'bg-titi-yellow text-titi-dark',
  2: 'bg-gray-300 text-titi-dark',
  3: 'bg-titi-streak text-white',
};

function RankRow({ fila, puesto }) {
  const { username, gotasSemana, esYo } = fila;
  const medal = MEDAL_TINTS[puesto];
  return (
    <li
      className={`flex items-center gap-3 rounded-2xl border p-3 sm:p-4 transition-colors ${
        esYo ? 'bg-titi-yellow-light border-titi-yellow' : 'bg-white border-gray-100'
      }`}
    >
      {medal ? (
        <span
          className={`w-8 h-8 rounded-full grid place-items-center text-sm font-black tabular-nums shadow-sm shrink-0 ${medal}`}
        >
          {puesto}
        </span>
      ) : (
        <span className="w-8 text-center text-lg font-black text-gray-500 tabular-nums shrink-0">
          {puesto}
        </span>
      )}
      <div className="w-9 h-9 rounded-full bg-titi-yellow text-titi-dark grid place-items-center font-extrabold shrink-0">
        {username?.[0]?.toUpperCase() ?? '?'}
      </div>
      <p className="min-w-0 flex-1 flex items-center gap-2 font-bold text-titi-dark truncate">
        @{username}
        {esYo && (
          <span className="bg-titi-yellow text-titi-dark text-xs font-bold px-2 py-0.5 rounded-full shrink-0">
            Vos
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

// ---- Banner de cierre: CTA a seguir sumando gotas ----
function BottomBanner({ onExplore }) {
  return (
    <section className="mt-6 bg-titi-yellow-light border border-titi-yellow/40 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-4">
      <span className="w-10 h-10 rounded-full bg-titi-yellow shadow-sm grid place-items-center shrink-0">
        <GotaIcon className="w-5 h-5 text-titi-dark" />
      </span>
      <div className="min-w-0 flex-1 text-center sm:text-left">
        <h3 className="text-lg font-bold text-titi-dark">¡Sigue sumando gotas!</h3>
        <p className="text-sm font-medium text-gray-500">
          Completá lecciones y desafíos para subir en el ranking la próxima semana.
        </p>
      </div>
      <button
        type="button"
        onClick={onExplore}
        className="bg-titi-yellow text-titi-dark font-bold text-sm px-4 py-2.5 rounded-xl shadow-[0_4px_0px_#E6B800] hover:shadow-[0_2px_0px_#E6B800] hover:-translate-y-0.5 active:shadow-none active:translate-y-0 transition-all duration-150 whitespace-nowrap"
      >
        Explorar cursos
      </button>
    </section>
  );
}
