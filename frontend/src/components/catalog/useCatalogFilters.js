import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import useQuickViewParam from './useQuickViewParam.js';
import { DEFAULT_FILTERS, filtersFromParams, filtersToParams } from './catalogData.js';

const SEARCH_DEBOUNCE_MS = 300;

/**
 * Estado del catálogo en la URL (R4, R6): búsqueda, filtros y `?curso=` de la
 * vista rápida. La búsqueda tiene un valor inmediato (`query`, el input del
 * hero) y llega a la URL con debounce; los filtros van directo.
 */
export default function useCatalogFilters(categorias) {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(() => filtersFromParams(searchParams, categorias), [searchParams, categorias]);
  const [query, setQueryState] = useState(filters.q);

  // Volver atrás / enlace externo: el input sigue a la URL.
  const lastWritten = useRef(filters.q);
  useEffect(() => {
    if (filters.q !== lastWritten.current) {
      lastWritten.current = filters.q;
      setQueryState(filters.q);
    }
  }, [filters.q]);

  const write = useCallback(
    (patch) => {
      setSearchParams(
        (prev) => filtersToParams({ ...filtersFromParams(prev, categorias), ...patch }, prev),
        { replace: true },
      );
    },
    [setSearchParams, categorias],
  );

  // Enlace viejo `?categoria=<id>`: se traduce a `?cat=<slug>` cuando llegan las categorías.
  useEffect(() => {
    if (searchParams.has('categoria') && categorias.length) write({});
  }, [searchParams, categorias, write]);

  useEffect(() => {
    if (query === filters.q) return undefined;
    const id = setTimeout(() => {
      lastWritten.current = query;
      write({ q: query });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query, filters.q, write]);

  const setFilter = useCallback(
    (patch) => {
      if ('q' in patch) {
        lastWritten.current = patch.q;
        setQueryState(patch.q);
      }
      write(patch);
    },
    [write],
  );

  const toggleNivel = useCallback(
    (id) => {
      const set = new Set(filters.niveles);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      write({ niveles: [...set] });
    },
    [filters.niveles, write],
  );

  const clearFilters = useCallback(() => {
    lastWritten.current = '';
    setQueryState('');
    write({ ...DEFAULT_FILTERS });
  }, [write]);

  /** Búsqueda escrita en el hero: busca en todo el catálogo (sale de la categoría). */
  const setQuery = useCallback(
    (value) => {
      setQueryState(value);
      if (value.trim() && filters.cat) write({ cat: '' });
    },
    [filters.cat, write],
  );

  // ---- Vista rápida ----
  const { openCourseId, openCourse, closeCourse } = useQuickViewParam();

  return {
    /** Filtros aplicados (la búsqueda ya con debounce). */
    filters,
    /** Texto del buscador tal cual se escribe. */
    query,
    setQuery,
    setFilter,
    toggleNivel,
    clearFilters,
    openCourseId,
    openCourse,
    closeCourse,
  };
}
