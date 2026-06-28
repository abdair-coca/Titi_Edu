import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import client from '../api/client.js';
import { useAuth } from './AuthContext.jsx';

/**
 * GamificationContext — estado de gotas + cola de toasts + premio semanal.
 *
 * - `gotas` { saldo, total, semana }: refrescable con `refreshGotas()`.
 * - `pushGota(cantidad)`: encola un toast de "ganaste gotas" y refresca el saldo.
 *   Lo llaman las pantallas que reciben `gotas` en la respuesta de una acción
 *   (lección completada, evaluación aprobada).
 * - `weeklyPrize` { semana, gotasSemana } | null: si fui top de la semana pasada.
 *   Se detecta al entrar (GET /api/ranking/friends dispara el cálculo lazy).
 */
const GamificationContext = createContext(null);

const GOTAS_VACIAS = { saldo: 0, total: 0, semana: 0 };

export function GamificationProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [gotas, setGotas] = useState(GOTAS_VACIAS);
  const [gotaQueue, setGotaQueue] = useState([]); // [{ id, cantidad }]
  const [weeklyPrize, setWeeklyPrize] = useState(null);

  const refreshGotas = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const { data } = await client.get('/api/gotas');
      if (data?.success) setGotas(data.data);
    } catch {
      // silencioso — las gotas son un nice-to-have, no rompen la UI
    }
  }, [isAuthenticated]);

  const pushGota = useCallback(
    (cantidad) => {
      const n = Number(cantidad) || 0;
      if (n <= 0) return;
      setGotaQueue((q) => [...q, { id: crypto.randomUUID(), cantidad: n }]);
      refreshGotas();
    },
    [refreshGotas],
  );

  const shiftGota = useCallback(() => setGotaQueue((q) => q.slice(1)), []);
  const dismissWeeklyPrize = useCallback(() => setWeeklyPrize(null), []);

  // Al autenticar: cargar gotas + chequear premio semanal (el GET dispara el
  // cierre/premio lazy de la semana pasada en el backend). Al desloguear: limpiar.
  useEffect(() => {
    if (!isAuthenticated) {
      setGotas(GOTAS_VACIAS);
      setGotaQueue([]);
      setWeeklyPrize(null);
      return;
    }
    refreshGotas();
    let cancelled = false;
    client
      .get('/api/ranking/friends')
      .then(({ data }) => {
        if (!cancelled && data?.success && data.data.premio) {
          setWeeklyPrize(data.data.premio);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, refreshGotas]);

  return (
    <GamificationContext.Provider
      value={{
        gotas,
        refreshGotas,
        gotaQueue,
        pushGota,
        shiftGota,
        weeklyPrize,
        dismissWeeklyPrize,
      }}
    >
      {children}
    </GamificationContext.Provider>
  );
}

export function useGamification() {
  const ctx = useContext(GamificationContext);
  if (!ctx) {
    throw new Error('useGamification debe usarse dentro de <GamificationProvider>');
  }
  return ctx;
}
