import { Link } from 'react-router-dom';
import { useStaggerReveal } from '../../lib/motion.js';
import CourseRow from '../catalog/CourseRow.jsx';
import { UsersIcon } from '../icons.jsx';
import PersonCard, { PersonCardSkeleton, PersonListItem } from './PersonCard.jsx';

// Gente para seguir (rediseno-inicio-explorar R6). Recibe el resultado de
// `useSuggestions()`; si falla o no hay nadie, no se muestra.

function Cell({ children }) {
  return <div className="snap-start shrink-0 w-[200px] sm:w-[210px]">{children}</div>;
}

/** Fila deslizable de tarjetas de persona. */
export function SuggestionsRow({ suggestions, onFollowChange, title = 'Gente para', accent = 'seguir', subtitle }) {
  const { items, loading, error } = suggestions;
  if (error || (!loading && items.length === 0)) return null;
  return (
    <CourseRow title={title} accent={accent} subtitle={subtitle} count={loading ? 0 : items.length}>
      {loading
        ? [0, 1, 2, 3].map((i) => (
            <Cell key={i}>
              <PersonCardSkeleton />
            </Cell>
          ))
        : items.map((p) => (
            <Cell key={p.id}>
              <PersonCard person={p} onFollowChange={onFollowChange} />
            </Cell>
          ))}
    </CourseRow>
  );
}

/** Panel del rail: lista corta con botón de seguir. */
export function SuggestionsPanel({ suggestions, onFollowChange, max = 4 }) {
  const { items, loading, error } = suggestions;
  const listRef = useStaggerReveal([loading]);
  if (error || (!loading && items.length === 0)) return null;
  return (
    <section aria-label="Gente para seguir" className="bg-white rounded-2xl border-2 border-titi-dark shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-8 h-8 rounded-xl bg-blue-500 text-white grid place-items-center border-2 border-titi-dark -rotate-6">
          <UsersIcon className="w-4 h-4" />
        </span>
        <h2 className="text-lg font-extrabold text-titi-dark">
          Gente para <span className="text-titi-streak">seguir</span>
        </h2>
      </div>
      {loading ? (
        <ul className="animate-pulse motion-reduce:animate-none">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex items-center gap-3 py-2.5">
              <span className="w-9 h-9 rounded-full bg-gray-100" />
              <span className="flex-1 h-3 rounded-full bg-gray-100" />
              <span className="w-20 h-8 rounded-xl bg-gray-100" />
            </li>
          ))}
        </ul>
      ) : (
        <ul ref={listRef}>
          {items.slice(0, max).map((p) => (
            <PersonListItem key={p.id} person={p} onFollowChange={onFollowChange} />
          ))}
        </ul>
      )}
      <Link
        to="/explore"
        className="inline-block mt-2 text-sm font-bold uppercase tracking-wide text-blue-500 hover:text-blue-600 transition-all duration-150 active:scale-95"
      >
        Ver más gente
      </Link>
    </section>
  );
}
