// Gotas del cielo del header (la moneda de Titi, con la forma y los ojitos de
// la gota de juguete de la habitación):
// - Gotas que suben: nacen en las cifras y se esfuman antes del buscador. Al
//   tocarlas salpican.
// - Gotas que caen: las sueltan los drones al tocarlos; caen, rebotan sobre el
//   borde del buscador (o el piso del lienzo) y se van.
// Todo es visual: no da gotas reales.
import { useCallback, useImperativeHandle, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { COLORS } from '../hero3d/roomLayout.js';
import { makeDropGeometry } from '../hero3d/dropGeometry.js';
import { clamp, damp, placeAt, pxUnit, rand, useSky, useTouchable } from './skyKit.js';

const DROP_HEIGHT = 0.42; // alto de la geometría de la gota
const GRAVITY = 1900; // px/s²
const FALL_POOL = 4;
const SPLASH_POOL = 18;
const SPLASH_BITS = 6;

function DropBody({ geometry, eyes = true }) {
  return (
    <>
      <mesh geometry={geometry}>
        <meshStandardMaterial color={COLORS.yellow} roughness={0.22} />
      </mesh>
      {eyes &&
        [-0.05, 0.05].map((x) => (
          <mesh key={x} position={[x, 0.15, 0.13]}>
            <sphereGeometry args={[0.022, 10, 8]} />
            <meshStandardMaterial color={COLORS.dark} roughness={0.3} />
          </mesh>
        ))}
    </>
  );
}

// Una gota que sube; al tocarla avisa para salpicar y vuelve a empezar.
function RisingDrop({ geometry, index, count, sizePx, onPop }) {
  const sky = useSky();
  const group = useRef(null);
  const life = useRef(null);
  const pos = useRef({ x: 0, y: 0 });

  const restart = (t, L, delay) => {
    // Cada gota tiene su franja de ancho para que no se amontonen.
    const band = L.width / count;
    life.current = {
      x: band * index + rand(0.2, 0.8) * band,
      start: t + delay,
      dur: rand(3.2, 4.4),
      phase: rand(0, Math.PI * 2),
    };
  };

  const onActivate = useCallback(() => {
    const l = life.current;
    if (!l) return;
    onPop(pos.current.x, pos.current.y);
    l.start = Infinity; // se reinicia en el próximo frame
  }, [onPop]);
  const handlers = useTouchable({ onActivate });

  useFrame((state) => {
    const L = sky.layoutRef.current;
    const g = group.current;
    if (!L || !g) return;
    const t = state.clock.elapsedTime;
    if (!life.current) restart(t, L, -index * 1.3); // arrancan escalonadas, ya a la vista
    if (life.current.start === Infinity) restart(t, L, 0.5);
    const l = life.current;
    const p = (t - l.start) / l.dur;
    if (p > 1) {
      restart(t, L, rand(0, 0.6));
      g.visible = false;
      return;
    }
    g.visible = p >= 0;
    if (p < 0) return;
    const x = l.x + Math.sin(t * 2.2 + l.phase) * 10;
    const y = L.dropsFrom + (L.dropsTo - L.dropsFrom) * p;
    pos.current.x = x;
    pos.current.y = y;
    // Entra creciendo y se esfuma achicándose arriba.
    const env = Math.min(1, p / 0.15, (1 - p) / 0.25);
    placeAt(state, g, x, y, 0.3);
    g.scale.setScalar(Math.max(0.0001, ((sizePx * pxUnit(state)) / DROP_HEIGHT) * clamp(env, 0, 1)));
    g.rotation.set(0.25, Math.sin(t * 1.3 + l.phase) * 0.6, Math.sin(t * 2.2 + l.phase) * 0.12);
  });

  return (
    <group ref={group} visible={false} {...handlers}>
      <group position={[0, -DROP_HEIGHT / 2, 0]}>
        <DropBody geometry={geometry} />
        <mesh visible={false} position={[0, DROP_HEIGHT / 2, 0]}>
          <sphereGeometry args={[0.42, 8, 6]} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * Sistema de gotas. Expone `spawn(x, y)` (gota que cae desde un dron, en px)
 * por `apiRef` para que los drones la usen.
 */
export default function SkyDrops({ apiRef, rising, sizePx }) {
  const sky = useSky();
  const geometry = useMemo(makeDropGeometry, []);
  const falling = useRef([]);
  const fallRefs = useRef([]);
  const splashMesh = useRef(null);
  const bits = useRef([]);
  const tmp = useMemo(() => new THREE.Object3D(), []);

  const splash = useCallback((x, y) => {
    for (let i = 0; i < SPLASH_BITS; i += 1) {
      const a = (i / SPLASH_BITS) * Math.PI * 2 + rand(-0.3, 0.3);
      const speed = rand(160, 280);
      bits.current.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 160, age: 0, life: rand(0.45, 0.6) });
    }
    if (bits.current.length > SPLASH_POOL) bits.current.splice(0, bits.current.length - SPLASH_POOL);
  }, []);

  useImperativeHandle(apiRef, () => ({
    spawn(x, y) {
      if (falling.current.length >= FALL_POOL) falling.current.shift();
      falling.current.push({ x, y, vy: -120, bounces: 0, rest: 0, squash: 1, gone: 0 });
    },
    splash,
  }), [splash]);

  useFrame((state, rawDt) => {
    const L = sky.layoutRef.current;
    if (!L) return;
    const dt = Math.min(rawDt, 0.05);
    const u = pxUnit(state);
    const scale = (sizePx * u) / DROP_HEIGHT;

    // Gotas que caen: gravedad, hasta dos rebotes y se achican.
    for (let i = 0; i < FALL_POOL; i += 1) {
      const g = fallRefs.current[i];
      const d = falling.current[i];
      if (!g) continue;
      g.visible = Boolean(d);
      if (!d) continue;
      // Si cae sobre el buscador, se apoya en su borde; si no, en el piso.
      if (d.floor === undefined) {
        const overSearch = d.x > L.landing.x0 && d.x < L.landing.x1 && d.y < L.landing.y;
        d.floor = overSearch ? L.landing.y : L.floorY;
      }
      const { floor } = d;
      if (d.rest === 0) {
        d.vy += GRAVITY * dt;
        d.y += d.vy * dt;
        if (d.y >= floor) {
          d.y = floor;
          d.bounces += 1;
          d.squash = 0.7;
          if (d.bounces > 2 || Math.abs(d.vy) < 140) d.rest = 0.0001;
          d.vy = -Math.abs(d.vy) * 0.38;
        }
      } else {
        d.rest += dt;
        if (d.rest > 0.5) d.gone = Math.min(1, d.gone + dt / 0.25);
      }
      d.squash = damp(d.squash, 1, 12, dt);
      placeAt(state, g, d.x, d.y, 0.35);
      const k = Math.max(0.0001, scale * (1 - d.gone));
      g.scale.set(k * (2 - d.squash), k * d.squash, k * (2 - d.squash));
      g.rotation.x = 0.25;
    }
    falling.current = falling.current.filter((d) => d.gone < 1);

    // Salpicadura: gotitas que vuelan y se achican.
    const list = bits.current;
    for (let i = 0; i < SPLASH_POOL; i += 1) {
      const b = list[i];
      if (b) {
        b.age += dt;
        b.vy += GRAVITY * 0.6 * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        placeAt(state, tmp, b.x, b.y, 0.35);
        tmp.scale.setScalar(Math.max(0.0001, (1 - b.age / b.life) * sizePx * 0.16 * u));
      } else tmp.scale.setScalar(0.0001);
      tmp.updateMatrix();
      splashMesh.current.setMatrixAt(i, tmp.matrix);
    }
    splashMesh.current.instanceMatrix.needsUpdate = true;
    bits.current = list.filter((b) => b.age < b.life);
  });

  return (
    <>
      {Array.from({ length: rising }, (_, i) => (
        <RisingDrop key={i} geometry={geometry} index={i} count={rising} sizePx={sizePx} onPop={splash} />
      ))}
      {Array.from({ length: FALL_POOL }, (_, i) => (
        <group
          key={`f${i}`}
          visible={false}
          ref={(el) => {
            fallRefs.current[i] = el;
          }}
        >
          <DropBody geometry={geometry} />
        </group>
      ))}
      <instancedMesh ref={splashMesh} args={[null, null, SPLASH_POOL]} frustumCulled={false}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial color={COLORS.yellow} roughness={0.22} />
      </instancedMesh>
    </>
  );
}
