import { useCallback, useEffect, useState } from 'react';
import client from '../../api/client.js';

/** GET que devuelve `data.data[key]` con carga, error y reintento. */
export function useApiList(url, key, { enabled = true } = {}) {
  const [state, setState] = useState({ items: [], loading: enabled, error: null });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!enabled || !url) {
      setState({ items: [], loading: false, error: null });
      return undefined;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    client
      .get(url)
      .then(({ data }) => {
        if (cancelled) return;
        if (data?.success) setState({ items: data.data?.[key] || [], loading: false, error: null });
        else setState({ items: [], loading: false, error: data?.message || 'No se pudo cargar' });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({ items: [], loading: false, error: err.response?.data?.message || err.message || 'Error de red' });
      });
    return () => {
      cancelled = true;
    };
  }, [url, key, enabled, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}

/** Gente para seguir (`GET /api/users/suggestions`). */
export const useSuggestions = (limit = 10) => useApiList(`/api/users/suggestions?limit=${limit}`, 'users');

/** Hashtags en tendencia (`GET /api/search/trending`). */
export const useTrending = (limit = 8) => useApiList(`/api/search/trending?limit=${limit}`, 'hashtags');
