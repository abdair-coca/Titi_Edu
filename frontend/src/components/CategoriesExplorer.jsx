import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client.js';
import { useStaggerReveal } from '../lib/motion.js';
import { categoriaSlug } from './catalog/catalogData.js';
import { CategoryIcon, categoryTheme } from './catalog/categoryTheme.jsx';

/**
 * CategoriesExplorer — accesos al catálogo filtrado por categoría
 * (`/courses?cat=<slug>`). Solo categorías con cursos, las de más cursos
 * primero. Look v3 (rediseno-inicio-explorar): superficie con borde oscuro y
 * mini tiles con el acento y la microinteracción de cada categoría.
 *
 * @param layout 'wide' (Mis cursos: 4 columnas en sm+) | 'rail' (2 columnas)
 * @param max    cuántas mostrar
 */
export default function CategoriesExplorer({ layout = 'wide', max = 4 }) {
  const [categorias, setCategorias] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    client
      .get('/api/categories')
      .then(({ data }) => {
        if (cancelled) return;
        if (data?.success) setCategorias(data.data?.categorias || []);
        else setError(true);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = (categorias || [])
    .filter((c) => (c._count?.cursos ?? 0) > 0)
    .sort((a, b) => (b._count?.cursos ?? 0) - (a._count?.cursos ?? 0))
    .slice(0, max);
  const gridRef = useStaggerReveal([visible.length]);
  const cols = layout === 'rail' ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4';

  if (error) return null;

  return (
    <section aria-label="Categorías" className="bg-white rounded-2xl border-2 border-titi-dark shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-lg font-extrabold text-titi-dark">
          Explorá por <span className="text-titi-streak">categoría</span>
        </h2>
        <Link
          to="/courses"
          className="text-sm font-bold text-blue-500 hover:text-blue-600 uppercase tracking-wide transition-all duration-150 active:scale-95 whitespace-nowrap"
        >
          Ver todas
        </Link>
      </div>

      {categorias === null ? (
        <div className={`grid ${cols} gap-2 animate-pulse motion-reduce:animate-none`}>
          {Array.from({ length: max }).map((_, i) => (
            <div key={i} className="h-[92px] bg-gray-100 rounded-xl" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <p className="text-sm font-medium text-gray-500">Todavía no hay categorías con cursos.</p>
      ) : (
        <div ref={gridRef} className={`grid ${cols} gap-2`}>
          {visible.map((cat) => {
            const theme = categoryTheme(cat.nombre);
            const count = cat._count?.cursos ?? 0;
            return (
              <Link
                key={cat.id}
                to={`/courses?cat=${encodeURIComponent(categoriaSlug(cat.nombre))}`}
                className={[
                  'group flex flex-col items-start gap-2 p-2.5 rounded-xl border-2 border-gray-200 bg-white text-left',
                  'shadow-[0_3px_0_#E5E7EB] hover:border-titi-dark hover:-translate-y-0.5 hover:shadow-[0_4px_0_#1A1A2E]',
                  'active:translate-y-0.5 active:shadow-none transition-all duration-150 motion-reduce:transition-none',
                  'focus:outline-none focus-visible:ring-4 focus-visible:ring-titi-yellow/60',
                ].join(' ')}
              >
                <span className={`w-9 h-9 rounded-xl border-2 border-titi-dark grid place-items-center text-white -rotate-6 transition-transform duration-200 group-hover:rotate-0 motion-reduce:transition-none ${theme.solid}`}>
                  <CategoryIcon nombre={cat.nombre} className="w-5 h-5" />
                </span>
                <span className="min-w-0 w-full">
                  <span className="block text-sm font-extrabold text-titi-dark leading-tight truncate">{cat.nombre}</span>
                  <span className="block text-xs font-bold text-gray-500 tabular-nums">
                    {count} {count === 1 ? 'curso' : 'cursos'}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
