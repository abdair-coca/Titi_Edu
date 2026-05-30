// Helpers compartidos: URLs de media y formato de fechas

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Resuelve un imageUrl del backend a una URL absoluta usable en <img>.
 * - null / undefined / '' → null
 * - Absoluta (http/https) → la devuelve tal cual
 * - Relativa (/uploads/...) → prefija con VITE_API_URL
 */
export function resolveMediaUrl(url) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/')) return `${API_BASE}${url}`;
  return `${API_BASE}/${url}`;
}

const RTF = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
const UNITS = [
  ['year', 60 * 60 * 24 * 365],
  ['month', 60 * 60 * 24 * 30],
  ['week', 60 * 60 * 24 * 7],
  ['day', 60 * 60 * 24],
  ['hour', 60 * 60],
  ['minute', 60],
  ['second', 1],
];

/** Devuelve "hace 2 horas", "ayer", "ahora", etc. */
export function relativeTime(input) {
  if (!input) return '';
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return '';
  const diffSec = Math.round((date.getTime() - Date.now()) / 1000);
  const absSec = Math.abs(diffSec);
  if (absSec < 5) return 'ahora';
  for (const [unit, secs] of UNITS) {
    if (absSec >= secs) {
      const value = Math.round(diffSec / secs);
      return RTF.format(value, unit);
    }
  }
  return RTF.format(diffSec, 'second');
}

/** Fecha larga en español: "30 de mayo de 2026". */
export function formatDate(input) {
  if (!input) return '';
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
