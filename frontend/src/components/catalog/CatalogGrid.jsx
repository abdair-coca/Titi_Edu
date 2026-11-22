import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { Flip } from 'gsap/Flip';
import TitiMascot from '../TitiMascot.jsx';
import { AlertIcon } from '../icons.jsx';
import CourseCard, { CourseCardSkeleton } from './CourseCard.jsx';
import { MOTION } from '../../lib/motion.js';

gsap.registerPlugin(Flip);

// Cuadrícula del catálogo (rediseno-catalogo-cursos R4, R9, R10).

const GRID = 'grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6';
const MAX_ANIMATED = 12;

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const inViewport = (el) => {
  const r = el.getBoundingClientRect();
  return r.bottom > 0 && r.top < window.innerHeight;
};

/**
 * Reordenamiento FLIP: al cambiar la lista, las tarjetas que siguen se deslizan
 * a su lugar nuevo y las nuevas entran con saltito. Solo anima las visibles
 * (hasta MAX_ANIMATED); el resto aparece en su lugar.
 */
function useFlipGrid(containerRef, listKey, ready) {
  const lastKey = useRef(null);
  const pending = useRef(null);
  const entered = useRef(false);

  // Se lee el DOM viejo en el render, antes de que React lo cambie.
  if (ready && listKey !== lastKey.current) {
    const el = containerRef.current;
    if (el && lastKey.current !== null && !reducedMotion()) {
      const visible = [...el.children].filter(inViewport).slice(0, MAX_ANIMATED);
      pending.current = visible.length ? Flip.getState(visible) : null;
    }
    lastKey.current = listKey;
  }

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!ready || !el) return;
    const state = pending.current;
    pending.current = null;
    if (reducedMotion()) return;

    const visible = [...el.children].filter(inViewport).slice(0, MAX_ANIMATED);
    if (!entered.current) {
      // Primera carga: entrada escalonada.
      entered.current = true;
      gsap.fromTo(
        visible,
        { y: 16, scale: 0.96, autoAlpha: 0 },
        { y: 0, scale: 1, autoAlpha: 1, duration: MOTION.dur.base, ease: MOTION.ease.pop, stagger: 0.04, clearProps: 'all' },
      );
      return;
    }
    if (!state) {
      // Vuelve de un vacío: la cuadrícula se montó de nuevo.
      gsap.fromTo(
        visible,
        { scale: 0.9, autoAlpha: 0 },
        { scale: 1, autoAlpha: 1, duration: MOTION.dur.base, ease: MOTION.ease.pop, stagger: 0.03, clearProps: 'all' },
      );
      return;
    }
    Flip.from(state, {
      targets: visible,
      duration: MOTION.dur.base,
      ease: 'power2.inOut',
      nested: false,
      clearProps: 'transform',
      onEnter: (els) =>
        gsap.fromTo(
          els,
          { scale: 0.85, autoAlpha: 0 },
          { scale: 1, autoAlpha: 1, duration: MOTION.dur.base, ease: MOTION.ease.pop, stagger: 0.03, clearProps: 'all' },
        ),
    });
  }, [listKey, ready, containerRef]);
}

/** Titi celebra un momento cuando una búsqueda nueva encuentra cursos. */
function SearchCelebration({ query, count }) {
  const [shown, setShown] = useState(null);
  useEffect(() => {
    if (!query || count === 0) {
      setShown(null);
      return undefined;
    }
    setShown(query);
    const id = setTimeout(() => setShown(null), 2400);
    return () => clearTimeout(id);
    // Una reacción por búsqueda aplicada, no por cada cambio de conteo.
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!shown) return null;
  return <TitiMascot state="celebra" size="sm" message="" className="titi-pop-in -my-4 shrink-0" />;
}

/** Vacío con filtros: Titi pensando y una lupa que lo rodea buscando. */
function EmptyResults({ onClear }) {
  return (
    <div className="flex flex-col items-center text-center py-14 px-6 rounded-2xl border-2 border-dashed border-gray-200 bg-white">
      <div className="relative">
        <TitiMascot state="pensando" size="lg" message="" />
        <span className="titi-search-lens absolute top-6 left-1/2 w-10 h-10 text-titi-dark" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="white" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="w-full h-full drop-shadow">
            <circle cx="10" cy="10" r="6.5" />
            <line x1="15" y1="15" x2="21" y2="21" />
          </svg>
        </span>
      </div>
      <h3 className="text-xl font-extrabold text-titi-dark mt-4 mb-1">Titi buscó por todos lados…</h3>
      <p className="text-sm font-medium text-gray-500 mb-6 max-w-xs">
        No hay cursos con esa combinación. Prueba con otras palabras o quita algún filtro.
      </p>
      <button type="button" onClick={onClear} className="titi-btn-primary px-6 py-3 text-base">
        Limpiar filtros
      </button>
    </div>
  );
}

function EmptyCatalog() {
  return (
    <div className="flex flex-col items-center text-center py-14 px-6">
      <TitiMascot state="idle" size="lg" message="" className="mb-4" />
      <h3 className="text-xl font-extrabold text-titi-dark mb-1">Todavía no hay cursos publicados</h3>
      <p className="text-sm font-medium text-gray-500 max-w-xs">
        La comunidad está preparando los primeros. Vuelve pronto.
      </p>
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-start gap-4">
      <div className="w-full bg-red-50 border-2 border-red-200 rounded-2xl p-4 flex items-start gap-3">
        <AlertIcon className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-red-700">No pudimos cargar el catálogo</p>
          <p className="text-xs font-medium text-red-500 mt-0.5">{message}</p>
        </div>
      </div>
      <button type="button" onClick={onRetry} className="titi-btn-primary px-6 py-3 text-base">
        Reintentar
      </button>
    </div>
  );
}

export function CatalogSkeleton({ count = 8 }) {
  return (
    <div className={GRID} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <CourseCardSkeleton key={i} className="h-[340px]" />
      ))}
    </div>
  );
}

export default function CatalogGrid({
  cursos,
  totalCount,
  loading,
  error,
  onRetry,
  filtering,
  query,
  onClear,
  onOpen,
  friendsMap,
  progressMap,
}) {
  const containerRef = useRef(null);
  const listKey = cursos.map((c) => c.id).join('|');
  const ready = !loading && !error && cursos.length > 0;
  useFlipGrid(containerRef, listKey, ready);

  let body;
  if (loading) body = <CatalogSkeleton />;
  else if (error) body = <ErrorState message={error} onRetry={onRetry} />;
  else if (totalCount === 0) body = <EmptyCatalog />;
  else if (cursos.length === 0) body = <EmptyResults onClear={onClear} />;
  else {
    body = (
      <div ref={containerRef} className={GRID}>
        {cursos.map((curso) => (
          <div key={curso.id} data-flip-id={curso.id}>
            <CourseCard
              curso={curso}
              onOpen={() => onOpen(curso.id)}
              friends={friendsMap.get(curso.id)}
              progress={progressMap.get(curso.id)}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {!loading && !error && totalCount > 0 && (
        <div className="flex items-center gap-3 min-h-[2rem]" aria-live="polite">
          <p className="text-sm font-bold text-gray-500">
            {filtering
              ? `${cursos.length} de ${totalCount} ${totalCount === 1 ? 'curso' : 'cursos'}`
              : `${totalCount} ${totalCount === 1 ? 'curso' : 'cursos'}`}
          </p>
          <SearchCelebration query={query} count={cursos.length} />
        </div>
      )}
      {body}
    </div>
  );
}
