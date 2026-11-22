import { useEffect, useRef, useState } from 'react';
import { AwardIcon, CheckIcon, CloseIcon, SlidersIcon } from '../icons.jsx';
import { CategoryIcon, categoryTheme } from './categoryTheme.jsx';
import { LENGTHS, LEVELS, ORDERS, activeFilterCount, categoriaSlug } from './catalogData.js';
import useSheetDismiss from './useSheetDismiss.js';

// Barra de filtros del catálogo (rediseno-catalogo-cursos R4). Pegajosa al
// scrollear; en celular las categorías quedan como tira y el resto va a una
// hoja inferior.

function Pill({ active, onClick, children, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'group h-10 pl-1.5 pr-4 inline-flex items-center gap-2 rounded-full text-sm font-bold shrink-0 whitespace-nowrap select-none border-2',
        'transition-all duration-150 focus:outline-none focus-visible:ring-4 focus-visible:ring-titi-yellow/60',
        'active:translate-y-0.5 active:shadow-none motion-reduce:transition-none',
        active
          ? 'bg-titi-yellow border-titi-dark text-titi-dark shadow-[0_3px_0_#1A1A2E]'
          : 'bg-white border-gray-200 text-titi-dark shadow-[0_3px_0_#E5E7EB] hover:border-titi-dark hover:-translate-y-0.5',
        className,
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function CategoryStrip({ categorias, value, onChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-1 px-1 py-1">
      <Pill active={!value} onClick={() => onChange('')} className="pl-4">
        Todas
      </Pill>
      {categorias.map((c) => {
        const slug = categoriaSlug(c.nombre);
        const theme = categoryTheme(c.nombre);
        return (
          <Pill key={c.id} active={value === slug} onClick={() => onChange(value === slug ? '' : slug)}>
            <span className={`w-7 h-7 rounded-full grid place-items-center text-white ${theme.solid}`}>
              <CategoryIcon nombre={c.nombre} className="w-4 h-4" />
            </span>
            {c.nombre}
          </Pill>
        );
      })}
    </div>
  );
}

/** Grupo de botones segmentados (nivel: varios; largo: uno o ninguno). */
function Segmented({ label, options, isActive, onToggle }) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-1 p-1 rounded-2xl bg-gray-100">
      {options.map((o) => {
        const active = isActive(o.id);
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={active}
            title={o.hint}
            onClick={() => onToggle(o.id)}
            className={[
              'h-8 px-3 rounded-xl text-sm font-bold whitespace-nowrap transition-all duration-150',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-titi-yellow motion-reduce:transition-none',
              active ? 'bg-white text-titi-dark shadow-[0_2px_0_#1A1A2E] border-2 border-titi-dark' : 'text-gray-500 border-2 border-transparent hover:text-titi-dark',
            ].join(' ')}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function CertSwitch({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="group inline-flex items-center gap-2 h-10 text-sm font-bold text-titi-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-titi-yellow rounded-xl px-1"
    >
      <span
        className={[
          'relative w-11 h-6 rounded-full border-2 border-titi-dark transition-colors duration-150',
          checked ? 'bg-titi-certificate' : 'bg-gray-100',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white border-2 border-titi-dark transition-transform duration-200 ease-out motion-reduce:transition-none',
            checked ? 'translate-x-5' : 'translate-x-0',
          ].join(' ')}
        />
      </span>
      <AwardIcon className="w-4 h-4 text-titi-certificate" />
      Con certificado
    </button>
  );
}

function OrderSelect({ value, onChange }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm font-bold text-gray-500">
      Ordenar
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-xl border-2 border-gray-200 bg-white pl-3 pr-8 text-sm font-bold text-titi-dark hover:border-titi-dark focus:outline-none focus:border-titi-dark focus:ring-4 focus:ring-titi-yellow/40 cursor-pointer"
      >
        {ORDERS.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Chips de filtros activos, quitables uno por uno. */
function ActiveChips({ filters, categorias, onFilter, onToggleNivel, onClear }) {
  const chips = [];
  if (filters.q) chips.push({ key: 'q', label: `"${filters.q}"`, remove: () => onClear('q') });
  if (filters.cat) {
    const c = categorias.find((x) => categoriaSlug(x.nombre) === filters.cat);
    chips.push({ key: 'cat', label: c?.nombre || filters.cat, remove: () => onFilter({ cat: '' }) });
  }
  for (const n of filters.niveles) {
    chips.push({ key: `n-${n}`, label: LEVELS.find((l) => l.id === n)?.label, remove: () => onToggleNivel(n) });
  }
  if (filters.largo) {
    chips.push({ key: 'largo', label: `Curso ${LENGTHS.find((l) => l.id === filters.largo)?.label.toLowerCase()}`, remove: () => onFilter({ largo: '' }) });
  }
  if (filters.cert) chips.push({ key: 'cert', label: 'Con certificado', remove: () => onFilter({ cert: false }) });
  if (!chips.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.remove}
          aria-label={`Quitar filtro ${chip.label}`}
          className="titi-pop-in inline-flex items-center gap-1.5 h-8 pl-3 pr-2 rounded-full bg-titi-dark text-white text-xs font-bold hover:bg-titi-dark-mid focus:outline-none focus-visible:ring-2 focus-visible:ring-titi-yellow"
        >
          {chip.label}
          <CloseIcon className="w-3.5 h-3.5" />
        </button>
      ))}
      <button
        type="button"
        onClick={() => onClear('all')}
        className="h-8 px-2 text-xs font-bold uppercase tracking-wide text-blue-500 hover:text-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-titi-yellow rounded-lg"
      >
        Limpiar todo
      </button>
    </div>
  );
}

function FiltersSheet({ open, onClose, filters, onFilter, onToggleNivel, resultCount }) {
  const { panelRef, dragHandlers } = useSheetDismiss({ open, onClose });
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 sm:hidden" role="dialog" aria-modal="true" aria-label="Filtros">
      <button type="button" aria-label="Cerrar filtros" onClick={onClose} className="titi-backdrop-in absolute inset-0 bg-titi-dark/60" />
      <div
        ref={panelRef}
        className="titi-sheet-in absolute inset-x-0 bottom-0 bg-white rounded-t-3xl border-t-2 border-titi-dark p-5 pb-8 flex flex-col gap-5 max-h-[85svh] overflow-y-auto"
      >
        <div {...dragHandlers} className="-mt-2 -mx-5 pt-1 pb-3 grid place-items-center cursor-grab touch-none">
          <span className="w-10 h-1.5 rounded-full bg-gray-200" />
        </div>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-titi-dark">Filtros</h3>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="w-9 h-9 grid place-items-center rounded-xl hover:bg-gray-100">
            <CloseIcon />
          </button>
        </div>
        <section className="flex flex-col gap-2">
          <h4 className="text-sm font-extrabold text-gray-500">Nivel</h4>
          <Segmented label="Nivel" options={LEVELS} isActive={(id) => filters.niveles.includes(id)} onToggle={onToggleNivel} />
        </section>
        <section className="flex flex-col gap-2">
          <h4 className="text-sm font-extrabold text-gray-500">Largo del curso</h4>
          <Segmented
            label="Largo del curso"
            options={LENGTHS}
            isActive={(id) => filters.largo === id}
            onToggle={(id) => onFilter({ largo: filters.largo === id ? '' : id })}
          />
        </section>
        <CertSwitch checked={filters.cert} onChange={(cert) => onFilter({ cert })} />
        <OrderSelect value={filters.orden} onChange={(orden) => onFilter({ orden })} />
        <button
          type="button"
          onClick={onClose}
          className="titi-btn-primary w-full py-3 text-base"
        >
          <CheckIcon className="w-5 h-5" />
          Ver {resultCount === 1 ? '1 curso' : `${resultCount} cursos`}
        </button>
      </div>
    </div>
  );
}

export default function CatalogFilters({ categorias, filters, onFilter, onToggleNivel, onClear, resultCount }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const sentinelRef = useRef(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const obs = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting), {
      rootMargin: '-72px 0px 0px 0px',
      threshold: 1,
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const extraCount = activeFilterCount(filters) - (filters.cat ? 1 : 0);

  return (
    <>
      <div ref={sentinelRef} aria-hidden="true" className="h-px" />
      <div
        className={[
          'sticky top-14 md:top-2 z-20 flex flex-col gap-3 rounded-2xl border-2 transition-all duration-200 py-2',
          stuck ? 'bg-white border-titi-dark px-3 shadow-[0_4px_0_#1A1A2E]' : 'border-transparent bg-titi-cream',
        ].join(' ')}
      >
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <CategoryStrip categorias={categorias} value={filters.cat} onChange={(cat) => onFilter({ cat })} />
          </div>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="sm:hidden relative h-10 px-3 shrink-0 inline-flex items-center gap-1.5 rounded-full border-2 border-titi-dark bg-white text-sm font-bold text-titi-dark shadow-[0_3px_0_#1A1A2E] active:translate-y-0.5 active:shadow-none"
          >
            <SlidersIcon className="w-4 h-4" />
            Filtros
            {extraCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-titi-streak text-white text-[11px] font-extrabold grid place-items-center">
                {extraCount}
              </span>
            )}
          </button>
        </div>

        <div className="hidden sm:flex flex-wrap items-center gap-x-4 gap-y-2">
          <Segmented label="Nivel" options={LEVELS} isActive={(id) => filters.niveles.includes(id)} onToggle={onToggleNivel} />
          <Segmented
            label="Largo del curso"
            options={LENGTHS}
            isActive={(id) => filters.largo === id}
            onToggle={(id) => onFilter({ largo: filters.largo === id ? '' : id })}
          />
          <CertSwitch checked={filters.cert} onChange={(cert) => onFilter({ cert })} />
          <div className="ml-auto">
            <OrderSelect value={filters.orden} onChange={(orden) => onFilter({ orden })} />
          </div>
        </div>
      </div>

      <ActiveChips
        filters={filters}
        categorias={categorias}
        onFilter={onFilter}
        onToggleNivel={onToggleNivel}
        onClear={onClear}
      />

      <FiltersSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        filters={filters}
        onFilter={onFilter}
        onToggleNivel={onToggleNivel}
        resultCount={resultCount}
      />
    </>
  );
}
