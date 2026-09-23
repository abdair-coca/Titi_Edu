import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import client from '../api/client.js';

// Estado efímero y compartido entre el aviso de configuración y las dos
// variantes (desktop/móvil) del panel. Nunca se persiste fuera de la memoria
// del tab.
const availabilityCache = new Map();
const pendingRequests = new Map();
const availabilityListeners = new Map();

function keyFor(userKey, lessonId) {
  return `${userKey || 'anonymous'}:${lessonId}`;
}

function notifyAvailability(key, status) {
  for (const listener of availabilityListeners.get(key) || []) listener(status);
}

function subscribeAvailability(key, listener) {
  const listeners = availabilityListeners.get(key) || new Set();
  listeners.add(listener);
  availabilityListeners.set(key, listeners);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) availabilityListeners.delete(key);
  };
}

function requestAvailability({ userKey, lessonId, force = false }) {
  const key = keyFor(userKey, lessonId);
  if (force) availabilityCache.delete(key);
  const cached = availabilityCache.get(key);
  if (cached) return { promise: Promise.resolve(cached), release: () => {} };

  let entry = pendingRequests.get(key);
  if (!entry) {
    const controller = new AbortController();
    entry = { controller, consumers: 0, settled: false, promise: null };
    entry.promise = client
      .get(`/api/lessons/${lessonId}/chat/status`, { signal: controller.signal })
      .then(({ data }) => {
        if (!data?.success) throw new Error(data?.message || 'No se pudo verificar la disponibilidad del tutor.');
        const availability = data.data || null;
        if (availability) {
          availabilityCache.set(key, availability);
          notifyAvailability(key, availability);
        }
        return availability;
      })
      .finally(() => {
        entry.settled = true;
        if (pendingRequests.get(key) === entry) pendingRequests.delete(key);
      });
    pendingRequests.set(key, entry);
  }

  entry.consumers += 1;
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    entry.consumers -= 1;
    if (entry.consumers === 0 && !entry.settled) {
      entry.controller.abort();
      if (pendingRequests.get(key) === entry) pendingRequests.delete(key);
    }
  };

  return { promise: entry.promise, release };
}

export function clearTutorAvailabilityCache() {
  availabilityCache.clear();
  for (const entry of pendingRequests.values()) entry.controller.abort();
  pendingRequests.clear();
}

export function invalidateTutorAvailability({ userKey, lessonId }) {
  availabilityCache.delete(keyFor(userKey, lessonId));
}

export function useTutorAvailability(lessonId, { enabled = true } = {}) {
  const { user } = useAuth();
  const userKey = user?.id || user?.neoId || user?.email || 'anonymous';
  const previousUserKeyRef = useRef(userKey);
  const [state, setState] = useState({
    status: null,
    error: null,
    loading: Boolean(enabled && lessonId),
  });

  useEffect(() => {
    if (previousUserKeyRef.current !== userKey) {
      clearTutorAvailabilityCache();
      previousUserKeyRef.current = userKey;
    }
  }, [userKey]);

  useEffect(() => {
    if (!enabled || !lessonId) return undefined;
    return subscribeAvailability(keyFor(userKey, lessonId), (status) => {
      setState({ status, error: null, loading: false });
    });
  }, [enabled, lessonId, userKey]);

  const refresh = useCallback(({ force = false, showLoading = true } = {}) => {
    if (!enabled || !lessonId) return Promise.resolve(null);
    if (showLoading) setState((prev) => ({ ...prev, loading: true, error: null }));
    const request = requestAvailability({ userKey, lessonId, force });
    return request.promise
      .then((status) => {
        setState({ status, error: null, loading: false });
        return status;
      })
      .catch((error) => {
        setState((prev) => ({ ...prev, error, loading: false }));
        return null;
      })
      .finally(() => request.release());
  }, [enabled, lessonId, userKey]);

  useEffect(() => {
    if (!enabled || !lessonId) {
      setState({ status: null, error: null, loading: false });
      return undefined;
    }

    let cancelled = false;
    setState({ status: null, error: null, loading: true });
    const request = requestAvailability({ userKey, lessonId });
    request.promise
      .then((status) => {
        if (!cancelled) setState({ status, error: null, loading: false });
      })
      .catch((error) => {
        if (!cancelled) setState({ status: null, error, loading: false });
      });

    return () => {
      cancelled = true;
      request.release();
    };
  }, [enabled, lessonId, userKey]);

  return {
    status: state.status,
    statusError: state.error,
    loading: state.loading,
    refresh,
  };
}
