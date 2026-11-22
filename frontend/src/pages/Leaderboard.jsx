import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCountUp, useStaggerReveal } from '../lib/motion.js';
import Avatar from '../components/social/Avatar.jsx';
import { ErrorBox, SectionHeading } from '../components/social/StateBlocks.jsx';
import { DARK_PANEL, DARK_TILE, EmptyState, PageHeader, PanelTitle, SURFACE } from '../components/ui/v3.jsx';
import { BoltIcon, BooksIcon, CalendarIcon, CheckIcon, ClockIcon, GotaIcon, MedalIcon, UsersIcon } from '../components/icons.jsx';

// Ranking v3 (rediseno-plataforma-v3 R6): podio del top 3, filas de
// superficie, tu fila en amarillo; rail con la temporada y cómo sumar gotas.

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

  const podio = tabla.length >= 3 ? tabla.slice(0, 3) : [];
  const resto = podio.length ? visible.slice(3) : visible;

  return (
    <div className="max-w-6xl mx-auto lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6 lg:items-start">
      <div className="min-w-0">
        <PageHeader title="Ranking" accent="semanal" subtitle="Gotas de la semana entre vos y la gente que seguís." />

        <div className="lg:hidden mb-6">
          <SeasonCard />
        </div>

        {loading ? (
          <ul className="space-y-3 animate-pulse motion-reduce:animate-none" aria-busy="true" aria-label="Cargando ranking">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="flex items-center gap-3 p-3 sm:p-4 rounded-2xl border-2 border-gray-200 bg-white">
                <span className="w-8 h-6 bg-gray-100 rounded-full" />
                <span className="w-9 h-9 rounded-full bg-gray-100" />
                <span className="flex-1 h-3 bg-gray-100 rounded-full" />
                <span className="w-14 h-4 bg-gray-100 rounded-full" />
              </li>
            ))}
          </ul>
        ) : error ? (
          <ErrorBox title="No pudimos cargar el ranking" message={error} onRetry={fetchRanking} />
        ) : tabla.length <= 1 ? (
          <EmptyState
            state="pensando"
            title="Todavía no hay con quién"
            accent="competir"
            text="Seguí a tus compañeros para ver quién junta más gotas esta semana."
          >
            <button type="button" onClick={() => navigate('/explore')} className="titi-btn-primary">
              Buscar gente en Explorar
            </button>
          </EmptyState>
        ) : (
          <>
            {podio.length > 0 && <Podium filas={podio} />}

            <SectionHeading title={`Top ${Math.min(tabla.length, TOP_VISIBLE)} de la`} accent="semana">
              {showToggle && (
                <button
                  type="button"
                  onClick={() => setExpanded((e) => !e)}
                  aria-expanded={expanded}
                  className="text-sm font-bold text-blue-500 hover:text-blue-600 uppercase tracking-wide transition-all duration-150 active:scale-95 whitespace-nowrap"
                >
                  {expanded ? 'Ver menos' : 'Ver todos'}
                </button>
              )}
            </SectionHeading>
            {miPosicion > 0 && (
              <p className="text-sm font-semibold text-gray-500 -mt-2 mb-3">
                Vas en el puesto <span className="text-titi-dark font-extrabold">#{miPosicion}</span> de {tabla.length}.
              </p>
            )}

            <ul ref={listRef} className="space-y-2.5">
              {resto.map((fila, i) => (
                <RankRow key={fila.usuarioId} fila={fila} puesto={i + 1 + (podio.length ? 3 : 0)} />
              ))}
            </ul>

            <BottomBanner onExplore={() => navigate('/courses')} />
          </>
        )}
      </div>

      {/* Rail (solo desktop) */}
      <aside className="hidden lg:flex flex-col gap-5 sticky top-8">
        <SeasonCard />
        <WaysPanel />
      </aside>
    </div>
  );
}

// ---- Temporada semanal: panel oscuro con cuenta regresiva ----
function SeasonCard() {
  const { dias, horas } = tiempoHastaLunes();
  return (
    <section aria-label="Temporada semanal" className={`${DARK_PANEL} p-4`}>
      <div className="flex items-center gap-3 mb-3">
        <span className="w-10 h-10 rounded-xl bg-titi-yellow text-titi-dark grid place-items-center -rotate-6 shrink-0" aria-hidden="true">
          <CalendarIcon className="w-5 h-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold text-titi-cream leading-tight">
            Temporada <span className="text-titi-yellow">semanal</span>
          </h2>
          <p className="text-sm font-medium text-white/60">Se reinicia cada lunes.</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className={`${DARK_TILE} p-3`}>
          <p className="text-2xl font-black text-titi-cream tabular-nums leading-none">{dias}</p>
          <p className="text-xs font-bold text-white/60 mt-1">{dias === 1 ? 'día' : 'días'}</p>
        </div>
        <div className={`${DARK_TILE} p-3`}>
          <p className="text-2xl font-black text-titi-cream tabular-nums leading-none">{horas}</p>
          <p className="text-xs font-bold text-white/60 mt-1">{horas === 1 ? 'hora' : 'horas'}</p>
        </div>
      </div>
      <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-titi-yellow">
        <ClockIcon className="w-4 h-4" />
        Para que termine la semana
      </p>
    </section>
  );
}

const WAYS = [
  { Icon: BooksIcon, solid: 'bg-green-500', text: 'Completá lecciones' },
  { Icon: CheckIcon, solid: 'bg-titi-achievement', text: 'Aprobá evaluaciones' },
  { Icon: BoltIcon, solid: 'bg-titi-streak', text: 'Cumplí los desafíos del día' },
  { Icon: UsersIcon, solid: 'bg-blue-500', text: 'Publicá y seguí gente' },
];

function WaysPanel() {
  return (
    <section aria-label="Cómo sumar gotas" className={`${SURFACE} p-4`}>
      <PanelTitle Icon={GotaIcon} solid="bg-titi-yellow" title="Cómo sumar" accent="gotas" />
      <ul>
        {WAYS.map(({ Icon, solid, text }) => (
          <li key={text} className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0">
            <span className={`w-8 h-8 rounded-full grid place-items-center text-white shrink-0 ${solid}`} aria-hidden="true">
              <Icon className="w-4 h-4" />
            </span>
            <span className="text-sm font-bold text-titi-dark">{text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Medallas planas para el top 3: oro (amarillo), plata (gris), bronce (streak).
const MEDALS = {
  1: { solid: 'bg-titi-yellow text-titi-dark', base: 'h-28 sm:h-32', label: 'Oro' },
  2: { solid: 'bg-gray-300 text-titi-dark', base: 'h-20 sm:h-24', label: 'Plata' },
  3: { solid: 'bg-titi-streak text-white', base: 'h-16 sm:h-20', label: 'Bronce' },
};

// ---- Podio: 2 · 1 · 3 ----
function Podium({ filas }) {
  const order = [filas[1], filas[0], filas[2]];
  const ref = useStaggerReveal([filas.length]);
  return (
    <section aria-label="Podio de la semana" className={`${SURFACE} px-3 sm:px-6 pt-5 pb-0 mb-6 overflow-hidden`}>
      <ol ref={ref} className="grid grid-cols-3 gap-2 sm:gap-4 items-end">
        {order.map((fila) => {
          const puesto = filas.indexOf(fila) + 1;
          return <PodiumSpot key={fila.usuarioId} fila={fila} puesto={puesto} />;
        })}
      </ol>
    </section>
  );
}

function PodiumSpot({ fila, puesto }) {
  const medal = MEDALS[puesto];
  const gotas = useCountUp(fila.gotasSemana);
  return (
    <li className="flex flex-col items-center text-center min-w-0">
      <div className="relative mb-2">
        <Avatar username={fila.username} size={puesto === 1 ? 'lg' : 'md'} className={fila.esYo ? 'ring-4 ring-titi-yellow' : ''} />
        <span
          className={`absolute -bottom-2 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full border-2 border-titi-dark grid place-items-center text-xs font-black tabular-nums ${medal.solid}`}
          title={`Medalla de ${medal.label.toLowerCase()}`}
        >
          {puesto}
        </span>
      </div>
      <p className="mt-1 max-w-full text-sm font-extrabold text-titi-dark truncate">
        {fila.esYo ? 'Vos' : `@${fila.username}`}
      </p>
      <p className="inline-flex items-center gap-1 text-sm font-black text-titi-yellow-dark tabular-nums">
        <GotaIcon className="w-4 h-4" />
        {gotas}
      </p>
      <div className={`mt-2 w-full ${medal.base} rounded-t-xl border-2 border-b-0 border-titi-dark grid place-items-start justify-center pt-2 ${medal.solid}`}>
        <MedalIcon className="w-6 h-6" />
      </div>
    </li>
  );
}

function RankRow({ fila, puesto }) {
  const { username, gotasSemana, esYo } = fila;
  const gotas = useCountUp(gotasSemana);
  return (
    <li
      className={`flex items-center gap-3 rounded-2xl border-2 p-3 sm:p-4 ${
        esYo ? 'bg-titi-yellow-light border-titi-dark shadow-[0_3px_0_#1A1A2E]' : 'bg-white border-gray-200'
      }`}
    >
      <span className="w-8 text-center text-lg font-black text-gray-500 tabular-nums shrink-0">{puesto}</span>
      <Avatar username={username} size="sm" />
      <p className="min-w-0 flex-1 flex items-center gap-2 font-extrabold text-titi-dark">
        <span className="truncate">@{username}</span>
        {esYo && (
          <span className="bg-titi-yellow text-titi-dark text-xs font-extrabold px-2 py-0.5 rounded-full border-2 border-titi-dark shrink-0">Vos</span>
        )}
      </p>
      <span className="inline-flex items-center gap-1 text-titi-yellow-dark font-black tabular-nums shrink-0">
        <GotaIcon className="w-4 h-4" />
        {gotas}
      </span>
    </li>
  );
}

// ---- Banner de cierre: panel oscuro con CTA ----
function BottomBanner({ onExplore }) {
  return (
    <section className={`mt-6 ${DARK_PANEL} p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-4`}>
      <span className="w-12 h-12 rounded-xl bg-titi-yellow text-titi-dark grid place-items-center shrink-0 -rotate-6" aria-hidden="true">
        <GotaIcon className="w-6 h-6" />
      </span>
      <div className="min-w-0 flex-1 text-center sm:text-left">
        <h3 className="text-lg font-extrabold text-titi-cream">
          ¡Seguí sumando <span className="text-titi-yellow">gotas</span>!
        </h3>
        <p className="text-sm font-medium text-white/60">Completá lecciones y desafíos para subir en el ranking.</p>
      </div>
      <button type="button" onClick={onExplore} className="titi-btn-primary text-sm px-5 whitespace-nowrap">
        Explorar cursos
      </button>
    </section>
  );
}
