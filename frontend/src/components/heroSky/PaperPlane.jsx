// Avión de papel del cielo del header. Cada cruce se sortea:
// - Paseo: cruza por el renglón del párrafo y a mitad hace un rizo que sube
//   sobre el título (las letras se inclinan con el viento al pasar).
// - Choque (a veces, contra una letra al azar): baja en picada hasta la letra,
//   la golpea (se tambalea y vuelve), retrocede mareado con un tirabuzón y se
//   va por donde vino.
// Deja una estela punteada que se borra. Al tocarlo hace un tirabuzón.
// Capas: cada paseo sortea si cruza por delante o por detrás de las letras y
// en la cima del rizo pide pasar al otro lado (rodea el título); el choque va
// siempre por delante. El cambio real espera a que no toque texto.
import { useCallback, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { COLORS } from '../hero3d/roomLayout.js';
import { TAU, clamp, lerp, placeAt, pxUnit, quadLength, quadPoint, rand, useSky, useTouchable } from './skyKit.js';
import { brushLetters, hitLetter, randomLetter, requestLayer } from './skyLetters.js';

// Largo del modelo en unidades propias (nariz → cola), para escalarlo a px.
const MODEL_LENGTH = 1.6;
// La nariz está 1 unidad delante del centro del modelo.
const NOSE = 1 / MODEL_LENGTH;
const ROLL_SECONDS = 0.65;
const TRAIL_DOTS = 16;
const TRAIL_EVERY = 0.055;
// El rizo ocupa este tramo del recorrido (centro, en fracción del ancho).
const LOOP_AT = 0.55;
const CRASH_CHANCE = 0.5;
const RECOIL_SECONDS = 0.7;
const RECOIL_GRAVITY = 620;

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

// ---- Paseo con rizo ----

function cruiseAt(s, f, L) {
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

function newCruise(L, dir, sizePx, mobile) {
  const margin = sizePx * 1.2;
  const dur = mobile ? rand(6, 7) : rand(7, 8.5);
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
  const f = { kind: 'cruise', dir, v, slow, r, loopDur, xFrom, s1, total };
  f.at = (s) => cruiseAt(s, f, L);
  // Por delante o por detrás; en la cima del rizo cambia de lado.
  f.front = Math.random() < 0.5;
  f.frontAt = (s) => (s < s1 + loopDur / 2 ? f.front : !f.front);
  return f;
}

// ---- Choque contra una letra ----

function newCrash(L, dir, letter, sizePx, mobile) {
  const margin = sizePx * 1.2;
  const speed = mobile ? 300 : 360;
  // Punto de impacto: el costado de la letra, en su parte de arriba (así se
  // tambalea sobre su base).
  const hit = {
    x: dir > 0 ? letter.left + 2 : letter.right - 2,
    y: lerp(letter.top, letter.bottom, rand(0.12, 0.4)),
  };
  const p0 = { x: dir > 0 ? -margin : L.width + margin, y: clamp(letter.top - rand(70, 150), 24, L.height) };
  const c = { x: lerp(p0.x, hit.x, rand(0.5, 0.65)), y: Math.min(p0.y, hit.y) - rand(10, 60) };
  // El centro del avión queda detrás de la nariz, en la dirección de llegada.
  const ax = hit.x - c.x;
  const ay = hit.y - c.y;
  const an = Math.hypot(ax, ay) || 1;
  const nose = sizePx * NOSE;
  const end = { x: hit.x - (ax / an) * nose, y: hit.y - (ay / an) * nose };
  const approach = quadLength(p0, c, end) / speed;

  // Retroceso: sale despedido hacia atrás y arriba, con gravedad.
  const vx = -dir * 190;
  const vy = -230;
  const recoilAt = (u) => ({ x: end.x + vx * u, y: end.y + vy * u + 0.5 * RECOIL_GRAVITY * u * u });
  const r1 = recoilAt(RECOIL_SECONDS);

  // Salida: da la vuelta y se va por donde vino, alto.
  const exitTo = { x: dir > 0 ? -margin : L.width + margin, y: rand(24, Math.max(40, letter.top - 30)) };
  const exitC = { x: r1.x - dir * 120, y: Math.min(r1.y, exitTo.y) - 70 };
  const exit = quadLength(r1, exitC, exitTo) / (speed * 0.9);

  const t1 = approach;
  const t2 = t1 + RECOIL_SECONDS;
  return {
    kind: 'crash',
    dir,
    letter: letter.index,
    hit,
    impactAt: t1,
    total: t2 + exit,
    frontAt: () => true,
    at(s) {
      if (s < t1) return quadPoint(p0, c, end, clamp(s / t1, 0, 1));
      if (s < t2) return recoilAt(s - t1);
      return quadPoint(r1, exitC, exitTo, clamp((s - t2) / exit, 0, 1));
    },
    // Durante el retroceso mira a la letra con la nariz arriba, tambaleando.
    orient(s) {
      if (s < t1 || s >= t2) return null;
      const q = (s - t1) / RECOIL_SECONDS;
      return { facing: dir, heading: 0.55 + Math.sin(q * 20) * 0.45 * (1 - q) };
    },
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
  const count = useRef(0);
  const roll = useRef(null);
  const facing = useRef(1);
  const wind = useRef(new Map());
  const dots = useRef({ list: [], last: 0 });
  const tmp = useMemo(() => new THREE.Object3D(), []);

  const onActivate = useCallback(() => {
    if (roll.current === null) roll.current = -1;
  }, []);
  const handlers = useTouchable({ onActivate });

  // Sortea el próximo vuelo: el primero siempre es el paseo con rizo.
  const nextFlight = (t, L, dir, startAt = 0) => {
    const letter = count.current > 0 && Math.random() < CRASH_CHANCE ? randomLetter(L) : null;
    count.current += 1;
    const f = letter ? newCrash(L, dir, letter, sizePx, sky.mobile) : newCruise(L, dir, sizePx, sky.mobile);
    return Object.assign(f, { start: t - startAt, gap: rand(0.4, 1.4), impacted: false, layout: L });
  };

  useFrame((state, rawDt) => {
    const L = sky.layoutRef.current;
    if (!L || !group.current) return;
    const dt = Math.min(rawDt, 0.05);
    const t = state.clock.elapsedTime;
    let f = flight.current;
    // Primer cruce: arranca ya a la vista. Si cambia el layout en medio de un
    // paseo, se rearma (un choque en curso termina con las medidas que tenía).
    if (!f) f = nextFlight(t, L, 1, 1.2);
    else if (f.kind === 'cruise' && f.layout !== L) {
      f = Object.assign(newCruise(L, f.dir, sizePx, sky.mobile), { start: f.start, gap: f.gap, layout: L, front: f.front });
    }
    let s = t - f.start;
    if (s > f.total + f.gap) {
      f = nextFlight(t, L, -f.dir);
      s = 0;
    }
    flight.current = f;

    // Impacto: la letra se tambalea, salpica y el avión hace un tirabuzón.
    if (f.kind === 'crash' && !f.impacted && s >= f.impactAt) {
      f.impacted = true;
      hitLetter(sky, f.letter, 'crash', f.dir, 1);
      sky.drops.current?.splash(f.hit.x, f.hit.y, 5);
      roll.current = -1;
    }

    const p = f.at(s);
    const ahead = f.at(s + 0.03);
    const vx = ahead.x - p.x;
    const vy = ahead.y - p.y;
    const forced = f.orient?.(s);
    if (forced) facing.current = forced.facing;
    else if (Math.abs(vx) > 0.4) facing.current = vx > 0 ? 1 : -1;
    const fc = facing.current;

    placeAt(state, group.current, p.x, p.y, 0.2);
    // Caja del avión para el cambio de capa.
    const half = sizePx * 0.55;
    sky.midRects.current.set('plane', { left: p.x - half, right: p.x + half, top: p.y - half * 0.6, bottom: p.y + half * 0.6 });
    requestLayer(sky, L, f.frontAt(s));
    group.current.scale.set(fc, 1, 1).multiplyScalar((sizePx * pxUnit(state)) / MODEL_LENGTH);
    // Nariz hacia donde va (el grupo de afuera espeja si vuela a la izquierda).
    heading.current.rotation.z = forced ? forced.heading : Math.atan2(-vy, vx * fc);

    // Viento sobre las letras al pasar (la letra del choque espera el golpe).
    brushLetters(sky, L, wind.current, t, p.x, p.y, fc, sizePx * 0.42, {
      skip: f.kind === 'crash' && !f.impacted ? f.letter : -1,
    });

    // Tirabuzón al tocarlo o al chocar; si no, un leve alabeo para ver las alas.
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
      const back = (sizePx * 0.45) / (Math.hypot(vx, vy) || 1);
      d.list.unshift({ x: p.x - vx * back, y: p.y - vy * back });
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
            <mesh position={[-0.35, 0.065, 0]} scale={[0.18, 0.012, 0.62]}>
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
