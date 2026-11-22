import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStaggerReveal } from '../../lib/motion.js';
import { ChevronLeftIcon, ChevronRightIcon, PlayIcon } from '../icons.jsx';
import { CourseCover } from './CourseCard.jsx';
import { categoryTheme } from './categoryTheme.jsx';

// Fila curada deslizable (rediseno-catalogo-cursos R3): scroll con snap y
// flechas en desktop que aparecen solo si hay más para ver.

function ArrowButton({ dir, onClick, hidden }) {
  const Icon = dir === 'left' ? ChevronLeftIcon : ChevronRightIcon;
  return (
    <button
      type="button"
      onClick={onClick}
      tabIndex={hidden ? -1 : 0}
      aria-hidden={hidden}
      aria-label={dir === 'left' ? 'Ver anteriores' : 'Ver más'}
      className={[
        'hidden md:grid place-items-center w-10 h-10 rounded-full bg-white border-2 border-titi-dark text-titi-dark shadow-[0_3px_0_#1A1A2E]',
        'hover:bg-titi-yellow active:translate-y-0.5 active:shadow-none transition-all duration-150',
        'focus:outline-none focus-visible:ring-4 focus-visible:ring-titi-yellow/60',
        hidden ? 'opacity-0 pointer-events-none scale-90' : 'opacity-100 scale-100',
      ].join(' ')}
    >
      <Icon className="w-5 h-5" />
    </button>
  );
}

export default function CourseRow({ title, subtitle, accent, seeAll, children, count }) {
  const scrollerRef = useRef(null);
  const revealRef = useStaggerReveal([count], { scale: 0.94 });
  const [edges, setEdges] = useState({ start: true, end: true });

  const measure = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setEdges({
      start: el.scrollLeft <= 4,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    measure();
    const el = scrollerRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, count]);

  const page = (dir) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' });
  };

  const setRefs = (node) => {
    scrollerRef.current = node;
    revealRef.current = node;
  };

  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <div className="flex items-end gap-3">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-extrabold text-titi-dark leading-tight">
            {title} {accent && <span className="text-titi-streak">{accent}</span>}
          </h2>
          {subtitle && <p className="text-sm font-medium text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {seeAll && (
            <button
              type="button"
              onClick={seeAll.onClick}
              className="text-sm font-bold uppercase tracking-wide text-blue-500 hover:text-blue-600 px-1 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-titi-yellow"
            >
              {seeAll.label || 'Ver todo'}
            </button>
          )}
          <ArrowButton dir="left" onClick={() => page(-1)} hidden={edges.start} />
          <ArrowButton dir="right" onClick={() => page(1)} hidden={edges.end} />
        </div>
      </div>
      <div
        ref={setRefs}
        onScroll={measure}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth -mx-4 px-4 sm:mx-0 sm:px-1 pt-1 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden motion-reduce:scroll-auto"
      >
        {children}
      </div>
    </section>
  );
}

/** Celda de fila: ancho fijo y snap. */
export function RowItem({ children, wide = false }) {
  return (
    <div className={`snap-start shrink-0 ${wide ? 'w-[300px] sm:w-[340px]' : 'w-[250px] sm:w-[270px]'}`}>
      {children}
    </div>
  );
}

/** "Continúa donde quedaste": avance animado y acceso directo a la siguiente lección. */
export function ContinueCard({ inscripcion }) {
  const { curso, avance, leccionesCompletadas, leccionesTotales, siguienteLeccionId } = inscripcion;
  const theme = categoryTheme(curso.categoria?.nombre);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setWidth(avance));
    return () => cancelAnimationFrame(id);
  }, [avance]);
  const href = `/courses/${curso.id}/learn${siguienteLeccionId ? `?lessonId=${siguienteLeccionId}` : ''}`;

  return (
    <Link
      to={href}
      className={[
        'group h-full flex gap-3 p-3 bg-white rounded-2xl border-2 border-titi-dark shadow-[0_5px_0_#1A1A2E]',
        'hover:-translate-y-1 hover:shadow-[0_8px_0_#1A1A2E] active:translate-y-[3px] active:shadow-[0_2px_0_#1A1A2E]',
        'transition-all duration-150 focus:outline-none focus-visible:ring-4 focus-visible:ring-titi-yellow motion-reduce:transition-none',
      ].join(' ')}
    >
      <CourseCover curso={curso} iconSize="sm" className="w-20 h-full min-h-[96px] rounded-xl border-2 border-titi-dark shrink-0" />
      <div className="min-w-0 flex-1 flex flex-col gap-1.5">
        <span className={`text-xs font-extrabold uppercase tracking-wide truncate ${theme.text}`}>
          {curso.categoria?.nombre || 'General'}
        </span>
        <h3 className="text-sm font-extrabold text-titi-dark leading-snug line-clamp-2">{curso.titulo}</h3>
        <div className="mt-auto flex items-center gap-2">
          <span className="flex-1 h-2.5 rounded-full bg-gray-100 overflow-hidden border border-gray-200">
            <span
              className="block h-full rounded-full bg-titi-yellow transition-[width] duration-700 ease-out motion-reduce:transition-none"
              style={{ width: `${width}%` }}
            />
          </span>
          <span className="text-xs font-extrabold tabular-nums text-titi-yellow-dark">{avance}%</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-gray-500 tabular-nums">
            {leccionesCompletadas} de {leccionesTotales} lecciones
          </span>
          <span className="inline-flex items-center gap-1 h-7 pl-2 pr-2.5 rounded-lg bg-titi-yellow text-titi-dark text-xs font-extrabold shadow-[0_2px_0_#E6B800] group-hover:shadow-[0_1px_0_#E6B800] group-hover:translate-y-px transition-all duration-150">
            <PlayIcon className="w-3.5 h-3.5" />
            Seguir
          </span>
        </div>
      </div>
    </Link>
  );
}
