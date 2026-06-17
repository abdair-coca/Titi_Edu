import { Link } from 'react-router-dom';
import { relativeTime } from '../lib/format.js';

// Verbo + emoji según el tipo de actividad académica.
const VERBO = {
  inscripcion: { texto: 'se inscribió en', emoji: '📚' },
  curso_completado: { texto: 'completó', emoji: '🎓' },
  logro: { texto: 'desbloqueó el logro', emoji: '🏅' },
};

/**
 * Tarjeta de actividad académica para el feed (subfase 4.4 / AGENTS §4.1).
 * Recibe un item de GET /api/posts/feed/academic:
 *   { actorUsername, actorAvatarUrl, type, cursoId?, curso?, logroNombre?, createdAt }
 */
export default function AcademicActivityCard({ item }) {
  const v = VERBO[item.type] || { texto: 'tuvo actividad', emoji: '✨' };
  const esCurso = item.type === 'inscripcion' || item.type === 'curso_completado';

  return (
    <article className="bg-white rounded-2xl border border-titi-border shadow-titi p-4 mb-6">
      <header className="flex items-center gap-3">
        <Avatar username={item.actorUsername} avatarUrl={item.actorAvatarUrl} />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-titi-text leading-snug">
            <Link
              to={`/profile/${item.actorUsername}`}
              className="font-extrabold hover:text-titi-yellow-dark"
            >
              @{item.actorUsername}
            </Link>{' '}
            <span className="font-semibold text-titi-muted">{v.texto}</span>{' '}
            <span aria-hidden="true">{v.emoji}</span>
          </p>
          <p className="text-xs text-titi-muted font-semibold mt-0.5">
            {relativeTime(item.createdAt)}
          </p>
        </div>
      </header>

      {esCurso && item.curso && (
        <Link
          to={`/courses/${item.curso.id}`}
          className="titi-card-pop mt-3 flex items-center gap-3 bg-titi-cream border border-titi-border rounded-xl p-3 hover:border-titi-yellow group"
        >
          <span className="text-2xl select-none shrink-0" aria-hidden="true">
            {item.curso.categoria?.icono || '📘'}
          </span>
          <div className="min-w-0 flex-1">
            {item.curso.categoria?.nombre && (
              <span className="text-xs font-semibold text-titi-streak uppercase tracking-wide">
                {item.curso.categoria.nombre}
              </span>
            )}
            <p className="text-sm font-bold text-titi-dark line-clamp-1">{item.curso.titulo}</p>
          </div>
          <span className="text-sm font-bold text-titi-dark group-hover:text-titi-yellow-dark whitespace-nowrap shrink-0">
            Ver este curso →
          </span>
        </Link>
      )}

      {esCurso && !item.curso && (
        <p className="mt-3 text-xs text-titi-muted italic">Este curso ya no está disponible.</p>
      )}

      {item.type === 'logro' && item.logroNombre && (
        <div className="mt-3 inline-flex items-center gap-2 bg-titi-achievement/10 border border-titi-achievement/30 rounded-full px-3 py-1.5">
          <span aria-hidden="true">🏅</span>
          <span className="text-sm font-bold text-titi-achievement">{item.logroNombre}</span>
        </div>
      )}
    </article>
  );
}

function Avatar({ username, avatarUrl }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className="w-11 h-11 rounded-full bg-titi-bg border-2 border-titi-yellow shrink-0"
      />
    );
  }
  return (
    <div className="w-11 h-11 rounded-full bg-titi-yellow text-titi-dark grid place-items-center font-extrabold shrink-0">
      {username?.[0]?.toUpperCase() ?? '?'}
    </div>
  );
}
