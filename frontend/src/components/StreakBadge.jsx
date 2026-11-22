import { useCountUp } from '../lib/motion.js';
import { ProgressBar } from './ui/v3.jsx';
import { CheckIcon, ClockIcon } from './icons.jsx';

/**
 * StreakBadge — muestra la racha del usuario con estética Titi.
 *
 * Variantes:
 *  - "sidebar"  → bloque oscuro para el sidebar dark, con progreso a la próxima meta
 *  - "hero"     → tarjeta cálida grande para el perfil, con metas e hitos
 *  - "inline"   → píldora compacta para meterse en cualquier card
 *
 * Estados (derivados de racha + ultimaActividad):
 *  - hoy      → ya estudió hoy, llama encendida + chip verde
 *  - riesgo   → la última actividad fue ayer: hoy debe estudiar o la pierde
 *  - apagada  → pasó más de un día, la racha se va a reiniciar
 *  - rota     → racha === 0
 */
export default function StreakBadge({
  racha = 0,
  estaActiva = true,
  ultimaActividad = null,
  isSelf = true,
  variant = 'inline',
  className = '',
}) {
  const estado = getEstado(racha, estaActiva, ultimaActividad);

  if (variant === 'sidebar') {
    return <SidebarVariant racha={racha} estado={estado} className={className} />;
  }
  if (variant === 'hero') {
    return <HeroVariant racha={racha} estado={estado} isSelf={isSelf} className={className} />;
  }
  return <InlineVariant racha={racha} estado={estado} className={className} />;
}

// ---- Estado de la racha ----

function isSameLocalDay(a, b) {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

function getEstado(racha, estaActiva, ultimaActividad) {
  if (!racha) return 'rota';
  if (ultimaActividad) {
    const hoy = new Date();
    if (isSameLocalDay(ultimaActividad, hoy)) return 'hoy';
    const ayer = new Date(hoy);
    ayer.setDate(hoy.getDate() - 1);
    if (isSameLocalDay(ultimaActividad, ayer)) return 'riesgo';
    return 'apagada';
  }
  return estaActiva ? 'hoy' : 'apagada';
}

// ---- Metas (alineadas con los logros de racha: 7 y 30 días) ----

const METAS = [7, 30, 100, 365].map((dias) => ({ dias }));

function nextMeta(racha) {
  const next = METAS.find((m) => racha < m.dias) || null;
  const idx = next ? METAS.indexOf(next) : -1;
  const prev = idx > 0 ? METAS[idx - 1].dias : 0;
  return { next, prev };
}

function metaProgress(racha) {
  const { next, prev } = nextMeta(racha);
  if (!next) return { next: null, prev, pct: 100 };
  const pct = Math.max(0, Math.min(100, Math.round(((racha - prev) / (next.dias - prev)) * 100)));
  return { next, prev, pct };
}

// ---- Llama animada SVG ----

export function FlameIcon({ size = 24, dim = false, animated = true }) {
  const id = `${size}-${dim ? 'dim' : 'lit'}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={animated && !dim ? 'titi-flame-flicker' : ''}
    >
      <defs>
        <linearGradient id={`flame-outer-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={dim ? '#9CA3AF' : '#FF9A3C'} />
          <stop offset="55%" stopColor={dim ? '#6B7280' : '#FF6B35'} />
          <stop offset="100%" stopColor={dim ? '#4B5563' : '#D9480F'} />
        </linearGradient>
        <linearGradient id={`flame-inner-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={dim ? '#E5E7EB' : '#FFE08A'} />
          <stop offset="100%" stopColor={dim ? '#9CA3AF' : '#FFD93D'} />
        </linearGradient>
      </defs>
      {/* Cuerpo principal */}
      <path
        d="M12 2c.6 3.4 3.5 4.8 3.5 8.5 0 1.6-.6 2.8-1.5 3.6.4-1.5.1-3-1-4.3 0 2.2-1 3.6-2 4.5-1.8 1.6-2.5 3.3-2.5 5 0 3.3 2.5 4.7 5.5 4.7s5.5-1.4 5.5-4.7c0-5.6-7.5-7.4-7.5-17.3z"
        fill={`url(#flame-outer-${id})`}
      />
      {/* Lengua interior */}
      <path
        d="M12 11c0 1.8-.7 2.8-1.4 3.7-.8 1-1.3 2-1.3 3.3 0 1.9 1.4 2.8 2.7 2.8s2.7-.9 2.7-2.8c0-2.4-2.7-3.8-2.7-7z"
        fill={`url(#flame-inner-${id})`}
      />
    </svg>
  );
}

// ---- Chip de estado del día ----

function EstadoChip({ estado, isSelf }) {
  const base = 'inline-flex items-center gap-1.5 h-7 pl-1 pr-2.5 rounded-full border-2 text-xs font-extrabold';
  if (estado === 'hoy') {
    return (
      <span className={`${base} bg-white border-titi-dark text-titi-dark`}>
        <span className="w-5 h-5 rounded-full bg-green-500 text-white grid place-items-center">
          <CheckIcon className="w-3 h-3" />
        </span>
        {isSelf ? 'Hoy ya sumaste' : 'Activa hoy'}
      </span>
    );
  }
  if (estado === 'riesgo') {
    return (
      <span className={`${base} bg-white border-titi-dark text-titi-dark`}>
        <span className="w-5 h-5 rounded-full bg-titi-certificate text-white grid place-items-center">
          <ClockIcon className="w-3 h-3" />
        </span>
        {isSelf ? '¡Estudiá hoy para no perderla!' : 'En riesgo'}
      </span>
    );
  }
  if (estado === 'apagada') {
    return (
      <span className={`${base} pl-2.5 bg-gray-100 border-gray-200 text-gray-500`}>
        {isSelf ? 'Se está apagando…' : 'Inactiva'}
      </span>
    );
  }
  return null;
}

// ---- Variante inline (chip) ----

function InlineVariant({ racha, estado, className }) {
  if (estado === 'rota') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-gray-100 border-2 border-gray-200 ${className}`}
        aria-label="Sin racha activa"
      >
        <FlameIcon size={16} dim animated={false} />
        <span className="text-sm font-black text-gray-500 tabular-nums">0</span>
        <span className="text-xs text-gray-500 font-bold">días</span>
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-white border-2 border-titi-dark ${className}`}
      aria-label={`Racha de ${racha} días`}
    >
      <FlameIcon size={16} animated={estado === 'hoy'} dim={estado === 'apagada'} />
      <span className="text-sm font-black text-titi-streak tabular-nums">{racha}</span>
      <span className="text-xs text-titi-dark font-bold">{racha === 1 ? 'día' : 'días'}</span>
    </span>
  );
}

// ---- Variante hero (superficie v3 — perfil) ----

function HeroVariant({ racha, estado, isSelf, className }) {
  const display = useCountUp(racha);
  const { next, pct } = metaProgress(racha);
  const rota = estado === 'rota';
  const encendida = estado === 'hoy' || estado === 'riesgo';

  return (
    <section
      className={`bg-white rounded-2xl border-2 border-titi-dark shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-4 ${className}`}
      aria-label={rota ? 'Sin racha activa' : `Racha de ${racha} ${racha === 1 ? 'día' : 'días'}`}
    >
      <h2 className="text-lg font-extrabold text-titi-dark leading-tight mb-3">
        Racha de <span className="text-titi-streak">estudio</span>
      </h2>
      <div className="flex items-center gap-3">
        <span
          className={`w-14 h-14 shrink-0 rounded-2xl border-2 border-titi-dark grid place-items-center -rotate-6 ${
            rota ? 'bg-gray-100' : 'bg-orange-100'
          }`}
        >
          <FlameIcon size={36} animated={encendida} dim={rota || estado === 'apagada'} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-end gap-1.5 flex-wrap">
            <span className={`text-4xl font-black tabular-nums leading-none ${rota ? 'text-gray-400' : 'text-titi-streak'}`}>
              {display}
            </span>
            <span className="text-sm font-bold text-titi-dark pb-0.5">{racha === 1 ? 'día seguido' : 'días seguidos'}</span>
          </p>
          <div className="mt-1.5">
            {rota ? (
              <p className="text-sm font-semibold text-gray-500">
                {isSelf ? 'Completá una lección hoy y encendé la primera llama.' : 'Sin racha activa'}
              </p>
            ) : (
              <EstadoChip estado={estado} isSelf={isSelf} />
            )}
          </div>
        </div>
      </div>

      {/* Progreso hacia la próxima meta (se llena desde 0) */}
      {next && (
        <div className="mt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 mb-1.5">
            <span className="text-xs font-extrabold uppercase tracking-wide text-gray-500">Próxima meta: {next.dias} días</span>
            <span className="text-xs font-extrabold text-titi-streak tabular-nums">
              {isSelf ? `faltan ${next.dias - racha}` : `${racha}/${next.dias}`}
            </span>
          </div>
          <ProgressBar value={pct} color="bg-titi-streak" track="bg-orange-100" label={`Racha hacia la meta de ${next.dias} días`} />
        </div>
      )}

      {/* Hitos */}
      <div className="flex flex-wrap gap-1.5 mt-3">
        {METAS.map((m) => {
          const logrado = racha >= m.dias;
          return (
            <span
              key={m.dias}
              title={logrado ? `¡Meta de ${m.dias} días lograda!` : `Meta: ${m.dias} días`}
              className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-xs font-extrabold border-2 tabular-nums ${
                logrado ? 'bg-titi-streak border-titi-dark text-white' : 'bg-white border-gray-200 text-gray-500'
              }`}
            >
              {logrado && <CheckIcon className="w-3 h-3" />}
              {m.dias} días
            </span>
          );
        })}
      </div>
    </section>
  );
}

// ---- Variante sidebar (bloque oscuro — navbar, minimalista) ----

function SidebarVariant({ racha, estado, className }) {
  const display = useCountUp(racha);
  const rota = estado === 'rota';
  const encendida = estado === 'hoy' || estado === 'riesgo';

  if (rota) {
    return (
      <div
        className={`flex items-center gap-3 px-3 py-2.5 bg-titi-dark-mid border border-white/10 rounded-xl ${className}`}
        aria-label="Sin racha activa"
      >
        <FlameIcon size={26} dim animated={false} />
        <p className="text-gray-400 font-black text-xl leading-none tabular-nums">0</p>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 bg-titi-dark-mid border rounded-xl ${
        encendida ? 'border-titi-streak/40' : 'border-white/10'
      } ${className}`}
      aria-label={`Racha de ${racha} ${racha === 1 ? 'día' : 'días'}`}
      title={
        estado === 'riesgo'
          ? 'Completá una lección hoy para no perder la racha'
          : `Racha de ${racha} ${racha === 1 ? 'día' : 'días'}`
      }
    >
      <FlameIcon size={28} animated={encendida} dim={estado === 'apagada'} />
      <p className="text-white font-black text-2xl leading-none tabular-nums">{display}</p>
      <p className="text-titi-streak text-xs font-bold uppercase tracking-wide">
        {racha === 1 ? 'día' : 'días'}
      </p>
      {estado === 'riesgo' && (
        <span
          aria-hidden="true"
          className="ml-auto w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0"
        />
      )}
    </div>
  );
}
