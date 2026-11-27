import { Link } from 'react-router-dom';
import { useStaggerReveal } from '../../lib/motion.js';
import { FireIcon, HashIcon } from '../icons.jsx';

// Tendencias (rediseno-inicio-explorar R8): pastillas deslizables (celular) y
// ranking (rail). Recibe el resultado de `useTrending()`; si falla o está
// vacío, no se muestra.

const posts = (n) => `${n} ${n === 1 ? 'post' : 'posts'}`;

/** Pastilla de hashtag, igual a las del catálogo. */
export function HashtagPill({ name, count }) {
  return (
    <Link
      to={`/hashtag/${encodeURIComponent(name.toLowerCase())}`}
      className={[
        'group h-10 pl-1.5 pr-4 inline-flex items-center gap-2 rounded-full border-2 shrink-0 whitespace-nowrap select-none',
        'bg-white border-gray-200 text-sm font-bold text-titi-dark shadow-[0_3px_0_#E5E7EB]',
        'hover:border-titi-dark hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none',
        'transition-all duration-150 focus:outline-none focus-visible:ring-4 focus-visible:ring-titi-yellow/60 motion-reduce:transition-none',
      ].join(' ')}
    >
      <span className="w-7 h-7 rounded-full bg-titi-yellow text-titi-dark grid place-items-center transition-transform duration-200 group-hover:rotate-12 motion-reduce:transition-none">
        <HashIcon className="w-4 h-4" />
      </span>
      {name}
      {typeof count === 'number' && <span className="text-xs font-bold text-gray-400 tabular-nums">{count}</span>}
    </Link>
  );
}

export function TrendingStrip({ trending, className = '' }) {
  const { items, loading, error } = trending;
  if (error || (!loading && items.length === 0)) return null;
  return (
    <div className={`flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-4 px-4 sm:mx-0 sm:px-0 py-1 ${className}`}>
      <span className="inline-flex items-center gap-1 text-xs font-extrabold uppercase tracking-wide text-titi-streak shrink-0 pr-1">
        <FireIcon className="w-4 h-4" />
        Tendencias
      </span>
      {loading
        ? [0, 1, 2, 3].map((i) => <span key={i} className="h-10 w-28 rounded-full bg-gray-100 animate-pulse shrink-0 motion-reduce:animate-none" />)
        : items.map((h) => <HashtagPill key={h.name} name={h.name} count={h.postCount} />)}
    </div>
  );
}

export function TrendingPanel({ trending, max = 5 }) {
  const { items, loading, error } = trending;
  const listRef = useStaggerReveal([loading]);
  if (error || (!loading && items.length === 0)) return null;
  return (
    <section aria-label="Tendencias" className="bg-white rounded-2xl border-2 border-titi-dark shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-8 h-8 rounded-xl bg-titi-streak text-white grid place-items-center border-2 border-titi-dark -rotate-6">
          <FireIcon className="w-4 h-4" />
        </span>
        <h2 className="text-lg font-extrabold text-titi-dark">
          En <span className="text-titi-streak">tendencia</span>
        </h2>
      </div>
      {loading ? (
        <ul className="animate-pulse motion-reduce:animate-none">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="flex items-center gap-3 py-2.5">
              <span className="w-6 h-4 rounded bg-gray-100" />
              <span className="flex-1 h-3 rounded-full bg-gray-100" />
            </li>
          ))}
        </ul>
      ) : (
        <ol ref={listRef}>
          {items.slice(0, max).map((h, i) => (
            <li key={h.name} className="border-b border-gray-100 last:border-0">
              <Link
                to={`/hashtag/${encodeURIComponent(h.name.toLowerCase())}`}
                className="group flex items-center gap-3 py-2.5 -mx-2 px-2 rounded-xl hover:bg-titi-cream active:scale-[0.98] transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-titi-yellow"
              >
                <span className={`w-6 text-lg font-black tabular-nums ${i === 0 ? 'text-titi-streak' : 'text-gray-400'}`}>{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-extrabold text-titi-dark truncate group-hover:text-blue-500 transition-colors">
                    #{h.name}
                  </span>
                  <span className="block text-xs font-semibold text-gray-500">{posts(h.postCount)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
