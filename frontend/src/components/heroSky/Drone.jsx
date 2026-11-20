// Drones del cielo del header: el repartidor (amarillo, con un librito
// colgando) cruza rasante sobre el título y esquiva el mouse; el dron chico
// (naranja, con antena) ronda el hueco junto al título y mira al puntero.
// Al tocarlos hacen un rizo y sueltan una gota que cae sobre las letras.
// Con las letras (change rediseno-hero-cursos): las peinan con viento al
// pasar, el repartidor a veces suelta una gota sobre una letra al azar, y al
// tocar una letra el dron más cercano vuela hasta ella, la mira y le suelta
// una gota. Con el buscador enfocado, lo miran.
//
// Todo el modelo se arma con figuras básicas (sin modelos de terceros), con la
// paleta de la habitación y la misma luz suave.
import { useCallback, useEffect, useRef } from 'react';
import { RoundedBox } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { COLORS } from '../hero3d/roomLayout.js';
import { TAU, clamp, damp, lerp, placeAt, pointerPx, pxUnit, rand, useSky, useTouchable } from './skyKit.js';
import { brushLetters, randomLetter } from './skyLetters.js';

// Ancho del modelo en unidades propias (con hélices), para escalarlo a px.
const MODEL_WIDTH = 1.9;
const LOOP_SECONDS = 0.8;
const LOOP_RADIUS_PX = 46;
const DODGE_RADIUS_PX = 110;
// Visita a una letra tocada: llega, la mira, suelta la gota y vuelve.
const VISIT_IN = 0.6;
const VISIT_HOLD = 1.3;
const VISIT_OUT = 0.6;
const VISIT_DROP_AT = VISIT_IN + 0.4;
const AUTO_DROP_CHANCE = 0.55;

const ROTORS = [
  [-0.68, 0.3],
  [0.68, 0.3],
  [-0.68, -0.3],
  [0.68, -0.3],
];

function Mat({ color, rough = 0.55, ...props }) {
  return <meshStandardMaterial color={color} roughness={rough} {...props} />;
}

function Rotor({ x, z, accent, bladesRef }) {
  return (
    <group position={[x, 0.16, z]}>
      <mesh position={[0, -0.02, 0]}>
        <cylinderGeometry args={[0.05, 0.06, 0.1, 12]} />
        <Mat color={COLORS.dark} />
      </mesh>
      <group ref={bladesRef} position={[0, 0.045, 0]}>
        <mesh>
          <boxGeometry args={[0.46, 0.014, 0.06]} />
          <Mat color={COLORS.cream} rough={0.4} />
        </mesh>
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[0.46, 0.014, 0.06]} />
          <Mat color={COLORS.cream} rough={0.4} />
        </mesh>
      </group>
      {/* Aro protector */}
      <mesh position={[0, 0.045, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.26, 0.022, 8, 28]} />
        <Mat color={accent} rough={0.45} />
      </mesh>
    </group>
  );
}

/**
 * Cuerpo del dron (mirando a la cámara, +z). Refs para animar hélices, ojos,
 * el librito colgado y la antena.
 */
function DroneBody({ color, accent, light, parts, withPackage, withAntenna }) {
  return (
    <group>
      <RoundedBox args={[0.9, 0.36, 0.62]} radius={0.15} smoothness={3}>
        <Mat color={color} rough={0.5} />
      </RoundedBox>
      {/* Visor con ojos */}
      <RoundedBox args={[0.62, 0.22, 0.08]} radius={0.04} smoothness={2} position={[0, 0.02, 0.29]}>
        <Mat color={COLORS.dark} rough={0.3} />
      </RoundedBox>
      <group ref={parts.eyes} position={[0, 0.02, 0.335]}>
        {[-0.14, 0.14].map((x) => (
          <mesh key={x} position={[x, 0, 0]} scale={[1, 1.35, 0.5]}>
            <sphereGeometry args={[0.05, 12, 10]} />
            <Mat color={COLORS.cream} emissive="#FFF6D8" emissiveIntensity={0.5} rough={0.3} />
          </mesh>
        ))}
      </group>
      {/* Luz de arriba */}
      <mesh position={[0, 0.2, 0]}>
        <sphereGeometry args={[0.07, 12, 10]} />
        <Mat color={light} emissive={light} emissiveIntensity={0.35} rough={0.3} />
      </mesh>
      {/* Brazos */}
      {ROTORS.map(([x, z]) => (
        <mesh key={`a${x}${z}`} position={[x * 0.78, 0.1, z * 0.85]} rotation={[0, Math.atan2(-z, x), Math.PI / 2]}>
          <cylinderGeometry args={[0.035, 0.035, 0.34, 8]} />
          <Mat color={COLORS.dark} />
        </mesh>
      ))}
      {ROTORS.map(([x, z], i) => (
        <Rotor
          key={`r${x}${z}`}
          x={x}
          z={z}
          accent={accent}
          bladesRef={(el) => {
            parts.blades.current[i] = el;
          }}
        />
      ))}
      {withPackage && (
        <group ref={parts.pivot} position={[0, -0.17, 0]}>
          <mesh position={[0, -0.16, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.32, 6]} />
            <Mat color={COLORS.dark} />
          </mesh>
          {/* Librito: tapa violeta (logro) y hojas crema a la vista */}
          <group position={[0, -0.38, 0]} rotation={[0.2, 0.25, 0]}>
            <RoundedBox args={[0.46, 0.15, 0.34]} radius={0.03} smoothness={2}>
              <Mat color={COLORS.achievement} rough={0.6} />
            </RoundedBox>
            <mesh position={[0.03, 0, 0]}>
              <boxGeometry args={[0.42, 0.105, 0.35]} />
              <Mat color={COLORS.cream} rough={0.9} />
            </mesh>
          </group>
        </group>
      )}
      {withAntenna && (
        <group ref={parts.antenna} position={[0.18, 0.18, -0.05]}>
          <mesh position={[0, 0.14, 0]}>
            <cylinderGeometry args={[0.016, 0.016, 0.28, 6]} />
            <Mat color={COLORS.dark} />
          </mesh>
          <mesh position={[0, 0.3, 0]}>
            <sphereGeometry args={[0.06, 12, 10]} />
            <Mat color={COLORS.yellow} emissive={COLORS.yellow} emissiveIntensity={0.3} />
          </mesh>
        </group>
      )}
      {!withPackage && (
        // Patas
        <group position={[0, -0.24, 0]}>
          {[-0.2, 0.2].map((z) => (
            <mesh key={z} position={[0, 0, z]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.025, 0.025, 0.62, 8]} />
              <Mat color={COLORS.dark} />
            </mesh>
          ))}
        </group>
      )}
      {/* Área de toque generosa */}
      <mesh visible={false} position={[0, withPackage ? -0.12 : 0, 0]}>
        <sphereGeometry args={[withPackage ? 0.95 : 0.85, 10, 8]} />
      </mesh>
    </group>
  );
}

function useDroneParts() {
  return {
    eyes: useRef(null),
    pivot: useRef(null),
    antenna: useRef(null),
    blades: useRef([]),
  };
}

// Rizo: desplazamiento (px) y giro del cuerpo para el progreso q ∈ [0, 1].
// `down` hace el rizo hacia abajo (el repartidor vuela pegado a la barra
// amarilla: hacia arriba quedaría tapado).
function loopOffset(q, dir, down = false) {
  const a = TAU * q;
  const v = down ? 1 : -1;
  return {
    x: Math.sin(a) * LOOP_RADIUS_PX * dir,
    y: v * (1 - Math.cos(a)) * LOOP_RADIUS_PX,
    roll: -v * a * dir,
  };
}

const easeLoop = (q) => (q < 0.5 ? 2 * q * q : 1 - (-2 * q + 2) ** 2 / 2);

// Peso de la visita (0 = vuelo normal, 1 = sobre la letra) a los `u` s de
// empezar; null cuando terminó.
function visitWeight(u) {
  if (u < VISIT_IN) return easeLoop(u / VISIT_IN);
  if (u < VISIT_IN + VISIT_HOLD) return 1;
  if (u < VISIT_IN + VISIT_HOLD + VISIT_OUT) return 1 - easeLoop((u - VISIT_IN - VISIT_HOLD) / VISIT_OUT);
  return null;
}

/**
 * Visita compartida por los dos drones. El paso devuelto mezcla la posición
 * normal con la de arriba de la letra y suelta la gota en el momento justo.
 */
function useVisit(sky, pos, available, hoverAbove, dropBelow) {
  const visit = useRef(null);
  useEffect(
    () =>
      sky.registerDrone({
        pos,
        available,
        visit(letter) {
          visit.current = { letter, start: null, dropped: false };
        },
      }),
    [sky, pos, available],
  );
  return (t, x, y) => {
    const v = visit.current;
    if (!v) return { x, y, w: 0, look: null };
    if (v.start === null) v.start = t;
    const u = t - v.start;
    const w = visitWeight(u);
    if (w === null) {
      visit.current = null;
      return { x, y, w: 0, look: null };
    }
    const nx = lerp(x, v.letter.cx, w);
    const ny = lerp(y, v.letter.top - hoverAbove, w);
    if (!v.dropped && u >= VISIT_DROP_AT) {
      v.dropped = true;
      sky.drops.current?.spawn(nx, ny + dropBelow, 0);
    }
    return { x: nx, y: ny, w, look: { x: v.letter.cx, y: v.letter.cy } };
  };
}

// Qué mira el dron: la letra que visita, el buscador con foco, el mouse o
// hacia adelante.
function lookAt(state, sky, L, visitLook, fallback) {
  if (visitLook) return visitLook;
  if (sky.focusRef.current && L.searchCenter) return L.searchCenter;
  if (sky.pointerRef.current.inside) return pointerPx(state);
  return fallback;
}

// Hélices, ojos y antena: lo que se anima igual en los dos drones.
function animateParts(parts, t, dt, look) {
  for (const b of parts.blades.current) if (b) b.rotation.y += dt * 38;
  if (parts.eyes.current) {
    parts.eyes.current.position.x = damp(parts.eyes.current.position.x, look.x * 0.07, 10, dt);
    parts.eyes.current.position.y = damp(parts.eyes.current.position.y, 0.02 + look.y * 0.035, 10, dt);
    // Parpadeo cada ~3,5 s
    const blink = (t % 3.5) < 0.12 ? 0.15 : 1;
    parts.eyes.current.scale.y = damp(parts.eyes.current.scale.y, blink, 30, dt);
  }
  if (parts.antenna.current) parts.antenna.current.rotation.z = Math.sin(t * 5) * 0.12;
}

/**
 * Dron repartidor: cruza de lado a lado rasante sobre el título (cada 5–7 s),
 * se balancea, el librito colgado acompaña el movimiento y esquiva el mouse.
 */
export function DeliveryDrone({ sizePx }) {
  const sky = useSky();
  const group = useRef(null);
  const tilt = useRef(null);
  const parts = useDroneParts();
  const flight = useRef({ dir: 1, start: null, dur: 6, gap: 0 });
  const dodge = useRef({ x: 0, y: 0 });
  const loop = useRef(null);
  const pos = useRef({ x: -999, y: -999 });
  const wind = useRef(new Map());
  const always = useCallback(() => true, []);
  const stepVisit = useVisit(sky, pos, always, sizePx * 0.62, sizePx * 0.32);

  const onActivate = useCallback(() => {
    if (loop.current !== null) return;
    loop.current = -1; // arranca en el próximo frame (con el reloj del Canvas)
    sky.drops.current?.spawn(pos.current.x, pos.current.y + sizePx * 0.32);
  }, [sky, sizePx]);
  const handlers = useTouchable({ onActivate });

  useFrame((state, rawDt) => {
    const L = sky.layoutRef.current;
    if (!L || !group.current) return;
    const dt = Math.min(rawDt, 0.05);
    const t = state.clock.elapsedTime;
    const fl = flight.current;
    const margin = sizePx * 0.9;

    // Primer cruce: arranca ya a la vista.
    if (fl.start === null) fl.start = t - fl.dur * 0.3;
    if (t - fl.start > fl.dur + fl.gap) {
      fl.dir *= -1;
      fl.start = t;
      fl.dur = sky.mobile ? rand(4.6, 5.6) : rand(5.2, 6.6);
      fl.gap = rand(0.1, 0.8);
      // A veces suelta una gota sobre una letra al azar del primer renglón.
      fl.dropOn = Math.random() < AUTO_DROP_CHANCE ? randomLetter(L, (l) => l.line === 0) : null;
    }
    const p = clamp((t - fl.start) / fl.dur, 0, 1);
    // Velocidad que respira un poco (no es una cinta transportadora).
    const eased = p - Math.sin(p * TAU) * 0.035;
    const from = fl.dir > 0 ? -margin : L.width + margin;
    const to = fl.dir > 0 ? L.width + margin : -margin;
    let x = from + (to - from) * eased;
    let y = L.deliveryY + Math.sin(t * 2.3) * 6;

    // Gota espontánea al pasar sobre la letra sorteada.
    if (fl.dropOn && (x - fl.dropOn.cx) * fl.dir >= 0) {
      sky.drops.current?.spawn(x, y + sizePx * 0.32, fl.dir * 20);
      fl.dropOn = null;
    }

    // Esquiva el mouse (solo puntero fino).
    let tx = 0;
    let ty = 0;
    if (sky.pointerRef.current.inside) {
      const m = pointerPx(state);
      const dx = x + dodge.current.x - m.x;
      const dy = y + dodge.current.y - m.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < DODGE_RADIUS_PX) {
        const push = (DODGE_RADIUS_PX - dist) * 1.1;
        tx = (dx / dist) * push;
        ty = (dy / dist) * push;
      }
    }
    dodge.current.x = damp(dodge.current.x, tx, 6, dt);
    dodge.current.y = damp(dodge.current.y, clamp(ty, -40, 40), 6, dt);
    x += dodge.current.x;
    y += dodge.current.y;

    // Rizo al tocarlo.
    let roll = 0;
    if (loop.current !== null) {
      if (loop.current < 0) loop.current = t;
      const q = (t - loop.current) / LOOP_SECONDS;
      if (q >= 1) loop.current = null;
      else {
        const o = loopOffset(easeLoop(q), fl.dir, true);
        x += o.x;
        y += o.y;
        roll = o.roll;
      }
    }

    const visit = stepVisit(t, x, y);
    x = visit.x;
    y = visit.y;
    pos.current.x = x;
    pos.current.y = y;
    placeAt(state, group.current, x, y);
    group.current.scale.setScalar((sizePx * pxUnit(state)) / MODEL_WIDTH);
    brushLetters(sky, L, wind.current, t, x, y, fl.dir, sizePx * 0.72);

    // Se inclina hacia donde va y un poco más cuando esquiva.
    const lean = -fl.dir * 0.14 - dodge.current.x * 0.003;
    tilt.current.rotation.z = damp(tilt.current.rotation.z, lean, 5, dt);
    group.current.rotation.z = roll;
    tilt.current.rotation.y = damp(tilt.current.rotation.y, fl.dir * 0.32, 3, dt);
    if (parts.pivot.current) {
      parts.pivot.current.rotation.z = -fl.dir * 0.16 + Math.sin(t * 3.1) * 0.14 - roll * 0.4;
    }
    const lookTarget = lookAt(state, sky, L, visit.look, { x: x + fl.dir * 60, y });
    animateParts(parts, t, dt, {
      x: clamp((lookTarget.x - x) / 120, -1, 1),
      y: clamp((y - lookTarget.y) / 120, -1, 1),
    });
  });

  return (
    <group ref={group} {...handlers}>
      <group ref={tilt} rotation={[0.32, 0, 0]}>
        <DroneBody
          color={COLORS.yellow}
          accent={COLORS.yellowDark}
          light={COLORS.streak}
          parts={parts}
          withPackage
        />
      </group>
    </group>
  );
}

/**
 * Dron chico: ronda en ocho el hueco junto al título, mira al
 * puntero y al acercarle el mouse se agranda un poco, contento. Al tocarlo
 * da una voltereta en el lugar y suelta una gota.
 */
export function ScoutDrone({ sizePx }) {
  const sky = useSky();
  const group = useRef(null);
  const tilt = useRef(null);
  const parts = useDroneParts();
  const loop = useRef(null);
  const hovered = useRef(false);
  const grow = useRef(1);
  const pos = useRef({ x: -999, y: -999 });
  const wind = useRef(new Map());
  const hasZone = useCallback(() => Boolean(sky.layoutRef.current?.smallZone), [sky]);
  const stepVisit = useVisit(sky, pos, hasZone, sizePx * 0.55, sizePx * 0.2);

  const onActivate = useCallback(() => {
    if (loop.current !== null) return;
    loop.current = -1;
    sky.drops.current?.spawn(pos.current.x, pos.current.y + sizePx * 0.2);
  }, [sky, sizePx]);
  const onHover = useCallback((on) => {
    hovered.current = on;
  }, []);
  const handlers = useTouchable({ onActivate, onHover });

  useFrame((state, rawDt) => {
    const L = sky.layoutRef.current;
    const g = group.current;
    if (!g) return;
    const zone = L?.smallZone;
    g.visible = Boolean(zone);
    if (!zone) return;
    const dt = Math.min(rawDt, 0.05);
    const t = state.clock.elapsedTime;

    const cx = (zone.x0 + zone.x1) / 2;
    const cy = (zone.y0 + zone.y1) / 2;
    const ax = Math.max(0, (zone.x1 - zone.x0) / 2 - sizePx * 0.55);
    const ay = Math.max(0, (zone.y1 - zone.y0) / 2 - sizePx * 0.3);
    let x = cx + Math.sin(t * 0.9) * ax;
    let y = cy + Math.sin(t * 1.8) * ay;
    const vx = Math.cos(t * 0.9);

    let roll = 0;
    if (loop.current !== null) {
      if (loop.current < 0) loop.current = t;
      const q = (t - loop.current) / LOOP_SECONDS;
      if (q >= 1) loop.current = null;
      else {
        // Voltereta en el lugar con saltito: no sale de su hueco ni tapa el título.
        const e = easeLoop(q);
        y -= Math.sin(Math.PI * q) * 18;
        roll = -TAU * e * (vx >= 0 ? 1 : -1);
      }
    }
    const visit = stepVisit(t, x, y);
    x = visit.x;
    y = visit.y;
    pos.current.x = x;
    pos.current.y = y;
    placeAt(state, g, x, y, 0.4);
    if (visit.w > 0) brushLetters(sky, L, wind.current, t, x, y, vx >= 0 ? 1 : -1, sizePx * 0.6);

    grow.current = damp(grow.current, hovered.current ? 1.15 : 1, 10, dt);
    g.scale.setScalar(((sizePx * pxUnit(state)) / MODEL_WIDTH) * grow.current);
    g.rotation.z = roll;

    // Mira la letra que visita, el buscador con foco, el puntero o hacia donde va.
    const m = lookAt(state, sky, L, visit.look, { x: x + vx * 80, y });
    const lx = clamp((m.x - x) / 160, -1, 1);
    const ly = clamp((y - m.y) / 160, -1, 1);
    tilt.current.rotation.y = damp(tilt.current.rotation.y, lx * 0.55, 6, dt);
    tilt.current.rotation.x = damp(tilt.current.rotation.x, 0.32 - ly * 0.3, 6, dt);
    tilt.current.rotation.z = damp(tilt.current.rotation.z, -vx * 0.12, 4, dt);
    animateParts(parts, t, dt, { x: lx, y: ly });
  });

  return (
    <group ref={group} {...handlers}>
      <group ref={tilt} rotation={[0.32, 0, 0]}>
        <DroneBody
          color={COLORS.streak}
          accent={COLORS.yellow}
          light={COLORS.yellow}
          parts={parts}
          withAntenna
        />
      </group>
    </group>
  );
}
