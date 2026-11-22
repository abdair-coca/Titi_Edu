import { categoryIcon, categoryKey } from '../icons.jsx';

// Acento por categoría (design.md §2 "Acento de categoría"). Las clases van
// escritas enteras para que Tailwind las detecte.
const THEMES = {
  code: { solid: 'bg-titi-cat-code', tint: 'bg-titi-cat-code-light', text: 'text-titi-cat-code', border: 'border-titi-cat-code' },
  data: { solid: 'bg-titi-cat-data', tint: 'bg-titi-cat-data-light', text: 'text-titi-cat-data', border: 'border-titi-cat-data' },
  math: { solid: 'bg-titi-cat-math', tint: 'bg-titi-cat-math-light', text: 'text-titi-cat-math', border: 'border-titi-cat-math' },
  lang: { solid: 'bg-titi-cat-lang', tint: 'bg-titi-cat-lang-light', text: 'text-titi-cat-lang', border: 'border-titi-cat-lang' },
  science: { solid: 'bg-titi-cat-science', tint: 'bg-titi-cat-science-light', text: 'text-titi-cat-science', border: 'border-titi-cat-science' },
  design: { solid: 'bg-titi-cat-design', tint: 'bg-titi-cat-design-light', text: 'text-titi-cat-design', border: 'border-titi-cat-design' },
  business: { solid: 'bg-titi-cat-business', tint: 'bg-titi-cat-business-light', text: 'text-titi-cat-business', border: 'border-titi-cat-business' },
  music: { solid: 'bg-titi-cat-music', tint: 'bg-titi-cat-music-light', text: 'text-titi-cat-music', border: 'border-titi-cat-music' },
  other: { solid: 'bg-titi-dark', tint: 'bg-titi-yellow-light', text: 'text-titi-dark', border: 'border-titi-dark' },
};

/** Tema de una categoría por su nombre: { key, Icon, solid, tint, text, border }. */
export function categoryTheme(nombre) {
  const key = categoryKey(nombre);
  return { key, Icon: categoryIcon(nombre), ...THEMES[key] };
}

/**
 * Ícono de categoría con microinteracción: se redibuja y hace el gesto de su
 * materia cuando el contenedor `.group` recibe hover, foco o toque
 * (`.titi-cat-icon` en index.css; apagado con movimiento reducido).
 */
export function CategoryIcon({ nombre, className = 'w-5 h-5' }) {
  const { key, Icon } = categoryTheme(nombre);
  return (
    <span className="titi-cat-icon inline-grid place-items-center" data-cat={key} aria-hidden="true">
      <Icon className={className} />
    </span>
  );
}
