// Piezas comunes del cielo del header (chunk diferido de SkyScene).
//
// Todo el cielo piensa en píxeles del lienzo (los carriles salen de medir el
// texto real) y recién al dibujar pasa a unidades de mundo. La cámara es en
// perspectiva y mira de frente al plano z = 0: ahí 1 px = viewport.height /
// size.height unidades.
import { createContext, useContext, useMemo, useRef } from 'react';

export const TAU = Math.PI * 2;

export const SkyContext = createContext(null);
export const useSky = () => useContext(SkyContext);

// Unidades de mundo por píxel en el plano z = 0.
export const pxUnit = (state) => state.viewport.height / state.size.height;

// Coloca `obj` en el punto (x, y) del lienzo (px, origen arriba a la izquierda).
export function placeAt(state, obj, x, y, z = 0) {
  const f = pxUnit(state);
  obj.position.set((x - state.size.width / 2) * f, (state.size.height / 2 - y) * f, z);
}

// Puntero en px del lienzo (el compute del Canvas lo deja en state.pointer).
export function pointerPx(state) {
  return {
    x: ((state.pointer.x + 1) / 2) * state.size.width,
    y: ((1 - state.pointer.y) / 2) * state.size.height,
  };
}

// Damping exponencial independiente de los FPS.
export const damp = (current, target, lambda, dt) => current + (target - current) * (1 - Math.exp(-lambda * dt));

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const rand = (lo, hi) => lo + Math.random() * (hi - lo);

export const lerp = (a, b, t) => a + (b - a) * t;

// Punto de una curva cuadrática (p0 → p1 con control c) en u ∈ [0, 1].
export function quadPoint(p0, c, p1, u) {
  const v = 1 - u;
  return { x: v * v * p0.x + 2 * v * u * c.x + u * u * p1.x, y: v * v * p0.y + 2 * v * u * c.y + u * u * p1.y };
}

// Largo aproximado de esa curva (para que la velocidad sea pareja entre vuelos).
export function quadLength(p0, c, p1) {
  let len = 0;
  let prev = p0;
  for (let i = 1; i <= 12; i += 1) {
    const p = quadPoint(p0, c, p1, i / 12);
    len += Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = p;
  }
  return len;
}

// El buscador, los botones, los links y las letras del título siempre ganan:
// un toque ahí nunca llega al 3D aunque haya un objeto detrás.
const UI_SELECTOR =
  'input, textarea, select, button, a, label, [role="button"], [contenteditable="true"], [data-sky-letter]';
export function isUiTarget(e) {
  const target = e?.nativeEvent?.target ?? e?.target;
  return Boolean(target?.closest?.(UI_SELECTOR));
}

// Handlers de un objeto tocable: cursor de puntero mientras está encima (salvo
// sobre la UI) y click/tap que ignora la UI. `onHover(on)` es opcional.
export function useTouchable({ onActivate, onHover }) {
  const sky = useSky();
  const over = useRef(false);
  return useMemo(() => {
    const set = (on) => {
      if (on === over.current) return;
      over.current = on;
      sky.setHover(on);
      onHover?.(on);
    };
    return {
      onPointerOver: (e) => {
        e.stopPropagation();
        set(!isUiTarget(e));
      },
      onPointerMove: (e) => {
        e.stopPropagation();
        set(!isUiTarget(e));
      },
      onPointerOut: () => set(false),
      onClick: (e) => {
        if (isUiTarget(e)) return;
        e.stopPropagation();
        onActivate(e);
      },
    };
  }, [sky, onActivate, onHover]);
}
