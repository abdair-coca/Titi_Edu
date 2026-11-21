// Geometrías de Titi hechas en código: piezas esculpidas (cabeza, torso,
// muslos, orejas, manos y pies: formas suaves fundidas, ver titiSculpt),
// barridos que se afinan (bigote, cejas, mechón, chivita, boca), la esfera
// "cuadradita" de los ojos, la nariz en trapecio y la cola continua con
// esqueleto. Brazos y canillas siguen siendo cápsulas.
//
// Coordenadas de la cara: las de la cabeza (centrada en el origen, antes de su
// escala), Titi mira hacia +z y su lado izquierdo es +x.
// Las medidas salen de /Titi.png (ojos, nariz, boca y bigote medidos sobre la
// imagen y pasados a unidades de la cabeza).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ellipse, inside, layer, makeSculpt, rayExit, sdEllipsoid, smin, ssub } from './titiSculpt.js';

export const HEAD = { x: 0.27, y: 0.245, z: 0.25 };
// Hocico claro: elipsoide delante de la cabeza (se funde con ella).
export const MUZZLE = { p: [0, -0.075, 0.185], s: [0.13, 0.095, 0.085] };
// Puente del bigote: almohadilla blanca bajo la nariz donde va la "w" (en
// Titi.png la sonrisa está dibujada sobre el bigote, no sobre la piel).
export const STACHE_PAD = { p: [0, -0.1, 0.25], s: [0.104, 0.047, 0.036] };

// Centro de cada ojo (lado +x) y su cuenca.
export const EYE = { x: 0.106, y: 0.05 };
export const EYE_SOCKET = { p: [EYE.x, EYE.y, 0.262], s: [0.08, 0.09, 0.04] };

const ellipsoidZ = (x, y, cx, cy, cz, rx, ry, rz) => {
  const k = 1 - ((x - cx) / rx) ** 2 - ((y - cy) / ry) ** 2;
  return cz + rz * Math.sqrt(Math.max(0, k));
};

/**
 * Cabeza esculpida: cráneo, mejillas llenas (donde se apoya el bigote), hocico
 * y mentón fundidos en una sola forma.
 */
const HEAD_C = [0, 0, 0];
const HEAD_R = [HEAD.x, HEAD.y, HEAD.z];
const CHIN = { p: [0, -0.16, 0.13], s: [0.1, 0.075, 0.09] };
const CHEEK_R = [0.15, 0.12, 0.15];
const BROW_RIDGE_R = [0.1, 0.045, 0.068];
const EAR_BASE_R = [0.05, 0.07, 0.05];
// Piezas de cada lado (centro con x en el lado correspondiente).
const SIDES = [-1, 1].map((sx) => ({
  cheek: [sx * 0.15, -0.105, 0.06],
  ridge: [sx * 0.1, 0.155, 0.16],
  socket: [sx * EYE_SOCKET.p[0], EYE_SOCKET.p[1], EYE_SOCKET.p[2]],
  ear: [sx * 0.245, 0.04, -0.015],
}));

export function headSdf(p) {
  let d = sdEllipsoid(p, HEAD_C, HEAD_R);
  // Mejillas llenas (donde apoya el bigote), hocico y mentón.
  for (const s of SIDES) d = smin(d, sdEllipsoid(p, s.cheek, CHEEK_R), 0.08);
  d = smin(d, sdEllipsoid(p, MUZZLE.p, MUZZLE.s), 0.05);
  d = smin(d, sdEllipsoid(p, CHIN.p, CHIN.s), 0.06);
  for (const s of SIDES) {
    // Arco de la ceja apenas marcado y cuenca poco profunda: los ojos quedan
    // metidos en la cara (de perfil no saltan afuera).
    d = smin(d, sdEllipsoid(p, s.ridge, BROW_RIDGE_R), 0.05);
    d = ssub(d, sdEllipsoid(p, s.socket, EYE_SOCKET.s), 0.035);
    // Base de la oreja: el cráneo sube un poco a su encuentro (unión orgánica).
    d = smin(d, sdEllipsoid(p, s.ear, EAR_BASE_R), 0.05);
  }
  return d;
}

/** z de la superficie (de frente) de la cabeza esculpida en (x, y), más `lift`. */
export const onHead = (x, y, lift = 0) => rayExit(headSdf, [x, y, 0], [0, 0, 1], 0.5) + lift;
/** Punto de la superficie (de frente) en (x, y), despegado `lift` según la normal. */
export const onHeadN = (x, y, lift = 0) => {
  const z = onHead(x, y);
  const e = 1e-4;
  const n = [
    headSdf([x + e, y, z]) - headSdf([x - e, y, z]),
    headSdf([x, y + e, z]) - headSdf([x, y - e, z]),
    headSdf([x, y, z + e]) - headSdf([x, y, z - e]),
  ];
  // A medio camino entre la normal y el frente: pegado a la curva del cráneo
  // sin subirse sobre la silueta de la frente.
  const l = Math.hypot(...n) || 1;
  const k = [n[0] / l, n[1] / l, n[2] / l + 1];
  const kl = Math.hypot(...k);
  return [x + (k[0] / kl) * lift, y + (k[1] / kl) * lift, z + (k[2] / kl) * lift];
};
/** z de la superficie del puente del bigote. */
export const onPad = (x, y, lift = 0) => ellipsoidZ(x, y, ...STACHE_PAD.p, ...STACHE_PAD.s) + lift;

// Hacia afuera de la cabeza: orienta el aplanado de bigote, cejas y mechón.
// (gradiente del campo de la cabeza esculpida).
const headNormal = (p) => {
  const e = 1e-4;
  return new THREE.Vector3(
    headSdf([p.x + e, p.y, p.z]) - headSdf([p.x - e, p.y, p.z]),
    headSdf([p.x, p.y + e, p.z]) - headSdf([p.x, p.y - e, p.z]),
    headSdf([p.x, p.y, p.z + e]) - headSdf([p.x, p.y, p.z - e]),
  ).normalize();
};

/**
 * Barrido de sección elíptica a lo largo de una curva, con radio variable.
 * A diferencia de un tubo de Frenet, la sección no se retuerce: su lado plano
 * mira siempre hacia `forward` (el bigote queda alto y delgado, de frente).
 * Si el radio llega a 0 en los extremos, quedan cerrados y redondeados.
 *
 * @param {number[][]} points  Puntos de control [x, y, z].
 * @param {(t: number) => number} radius  Radio (alto) según el avance 0..1.
 * @param {{ segments?: number, radial?: number, depth?: number, forward?: (p: THREE.Vector3) => THREE.Vector3 }} opts
 *   depth: grosor relativo en la dirección `forward`.
 */
export function makeSweep(points, radius, { segments = 40, radial = 14, depth = 1, forward = headNormal } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
  const positions = [];
  const indices = [];
  const p = new THREE.Vector3();
  const t3 = new THREE.Vector3();
  const b = new THREE.Vector3();
  const n = new THREE.Vector3();
  const v = new THREE.Vector3();

  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    curve.getPointAt(t, p);
    curve.getTangentAt(t, t3);
    b.copy(forward(p)).addScaledVector(t3, -forward(p).dot(t3));
    if (b.lengthSq() < 1e-8) b.set(0, 0, 1);
    b.normalize();
    n.crossVectors(b, t3).normalize();
    const r = radius(t);
    for (let j = 0; j <= radial; j += 1) {
      const a = (j / radial) * Math.PI * 2;
      v.copy(p)
        .addScaledVector(n, Math.cos(a) * r)
        .addScaledVector(b, Math.sin(a) * r * depth);
      positions.push(v.x, v.y, v.z);
    }
  }
  const row = radial + 1;
  for (let i = 0; i < segments; i += 1) {
    for (let j = 0; j < radial; j += 1) {
      const a = i * row + j;
      const c = a + row;
      indices.push(a, a + 1, c, c, a + 1, c + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Perfil de grosor: raíz redondeada, máximo en `at` y punta afinada.
 * base: grosor relativo al empezar (tras el redondeo); round: largo del
 * redondeo de la raíz; tip: cuán rápido se afina (más alto = punta más fina).
 */
const profile = (peak, { at = 0.3, base = 0.7, round = 0.08, tip = 1 } = {}) => (t) => {
  const cap = Math.sqrt(Math.min(1, t / round));
  const body = t < at
    ? base + (1 - base) * Math.sin((t / at) * (Math.PI / 2))
    : Math.cos(((t - at) / (1 - at)) * (Math.PI / 2)) ** tip;
  return peak * cap * body;
};

// Grosor parejo con los dos extremos redondeados (la línea de la boca).
const line = (r, round = 0.08) => (t) => r * Math.sqrt(Math.min(1, t / round, (1 - t) / round));

const mirror = (pts) => pts.map(([x, y, z]) => [-x, y, z]);

/**
 * z para que un mechón de alto ±h centrado en (x, y) quede delante de la cara
 * en todo su alto (la mejilla se adelanta por encima de la línea media).
 */
const clearOfFace = (x, y, h, lift) => Math.max(onHead(x, y + h), onHead(x, y), onHead(x, y - h)) + lift;

/**
 * Perfil por claves [t, radio]: interpolación suave entre cada par (sin
 * quiebres de grosor a lo largo del barrido).
 */
const keyed = (keys) => (t) => {
  let i = 1;
  while (i < keys.length - 1 && keys[i][0] < t) i += 1;
  const [t0, r0] = keys[i - 1];
  const [t1, r1] = keys[i];
  const u = THREE.MathUtils.clamp((t - t0) / (t1 - t0), 0, 1);
  return r0 + (r1 - r0) * (u * u * (3 - 2 * u));
};

// Bigote (mitad +x), medido sobre Titi.png: nace bajo la nariz (en el puente),
// baja abriéndose sobre la mejilla, llega más allá de las orejas y la punta se
// levanta en un rizo fino. Lo más grueso queda sobre la mejilla.
const MUSTACHE = [
  [0.04, -0.098, 0.25],
  [0.1, -0.104, 0],
  [0.182, -0.13, 0],
  [0.252, -0.165, 0],
  [0.312, -0.196, 0.14],
  [0.36, -0.211, 0.114],
  [0.397, -0.2, 0.1],
  [0.421, -0.174, 0.096],
  [0.43, -0.142, 0.1],
].map(([x, y, z]) => [x, y, z || clearOfFace(x, y, 0.05, 0.024)]);
const MUSTACHE_R = keyed([
  [0, 0.006],
  [0.04, 0.036],
  [0.17, 0.045],
  [0.38, 0.068],
  [0.55, 0.074],
  [0.7, 0.062],
  [0.81, 0.044],
  [0.9, 0.026],
  [0.96, 0.012],
  [1, 0],
]);
// Mechón de abajo: una segunda capa detrás y más baja que arma la panza del
// bigote (en Titi.png el bigote tiene dos tonos, uno sobre otro).
const MUSTACHE_UNDER = [
  [0.1, -0.14, 0],
  [0.19, -0.185, 0],
  [0.262, -0.222, 0.1],
  [0.318, -0.24, 0.078],
  [0.364, -0.236, 0.066],
].map(([x, y, z]) => [x, y, z || clearOfFace(x, y, 0.04, -0.014)]);
const MUSTACHE_UNDER_R = keyed([
  [0, 0.004],
  [0.1, 0.034],
  [0.45, 0.05],
  [0.8, 0.032],
  [1, 0],
]);

// Cejas (mitad +x), medidas sobre Titi.png: un mechón grueso como nubecita,
// alto adentro, que baja hacia afuera y termina en punta, con un segundo
// mechón más corto encima que le da el borde "esponjoso".
const BROW = [
  [0.064, 0.182],
  [0.1, 0.184],
  [0.14, 0.175],
  [0.17, 0.155],
  [0.185, 0.13],
].map(([x, y]) => onHeadN(x, y, 0.024));
const BROW_TUFT = [
  [0.074, 0.196],
  [0.106, 0.203],
  [0.138, 0.194],
  [0.158, 0.178],
].map(([x, y]) => onHeadN(x, y, 0.018));

// Mechón de la coronilla (Titi.png): una cresta baja y ancha, como una llama
// de tres puntas que nace del cráneo: la central más alta e inclinada hacia
// +x, una chica a cada lado. Bases anchas y hundidas, puntas finas.
const TUFT = [
  { pts: [[-0.012, 0.19, 0.04], [0.0, 0.262, 0.045], [0.02, 0.302, 0.04], [0.05, 0.33, 0.03]], r: 0.052 },
  { pts: [[-0.055, 0.19, 0.035], [-0.058, 0.25, 0.04], [-0.05, 0.283, 0.035], [-0.036, 0.3, 0.03]], r: 0.038 },
  { pts: [[0.045, 0.19, 0.035], [0.062, 0.24, 0.035], [0.085, 0.268, 0.025], [0.104, 0.277, 0.015]], r: 0.034 },
  { pts: [[-0.004, 0.17, -0.02], [-0.01, 0.245, -0.025], [0.01, 0.285, -0.025], [0.03, 0.3, -0.03]], r: 0.042 },
];

// Chivita: mechón central largo y dos cortos a los costados (punta irregular).
const GOATEE = [
  { pts: [[0, -0.152, 0.238], [0, -0.2, 0.246], [0.002, -0.252, 0.232], [0.01, -0.3, 0.206]], r: 0.04, tip: 1.4 },
  { pts: [[0.026, -0.164, 0.232], [0.035, -0.205, 0.232], [0.028, -0.245, 0.218]], r: 0.023, tip: 1.2 },
  { pts: [[-0.026, -0.164, 0.232], [-0.032, -0.2, 0.232], [-0.022, -0.236, 0.22]], r: 0.021, tip: 1.2 },
];

// Boca en "w" justo debajo de la nariz, sobre el hocico.
const SMILE = [
  [-0.082, -0.087],
  [-0.064, -0.104],
  [-0.038, -0.113],
  [-0.014, -0.106],
  [0, -0.094],
  [0.014, -0.106],
  [0.038, -0.113],
  [0.064, -0.104],
  [0.082, -0.087],
];

/** Esfera con el contorno frontal "cuadradito" (ojos de Titi.png). */
function makeSquircleSphere(power = 3.2) {
  const g = new THREE.SphereGeometry(1, 40, 28);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const r = Math.hypot(x, y);
    if (r < 1e-6) continue;
    const c = Math.abs(x / r);
    const s = Math.abs(y / r);
    const k = 1 / (c ** power + s ** power) ** (1 / power);
    // Solo se "cuadra" un poco: entre círculo y superelipse.
    const f = 1 + (k - 1) * 0.55;
    pos.setXY(i, x * f, y * f);
  }
  g.computeVertexNormals();
  return g;
}

/** Nariz: más ancha arriba que abajo (trapecio redondeado). */
function makeNose() {
  const g = new THREE.SphereGeometry(1, 32, 20);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const y = pos.getY(i);
    pos.setX(i, pos.getX(i) * (1 + 0.3 * y));
    pos.setY(i, y < 0 ? y * 0.9 : y);
  }
  g.computeVertexNormals();
  return g;
}

/**
 * Cola continua con esqueleto: un solo tubo a lo largo de +y (pose de reposo
 * recta), con cada anillo pegado a uno o dos huesos. Doblar los huesos curva la
 * malla sin quiebres entre segmentos.
 */
export function makeTailGeometry({ segments, length, radius: [r0, r1] }) {
  const rings = [];
  const perBone = 8;
  const total = segments * length;
  for (let k = 0; k <= segments * perBone; k += 1) {
    const h = (k / (segments * perBone)) * total;
    rings.push({ h, r: r0 + (r1 - r0) * (h / total), tilt: 0 });
  }
  // Punta redondeada (media esfera; el último anillo es un punto).
  for (let k = 1; k <= 6; k += 1) {
    const a = (k / 6) * (Math.PI / 2);
    rings.push({ h: total + Math.sin(a) * r1, r: k === 6 ? 0 : Math.cos(a) * r1, tilt: a });
  }

  const radial = 18;
  const positions = [];
  const normals = [];
  const skinIndex = [];
  const skinWeight = [];
  const indices = [];
  // Peso de cada hueso: B-spline cuadrática centrada en el medio del hueso
  // (reparte cada anillo entre hasta tres huesos; la curva queda suave, sin
  // "festones" en la parte de adentro de la espiral).
  const bspline = (x) => {
    const ax = Math.abs(x);
    if (ax < 0.5) return 0.75 - ax * ax;
    if (ax < 1.5) return 0.5 * (1.5 - ax) ** 2;
    return 0;
  };
  for (const { h, r, tilt } of rings) {
    const u = Math.min(h, total) / length;
    const weights = new Map();
    for (let k = Math.floor(u) - 2; k <= Math.floor(u) + 2; k += 1) {
      const b = bspline(u - (k + 0.5));
      if (b <= 0) continue;
      const bone = THREE.MathUtils.clamp(k, 0, segments - 1);
      weights.set(bone, (weights.get(bone) || 0) + b);
    }
    const top = [...weights].sort((x, y) => y[1] - x[1]).slice(0, 4);
    const sum = top.reduce((acc, [, v]) => acc + v, 0);
    const idx = [0, 0, 0, 0];
    const wt = [0, 0, 0, 0];
    top.forEach(([bone, v], k) => {
      idx[k] = bone;
      wt[k] = v / sum;
    });
    for (let j = 0; j <= radial; j += 1) {
      const a = (j / radial) * Math.PI * 2;
      positions.push(Math.cos(a) * r, h, Math.sin(a) * r);
      // Normales exactas: con las calculadas, el anillo final (un punto) da
      // normales al azar y el contorno de la punta sale en estrella.
      normals.push(Math.cos(a) * Math.cos(tilt), Math.sin(tilt), Math.sin(a) * Math.cos(tilt));
      skinIndex.push(...idx);
      skinWeight.push(...wt);
    }
  }
  const row = radial + 1;
  for (let i = 0; i < rings.length - 1; i += 1) {
    for (let j = 0; j < radial; j += 1) {
      const a = i * row + j;
      const c = a + row;
      indices.push(a, c, a + 1, c, c + 1, a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
  geometry.setIndex(indices);
  return geometry;
}

/**
 * Cabeza esculpida con el antifaz claro pintado (dos óvalos alrededor de los
 * ojos unidos al hocico, como en Titi.png): sin piezas que sobresalgan.
 */
export function makeHeadGeometry(colors) {
  const fur = new THREE.Color(colors.fur);
  const mask = new THREE.Color(colors.mask);
  return makeSculpt(headSdf, {
    max: 0.5,
    width: 80,
    height: 60,
    paint: ([x, y, z]) => {
      const eyes = Math.min(ellipse(Math.abs(x), y, EYE.x, EYE.y, 0.118, 0.126), ellipse(x, y, 0, -0.045, 0.085, 0.075));
      const front = THREE.MathUtils.smoothstep(z, 0.06, 0.12);
      return layer(fur, [mask, inside(eyes, 0.05) * front]);
    },
  });
}

/** Oreja: disco grueso con el centro ahuecado y pintado más oscuro. */
export function makeEarGeometry(colors) {
  const fur = new THREE.Color(colors.fur);
  const inner = new THREE.Color(colors.earInner);
  const sdf = (p) => ssub(
    sdEllipsoid(p, [0, 0, 0], [0.105, 0.115, 0.052]),
    sdEllipsoid(p, [0, -0.008, 0.056], [0.074, 0.084, 0.048]),
    0.022,
  );
  return makeSculpt(sdf, {
    max: 0.2,
    width: 36,
    height: 26,
    paint: ([x, y], n) => layer(fur, [inner, inside(ellipse(x, y, 0, -0.008, 0.08, 0.09), 0.08) * THREE.MathUtils.smoothstep(n[2], 0.2, 0.5)]),
  });
}

/**
 * Torso en una pieza: cadera ancha que se afina hacia el pecho y el cuello
 * (forma de pera), con la panza clara pintada adelante.
 */
export function makeTorsoGeometry(colors) {
  const fur = new THREE.Color(colors.fur);
  const belly = new THREE.Color(colors.belly);
  const sdf = (p) => {
    let d = sdEllipsoid(p, [0, 0.1, -0.015], [0.245, 0.2, 0.215]);
    d = smin(d, sdEllipsoid(p, [0, 0.27, 0], [0.18, 0.2, 0.16]), 0.12);
    d = smin(d, sdEllipsoid(p, [0, 0.41, 0.01], [0.12, 0.08, 0.11]), 0.08);
    return d;
  };
  return makeSculpt(sdf, {
    center: [0, 0.2, 0],
    max: 0.5,
    width: 52,
    height: 40,
    paint: ([x, y, z]) => layer(fur, [belly, inside(ellipse(x, y, 0, 0.16, 0.12, 0.2), 0.08) * THREE.MathUtils.smoothstep(z, 0.04, 0.1)]),
  });
}

/** Muslo en forma de pata de pollo: ancho en la cadera, se afina a la rodilla. */
export function makeThighGeometry(side, length) {
  const sdf = (p) => smin(
    sdEllipsoid(p, [side * 0.022, -0.07, 0], [0.122, 0.135, 0.128]),
    sdEllipsoid(p, [0, -length + 0.01, 0.005], [0.066, 0.07, 0.068]),
    0.09,
  );
  return makeSculpt(sdf, { center: [0, -0.09, 0], max: 0.4, width: 36, height: 28 });
}

/**
 * Planta con dedos fundidos y el pliegue entre dedo y dedo pintado más oscuro
 * (así se leen los dedos aun con el sombreado toon, como en Titi.png).
 */
function makePaw(palm, digits, { center, max, color, crease }) {
  const dist = (p) => digits.map(({ c, r }) => sdEllipsoid(p, c, r));
  const sdf = (p) => dist(p).reduce((d, t) => smin(d, t, 0.012), sdEllipsoid(p, palm.c, palm.r));
  const base = new THREE.Color(color);
  const line = new THREE.Color(crease);
  return makeSculpt(sdf, {
    center,
    max,
    width: 44,
    height: 30,
    paint: (p) => {
      const d = dist(p).sort((a, b) => a - b);
      // Pliegue: donde dos dedos quedan casi a la misma distancia.
      const w = (1 - THREE.MathUtils.smoothstep(d[1] - d[0], 0.002, 0.006)) * (1 - THREE.MathUtils.smoothstep(d[0], 0.004, 0.014));
      return base.clone().lerp(line, w * 0.7);
    },
  });
}

/** Pie: planta y cuatro dedos (lado +x). */
export function makeFootGeometry(color, crease) {
  return makePaw(
    { c: [0, -0.004, 0.032], r: [0.066, 0.034, 0.09] },
    [-0.045, -0.015, 0.015, 0.045].map((x) => ({ c: [x, -0.008, 0.13 - Math.abs(x) * 0.3], r: [0.017, 0.021, 0.03] })),
    { center: [0, -0.004, 0.05], max: 0.25, color, crease },
  );
}

/** Mano: palma y tres dedos (cuelga hacia -y, los dedos al frente). */
export function makeHandGeometry(color, crease) {
  return makePaw(
    { c: [0, -0.02, 0.01], r: [0.056, 0.042, 0.06] },
    [-0.032, 0, 0.032].map((x) => ({ c: [x, -0.054, 0.034 - Math.abs(x) * 0.25], r: [0.017, 0.026, 0.024] })),
    { center: [0, -0.025, 0.015], max: 0.2, color, crease },
  );
}

export function makeTitiGeometries() {
  const forwardZ = () => new THREE.Vector3(0, 0, 1);
  // El bigote se aplana hacia afuera en horizontal (nunca hacia abajo): así
  // conserva todo su alto visto de frente aunque apoye en la mejilla.
  // Dirección suave (no sigue los bultos de la mejilla: el barrido no se tuerce).
  const level = (p) => new THREE.Vector3(Math.sign(p.x) * Math.min(1.4, (Math.abs(p.x) * 3.2) ** 1.4), 0, 1).normalize();
  const mustache = (pts, under) =>
    mergeGeometries([
      makeSweep(pts, MUSTACHE_R, { segments: 60, radial: 16, depth: 0.6, forward: level }),
      makeSweep(under, MUSTACHE_UNDER_R, { segments: 30, radial: 12, depth: 0.58, forward: level }),
    ]);
  const brow = (sx) =>
    mergeGeometries([
      makeSweep(sx > 0 ? BROW : mirror(BROW), profile(0.035, { at: 0.2, base: 0.9, round: 0.16, tip: 0.8 }), { segments: 36, radial: 14, depth: 0.5 }),
      makeSweep(sx > 0 ? BROW_TUFT : mirror(BROW_TUFT), profile(0.022, { at: 0.4, base: 0.7, round: 0.25, tip: 1 }), { segments: 24, radial: 12, depth: 0.5 }),
    ]);
  const mustacheL = mustache(MUSTACHE, MUSTACHE_UNDER);
  const mustacheR = mustache(mirror(MUSTACHE), mirror(MUSTACHE_UNDER));
  // La "w" va sobre lo que esté adelante: el puente o la raíz del bigote.
  const ray = new THREE.Raycaster();
  const wings = [mustacheL, mustacheR].map((geo) => new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })));
  const frontOfStache = (x, y) => {
    ray.set(new THREE.Vector3(x, y, 1), new THREE.Vector3(0, 0, -1));
    const hit = ray.intersectObjects(wings)[0];
    return Math.max(onPad(x, y), hit ? hit.point.z : -1);
  };
  return {
    mouthZ: frontOfStache(0, -0.106),
    sphere: new THREE.SphereGeometry(1, 32, 24),
    smallSphere: new THREE.SphereGeometry(1, 14, 10),
    eyeWhite: makeSquircleSphere(),
    nose: makeNose(),
    mustacheL,
    mustacheR,
    browL: brow(1),
    browR: brow(-1),
    tuft: mergeGeometries(
      TUFT.map(({ pts, r }) => makeSweep(pts, profile(r, { at: 0.12, base: 0.95, round: 0.04, tip: 1.25 }), { segments: 28, radial: 14, depth: 0.62, forward: forwardZ })),
    ),
    goatee: mergeGeometries(
      GOATEE.map(({ pts, r, tip }) => makeSweep(pts, profile(r, { at: 0.22, base: 0.8, round: 0.12, tip }), { segments: 22, radial: 12, depth: 0.85, forward: forwardZ })),
    ),
    smile: makeSweep(SMILE.map(([x, y]) => [x, y, frontOfStache(x, y) + 0.002]), line(0.0068), { segments: 48, radial: 8, depth: 0.8 }),
  };
}
