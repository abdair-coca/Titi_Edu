import { Link } from 'react-router-dom';
import { UsersIcon } from '../icons.jsx';
import Avatar from './Avatar.jsx';
import FollowButton from './FollowButton.jsx';

// Persona para seguir (rediseno-inicio-explorar R6): tile v3 para filas y
// variante de lista para el rail.

// Banda de color por persona: tintes de la paleta, estable por usuario.
const BANDS = [
  'bg-titi-yellow-light',
  'bg-titi-cat-code-light',
  'bg-titi-cat-lang-light',
  'bg-titi-cat-design-light',
  'bg-titi-cat-science-light',
  'bg-titi-cat-data-light',
  'bg-titi-cat-math-light',
];
function bandFor(username = '') {
  let h = 0;
  for (const ch of username) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return BANDS[h % BANDS.length];
}

/** "Seguido por @ana y 2 más" o "12 seguidores". */
export function socialProof({ mutualCount = 0, mutualSample = [], followerCount = 0 }) {
  if (mutualCount > 0 && mutualSample.length) {
    const rest = mutualCount - 1;
    return `Seguido por @${mutualSample[0]}${rest > 0 ? ` y ${rest} más` : ''}`;
  }
  if (followerCount > 0) return `${followerCount} ${followerCount === 1 ? 'seguidor' : 'seguidores'}`;
  return 'Nuevo en Titi';
}

export default function PersonCard({ person, onFollowChange, initialFollowing = false }) {
  return (
    <article
      className={[
        'group relative h-full flex flex-col items-center text-center bg-white rounded-2xl border-2 border-titi-dark overflow-hidden',
        'shadow-[0_5px_0_#1A1A2E] transition-all duration-150 ease-out',
        'hover:-translate-y-1 hover:shadow-[0_8px_0_#1A1A2E] active:translate-y-[3px] active:shadow-[0_2px_0_#1A1A2E]',
        'has-[a:focus-visible]:ring-4 has-[a:focus-visible]:ring-titi-yellow motion-reduce:transition-none motion-reduce:hover:translate-y-0',
      ].join(' ')}
    >
      <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-12 border-b-2 border-titi-dark ${bandFor(person.username)}`} />
      <div className="relative mt-5 transition-transform duration-300 ease-out group-hover:-rotate-6 group-hover:scale-105 motion-reduce:transition-none">
        <Avatar username={person.username} src={person.avatarUrl} size="lg" />
      </div>
      <div className="flex flex-col items-center gap-1 px-3 pt-2 pb-3 flex-1 w-full min-w-0">
        <h3 className="text-base font-extrabold text-titi-dark truncate max-w-full">
          {/* Enlace estirado: toda la tarjeta lleva al perfil. */}
          <Link
            to={`/profile/${person.username}`}
            className="focus:outline-none after:absolute after:inset-0 after:content-['']"
          >
            @{person.username}
          </Link>
        </h3>
        <p className="text-sm font-medium text-gray-500 line-clamp-2 min-h-[2.5rem]">
          {person.bio || 'Aprendiendo en Titi.'}
        </p>
        <p className="inline-flex items-center gap-1 text-xs font-bold text-gray-500 max-w-full">
          <UsersIcon className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{socialProof(person)}</span>
        </p>
        <FollowButton username={person.username} initialFollowing={initialFollowing} onChange={onFollowChange} className="mt-auto w-full" />
      </div>
    </article>
  );
}

/** Fila compacta para el rail. */
export function PersonListItem({ person, onFollowChange }) {
  return (
    <li className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0">
      <Link to={`/profile/${person.username}`} className="shrink-0 rounded-full focus:outline-none focus-visible:ring-4 focus-visible:ring-titi-yellow/60">
        <Avatar username={person.username} src={person.avatarUrl} size="sm" />
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          to={`/profile/${person.username}`}
          className="block text-sm font-extrabold text-titi-dark truncate hover:text-blue-500 transition-colors"
        >
          @{person.username}
        </Link>
        <p className="text-xs font-semibold text-gray-500 truncate">{socialProof(person)}</p>
      </div>
      <FollowButton username={person.username} onChange={onFollowChange} size="sm" />
    </li>
  );
}

export function PersonCardSkeleton() {
  return (
    <div className="h-full flex flex-col items-center bg-white rounded-2xl border-2 border-gray-200 overflow-hidden animate-pulse motion-reduce:animate-none">
      <div className="h-12 w-full bg-gray-100" />
      <div className="-mt-7 w-16 h-16 rounded-full bg-gray-100 border-2 border-white" />
      <div className="flex flex-col items-center gap-2 w-full p-3">
        <div className="h-4 w-2/3 bg-gray-100 rounded-full" />
        <div className="h-3 w-5/6 bg-gray-100 rounded-full" />
        <div className="h-3 w-1/2 bg-gray-100 rounded-full" />
        <div className="h-10 w-full bg-gray-100 rounded-xl mt-1" />
      </div>
    </div>
  );
}
