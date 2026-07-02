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

// ---- Íconos de tipo de material / editor (trazo, mismo estilo que categorías) ----

// Documento (pdf y afines).
export function FileIcon({ className = 'w-5 h-5' }) {
  return (
    <LineSvg className={className}>
      <path d="M14 2.5H7a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7.5l-5-5Z" />
      <path d="M14 2.5v5h5" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="17" x2="13" y2="17" />
    </LineSvg>
  );
}

// Lápiz — escribir/editar (word, respuesta corta, editar evaluación).
export function PencilIcon({ className = 'w-5 h-5' }) {
  return (
    <LineSvg className={className}>
      <path d="M17 3.5a2.1 2.1 0 0 1 3 3L8.5 18l-4 1 1-4L17 3.5Z" />
      <line x1="14.5" y1="6" x2="18" y2="9.5" />
    </LineSvg>
  );
}

// Imagen.
export function ImageIcon({ className = 'w-5 h-5' }) {
  return (
    <LineSvg className={className}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="M20.5 15.5 15.5 11l-8 8" />
    </LineSvg>
  );
}

// Clip — adjunto genérico.
export function ClipIcon({ className = 'w-5 h-5' }) {
  return (
    <LineSvg className={className}>
      <path d="m20 11.5-8.2 8.2a5 5 0 0 1-7-7L13 4.4a3.3 3.3 0 0 1 4.7 4.7l-8.1 8.1a1.7 1.7 0 0 1-2.4-2.4l7.6-7.5" />
    </LineSvg>
  );
}

// Lista con viñetas — opción múltiple.
export function ListIcon({ className = 'w-5 h-5' }) {
  return (
    <LineSvg className={className}>
      <line x1="9" y1="6" x2="20" y2="6" />
      <line x1="9" y1="12" x2="20" y2="12" />
      <line x1="9" y1="18" x2="20" y2="18" />
      <circle cx="4.5" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="18" r="1" fill="currentColor" stroke="none" />
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

// ---- Íconos de navegación (navbar/chrome) ----
// Trazo 2.2 — un punto más grueso que los de categoría: se leen chicos (w-5)
// sobre el sidebar oscuro.

function NavSvg({ className, children }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

// Casa — Inicio / feed.
export function HomeIcon({ className = 'w-5 h-5' }) {
  return (
    <NavSvg className={className}>
      <path d="M3 9.5 12 3l9 6.5V21a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1V9.5Z" />
    </NavSvg>
  );
}

// Brújula — Explorar.
export function CompassIcon({ className = 'w-5 h-5' }) {
  return (
    <NavSvg className={className}>
      <circle cx="12" cy="12" r="9" />
      <polygon points="15 9 13 13 9 15 11 11 15 9" />
    </NavSvg>
  );
}

// Libro cerrado — catálogo de Cursos (el abierto, BookIcon, es el fallback de portadas).
export function BooksIcon({ className = 'w-5 h-5' }) {
  return (
    <NavSvg className={className}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
    </NavSvg>
  );
}

// Persona — Mi perfil.
export function UserIcon({ className = 'w-5 h-5' }) {
  return (
    <NavSvg className={className}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </NavSvg>
  );
}

// Campana — Notificaciones.
export function BellIcon({ className = 'w-5 h-5' }) {
  return (
    <NavSvg className={className}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </NavSvg>
  );
}

// Escudo — panel Admin.
export function ShieldIcon({ className = 'w-5 h-5' }) {
  return (
    <NavSvg className={className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
    </NavSvg>
  );
}

// Bolsa — Tienda.
export function BagIcon({ className = 'w-5 h-5' }) {
  return (
    <NavSvg className={className}>
      <path d="M6 8h12l1 12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1L6 8Z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </NavSvg>
  );
}

// Etiqueta — categorías (panel admin).
export function TagIcon({ className = 'w-5 h-5' }) {
  return (
    <NavSvg className={className}>
      <path d="M12.6 2.6 21 11a2 2 0 0 1 0 2.8l-7.2 7.2a2 2 0 0 1-2.8 0L2.6 12.6A2 2 0 0 1 2 11.2V4a2 2 0 0 1 2-2h7.2c.5 0 1 .2 1.4.6Z" />
      <circle cx="7.5" cy="7.5" r="1.3" fill="currentColor" stroke="none" />
    </NavSvg>
  );
}

// Calendario — temporadas / fechas (header del Ranking).
export function CalendarIcon({ className = 'w-5 h-5' }) {
  return (
    <NavSvg className={className}>
      <rect x="3.5" y="5" width="17" height="16" rx="2" />
      <line x1="3.5" y1="10" x2="20.5" y2="10" />
      <line x1="8" y1="2.5" x2="8" y2="6.5" />
      <line x1="16" y1="2.5" x2="16" y2="6.5" />
      <circle cx="8.5" cy="14.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="14.5" r="1" fill="currentColor" stroke="none" />
    </NavSvg>
  );
}

// Reloj — cuentas regresivas.
export function ClockIcon({ className = 'w-5 h-5' }) {
  return (
    <NavSvg className={className}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15.5 14" />
    </NavSvg>
  );
}

// Grupo de personas — estudiantes inscritos.
export function UsersIcon({ className = 'w-5 h-5' }) {
  return (
    <NavSvg className={className}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 5a3.5 3.5 0 0 1 0 7" />
      <path d="M17.5 14.5a6.5 6.5 0 0 1 4 5.5" />
    </NavSvg>
  );
}

// Salir — logout.
export function LogoutIcon({ className = 'w-5 h-5' }) {
  return (
    <NavSvg className={className}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </NavSvg>
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
