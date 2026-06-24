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
