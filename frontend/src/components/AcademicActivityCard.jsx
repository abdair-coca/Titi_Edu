import { Link } from 'react-router-dom';
import { relativeTime } from '../lib/format.js';
import { AwardIcon, BooksIcon, ChevronRightIcon, GotaIcon, GraduationIcon } from './icons.jsx';
import { CourseCover } from './catalog/CourseCard.jsx';
import { CategoryIcon, categoryTheme } from './catalog/categoryTheme.jsx';
import Avatar from './social/Avatar.jsx';

// Actividad académica v3 (rediseno-inicio-explorar R5): superficie con borde
// oscuro; el curso es un mini tile que abre la vista rápida sin salir del feed.

const VERBO = {
  inscripcion: { texto: 'se inscribió en', Icon: BooksIcon, chip: 'bg-blue-500 text-white' },
  curso_completado: { texto: 'completó', Icon: GraduationIcon, chip: 'bg-green-500 text-white' },
  logro: { texto: 'desbloqueó el logro', Icon: AwardIcon, chip: 'bg-titi-achievement text-white' },
};
const OTRO = { texto: 'tuvo actividad', Icon: GotaIcon, chip: 'bg-titi-yellow text-titi-dark' };

/**
 * @param item         de GET /api/posts/feed/academic:
 *                     { actorUsername, actorAvatarUrl, type, cursoId?, curso?, logroNombre?, createdAt }
 * @param onOpenCourse abre la vista rápida del curso; sin ella, enlaza a su página.
 */
export default function AcademicActivityCard({ item, onOpenCourse }) {
  const v = VERBO[item.type] || OTRO;
  const esCurso = item.type === 'inscripcion' || item.type === 'curso_completado';

  return (
    <article className="bg-white rounded-2xl border-2 border-titi-dark shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-4 sm:p-5 mb-5">
      <header className="flex items-center gap-3">
        <Link to={`/profile/${item.actorUsername}`} className="shrink-0 rounded-full focus:outline-none focus-visible:ring-4 focus-visible:ring-titi-yellow/60">
          <Avatar username={item.actorUsername} src={item.actorAvatarUrl} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-titi-dark leading-snug">
            <Link to={`/profile/${item.actorUsername}`} className="font-extrabold hover:text-blue-500 transition-colors">
              @{item.actorUsername}
            </Link>{' '}
            <span className="font-semibold text-gray-500">{v.texto}</span>
          </p>
          <p className="text-xs text-gray-400 font-semibold mt-0.5">{relativeTime(item.createdAt)}</p>
        </div>
        <span aria-hidden="true" className={`w-10 h-10 rounded-xl border-2 border-titi-dark grid place-items-center shrink-0 -rotate-6 ${v.chip}`}>
          <v.Icon className="w-5 h-5" />
        </span>
      </header>

      {esCurso && item.curso && <CourseTile curso={item.curso} onOpen={onOpenCourse} />}

      {esCurso && !item.curso && (
        <p className="mt-3 text-sm font-semibold text-gray-500">Este curso ya no está disponible.</p>
      )}

      {item.type === 'logro' && item.logroNombre && (
        <div className="mt-3 flex items-center gap-3 bg-purple-100 border-2 border-titi-dark rounded-2xl p-3">
          <span className="w-11 h-11 rounded-xl bg-titi-achievement text-white border-2 border-titi-dark grid place-items-center shrink-0 rotate-6">
            <AwardIcon className="w-6 h-6" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-wide text-titi-achievement">Logro desbloqueado</p>
            <p className="text-base font-extrabold text-titi-dark truncate">{item.logroNombre}</p>
          </div>
        </div>
      )}
    </article>
  );
}

/** Mini tile del curso: portada de la categoría + título; abre la vista rápida. */
function CourseTile({ curso, onOpen }) {
  const theme = categoryTheme(curso.categoria?.nombre);
  const className = [
    'group mt-3 w-full flex items-stretch gap-3 p-2.5 pr-3 text-left bg-white rounded-2xl border-2 border-titi-dark',
    'shadow-[0_4px_0_#1A1A2E] hover:-translate-y-0.5 hover:shadow-[0_6px_0_#1A1A2E] active:translate-y-[3px] active:shadow-[0_1px_0_#1A1A2E]',
    'transition-all duration-150 focus:outline-none focus-visible:ring-4 focus-visible:ring-titi-yellow motion-reduce:transition-none',
  ].join(' ');
  const body = (
    <>
      <CourseCover curso={curso} iconSize="sm" className="w-20 min-h-[72px] rounded-xl border-2 border-titi-dark shrink-0" />
      <span className="min-w-0 flex-1 flex flex-col justify-center gap-1">
        <span className={`inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide truncate ${theme.text}`}>
          <span className={`w-5 h-5 rounded-md grid place-items-center text-white shrink-0 ${theme.solid}`}>
            <CategoryIcon nombre={curso.categoria?.nombre} className="w-3 h-3" />
          </span>
          {curso.categoria?.nombre || 'General'}
        </span>
        <span className="text-base font-extrabold text-titi-dark leading-snug line-clamp-2">{curso.titulo}</span>
      </span>
      <span className="self-center inline-flex items-center gap-1 h-9 pl-3 pr-2 rounded-xl bg-titi-yellow text-titi-dark text-sm font-extrabold border-2 border-titi-dark shrink-0 transition-transform duration-150 group-hover:translate-x-0.5">
        <span className="hidden sm:inline">Ver curso</span>
        <ChevronRightIcon className="w-4 h-4" />
      </span>
    </>
  );

  // Enlace real (se puede abrir en otra pestaña); con `onOpen`, un clic común
  // abre la vista rápida en el lugar.
  function handleClick(e) {
    if (!onOpen || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    onOpen(curso);
  }
  return (
    <Link to={`/courses/${curso.id}`} onClick={handleClick} className={className}>
      {body}
    </Link>
  );
}
