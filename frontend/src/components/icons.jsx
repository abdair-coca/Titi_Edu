// Íconos SVG de marca (reemplazan emoji decorativos hardcodeados en la UI plana).
// Los íconos que vienen de data (categoria.icono) NO se tocan; estos son los
// decorativos fijos del front (gota, libro de fallback).

// Gota (las "gotas" = XP de la gamificación). Color por `text-*` del padre.
export function GotaIcon({ className = 'w-5 h-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2.2c-.4 0-.8.2-1 .5C8.7 5.6 5 10.8 5 14.5a7 7 0 0 0 14 0c0-3.7-3.7-8.9-6-11.8-.2-.3-.6-.5-1-.5Zm-1.6 8.1a1 1 0 0 1 1.4 1.4 3 3 0 0 0-.6 3.4 1 1 0 1 1-1.8.8 5 5 0 0 1 1-5.6Z" />
    </svg>
  );
}

// Rayo — usado en el stat card de "Gotas totales" del dashboard de Mis cursos.
export function BoltIcon({ className = 'w-6 h-6' }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12.9 2.3c.4-.4 1-.1 1 .4v7.8h5.4c.5 0 .8.6.4 1L10.6 21.6c-.4.5-1.2.1-1-.5l1.6-8.1H5.7c-.5 0-.8-.6-.4-1L12.9 2.3Z" />
    </svg>
  );
}

// Diana — usado en el stat card de "Tu progreso" del dashboard de Mis cursos.
export function TargetIcon({ className = 'w-6 h-6' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5.2" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Libro abierto — fallback genérico cuando un curso/categoría no tiene
// imagen ni ícono propio. Trazo (no relleno) para el estilo plano.
export function BookIcon({ className = 'w-12 h-12' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 6.5C10.3 5.2 7.9 4.8 5.5 5a1 1 0 0 0-1 1v11a1 1 0 0 0 1.1 1c2.1-.2 4.4.2 5.9 1.4 1.5-1.2 3.8-1.6 5.9-1.4a1 1 0 0 0 1.1-1V6a1 1 0 0 0-1-1c-2.4-.2-4.8.2-6.5 1.5Z" />
      <line x1="12" y1="6.5" x2="12" y2="19.5" />
    </svg>
  );
}

// ---- Íconos de categoría (trazo monocromo) para la ruta de aprendizaje ----
// Se muestran dentro del círculo de cada nodo, en relación a la materia del curso.

function LineSvg({ className, children }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

// Programación — </>
export function CodeIcon({ className = 'w-5 h-5' }) {
  return (
    <LineSvg className={className}>
      <polyline points="8 8 4 12 8 16" />
      <polyline points="16 8 20 12 16 16" />
      <line x1="13.5" y1="6" x2="10.5" y2="18" />
    </LineSvg>
  );
}

// Ciencia de datos / Machine Learning — chip
export function ChipIcon({ className = 'w-5 h-5' }) {
  return (
    <LineSvg className={className}>
      <rect x="7" y="7" width="10" height="10" rx="1.5" />
      <line x1="10" y1="3.5" x2="10" y2="6" />
      <line x1="14" y1="3.5" x2="14" y2="6" />
      <line x1="10" y1="18" x2="10" y2="20.5" />
      <line x1="14" y1="18" x2="14" y2="20.5" />
      <line x1="18" y1="10" x2="20.5" y2="10" />
      <line x1="18" y1="14" x2="20.5" y2="14" />
      <line x1="3.5" y1="10" x2="6" y2="10" />
      <line x1="3.5" y1="14" x2="6" y2="14" />
    </LineSvg>
  );
}

// Matemáticas — √x / función
export function SigmaIcon({ className = 'w-5 h-5' }) {
  return (
    <LineSvg className={className}>
      <path d="M17 5H7l6 7-6 7h10" />
    </LineSvg>
  );
}

// Idiomas — globo
export function GlobeIcon({ className = 'w-5 h-5' }) {
  return (
    <LineSvg className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z" />
    </LineSvg>
  );
}

// Ciencias — matraz
export function FlaskIcon({ className = 'w-5 h-5' }) {
  return (
    <LineSvg className={className}>
      <path d="M9 3h6" />
      <path d="M10 3v6l-5 8a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-8V3" />
      <path d="M7 15h10" />
    </LineSvg>
  );
}

// Diseño — pincel/paleta
export function PaletteIcon({ className = 'w-5 h-5' }) {
  return (
    <LineSvg className={className}>
      <path d="M12 3a9 9 0 1 0 0 18c1 0 1.7-.8 1.7-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.1a1.7 1.7 0 0 1 1.7-1.7H16a5 5 0 0 0 5-5c0-4-4-7.3-9-7.3Z" />
      <circle cx="7.5" cy="11.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="8" r="1" fill="currentColor" stroke="none" />
      <circle cx="16.5" cy="11.5" r="1" fill="currentColor" stroke="none" />
    </LineSvg>
  );
}

// Negocios — gráfico de barras/tendencia
export function ChartIcon({ className = 'w-5 h-5' }) {
  return (
    <LineSvg className={className}>
      <path d="M4 20V4" />
      <path d="M4 20h16" />
      <path d="M7 16l4-5 3 3 5-7" />
    </LineSvg>
  );
}

// Música — nota
export function MusicIcon({ className = 'w-5 h-5' }) {
  return (
    <LineSvg className={className}>
      <path d="M9 18V5l11-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="17" cy="16" r="3" />
    </LineSvg>
  );
}

// Check — usado en "Completado" (ruta de aprendizaje y actividad reciente).
export function CheckIcon({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

// Medalla — actividad reciente: evaluación aprobada.
export function AwardIcon({ className = 'w-5 h-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="5" />
      <path d="M9 12.5 7 21l5-3 5 3-2-8.5" />
    </svg>
  );
}

// Birrete — actividad reciente: curso completado.
export function GraduationIcon({ className = 'w-5 h-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 9 12 4l10 5-10 5-10-5Z" />
      <path d="M6 11.5V17c0 1.1 2.7 2 6 2s6-.9 6-2v-5.5" />
      <path d="M21 9v6" />
    </svg>
  );
}

// Trofeo — banner de cierre de "Mis cursos".
export function TrophyIcon({ className = 'w-6 h-6' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" />
      <path d="M8 5H5a2 2 0 0 0 0 4c.6 0 1.2-.2 1.7-.6" />
      <path d="M16 5h3a2 2 0 0 1 0 4c-.6 0-1.2-.2-1.7-.6" />
      <path d="M12 13v3" />
      <path d="M9.5 16.5h5l.7 3.5h-6.4l.7-3.5Z" />
    </svg>
  );
}

/**
 * Devuelve el componente de ícono de trazo que mejor representa a la categoría
 * de un curso (por su nombre). Fallback: BookIcon.
 */
export function categoryIcon(nombre) {
  const n = (nombre || '').toLowerCase();
  if (/(program|código|codigo|desarrollo|web|software)/.test(n)) return CodeIcon;
  if (/(dato|data|machine|inteligencia|ia|analít|analit)/.test(n)) return ChipIcon;
  if (/(matem|cálculo|calculo|álgebra|algebra|estadíst|estadist)/.test(n)) return SigmaIcon;
  if (/(idioma|lenguaj|inglés|ingles|español|espanol)/.test(n)) return GlobeIcon;
  if (/(cienc|física|fisica|químic|quimic|biolog)/.test(n)) return FlaskIcon;
  if (/(diseñ|disen|design|arte|gráfic|grafic)/.test(n)) return PaletteIcon;
  if (/(negoci|business|finanz|marketing|empren)/.test(n)) return ChartIcon;
  if (/(music|músic)/.test(n)) return MusicIcon;
  return BookIcon;
}
