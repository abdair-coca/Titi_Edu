// Marcas locales para comparar fases de optimización sin enviar datos fuera del
// navegador. El detalle puede ser un id de curso/lección, nunca contenido ni
// credenciales.
export function markPerformance(name, detail) {
  if (typeof performance === 'undefined' || typeof performance.mark !== 'function') return;
  const markName = `titi:${name}`;
  try {
    if (detail === undefined) performance.mark(markName);
    else performance.mark(markName, { detail: String(detail) });
  } catch {
    // Algunos navegadores antiguos no aceptan la opción detail.
    try { performance.mark(markName); } catch { /* noop */ }
  }
}

