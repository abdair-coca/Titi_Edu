// Gotas del cielo del header (la moneda de Titi, con la forma y los ojitos de
// la gota de juguete de la habitación). Las sueltan los drones y los globos:
// caen, rebotan sobre la letra que tengan debajo (la letra se aplasta), sobre
// el buscador o sobre el piso del lienzo, y se van. Con algo de deriva lateral
// pueden resbalar del borde de una letra y seguir cayendo.
// Todo es visual: no da gotas reales.
import { useCallback, useImperativeHandle, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { COLORS } from '../hero3d/roomLayout.js';
import { makeDropGeometry } from '../hero3d/dropGeometry.js';
import { damp, placeAt, pxUnit, rand, useSky } from './skyKit.js';
import { hitLetter, surfaceBelow } from './skyLetters.js';

const DROP_HEIGHT = 0.42; // alto de la geometría de la gota (base en y = 0)
const GRAVITY = 1900; // px/s²
const FALL_POOL = 6;
const SPLASH_POOL = 24;
const SPLASH_BITS = 6;
const MAX_BOUNCES = 3;

function DropBody({ geometry }) {
  return (
    <>
      <mesh geometry={geometry}>
        <meshStandardMaterial color={COLORS.yellow} roughness={0.22} />
      </mesh>
      {[-0.05, 0.05].map((x) => (
        <mesh key={x} position={[x, 0.15, 0.13]}>
          <sphereGeometry args={[0.022, 10, 8]} />
          <meshStandardMaterial color={COLORS.dark} roughness={0.3} />
        </mesh>
      ))}
    </>
  );
}

/**
 * Sistema de gotas. Expone por `apiRef`:
 * - `spawn(x, y, vx?)`: gota que cae desde (x, y) px, con deriva lateral opcional.
 * - `splash(x, y)`: salpicadura de gotitas.
 */
export default function SkyDrops({ apiRef, sizePx }) {
  const sky = useSky();
  const geometry = useMemo(makeDropGeometry, []);
  const falling = useRef([]);
  const fallRefs = useRef([]);
  const splashMesh = useRef(null);
  const bits = useRef([]);
  const tmp = useMemo(() => new THREE.Object3D(), []);

  const splash = useCallback((x, y, count = SPLASH_BITS) => {
    for (let i = 0; i < count; i += 1) {
      const a = (i / count) * Math.PI * 2 + rand(-0.3, 0.3);
      const speed = rand(160, 280);
      bits.current.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 160, age: 0, life: rand(0.45, 0.6) });
    }
    if (bits.current.length > SPLASH_POOL) bits.current.splice(0, bits.current.length - SPLASH_POOL);
  }, []);

  useImperativeHandle(apiRef, () => ({
    spawn(x, y, vx = rand(-30, 30)) {
      if (falling.current.length >= FALL_POOL) falling.current.shift();
      falling.current.push({ x, y, vx, vy: -120, bounces: 0, rest: 0, squash: 1, gone: 0 });
    },
    splash,
  }), [splash]);

  useFrame((state, rawDt) => {
    const L = sky.layoutRef.current;
    if (!L) return;
    const dt = Math.min(rawDt, 0.05);
    const u = pxUnit(state);
    const scale = (sizePx * u) / DROP_HEIGHT;

    // Gotas que caen: gravedad, rebotes sobre lo que haya debajo y se achican.
    for (let i = 0; i < FALL_POOL; i += 1) {
      const g = fallRefs.current[i];
      const d = falling.current[i];
      if (!g) continue;
      g.visible = Boolean(d);
      if (!d) continue;
      if (d.rest === 0) {
        // La superficie se busca en cada cuadro: con la deriva, la gota puede
        // salirse del borde de una letra y seguir cayendo al renglón de abajo.
        const floor = surfaceBelow(L, d.x, d.y);
        d.vy += GRAVITY * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        if (d.y >= floor.y) {
          const impact = Math.abs(d.vy);
          d.y = floor.y;
          d.bounces += 1;
          d.squash = 0.65;
          if (floor.letter >= 0) hitLetter(sky, floor.letter, 'bounce', Math.sign(d.vx) || 1, impact / 700);
          if (d.bounces >= MAX_BOUNCES || impact < 140) d.rest = 0.0001;
          d.vy = -impact * 0.42;
          d.vx *= 0.7;
        }
      } else {
        d.rest += dt;
        if (d.rest > 0.45) d.gone = Math.min(1, d.gone + dt / 0.25);
      }
      d.squash = damp(d.squash, 1, 12, dt);
      placeAt(state, g, d.x, d.y, 0.35);
      const k = Math.max(0.0001, scale * (1 - d.gone));
      g.scale.set(k * (2 - d.squash), k * d.squash, k * (2 - d.squash));
      g.rotation.set(0.25, 0, -d.vx * 0.002);
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
