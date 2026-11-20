// Soporte de las escenas 3D de /courses (habitación y cielo del header).
// Vive en el chunk principal: NO importa three. Decide si conviene montar 3D
// (reduced-motion, ahorro de datos, WebGL) y escucha el ancho de pantalla.
import { Component, useEffect, useState } from 'react';

export const MOBILE_QUERY = '(max-width: 639px)';

export function canShow3D() {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
  if (navigator.connection?.saveData) return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

// Escucha una media query y devuelve si coincide.
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);
    setMatches(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

// Perfil liviano en pantallas chicas (spec H6).
export function useIsMobile() {
  return useMediaQuery(MOBILE_QUERY);
}

// Descarga diferida: cuando el navegador está libre después de la carga, así
// los chunks 3D no compiten con lo que pinta primero (LCP).
export function useIdleLoad(enabled) {
  const [load, setLoad] = useState(false);
  useEffect(() => {
    if (!enabled || load) return undefined;
    let idleId;
    let timeoutId;
    const start = () => {
      if (window.requestIdleCallback) idleId = window.requestIdleCallback(() => setLoad(true), { timeout: 2000 });
      else timeoutId = window.setTimeout(() => setLoad(true), 300);
    };
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });
    return () => {
      window.removeEventListener('load', start);
      if (idleId) window.cancelIdleCallback?.(idleId);
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [enabled, load]);
  return load;
}

// Pausa el render fuera de pantalla o con la pestaña oculta (spec H6).
export function useInViewActive(ref, enabled) {
  const [active, setActive] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return undefined;
    let inView = true;
    const update = () => setActive(inView && document.visibilityState === 'visible');
    const obs = typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver(([entry]) => {
          inView = entry.isIntersecting;
          update();
        })
      : null;
    obs?.observe(el);
    document.addEventListener('visibilitychange', update);
    return () => {
      obs?.disconnect();
      document.removeEventListener('visibilitychange', update);
    };
  }, [ref, enabled]);
  return active;
}

// La escena nunca rompe la página: cualquier error (modelo que no carga, chunk
// que falla) avisa con onFail y no pinta nada.
export class SceneBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    this.props.onFail(`error: ${error?.message}`);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
