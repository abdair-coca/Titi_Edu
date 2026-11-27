import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import TitiMascot from '../TitiMascot.jsx';
import { ChevronLeftIcon } from '../icons.jsx';

// Piezas v3 compartidas (rediseno-plataforma-v3 R0): las clases exactas de
// design.md §5.2 / §15 en un solo lugar para no repetirlas en cada pantalla.

/** Tile v3: navega o abre algo entero. Sube al hover, se aplasta al presionar. */
export const TILE = [
  'bg-white rounded-2xl border-2 border-titi-dark shadow-[0_5px_0_#1A1A2E]',
  'transition-all duration-150 ease-out hover:-translate-y-1 hover:shadow-[0_8px_0_#1A1A2E]',
  'active:translate-y-[3px] active:shadow-[0_2px_0_#1A1A2E]',
  'focus:outline-none focus-visible:ring-4 focus-visible:ring-titi-yellow',
  'motion-reduce:transition-none motion-reduce:hover:translate-y-0',
].join(' ');

/** Superficie v3: informa; no se mueve. */
export const SURFACE = 'bg-white rounded-2xl border-2 border-titi-dark shadow-[0_2px_8px_rgba(0,0,0,0.06)]';

/** Panel oscuro (resúmenes de gamificación, cierres) y sus tiles internos. */
export const DARK_PANEL = 'bg-titi-dark rounded-2xl border-2 border-titi-dark';
export const DARK_TILE = 'bg-white/5 border-2 border-white/10 rounded-xl';

/** Botón secundario v3 (el de "Reintentar" / "Refrescar"): borde y sombra oscuros. */
export const BTN_SECONDARY = [
  'inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl bg-white border-2 border-titi-dark',
  'text-sm font-extrabold text-titi-dark whitespace-nowrap select-none shadow-[0_3px_0_#1A1A2E]',
  'hover:bg-titi-yellow hover:-translate-y-0.5 hover:shadow-[0_4px_0_#1A1A2E] active:translate-y-0.5 active:shadow-none',
  'transition-all duration-150 motion-reduce:transition-none',
  'focus:outline-none focus-visible:ring-4 focus-visible:ring-titi-yellow/60',
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:bg-white',
].join(' ');

/** Versión chica del secundario (filas de tabla, acciones dentro de cards). */
export const BTN_SECONDARY_SM = BTN_SECONDARY.replace('h-11 px-4', 'h-9 px-3');

/** Botón destructivo v3 (rojo sólido con sombra dura). */
export const BTN_DANGER_SM = [
  'inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-xl bg-red-500 border-2 border-titi-dark',
  'text-sm font-extrabold text-white whitespace-nowrap shadow-[0_3px_0_#1A1A2E]',
  'hover:-translate-y-0.5 hover:shadow-[0_4px_0_#1A1A2E] active:translate-y-0.5 active:shadow-none',
  'transition-all duration-150 motion-reduce:transition-none',
  'focus:outline-none focus-visible:ring-4 focus-visible:ring-red-300',
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0',
].join(' ');

/** Input v3 (el del buscador, en chico). */
export const INPUT = [
  'w-full bg-white border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-titi-dark',
  'placeholder:text-gray-400 hover:border-gray-300 focus:outline-none focus:border-titi-dark focus:ring-4 focus:ring-titi-yellow/40',
  'transition-all duration-150 disabled:opacity-60',
].join(' ');

/** Cabecera de página: título con palabra de acento + subtítulo + acciones. */
export function PageHeader({ title, accent, eyebrow, subtitle, children, className = '' }) {
  return (
    <header className={`mb-5 sm:mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        {eyebrow && <p className="text-sm font-extrabold uppercase tracking-wide text-gray-500">{eyebrow}</p>}
        <h1 className="text-3xl sm:text-4xl font-black text-titi-dark leading-tight break-words">
          {title} {accent && <span className="text-titi-streak">{accent}</span>}
        </h1>
        {subtitle && <p className="text-base font-medium text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2 shrink-0">{children}</div>}
    </header>
  );
}

/** "Volver a …": pastilla chica con flecha. Acepta `to` o `onClick`. */
export function BackLink({ to, onClick, children, className = '' }) {
  const cls = [
    'group inline-flex items-center gap-1.5 h-9 pl-1.5 pr-3.5 mb-4 rounded-full bg-white border-2 border-gray-200',
    'text-sm font-bold text-titi-dark shadow-[0_3px_0_#E5E7EB] hover:border-titi-dark active:translate-y-0.5 active:shadow-none',
    'transition-all duration-150 focus:outline-none focus-visible:ring-4 focus-visible:ring-titi-yellow/60 motion-reduce:transition-none',
    className,
  ].join(' ');
  const inner = (
    <>
      <span className="w-6 h-6 rounded-full bg-titi-yellow grid place-items-center transition-transform duration-150 group-hover:-translate-x-0.5 motion-reduce:transition-none">
        <ChevronLeftIcon className="w-4 h-4" />
      </span>
      {children}
    </>
  );
  if (to) {
    return (
      <Link to={to} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

/** Cuadro sólido del rol, girado, con el ícono (blanco; oscuro sobre amarillo). */
export function RoleBadge({ Icon, solid = 'bg-titi-yellow', size = 'md', className = '' }) {
  const dark = solid.includes('titi-yellow') || solid.includes('bg-white');
  const box = { sm: 'w-8 h-8', md: 'w-10 h-10', lg: 'w-12 h-12' }[size] || 'w-10 h-10';
  const icon = { sm: 'w-4 h-4', md: 'w-5 h-5', lg: 'w-6 h-6' }[size] || 'w-5 h-5';
  return (
    <span
      aria-hidden="true"
      className={`${box} shrink-0 rounded-xl border-2 border-titi-dark grid place-items-center -rotate-6 ${solid} ${dark ? 'text-titi-dark' : 'text-white'} ${className}`}
    >
      <Icon className={icon} />
    </span>
  );
}

/** Título de panel: insignia girada + título con acento + acción opcional. */
export function PanelTitle({ Icon, solid, title, accent, children, className = '' }) {
  return (
    <div className={`flex items-center gap-2 mb-3 ${className}`}>
      {Icon && <RoleBadge Icon={Icon} solid={solid} size="sm" />}
      <h2 className="text-lg font-extrabold text-titi-dark leading-tight min-w-0">
        {title} {accent && <span className="text-titi-streak">{accent}</span>}
      </h2>
      {children && <div className="ml-auto flex items-center gap-2 shrink-0">{children}</div>}
    </div>
  );
}

/**
 * Vacío con Titi (design.md §8): superficie v3, mascota con estado, título con
 * acento, texto y CTA. `compact` = sin superficie y con Titi chico (secciones).
 */
export function EmptyState({ state = 'idle', message = '', title, accent, text, children, compact = false, className = '' }) {
  return (
    <div
      className={[
        'flex flex-col items-center text-center',
        compact ? 'py-6 px-4' : `${SURFACE} py-8 sm:py-10 px-6 mb-5`,
        className,
      ].join(' ')}
    >
      <TitiMascot state={state} size={compact ? 'sm' : 'md'} message={message} className="mb-3" />
      {title && (
        <h2 className={`${compact ? 'text-base' : 'text-xl sm:text-2xl'} font-extrabold text-titi-dark break-words`}>
          {title} {accent && <span className="text-titi-streak">{accent}</span>}
        </h2>
      )}
      {text && <p className="text-base font-medium text-gray-500 mt-1 max-w-md">{text}</p>}
      {children && <div className="mt-5 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}

/**
 * Barra de progreso que monta en 0 y se llena hasta el valor (§10 patrón 4).
 * `color` = clase de fondo del relleno; `track` = clase del riel.
 */
export function ProgressBar({ value = 0, max = 100, color = 'bg-titi-yellow', track = 'bg-gray-100', height = 'h-2.5', label, className = '' }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0;
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setWidth(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
      className={`${height} ${track} rounded-full overflow-hidden ${className}`}
    >
      <div
        className={`h-full rounded-full ${color} transition-[width] duration-700 ease-out motion-reduce:transition-none`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

/** Línea de skeleton (gris, redondeada). */
export function SkeletonLine({ className = '' }) {
  return <div className={`bg-gray-100 rounded-full ${className}`} />;
}
