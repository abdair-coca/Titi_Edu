// Globos del cielo del header (change rediseno-hero-cursos, reemplazan a las
// nubes): flotan despacio por la franja de arriba del título, se mecen, se
// apartan del mouse y al pasarle por encima tiemblan. Al tocarlos revientan
// (pop + salpicadura) y sueltan gotas que caen sobre las letras; a los pocos
// segundos entra otro por un costado. Van en el lienzo medio: pasan por
// detrás o por delante de las letras junto con el avión.
import { useCallback, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { COLORS } from '../hero3d/roomLayout.js';
import { clamp, damp, placeAt, pointerPx, pxUnit, rand, useSky, useTouchable } from './skyKit.js';

const BODY_WIDTH = 0.9; // ancho del globo en unidades propias (para escalar a px)
const POP_SECONDS = 0.16;
const DODGE_RADIUS_PX = 90;

// Hilo: curva fija que cuelga del nudo (el globo entero se mece).
function useStringGeometry() {
  return useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.6, 0),
      new THREE.Vector3(0.06, -0.85, 0),
      new THREE.Vector3(-0.05, -1.1, 0),
      new THREE.Vector3(0.03, -1.35, 0),
    ]);
    return new THREE.TubeGeometry(curve, 16, 0.012, 5, false);
  }, []);
}

function Balloon({ id, color, speed, startFrac, sizePx, z, stringGeometry }) {
  const sky = useSky();
  const group = useRef(null);
  const body = useRef(null);
  const st = useRef(null);
  const hovered = useRef(false);
  const dodge = useRef({ x: 0, y: 0 });

  const onActivate = useCallback(() => {
    const b = st.current;
    if (!b || b.mode !== 'float') return;
    b.mode = 'pop';
    b.t0 = -1;
  }, []);
  const onHover = useCallback((on) => {
    hovered.current = on;
  }, []);
  const handlers = useTouchable({ onActivate, onHover });

  useFrame((state, rawDt) => {
    const L = sky.layoutRef.current;
    const g = group.current;
    if (!g) return;
    const band = L?.balloonBand;
    g.visible = Boolean(band);
    if (!band) return;
    const dt = Math.min(rawDt, 0.05);
    const t = state.clock.elapsedTime;
    const margin = sizePx * 1.2;
    const randomY = () => rand(band.y0 + sizePx * 0.6, Math.max(band.y0 + sizePx * 0.6, band.y1 - sizePx * 0.7));

    let b = st.current;
    if (!b) {
      b = { mode: 'float', x: startFrac * L.width, y: randomY(), phase: rand(0, 6), t0: 0 };
      st.current = b;
    }

    if (b.mode === 'gone') {
      g.visible = false;
      sky.midRects.current.delete(id);
      // Entra otro por el costado de atrás de su recorrido.
      if (t - b.t0 > b.wait) Object.assign(b, { mode: 'float', x: speed > 0 ? -margin : L.width + margin, y: randomY() });
      return;
    }

    if (b.mode === 'float') {
      b.x += speed * dt;
      if (speed > 0 && b.x > L.width + margin) Object.assign(b, { x: -margin, y: randomY() });
      if (speed < 0 && b.x < -margin) Object.assign(b, { x: L.width + margin, y: randomY() });
    }

    const y = b.y + Math.sin(t * 1.1 + b.phase) * 6;

    // Se aparta del mouse (solo puntero fino).
    let tx = 0;
    let ty = 0;
    if (sky.pointerRef.current.inside && b.mode === 'float') {
      const m = pointerPx(state);
      const dx = b.x + dodge.current.x - m.x;
      const dy = y + dodge.current.y - m.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < DODGE_RADIUS_PX) {
        const push = (DODGE_RADIUS_PX - dist) * 0.7;
        tx = (dx / dist) * push;
        ty = (dy / dist) * push;
      }
    }
    dodge.current.x = damp(dodge.current.x, tx, 4, dt);
    dodge.current.y = damp(dodge.current.y, clamp(ty, -30, 30), 4, dt);
    const x = b.x + dodge.current.x;
    const yy = y + dodge.current.y;
    placeAt(state, g, x, yy, z);
    // Caja del cuerpo (sin el hilo) para el cambio de capa.
    const r = sizePx * 0.55;
    sky.midRects.current.set(id, { left: x - r, right: x + r, top: yy - r * 1.1, bottom: yy + r * 1.1 });

    const base = (sizePx * pxUnit(state)) / BODY_WIDTH;
    let s = base;
    if (b.mode === 'pop') {
      if (b.t0 < 0) {
        b.t0 = t;
        // Revienta: salpicadura y dos gotas que caen sobre las letras.
        sky.drops.current?.splash(x, yy, 8);
        sky.drops.current?.spawn(x - sizePx * 0.15, yy, rand(-60, -20));
        sky.drops.current?.spawn(x + sizePx * 0.15, yy, rand(20, 60));
      }
      const q = (t - b.t0) / POP_SECONDS;
      if (q >= 1) {
        Object.assign(b, { mode: 'gone', t0: t, wait: rand(3, 5) });
        return;
      }
      // Se infla un instante y desaparece.
      s = base * (q < 0.4 ? 1 + q * 0.6 : (1.24 * (1 - q)) / 0.6);
    }
    g.scale.setScalar(Math.max(0.0001, s));

    // Se mece con el viento y se inclina hacia donde avanza; tiembla con el hover.
    const jiggle = hovered.current ? Math.sin(t * 28) * 0.06 : 0;
    g.rotation.z = Math.sin(t * 0.9 + b.phase) * 0.08 - speed * 0.0015 - dodge.current.x * 0.004 + jiggle;
    body.current.scale.set(1 - jiggle, 1 + jiggle, 1);
  });

  return (
    <group ref={group} {...handlers}>
      <group ref={body}>
        <mesh scale={[0.9, 1.06, 0.9]}>
          <sphereGeometry args={[0.5, 28, 20]} />
          <meshStandardMaterial color={color} roughness={0.32} />
        </mesh>
        {/* Brillo cartoon */}
        <mesh position={[-0.17, 0.2, 0.38]} rotation={[0, 0, 0.5]} scale={[0.07, 0.13, 0.04]}>
          <sphereGeometry args={[1, 12, 10]} />
          <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={0.5} roughness={0.2} />
        </mesh>
        {/* Nudo */}
        <mesh position={[0, -0.56, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.07, 0.1, 12]} />
          <meshStandardMaterial color={color} roughness={0.4} />
        </mesh>
      </group>
      <mesh geometry={stringGeometry}>
        <meshStandardMaterial color={COLORS.dark} roughness={0.7} />
      </mesh>
      {/* Área de toque generosa */}
      <mesh visible={false}>
        <sphereGeometry args={[0.65, 10, 8]} />
      </mesh>
    </group>
  );
}

export default function Balloons({ sizePx }) {
  const stringGeometry = useStringGeometry();
  // Dos globos, uno de cada color de la marca, en sentidos y alturas distintas.
  return (
    <>
      <Balloon id="globo-amarillo" color={COLORS.yellow} speed={22} startFrac={0.18} sizePx={sizePx} z={-0.8} stringGeometry={stringGeometry} />
      <Balloon id="globo-naranja" color={COLORS.streak} speed={-16} startFrac={0.7} sizePx={sizePx * 0.85} z={-1.1} stringGeometry={stringGeometry} />
    </>
  );
}
