import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { resolveMediaUrl } from '../../lib/format.js';
import { sanitizeMarkdownUrl } from '../../lib/markdown.js';
import { AwardIcon, ChevronRightIcon, ListIcon, UsersIcon } from '../icons.jsx';
import { CategoryIcon, categoryTheme } from './categoryTheme.jsx';
import { enrolledCount, lessonCount } from './catalogData.js';

// Tarjeta de curso v3 (rediseno-catalogo-cursos R5): tile con borde oscuro y
// sombra dura que se aplasta al tocar; inclinación leve con el mouse.

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

const finePointer = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(pointer: fine)').matches &&
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Inclinación que sigue al mouse (≤ 4°). Usa la propiedad CSS `rotate`, que se
 * compone con el `transform` del hover/press sin pisarlo.
 */
function useTilt() {
  const ref = useRef(null);
  const onPointerMove = (e) => {
    const el = ref.current;
    if (!el || e.pointerType !== 'mouse' || !finePointer()) return;
    const r = el.getBoundingClientRect();
    const dx = ((e.clientX - r.left) / r.width) * 2 - 1;
    const dy = ((e.clientY - r.top) / r.height) * 2 - 1;
    const angle = Math.min(1, Math.hypot(dx, dy)) * 4;
    el.style.rotate = `${-dy} ${dx} 0 ${angle.toFixed(2)}deg`;
  };
  const onPointerLeave = () => {
    if (ref.current) ref.current.style.rotate = '';
  };
  return { ref, onPointerMove, onPointerLeave };
}

/** Portada: imagen del curso o, sin imagen, el acento de su categoría. */
export function CourseCover({ curso, className = 'h-40', iconSize = 'lg' }) {
  const [imgOk, setImgOk] = useState(true);
  const theme = categoryTheme(curso.categoria?.nombre);
  const src = curso.portadaUrl ? resolveMediaUrl(sanitizeMarkdownUrl(curso.portadaUrl)) : null;

  if (src && imgOk) {
    return (
      <div className={`relative overflow-hidden ${theme.tint} ${className}`}>
        <img
          src={src}
          alt=""
          loading="lazy"
          draggable={false}
          onError={() => setImgOk(false)}
          className="w-full h-full object-cover select-none transition-transform duration-300 ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
      </div>
    );
  }

  const { Icon } = theme;
  const big = iconSize === 'lg';
  return (
    <div className={`relative overflow-hidden grid place-items-center ${theme.tint} ${className}`}>
      {/* Decoración: el mismo ícono, grande y tenue, en las esquinas */}
      <Icon className={`absolute -left-3 -bottom-4 w-24 h-24 -rotate-12 opacity-15 ${theme.text}`} />
      <Icon className={`absolute -right-2 -top-3 w-16 h-16 rotate-12 opacity-15 ${theme.text}`} />
      <span
        className={[
          'relative grid place-items-center rounded-2xl border-2 border-titi-dark shadow-[0_4px_0_#1A1A2E] text-white -rotate-6',
          'transition-transform duration-300 ease-out group-hover:rotate-0 group-hover:scale-110 motion-reduce:transition-none',
          big ? 'w-16 h-16' : 'w-11 h-11',
          theme.solid,
        ].join(' ')}
      >
        <CategoryIcon nombre={curso.categoria?.nombre} className={big ? 'w-8 h-8' : 'w-5 h-5'} />
      </span>
    </div>
  );
}

/** Avatares apilados de amigos (iniciales) + "N amigos". */
export function FriendStack({ friendCount, sampleFriends = [], className = '' }) {
  if (!friendCount) return null;
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="flex -space-x-2">
        {sampleFriends.slice(0, 3).map((name) => (
          <span
            key={name}
            title={name}
            className="w-6 h-6 rounded-full bg-titi-yellow text-titi-dark border-2 border-white grid place-items-center text-[11px] font-extrabold uppercase"
          >
            {name[0]}
          </span>
        ))}
      </span>
      <span className="text-xs font-bold text-titi-dark">
        {plural(friendCount, 'amigo', 'amigos')}
      </span>
    </span>
  );
}

export function LevelChip({ nivel, className = '' }) {
  if (!nivel) return null;
  return (
    <span className={`bg-titi-dark text-white text-xs font-bold capitalize px-2.5 py-1 rounded-full ${className}`}>
      {nivel.toLowerCase()}
    </span>
  );
}

/**
 * @param curso    curso del catálogo
 * @param onOpen   abre la vista rápida
 * @param friends  { friendCount, sampleFriends } si hay amigos inscritos
 * @param progress avance 0-100 si el usuario está inscrito
 */
export default function CourseCard({ curso, onOpen, friends, progress, className = '' }) {
  const tilt = useTilt();
  const theme = categoryTheme(curso.categoria?.nombre);
  const lecciones = lessonCount(curso);
  const inscritos = enrolledCount(curso);
  const autor = curso.creador?.username;

  return (
    <article className={`group relative h-full [perspective:900px] ${className}`}>
      <div
        ref={tilt.ref}
        onPointerMove={tilt.onPointerMove}
        onPointerLeave={tilt.onPointerLeave}
        className={[
          'relative h-full flex flex-col bg-white rounded-2xl border-2 border-titi-dark overflow-hidden',
          'shadow-[0_5px_0_#1A1A2E] transition-[transform,box-shadow,rotate] duration-150 ease-out',
          'hover:-translate-y-1 hover:shadow-[0_8px_0_#1A1A2E]',
          'active:translate-y-[3px] active:shadow-[0_2px_0_#1A1A2E]',
          'has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-titi-yellow',
          'motion-reduce:transition-none motion-reduce:hover:translate-y-0',
        ].join(' ')}
      >
        <div className="relative">
          <CourseCover curso={curso} />
          <LevelChip nivel={curso.nivel} className="absolute top-3 left-3" />
          {curso.emiteCertificado !== false && (
            <span
              title="Emite certificado"
              className="absolute top-3 right-3 w-7 h-7 rounded-full bg-titi-certificate text-white border-2 border-titi-dark grid place-items-center"
            >
              <AwardIcon className="w-3.5 h-3.5" />
              <span className="sr-only">Emite certificado</span>
            </span>
          )}
        </div>

        <div className="flex flex-col gap-2 p-4 flex-1 border-t-2 border-titi-dark">
          <span className={`inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide truncate ${theme.text}`}>
            <span className={`w-5 h-5 rounded-md grid place-items-center text-white shrink-0 ${theme.solid}`}>
              <CategoryIcon nombre={curso.categoria?.nombre} className="w-3 h-3" />
            </span>
            {curso.categoria?.nombre || 'General'}
          </span>

          <h3 className="text-base font-extrabold text-titi-dark leading-snug line-clamp-2">
            {/* El botón se estira sobre toda la tarjeta: toda ella abre la vista rápida. */}
            <button
              type="button"
              onClick={() => onOpen?.(curso)}
              className="text-left focus:outline-none after:absolute after:inset-0 after:content-['']"
            >
              {curso.titulo}
            </button>
          </h3>

          <p className="flex items-center gap-3 text-xs font-bold text-gray-500">
            <span className="inline-flex items-center gap-1">
              <ListIcon className="w-3.5 h-3.5" />
              {plural(lecciones, 'lección', 'lecciones')}
            </span>
            {inscritos > 0 && (
              <span className="inline-flex items-center gap-1">
                <UsersIcon className="w-3.5 h-3.5" />
                {plural(inscritos, 'inscrito', 'inscritos')}
              </span>
            )}
          </p>

          {typeof progress === 'number' && (
            <div className="flex items-center gap-2" aria-label={`Avance ${progress}%`}>
              <span className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                <span
                  className="block h-full rounded-full bg-titi-yellow transition-[width] duration-700 ease-out motion-reduce:transition-none"
                  style={{ width: `${progress}%` }}
                />
              </span>
              <span className="text-xs font-extrabold tabular-nums text-titi-yellow-dark">{progress}%</span>
            </div>
          )}

          <div className="mt-auto pt-2 flex items-center gap-2 min-w-0">
            {friends?.friendCount ? (
              <FriendStack {...friends} />
            ) : (
              <>
                <span className="w-6 h-6 rounded-full bg-titi-dark text-titi-cream grid place-items-center text-[11px] font-extrabold uppercase shrink-0">
                  {autor?.[0] ?? '?'}
                </span>
                <span className="text-sm font-bold text-titi-dark truncate">{autor || 'Anónimo'}</span>
              </>
            )}
            <Link
              to={`/courses/${curso.id}`}
              aria-label={`Abrir la página de ${curso.titulo}`}
              title="Abrir la página del curso"
              className="relative z-10 ml-auto w-8 h-8 shrink-0 grid place-items-center rounded-xl border-2 border-gray-200 text-titi-dark hover:border-titi-dark hover:bg-titi-yellow focus:outline-none focus-visible:ring-2 focus-visible:ring-titi-yellow transition-colors"
            >
              <ChevronRightIcon className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

export function CourseCardSkeleton({ className = '' }) {
  return (
    <div className={`h-full bg-white rounded-2xl border-2 border-gray-200 overflow-hidden animate-pulse motion-reduce:animate-none ${className}`}>
      <div className="h-40 bg-gray-100" />
      <div className="p-4 flex flex-col gap-3 border-t-2 border-gray-200">
        <div className="h-3 bg-gray-100 rounded-full w-1/3" />
        <div className="h-4 bg-gray-100 rounded-full w-4/5" />
        <div className="h-3 bg-gray-100 rounded-full w-1/2" />
        <div className="flex items-center gap-2 pt-2">
          <div className="w-6 h-6 rounded-full bg-gray-100" />
          <div className="h-3 bg-gray-100 rounded-full w-1/3" />
        </div>
      </div>
    </div>
  );
}
