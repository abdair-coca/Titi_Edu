import { useEffect, useState } from 'react';

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

// ---- Metas (alineadas con los logros de racha: 7 🔥 y 30 ⚡) ----

const METAS = [
  { dias: 7, icono: '🔥' },
  { dias: 30, icono: '⚡' },
  { dias: 100, icono: '💯' },
  { dias: 365, icono: '👑' },
];

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

// ---- Contador animado (respeta prefers-reduced-motion) ----

function useCountUp(target, duration = 450) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      setValue(target);
      return;
    }
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
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
  if (estado === 'hoy') {
    return (
      <span className="inline-flex items-center gap-1 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full text-xs font-bold text-green-700">
        ✓ {isSelf ? 'Hoy ya sumaste' : 'Activa hoy'}
      </span>
    );
  }
  if (estado === 'riesgo') {
    return (
      <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full text-xs font-bold text-amber-700">
        ⏳ {isSelf ? '¡Estudiá hoy para no perderla!' : 'En riesgo'}
      </span>
    );
  }
  if (estado === 'apagada') {
    return (
      <span className="inline-flex items-center gap-1 bg-gray-100 border border-gray-200 px-2.5 py-1 rounded-full text-xs font-bold text-gray-500">
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
        className={`inline-flex items-center gap-1.5 bg-gray-100 px-3 py-1.5 rounded-full ${className}`}
        aria-label="Sin racha activa"
      >
        <FlameIcon size={16} dim animated={false} />
        <span className="text-sm font-bold text-gray-400 tabular-nums">0</span>
        <span className="text-xs text-gray-400 font-semibold">días</span>
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-full ${className}`}
      aria-label={`Racha de ${racha} días`}
    >
      <FlameIcon size={16} animated={estado === 'hoy'} dim={estado === 'apagada'} />
      <span className="text-sm font-black text-titi-streak tabular-nums">{racha}</span>
      <span className="text-xs text-titi-streak/80 font-semibold">
        {racha === 1 ? 'día' : 'días'}
      </span>
    </span>
  );
}

// ---- Variante hero (tarjeta cálida grande — perfil) ----

function HeroVariant({ racha, estado, isSelf, className }) {
  const display = useCountUp(racha);
  const { next, pct } = metaProgress(racha);
  const rota = estado === 'rota';
  const encendida = estado === 'hoy' || estado === 'riesgo';

  if (rota) {
    return (
      <div
        className={`flex items-center gap-3 sm:gap-4 p-4 sm:p-5 bg-gray-50 border-2 border-gray-200 rounded-2xl ${className}`}
      >
        <FlameIcon size={48} dim animated={false} />
        <div className="min-w-0 flex-1">
          <p className="text-3xl sm:text-4xl font-black leading-none tabular-nums text-gray-400">0</p>
          <p className="text-sm font-bold text-gray-500 mt-1.5">
            {isSelf ? 'Tu racha está apagada' : 'Sin racha activa'}
          </p>
          {isSelf && (
            <p className="text-xs font-semibold text-gray-400 mt-0.5">
              Completá una lección hoy y encendé la primera llama 🔥
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`p-4 sm:p-6 bg-orange-50 border-2 border-orange-200 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.06)] ${className}`}
      aria-label={`Racha de ${racha} ${racha === 1 ? 'día' : 'días'}`}
    >
      <div className="flex items-center gap-3 sm:gap-5">
        <FlameIcon size={56} animated={encendida} dim={estado === 'apagada'} />

        <div className="min-w-0 flex-1">
          <div className="flex items-end gap-2 flex-wrap">
            <span className="text-3xl sm:text-4xl font-black text-titi-streak tabular-nums leading-none">
              {display}
            </span>
            <span className="text-sm font-bold text-titi-dark pb-0.5">
              {racha === 1 ? 'día seguido' : 'días seguidos'}
            </span>
          </div>
          <div className="mt-2">
            <EstadoChip estado={estado} isSelf={isSelf} />
          </div>
        </div>
      </div>

      {/* Progreso hacia la próxima meta */}
      {next && (
        <div className="mt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 mb-1.5">
            <span className="text-xs font-bold text-titi-dark">
              Próxima meta: {next.icono} {next.dias} días
            </span>
            <span className="text-xs font-bold text-titi-streak tabular-nums">
              {isSelf
                ? `faltan ${next.dias - racha}`
                : `${racha}/${next.dias}`}
            </span>
          </div>
          <div
            className="h-2.5 bg-orange-100 rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={racha}
            aria-valuemin={0}
            aria-valuemax={next.dias}
          >
            <div
              className="h-full bg-titi-streak rounded-full transition-all duration-500 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
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
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${
                logrado
                  ? 'bg-titi-streak border-titi-streak text-white'
                  : 'bg-white border-orange-200 text-gray-400'
              }`}
            >
              <span className={logrado ? '' : 'grayscale opacity-60'} aria-hidden="true">
                {m.icono}
              </span>
              <span className="tabular-nums">{m.dias}</span>
            </span>
          );
        })}
      </div>
    </div>
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
