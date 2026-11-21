// RoomRig — gira la habitación al arrastrar y la mueve un poco con el puntero.
//
// - Arrastre horizontal (mouse o dedo): gira la habitación ±35°; al soltarla se
//   queda donde quedó y, tras unos segundos sin tocarla, vuelve sola al frente.
// - Paralaje (solo mouse): la habitación sigue levemente al puntero.
// - Nunca captura la rueda ni el scroll: el lienzo tiene `touch-action: pan-y`,
//   así que un deslizamiento vertical en el celular scrollea la página (el
//   navegador cancela el puntero y el arrastre termina).
//
// Expone por contexto si el último gesto fue un arrastre (para que soltar el
// dedo sobre un objeto no cuente como click) y el cursor del lienzo. También
// decide cuándo redibujar el mapa de sombras (ver abajo). Titi puede tomar el
// puntero (`grab`/`release`): mientras lo cargan, el cuarto no gira.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import gsap from 'gsap';
import { useFrame, useThree } from '@react-three/fiber';
import { CONTROLS } from './roomLayout.js';

const RoomInputContext = createContext(null);

export const useRoomInput = () => useContext(RoomInputContext);

const DRAG_THRESHOLD_PX = 5;

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

const hasFinePointer = () =>
  typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

export default function RoomRig({ onFirstDrag, children }) {
  const group = useRef(null);
  const el = useThree((s) => s.events.connected || s.gl.domElement);
  const state = useRef({ yaw: 0, drag: null, grabbing: false, moved: false, releasedAt: 0, hover: 0, px: 0, py: 0 });
  const firstDragDone = useRef(false);
  const warmFrames = useRef(30);

  // Cursor del lienzo: mano para arrastrar, puntero sobre objetos tocables.
  const setCursor = useCallback(() => {
    if (!el) return;
    const s = state.current;
    el.style.cursor = s.drag?.active || s.grabbing ? 'grabbing' : s.hover > 0 ? 'pointer' : 'grab';
  }, [el]);

  const input = useMemo(
    () => ({
      wasDrag: () => state.current.moved,
      isDragging: () => Boolean(state.current.drag?.active || state.current.grabbing),
      hoverStart: () => {
        state.current.hover += 1;
        setCursor();
      },
      hoverEnd: () => {
        state.current.hover = Math.max(0, state.current.hover - 1);
        setCursor();
      },
      // Un objeto (Titi) se queda con el gesto: cancela el giro del cuarto,
      // haya empezado antes o después en el mismo pointerdown.
      grab: () => {
        state.current.drag = null;
        state.current.grabbing = true;
        state.current.moved = false;
        setCursor();
      },
      release: (moved) => {
        state.current.grabbing = false;
        state.current.moved = Boolean(moved);
        setCursor();
      },
      // Algo se movió este frame: redibujar las sombras.
      poke: () => {
        warmFrames.current = Math.max(warmFrames.current, 1);
      },
    }),
    [setCursor],
  );

  useEffect(() => {
    if (!el) return undefined;
    const s = state.current;
    setCursor();

    const onDown = (e) => {
      if (s.grabbing || (e.pointerType === 'mouse' && e.button !== 0)) return;
      s.drag = { id: e.pointerId, x0: e.clientX, yaw0: s.yaw, active: false };
      s.moved = false;
    };
    const onMove = (e) => {
      if (e.pointerType === 'mouse') {
        // Paralaje relativa al centro del lienzo, acotada a [-1, 1].
        const r = el.getBoundingClientRect();
        s.px = clamp(((e.clientX - (r.left + r.width / 2)) / r.width) * 2, -1, 1);
        s.py = clamp(((e.clientY - (r.top + r.height / 2)) / r.height) * 2, -1, 1);
      }
      const d = s.drag;
      if (!d || d.id !== e.pointerId) return;
      const dx = e.clientX - d.x0;
      if (!d.active && Math.abs(dx) < DRAG_THRESHOLD_PX) return;
      if (!d.active) {
        d.active = true;
        s.moved = true;
        setCursor();
        if (!firstDragDone.current) {
          firstDragDone.current = true;
          onFirstDrag?.();
        }
      }
      const width = el.clientWidth || 1;
      s.yaw = clamp(d.yaw0 + (dx / width) * CONTROLS.dragSpeed, -CONTROLS.maxYaw, CONTROLS.maxYaw);
    };
    const onUp = (e) => {
      if (!s.drag || s.drag.id !== e.pointerId) return;
      s.drag = null;
      s.releasedAt = performance.now();
      setCursor();
    };

    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      el.style.cursor = '';
    };
  }, [el, setCursor, onFirstDrag]);

  const fine = useMemo(hasFinePointer, []);

  // Sombras "horneadas": el mapa de sombras se vuelve a dibujar solo mientras
  // algo se mueve (giro, paralaje o una animación GSAP en curso). Quieto, el
  // cuadro cuesta la mitad.
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
    return () => {
      gl.shadowMap.autoUpdate = true;
    };
  }, [gl]);

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    const s = state.current;
    // Vuelta suave al frente después de un rato sin tocarla.
    if (!s.drag && s.yaw !== 0 && performance.now() - s.releasedAt > CONTROLS.returnAfterMs) {
      s.yaw *= 1 - Math.min(1, delta * 1.5);
      if (Math.abs(s.yaw) < 0.001) s.yaw = 0;
    }
    const yaw = s.yaw + (fine ? s.px * CONTROLS.parallaxYaw : 0);
    const pitch = fine ? s.py * CONTROLS.parallaxPitch : 0;
    const k = Math.min(1, delta * 6);
    const dy = (yaw - g.rotation.y) * k;
    const dx = (pitch - g.rotation.x) * k;
    g.rotation.y += dy;
    g.rotation.x += dx;

    const moving = Math.abs(dy) + Math.abs(dx) > 1e-5 || gsap.globalTimeline.getChildren(false, true, true).length > 0;
    if (moving || warmFrames.current > 0) {
      gl.shadowMap.needsUpdate = true;
      warmFrames.current = Math.max(0, warmFrames.current - 1);
    }
  });

  return (
    <RoomInputContext.Provider value={input}>
      <group ref={group}>{children}</group>
    </RoomInputContext.Provider>
  );
}
