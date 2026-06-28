// TitiMascot — la mascota Titi. Reproduce la animación (GIF/WebP/APNG) que
// corresponde al estado, con entrada pop (GSAP) y burbuja de mensaje.
//
// - Fiel al arte real: usa los assets de /public/titi/ (las animaciones que
//   vos creás). Mientras un asset no exista, cae al /Titi.png estático.
// - Respeta prefers-reduced-motion: muestra el PNG estático (sin animación).
// - API retrocompatible: acepta `mood` (como antes) o `state` directo.
import { usePopIn } from '../lib/motion.js';
import { TITI_STATES, TITI_POSTER, MOOD_TO_STATE } from './titi/titiAssets.js';

const sizes = { sm: 'w-16 h-16', md: 'w-24 h-24', lg: 'w-36 h-36', xl: 'w-48 h-48', '2xl': 'w-64 h-64' };
// La animación de "celebra" se muestra un escalón más grande en todos lados.
const SIZE_ORDER = ['sm', 'md', 'lg', 'xl', '2xl'];
function bumpForCelebra(size) {
  const i = SIZE_ORDER.indexOf(size);
  return i >= 0 && i < SIZE_ORDER.length - 1 ? SIZE_ORDER[i + 1] : size;
}

const moodMsg = {
  happy: '¡Así se hace!', sad: 'No encontré nada...', surprised: '¡Wow!',
  motivating: '¡Tú puedes!', idle: 'Todo tranquilo por aquí', celebrating: '¡Lo lograste!',
  fire: '¡Estás en racha!', proud: '¡Sabía que podías!',
};
const moodEmoji = {
  happy: '🎉', sad: '😔', surprised: '😮', motivating: '💪',
  idle: '😊', celebrating: '🏆', fire: '🔥', proud: '⭐',
};

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function TitiMascot({ mood = 'happy', state, message, size = 'md', className = '', customSrc }) {
  const popRef = usePopIn();
  const resolved = state || MOOD_TO_STATE[mood] || 'idle';
  const asset = TITI_STATES[resolved] || TITI_STATES.idle;
  const effectiveSize = resolved === 'celebra' ? bumpForCelebra(size) : size;
  const sizeClass = sizes[effectiveSize] || sizes.md;
  const text = message ?? moodMsg[mood] ?? '';
  const emoji = moodEmoji[mood] ?? '';

  // Con reduced-motion mostramos el PNG estático; si no, la animación.
  const reduced = prefersReducedMotion();
  const src = reduced ? TITI_POSTER : (customSrc || asset.src);

  return (
    <div ref={popRef} className={`flex flex-col items-center gap-3 ${className}`}>
      <img
        // `key` por estado: re-monta el <img> al cambiar de estado, así las
        // animaciones play-once (celebra/triste/saludo, loop:false) vuelven a
        // arrancar desde el frame 0 en vez de quedar congeladas.
        key={reduced ? 'static' : resolved}
        src={src}
        alt="Titi"
        loading="lazy"
        decoding="async"
        className={`${sizeClass} object-contain drop-shadow-lg select-none`}
        draggable={false}
        // Si la animación todavía no existe, cae al Titi.png de siempre.
        onError={(e) => {
          if (!e.currentTarget.src.endsWith(TITI_POSTER)) e.currentTarget.src = TITI_POSTER;
        }}
      />
      {text && (
        <p className="text-titi-text font-bold text-center text-sm sm:text-base max-w-xs leading-snug">
          {emoji && <span aria-hidden="true" className="mr-1">{emoji}</span>}
          {text}
        </p>
      )}
    </div>
  );
}
