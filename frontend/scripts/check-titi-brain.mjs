// Contrato del Titi 3D del cuarto de /courses (change titi-3d-cursos):
//   - pasea solo por la zona libre, sin salir de ella ni quedarse quieto;
//   - hace de todo un poco (sentarse, mirar, saludar, pensar);
//   - cargado nunca sale de la zona; al soltarlo cae, se marea y vuelve a lo suyo;
//   - tocarlo solo hace celebrar si estaba tranquilo;
//   - todas las poses devuelven números válidos para cada articulación;
//   - la cara parpadea seguido, sus impulsos quedan acotados y vuelven a reposo.
import assert from 'node:assert/strict';
import { AREA, CARRY_HEIGHT, carryTo, createBrain, drop, grab, poke, stepBrain } from '../src/components/hero3d/titi/titiBrain.js';
import { POSE_KEYS, poseFor } from '../src/components/hero3d/titi/titiPoses.js';
import { createFace, stepFace } from '../src/components/hero3d/titi/titiFace.js';

// Azar con semilla: la prueba siempre recorre el mismo camino.
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const inside = (b) => b.x >= AREA.minX - 1e-9 && b.x <= AREA.maxX + 1e-9 && b.z >= AREA.minZ - 1e-9 && b.z <= AREA.maxZ + 1e-9;
const DT = 1 / 60;

// 1. Diez minutos de vida propia.
for (const seed of [1, 7, 42]) {
  const rand = seeded(seed);
  const b = createBrain();
  const seen = new Set();
  let walked = 0;
  for (let i = 0; i < 60 * 600; i += 1) {
    const x = b.x;
    const z = b.z;
    stepBrain(b, DT, rand);
    seen.add(b.mode);
    walked += Math.hypot(b.x - x, b.z - z);
    assert.ok(inside(b), `semilla ${seed}: salió de la zona libre (${b.x}, ${b.z})`);
    assert.equal(b.y, 0, `semilla ${seed}: flota sin que nadie lo cargue`);
  }
  for (const mode of ['sit', 'walk', 'stand', 'wave', 'think']) {
    assert.ok(seen.has(mode), `semilla ${seed}: nunca hizo "${mode}"`);
  }
  assert.ok(walked > 10, `semilla ${seed}: caminó muy poco (${walked.toFixed(1)})`);
}

// 2. Cargarlo y soltarlo.
{
  const rand = seeded(3);
  const b = createBrain();
  grab(b);
  assert.equal(b.mode, 'carried');
  carryTo(b, 9, -9); // fuera del cuarto: se queda en el borde de la zona
  for (let i = 0; i < 120; i += 1) stepBrain(b, DT, rand);
  assert.ok(inside(b), 'cargado salió de la zona libre');
  assert.ok(Math.abs(b.x - AREA.maxX) < 0.01 && Math.abs(b.z - AREA.minZ) < 0.01, 'no siguió al puntero hasta el borde');
  assert.ok(Math.abs(b.y - CARRY_HEIGHT) < 0.01, 'no quedó colgando a la altura de carga');
  assert.equal(poke(b, rand), false, 'cargado no debe celebrar');

  drop(b);
  assert.equal(b.mode, 'fall');
  const modes = [];
  for (let i = 0; i < 60 * 4; i += 1) {
    stepBrain(b, DT, rand);
    if (modes[modes.length - 1] !== b.mode) modes.push(b.mode);
  }
  assert.deepEqual(modes.slice(0, 4), ['fall', 'land', 'dizzy', 'sit'], `tras soltarlo: ${modes.join(' → ')}`);
  assert.equal(b.y, 0, 'no llegó al piso');
}

// 3. Tocarlo: celebra y vuelve a sentarse.
{
  const rand = seeded(5);
  const b = createBrain();
  assert.equal(poke(b, rand), true);
  assert.equal(b.mode, 'celebrate');
  for (let i = 0; i < 60 * 1.5; i += 1) stepBrain(b, DT, rand);
  assert.equal(b.mode, 'sit', 'después de celebrar no volvió a sentarse');
}

// 4. Poses completas y finitas en todos los modos.
for (const mode of ['sit', 'stand', 'walk', 'wave', 'think', 'celebrate', 'carried', 'fall', 'land', 'dizzy']) {
  for (const t of [0, 0.37, 1.2, 5]) {
    const pose = poseFor(mode, t, { time: t * 3, phase: t * 7, speed: 0.4, swayX: 0.3, swayZ: -0.2 });
    for (const key of POSE_KEYS) {
      assert.ok(Number.isFinite(pose[key]), `pose ${mode}: "${key}" no es un número (${pose[key]})`);
    }
  }
}

// 5. Cara: parpadea cada 2–5 s, todo acotado y en reposo fuera de los impulsos.
{
  const rand = seeded(11);
  const f = createFace();
  let blinks = 0;
  let closed = false;
  let restFrames = 0;
  const frames = 60 * 120;
  for (let i = 0; i < frames; i += 1) {
    const fx = stepFace(f, DT, { calm: true, rand });
    for (const [k, v] of Object.entries(fx)) assert.ok(Number.isFinite(v), `cara: "${k}" no es un número`);
    assert.ok(fx.lid >= 0.05 && fx.lid <= 1, `párpado fuera de rango: ${fx.lid}`);
    assert.ok(Math.abs(fx.sx) <= 0.6 && Math.abs(fx.sy) <= 0.4, 'la mirada se fue demasiado');
    assert.ok(Math.abs(fx.twitch) <= 1 && fx.ear >= 0 && fx.ear <= 1, 'impulso fuera de rango');
    if (fx.lid < 0.5 && !closed) blinks += 1;
    closed = fx.lid < 0.5;
    if (fx.twitch === 0 && fx.ear === 0) restFrames += 1;
  }
  assert.ok(blinks >= 120 / 5 && blinks <= (120 / 2) * 1.3, `parpadeos en 2 min: ${blinks}`);
  assert.ok(restFrames / frames > 0.9, 'bigote u orejas casi nunca en reposo');
  // Agitado (cargado, cayendo): mira al frente y no olfatea.
  const g = createFace();
  for (let i = 0; i < 60 * 20; i += 1) {
    const fx = stepFace(g, DT, { calm: false, rand });
    if (i > 120) assert.equal(fx.twitch, 0, 'olfatea mientras lo cargan');
  }
  assert.ok(Math.abs(g.look.x) < 1e-3 && Math.abs(g.look.y) < 1e-3, 'agitado no vuelve a mirar al frente');
}

console.log('Titi 3D: vida propia, carga, toque, poses y cara OK');
