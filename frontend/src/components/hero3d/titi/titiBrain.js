// Cerebro de Titi: decide qué hace en cada momento y dónde está. Sin three ni
// React: un objeto de estado y funciones puras (se testea en Node).
//
// Vida propia: se sienta, mira alrededor, se levanta, camina a otro punto libre
// del cuarto y ahí hace algo (sentarse, saludar a la cámara, pensar, mirar).
// El usuario puede tocarlo (celebra) o agarrarlo y soltarlo (cae, se marea y
// sigue con lo suyo).
//
// Posiciones en unidades del cuarto (piso de -3 a 3; ver roomLayout.js).

// Zona libre de muebles alrededor de la alfombra. Es un rectángulo: cualquier
// recta entre dos puntos de adentro tampoco choca con nada.
export const AREA = { minX: -1.35, maxX: 0.9, minZ: -1.3, maxZ: 1.0 };
export const HOME = { x: -0.3, z: 0.55 };
// La cámara isométrica mira desde +x +z: este giro lo deja de frente.
export const FACE_CAMERA = Math.PI / 4;
export const CARRY_HEIGHT = 0.5;

const WALK_SPEED = 0.5; // unidades por segundo
const GRAVITY = 9.8;
const STAND_UP_S = 0.45; // al empezar a caminar, primero se para
const CALM = new Set(['sit', 'stand', 'walk', 'wave', 'think']);

// Qué hace al llegar a destino (peso relativo).
const ACTIVITIES = [
  ['sit', 5],
  ['stand', 2],
  ['wave', 1.5],
  ['think', 2],
];

const DURATION = {
  sit: [5, 9],
  stand: [2.4, 3.6],
  wave: [1.8, 2.2],
  think: [2.6, 3.4],
  celebrate: [1.3, 1.3],
  land: [0.35, 0.35],
  dizzy: [1.1, 1.1],
};

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export const clampToArea = (x, z) => ({ x: clamp(x, AREA.minX, AREA.maxX), z: clamp(z, AREA.minZ, AREA.maxZ) });

function pick(rand, weighted) {
  const total = weighted.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [item, w] of weighted) {
    r -= w;
    if (r <= 0) return item;
  }
  return weighted[weighted.length - 1][0];
}

const between = (rand, [a, b]) => a + (b - a) * rand();

function go(b, mode, rand) {
  b.mode = mode;
  b.t = 0;
  b.dur = DURATION[mode] ? between(rand, DURATION[mode]) : 0;
  // Para lo que hace en el lugar, se pone de frente a la cámara (más o menos).
  if (mode !== 'walk') b.yawTarget = FACE_CAMERA + (rand() - 0.5) * 0.7;
}

// Elige un destino libre a cierta distancia; de vez en cuando vuelve a la alfombra.
function pickTarget(b, rand) {
  if (rand() < 0.25) return { x: HOME.x, z: HOME.z };
  for (let i = 0; i < 8; i += 1) {
    const x = AREA.minX + rand() * (AREA.maxX - AREA.minX);
    const z = AREA.minZ + rand() * (AREA.maxZ - AREA.minZ);
    if (Math.hypot(x - b.x, z - b.z) > 0.7) return { x, z };
  }
  return { x: HOME.x, z: HOME.z };
}

function startWalk(b, rand) {
  const target = pickTarget(b, rand);
  b.target = target;
  b.next = pick(rand, ACTIVITIES);
  go(b, 'walk', rand);
}

/** Estado inicial: sentado en la alfombra, de frente. */
export function createBrain() {
  return {
    mode: 'sit',
    t: 0,
    dur: 6,
    x: HOME.x,
    z: HOME.z,
    y: 0, // altura sobre el piso (cargado o cayendo)
    vy: 0,
    vx: 0, // velocidad horizontal (para el balanceo al cargarlo)
    vz: 0,
    yaw: FACE_CAMERA,
    yawTarget: FACE_CAMERA,
    speed: 0,
    phase: 0,
    target: null,
    next: 'sit',
    carry: null,
  };
}

/**
 * Avanza el cerebro `dt` segundos.
 * @param {object} b      Estado (se modifica).
 * @param {number} dt
 * @param {() => number} rand  Fuente de azar (inyectable en tests).
 */
export function stepBrain(b, dt, rand = Math.random) {
  b.t += dt;
  const px = b.x;
  const pz = b.z;

  switch (b.mode) {
    case 'carried': {
      // Sigue al puntero con un poco de inercia.
      const k = 1 - Math.exp(-dt * 14);
      const c = b.carry || b;
      b.x += (c.x - b.x) * k;
      b.z += (c.z - b.z) * k;
      b.y += (CARRY_HEIGHT - b.y) * (1 - Math.exp(-dt * 10));
      break;
    }
    case 'fall':
      b.vy -= GRAVITY * dt;
      b.y += b.vy * dt;
      if (b.y <= 0) {
        b.y = 0;
        b.vy = 0;
        go(b, 'land', rand);
      }
      break;
    case 'walk': {
      const dx = b.target.x - b.x;
      const dz = b.target.z - b.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.05) {
        b.speed = 0;
        go(b, b.next, rand);
        break;
      }
      const turn = wrap(Math.atan2(dx, dz) - b.yaw);
      b.yaw = wrap(b.yaw + turn * (1 - Math.exp(-dt * 5)));
      // Se para antes de arrancar, gira en el lugar si el destino quedó atrás
      // y frena al llegar.
      const ready = b.t > STAND_UP_S ? 1 : 0;
      const facing = clamp(1 - Math.abs(turn) / 1.2, 0, 1);
      const arrive = clamp(dist / 0.3, 0.35, 1);
      const want = WALK_SPEED * ready * facing * arrive;
      b.speed += (want - b.speed) * (1 - Math.exp(-dt * 6));
      b.x += Math.sin(b.yaw) * b.speed * dt;
      b.z += Math.cos(b.yaw) * b.speed * dt;
      Object.assign(b, clampToArea(b.x, b.z));
      b.phase += dt * (4 + b.speed * 14);
      break;
    }
    default:
      b.speed *= Math.exp(-dt * 8);
      if (b.t >= b.dur) {
        if (b.mode === 'land') go(b, 'dizzy', rand);
        else if (b.mode === 'dizzy' || b.mode === 'celebrate') go(b, 'sit', rand);
        else if (b.mode === 'sit' || rand() < 0.75) startWalk(b, rand);
        else go(b, 'sit', rand);
      }
  }

  if (b.mode !== 'walk' && b.mode !== 'carried' && b.mode !== 'fall') {
    b.yaw = wrap(b.yaw + wrap(b.yawTarget - b.yaw) * (1 - Math.exp(-dt * 3)));
  }
  if (dt > 0) {
    b.vx = (b.x - px) / dt;
    b.vz = (b.z - pz) / dt;
  }
  return b;
}

/** El usuario lo agarra: queda colgando del puntero. */
export function grab(b) {
  b.mode = 'carried';
  b.t = 0;
  b.speed = 0;
  b.carry = { x: b.x, z: b.z };
}

/** Mueve el punto del que cuelga (siempre dentro de la zona libre). */
export function carryTo(b, x, z) {
  b.carry = clampToArea(x, z);
}

/** El usuario lo suelta: cae al piso. */
export function drop(b) {
  if (b.mode !== 'carried') return;
  b.mode = 'fall';
  b.t = 0;
  b.vy = 0;
  b.carry = null;
}

/** Toque sin arrastre: celebra si estaba tranquilo. */
export function poke(b, rand = Math.random) {
  if (!CALM.has(b.mode)) return false;
  b.speed = 0;
  go(b, 'celebrate', rand);
  return true;
}
