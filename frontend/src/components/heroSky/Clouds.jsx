// Nubes del cielo del header: bolitas crema con base plana que se desplazan
// al fondo (cruzan el lienzo en ~20–30 s). Al tocarlas se aplastan y rebotan.
import { useCallback, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { placeAt, pxUnit, useSky, useTouchable } from './skyKit.js';

const CLOUD_WIDTH = 2.2; // ancho del modelo en unidades propias
const SQUASH_SECONDS = 0.45;

// Puffs: [x, y, radio]
const PUFFS = [
  [-0.7, 0, 0.42],
  [-0.2, 0.22, 0.55],
  [0.35, 0.12, 0.48],
  [0.78, -0.02, 0.36],
];

function Cloud({ yFrac, speed, offset, sizePx, z }) {
  const sky = useSky();
  const group = useRef(null);
  const squash = useRef(null);

  const onActivate = useCallback(() => {
    if (squash.current === null) squash.current = -1;
  }, []);
  const handlers = useTouchable({ onActivate });

  useFrame((state) => {
    const L = sky.layoutRef.current;
    const g = group.current;
    if (!L || !g) return;
    const t = state.clock.elapsedTime;
    const margin = sizePx * 0.7;
    const span = L.width + margin * 2;
    const x = ((((offset * span + speed * t) % span) + span) % span) - margin;
    const top = L.promoBottom + 10;
    const y = top + (L.height - top - 20) * yFrac + Math.sin(t * 0.6 + offset * 9) * 4;
    placeAt(state, g, x, y, z);

    let sx = 1;
    let sy = 1;
    if (squash.current !== null) {
      if (squash.current < 0) squash.current = t;
      const q = (t - squash.current) / SQUASH_SECONDS;
      if (q >= 1) squash.current = null;
      else {
        // Aplastón y rebote que se amortigua.
        const k = Math.sin(q * Math.PI * 3) * (1 - q) * 0.28;
        sy = 1 - k;
        sx = 1 + k * 0.7;
      }
    }
    const s = (sizePx * pxUnit(state)) / CLOUD_WIDTH;
    g.scale.set(s * sx, s * sy, s);
  });

  return (
    <group ref={group} {...handlers}>
      <group rotation={[0.18, 0, 0]}>
        {PUFFS.map(([px, py, r]) => (
          <mesh key={px} position={[px, py, 0]} scale={[1, 0.9, 0.8]}>
            <sphereGeometry args={[r, 20, 14]} />
            <meshStandardMaterial color="#FFFFFF" roughness={0.95} />
          </mesh>
        ))}
        {/* Base plana */}
        <mesh position={[0.02, -0.2, 0]} scale={[1, 0.3, 0.62]}>
          <cylinderGeometry args={[0.95, 0.95, 0.5, 24]} />
          <meshStandardMaterial color="#FFFFFF" roughness={0.95} />
        </mesh>
      </group>
    </group>
  );
}

export default function Clouds({ count, sizePx }) {
  // Lugares y velocidades fijos (sin saltos entre renders).
  const clouds = useMemo(
    () =>
      [
        { yFrac: 0.08, speed: 36, offset: 0.1, scale: 1, z: -1.2 },
        { yFrac: 0.55, speed: 30, offset: 0.62, scale: 0.8, z: -1.6 },
        { yFrac: 0.92, speed: 42, offset: 0.35, scale: 0.9, z: -1.0 },
      ].slice(0, count),
    [count],
  );
  return clouds.map((c) => (
    <Cloud key={c.offset} yFrac={c.yFrac} speed={c.speed} offset={c.offset} z={c.z} sizePx={sizePx * c.scale} />
  ));
}
