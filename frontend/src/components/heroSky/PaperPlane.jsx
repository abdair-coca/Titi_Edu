// Avión de papel del cielo del header: cruza por debajo del párrafo, a mitad
// de camino hace un rizo que sube sobre el título y deja una estela punteada
// que se borra. Al tocarlo hace un tirabuzón.
import { useCallback, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { COLORS } from '../hero3d/roomLayout.js';
import { TAU, clamp, placeAt, pxUnit, rand, useSky, useTouchable } from './skyKit.js';

// Largo del modelo en unidades propias (nariz → cola), para escalarlo a px.
const MODEL_LENGTH = 1.6;
const ROLL_SECONDS = 0.65;
const TRAIL_DOTS = 16;
const TRAIL_EVERY = 0.055;
// El rizo ocupa este tramo del recorrido (centro, en fracción del ancho).
const LOOP_AT = 0.55;

// Avión plegado: dos alas con un poco de diedro y la quilla abajo. La nariz
// apunta a +x. Caras planas para que se lea el plegado.
function usePlaneGeometry() {
  return useMemo(() => {
    const nose = [1, 0, 0];
    const tail = [-0.6, 0, 0];
    const wingL = [-0.62, 0.1, -0.56];
    const wingR = [-0.62, 0.1, 0.56];
    const keel = [-0.6, -0.22, 0];
    const tris = [nose, tail, wingL, nose, wingR, tail, nose, keel, tail];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3));
    g.computeVertexNormals();
    return g;
  }, []);
}

// Posición (px) del avión a los `s` segundos de arrancar el cruce.
function flightAt(s, f, L) {
  const { dir, v, xFrom, s1, loopDur, r, slow } = f;
  const base = L.planeBase;
  // Ondita suave en los tramos rectos, que se apaga cerca del rizo.
  const wave = (k) => Math.sin(s * 2.4) * 7 * k;
  if (s < s1) {
    return { x: xFrom + dir * v * s, y: base + wave(clamp((s1 - s) / 0.5, 0, 1)) };
  }
  if (s < s1 + loopDur) {
    const u = s - s1;
    const phi = (u / loopDur) * TAU;
    return {
      x: xFrom + dir * (v * s1 + slow * u + r * Math.sin(phi)),
      y: base - r * (1 - Math.cos(phi)),
    };
  }
  const u = s - s1 - loopDur;
  return {
    x: xFrom + dir * (v * s1 + slow * loopDur + v * u),
    y: base + wave(clamp(u / 0.5, 0, 1)),
  };
}

export default function PaperPlane({ sizePx }) {
  const sky = useSky();
  const group = useRef(null);
  const heading = useRef(null);
  const body = useRef(null);
  const trail = useRef(null);
  const geometry = usePlaneGeometry();
  const flight = useRef(null);
  const roll = useRef(null);
  const dots = useRef({ list: [], last: 0 });
  const tmp = useMemo(() => new THREE.Object3D(), []);

  const onActivate = useCallback(() => {
    if (roll.current === null) roll.current = -1;
  }, []);
  const handlers = useTouchable({ onActivate });

  // Arma un cruce nuevo con velocidad y rizo calculados para el ancho actual.
  const newFlight = (t, L, dir, startAt = 0) => {
    const margin = sizePx * 1.2;
    const dur = sky.mobile ? rand(6, 7) : rand(7, 8.5);
    const dist = L.width + margin * 2;
    const r = L.planeLoopR;
    // En el rizo el avión avanza a un cuarto de la velocidad y gira a 3/4:
    // al entrar y salir la velocidad empalma con la del tramo recto.
    const v = (dist + TAU * r) / dur;
    const slow = v * 0.25;
    const loopDur = (TAU * r) / (v - slow);
    const xLoop = dir > 0 ? L.width * LOOP_AT : L.width * (1 - LOOP_AT);
    const xFrom = dir > 0 ? -margin : L.width + margin;
    const s1 = Math.abs(xLoop - xFrom) / v;
    const total = s1 + loopDur + (dist - v * s1 - slow * loopDur) / v;
    return { dir, v, slow, r, loopDur, xFrom, s1, total, start: t - startAt, gap: rand(0.3, 1.2) };
  };

  useFrame((state, rawDt) => {
    const L = sky.layoutRef.current;
    if (!L || !group.current) return;
    const dt = Math.min(rawDt, 0.05);
    const t = state.clock.elapsedTime;
    let f = flight.current;
    if (!f || f.r !== L.planeLoopR) {
      // Primer cruce (o cambio de layout): arranca ya a la vista.
      f = newFlight(t, L, f ? f.dir : 1, f ? 0 : 1.2);
      flight.current = f;
    }
    let s = t - f.start;
    if (s > f.total + f.gap) {
      f = newFlight(t, L, -f.dir);
      flight.current = f;
      s = 0;
    }
    const p = flightAt(s, f, L);
    const ahead = flightAt(s + 0.03, f, L);
    placeAt(state, group.current, p.x, p.y, 0.2);
    group.current.scale.set(f.dir, 1, 1).multiplyScalar((sizePx * pxUnit(state)) / MODEL_LENGTH);
    // Nariz hacia donde va (el grupo de afuera espeja si vuela a la izquierda).
    heading.current.rotation.z = Math.atan2(-(ahead.y - p.y), (ahead.x - p.x) * f.dir);

    // Tirabuzón al tocarlo; si no, un leve alabeo para ver las alas.
    let barrel = 0;
    if (roll.current !== null) {
      if (roll.current < 0) roll.current = t;
      const q = (t - roll.current) / ROLL_SECONDS;
      if (q >= 1) roll.current = null;
      else barrel = TAU * (1 - (1 - q) ** 2);
    }
    body.current.rotation.x = 1.0 + Math.sin(t * 1.7) * 0.1 + barrel;

    // Estela: un punto cada 55 ms, que se achica hasta borrarse.
    const d = dots.current;
    if (t - d.last > TRAIL_EVERY) {
      d.last = t;
      const back = sizePx * 0.45 / (Math.hypot(ahead.x - p.x, ahead.y - p.y) || 1);
      d.list.unshift({ x: p.x - (ahead.x - p.x) * back, y: p.y - (ahead.y - p.y) * back });
      if (d.list.length > TRAIL_DOTS) d.list.pop();
    }
    const u = pxUnit(state);
    for (let i = 0; i < TRAIL_DOTS; i += 1) {
      const dot = d.list[i];
      if (dot) {
        placeAt(state, tmp, dot.x, dot.y, 0.1);
        tmp.scale.setScalar(Math.max(0.0001, (1 - i / TRAIL_DOTS) * 3.2 * u));
      } else tmp.scale.setScalar(0.0001);
      tmp.updateMatrix();
      trail.current.setMatrixAt(i, tmp.matrix);
    }
    trail.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={trail} args={[null, null, TRAIL_DOTS]} frustumCulled={false}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial color={COLORS.yellowDark} roughness={0.6} />
      </instancedMesh>
      <group ref={group} {...handlers}>
        <group ref={heading}>
        <group ref={body}>
          <mesh geometry={geometry}>
            <meshStandardMaterial color={COLORS.sky} roughness={0.75} side={THREE.DoubleSide} flatShading />
          </mesh>
          {/* Franja amarilla en las alas: el avión es de Titi */}
          <mesh position={[-0.35, 0.065, 0]} rotation={[0, 0, 0]} scale={[0.18, 0.012, 0.62]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.yellow} roughness={0.6} />
          </mesh>
        </group>
        <mesh visible={false}>
          <sphereGeometry args={[0.95, 10, 8]} />
        </mesh>
        </group>
      </group>
    </>
  );
}
