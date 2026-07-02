/**
 * Tarjeta de curso recomendado por amigos (subfase 4.4 / AGENTS §4.2).
 * UI plana (sin gradientes/blur). Muestra un chip "🤝 N amigos" con los
 * nombres de muestra en el tooltip.
 */
import { nivelTextClass } from '../lib/nivel.js';
import { BookIcon, UsersIcon } from './icons.jsx';

export default function RecommendedCourseCard({ curso, friendCount, sampleFriends = [], onOpen }) {
  const amigosLabel = friendCount === 1 ? '1 amigo' : `${friendCount} amigos`;
  const nivel = curso.nivel || 'sin nivel';
  const tooltip = sampleFriends.length
    ? sampleFriends.map((u) => `@${u}`).join(', ') +
      (friendCount > sampleFriends.length ? ' y más' : '')
    : '';

  return (
    <div
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      role="button"
      tabIndex={0}
      className="titi-card-pop bg-white rounded-2xl border-2 border-gray-200 shadow-[0_4px_0px_#E5E7EB] hover:border-titi-yellow hover:shadow-[0_6px_0px_#E5E7EB] active:translate-y-0.5 active:shadow-none overflow-hidden cursor-pointer flex flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-titi-yellow"
    >
      {/* Portada (plana) */}
      <div className="relative h-32 bg-titi-yellow-light overflow-hidden">
        {curso.portadaUrl ? (
          <img
            src={curso.portadaUrl}
            alt={curso.titulo}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : curso.categoria?.icono ? (
          <div className="w-full h-full grid place-items-center text-5xl select-none">
            {curso.categoria.icono}
          </div>
        ) : (
          <div className="w-full h-full grid place-items-center">
            <BookIcon className="w-12 h-12 text-titi-dark/30" />
          </div>
        )}

        {/* Chip de amigos */}
        <span
          title={tooltip}
          className="absolute top-3 left-3 inline-flex items-center gap-1 bg-white text-titi-dark text-xs font-bold px-2.5 py-1 rounded-full shadow-sm"
        >
          <UsersIcon className="w-3.5 h-3.5 text-titi-dark" aria-hidden="true" /> {amigosLabel}
        </span>
      </div>

      {/* Contenido */}
      <div className="p-4 flex flex-col gap-2 flex-1">
        {/* Meta: categoría + nivel (etiqueta de texto color, sin forma) */}
        <div className="flex items-center gap-2">
          {curso.categoria?.nombre && (
            <span className="text-xs font-semibold text-titi-streak uppercase tracking-wide truncate">
              {curso.categoria.nombre}
            </span>
          )}
          <span
            className={`ml-auto text-xs font-bold uppercase tracking-wide shrink-0 ${nivelTextClass(nivel)}`}
          >
            {nivel}
          </span>
        </div>
        <h3 className="text-base font-bold text-titi-dark leading-snug line-clamp-2">
          {curso.titulo}
        </h3>
        <p className="text-sm text-gray-500 font-medium">
          {curso._count?.modulos ?? 0} {curso._count?.modulos === 1 ? 'módulo' : 'módulos'}
          {curso.creador?.username && <> · Por {curso.creador.username}</>}
        </p>
      </div>
    </div>
  );
}
