// TitiMascot — la mascota Titi viva. Renderiza el SVG por capas (TitiSvg) y lo
// anima por estado con Framer Motion. Reactiva a eventos vía la prop `mood`.
// Respeta prefers-reduced-motion (si está activo, Titi queda quieto).
import { motion, useReducedMotion } from 'framer-motion';
import TitiSvg from './titi/TitiSvg.jsx';

// Cada mood del resto de la app mapea a un estado de animación.
const STATE_BY_MOOD = {
  happy: 'celebra',
  celebrating: 'celebra',
  proud: 'celebra',
  surprised: 'celebra',
  motivating: 'idle',
  idle: 'idle',
  sad: 'triste',
  fire: 'racha',
};

const moodMsg = {
  happy: '¡Así se hace!',
  sad: 'No encontré nada...',
  surprised: '¡Wow!',
  motivating: '¡Tú puedes!',
  idle: 'Todo tranquilo por aquí',
  celebrating: '¡Lo lograste!',
  fire: '¡Estás en racha!',
  proud: '¡Sabía que podías!',
};

const moodEmoji = {
  happy: '🎉', sad: '😔', surprised: '😮', motivating: '💪',
  idle: '😊', celebrating: '🏆', fire: '🔥', proud: '⭐',
};

const sizes = { sm: 'w-16 h-16', md: 'w-24 h-24', lg: 'w-36 h-36', xl: 'w-48 h-48' };

// Variants de Framer por estado. `idle` flota en loop; los demás reaccionan.
const VARIANTS = {
  idle: { y: [0, -6, 0], rotate: 0, scale: 1, transition: { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } },
  celebra: { y: [0, -16, 0], rotate: [0, -7, 7, 0], scale: 1, transition: { duration: 0.7, repeat: 2, ease: 'easeInOut' } },
  triste: { y: 4, rotate: 3, scale: 0.96, transition: { duration: 0.5, ease: 'easeOut' } },
  racha: { y: 0, rotate: [0, -4, 4, -4, 4, 0], scale: 1, transition: { duration: 0.5, repeat: Infinity, repeatDelay: 1.4, ease: 'easeInOut' } },
};

export default function TitiMascot({ mood = 'happy', message, size = 'md', className = '' }) {
  const reduce = useReducedMotion();
  const state = STATE_BY_MOOD[mood] || 'idle';
  const sizeClass = sizes[size] || sizes.md;
  const text = message ?? moodMsg[mood] ?? '';
  const emoji = moodEmoji[mood] ?? '';

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <motion.div
        className={`${sizeClass} select-none`}
        style={{ filter: 'drop-shadow(0 6px 8px rgba(0,0,0,0.18))' }}
        animate={reduce ? undefined : state}
        variants={reduce ? undefined : VARIANTS}
        initial={false}
      >
        <TitiSvg className="w-full h-full" />
      </motion.div>
      {text && (
        <p className="text-titi-text font-bold text-center text-sm sm:text-base max-w-xs leading-snug">
          {emoji && <span aria-hidden="true" className="mr-1">{emoji}</span>}
          {text}
        </p>
      )}
    </div>
  );
}
