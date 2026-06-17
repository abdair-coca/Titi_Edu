import { usePopIn } from '../lib/motion.js';
import { MOTION } from '../lib/motion.js';

// Envuelve el contenido de una página. Hace zoom-in pop al montar.
// Se re-anima en cada navegación si el padre le pasa key={location.pathname}.
// Rebote más leve y escala más cercana a 1 que una card: es toda la página.
export default function PageTransition({ children }) {
  const ref = usePopIn([], { scale: 0.98, duration: MOTION.dur.base, ease: 'back.out(1.2)' });
  return <div ref={ref}>{children}</div>;
}
