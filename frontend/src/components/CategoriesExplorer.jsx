import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client.js';
import { categoryIcon } from './icons.jsx';

// Chip sólido rotado por índice — duotono por rol de design.md §2
// (logro/info/éxito/XP): color pleno + ícono blanco (oscuro sobre amarillo).
const CAT_TINTS = [
  'bg-titi-achievement text-white',
  'bg-blue-500 text-white',
  'bg-green-500 text-white',
  'bg-titi-yellow text-titi-dark',
];

/**
 * CategoriesExplorer — fila de accesos a /courses?categoria=<id>.
 * Solo categorías con al menos un curso (máx 4 visibles). Se usa en
 * "Mis cursos" y en los rails laterales de Feed/Explore.
 */
export default function CategoriesExplorer() {
  const navigate = useNavigate();
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

  const withCourses = (categorias || []).filter((c) => (c._count?.cursos ?? 0) > 0);
  const visible = withCourses.slice(0, 4);

  if (error) return null;

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-titi-dark">Explorar categorías</h2>
        <button
          type="button"
          onClick={() => navigate('/courses')}
          className="text-sm font-bold text-blue-500 hover:text-blue-600 uppercase tracking-wide transition-all duration-150 active:scale-95 whitespace-nowrap"
        >
          Ver todas
        </button>
      </div>

      {categorias === null ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <p className="text-sm text-gray-500">Aún no hay categorías con cursos.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {visible.map((cat, i) => {
            const Icon = categoryIcon(cat.nombre);
            const count = cat._count?.cursos ?? 0;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => navigate(`/courses?categoria=${cat.id}`)}
                className="flex flex-col items-center gap-1.5 text-center rounded-xl py-3 px-1 hover:bg-titi-cream active:scale-[0.96] transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-titi-yellow"
              >
                <span
                  className={`w-11 h-11 rounded-full grid place-items-center shrink-0 shadow-sm ${CAT_TINTS[i % CAT_TINTS.length]}`}
                >
                  <Icon className="w-5 h-5" />
                </span>
                <span className="text-xs font-bold text-titi-dark leading-tight line-clamp-2">
                  {cat.nombre}
                </span>
                <span className="text-xs font-semibold text-gray-500">
                  {count} {count === 1 ? 'curso' : 'cursos'}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
