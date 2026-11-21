// Geometrías de Titi hechas en código: barridos que se afinan (bigote, cejas,
// mechón, chivita, boca), la esfera "cuadradita" de los ojos, la nariz en
// trapecio y la cola continua con esqueleto. El resto del cuerpo son esferas y
// cápsulas escaladas.
//
// Coordenadas de la cara: las de la cabeza (esfera de radios HEAD centrada en el
// origen, antes de su escala), Titi mira hacia +z y su lado izquierdo es +x.
// Las medidas salen de /Titi.png (ojos, nariz, boca y bigote medidos sobre la
// imagen y pasados a unidades de la cabeza).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const HEAD = { x: 0.27, y: 0.245, z: 0.25 };
// Hocico claro: elipsoide delante de la cabeza (lo usa también TitiBody).
export const MUZZLE = { p: [0, -0.075, 0.185], s: [0.13, 0.095, 0.085] };

const ellipsoidZ = (x, y, cx, cy, cz, rx, ry, rz) => {
  const k = 1 - ((x - cx) / rx) ** 2 - ((y - cy) / ry) ** 2;
  return cz + rz * Math.sqrt(Math.max(0, k));
};
/** z de la superficie de la cabeza en (x, y), más `lift`. */
export const onHead = (x, y, lift = 0) => ellipsoidZ(x, y, 0, 0, 0, HEAD.x, HEAD.y, HEAD.z) + lift;
/** z de la superficie del hocico en (x, y), más `lift`. */
export const onMuzzle = (x, y, lift = 0) => ellipsoidZ(x, y, MUZZLE.p[0], MUZZLE.p[1], MUZZLE.p[2], ...MUZZLE.s) + lift;

// Hacia afuera de la cabeza: orienta el aplanado de bigote, cejas y mechón.
const headNormal = (p) => new THREE.Vector3(p.x / HEAD.x ** 2, p.y / HEAD.y ** 2, p.z / HEAD.z ** 2).normalize();

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

// Bigote (mitad +x). Nace en la comisura de la "w", baja abriéndose más allá
// de las mejillas y la punta sube enroscándose, como en Titi.png.
const MUSTACHE = [
  [0.07, -0.098, onMuzzle(0.07, -0.098, 0.014)],
  [0.125, -0.134, 0.238],
  [0.192, -0.18, 0.2],
  [0.26, -0.218, 0.15],
  [0.32, -0.24, 0.11],
  [0.364, -0.236, 0.09],
  [0.395, -0.212, 0.08],
  [0.41, -0.176, 0.082],
  [0.406, -0.142, 0.088],
];

// Cejas (mitad +x): mechón grueso adentro y arriba que baja hacia afuera y
// termina en punta, más un segundo mechón corto en la punta.
const BROW = [
  [0.052, 0.188],
  [0.1, 0.198],
  [0.148, 0.184],
  [0.184, 0.155],
  [0.2, 0.124],
].map(([x, y]) => [x, y, onHead(x, y, 0.016)]);
const BROW_TUFT = [
  [0.14, 0.17],
  [0.172, 0.146],
  [0.188, 0.112],
  [0.19, 0.092],
].map(([x, y]) => [x, y, onHead(x, y, 0.012)]);

// Mechón de la coronilla: llamitas que suben y se inclinan hacia +x.
const TUFT = [
  { pts: [[-0.03, 0.2, 0.04], [-0.035, 0.27, 0.05], [-0.022, 0.315, 0.04], [0.0, 0.338, 0.025]], r: 0.034 },
  { pts: [[0.005, 0.2, 0.03], [0.012, 0.285, 0.035], [0.04, 0.35, 0.02], [0.078, 0.38, 0.0]], r: 0.04 },
  { pts: [[0.04, 0.2, 0.02], [0.065, 0.268, 0.02], [0.1, 0.305, 0.005], [0.135, 0.312, -0.01]], r: 0.03 },
  { pts: [[-0.06, 0.2, 0.0], [-0.075, 0.255, 0.0], [-0.088, 0.285, -0.01]], r: 0.024 },
];

// Chivita: mechón central largo y dos cortos a los costados (punta irregular).
const GOATEE = [
  { pts: [[0, -0.152, 0.238], [0, -0.2, 0.246], [0.002, -0.252, 0.232], [0.01, -0.3, 0.206]], r: 0.04, tip: 1.4 },
  { pts: [[0.026, -0.164, 0.232], [0.035, -0.205, 0.232], [0.028, -0.245, 0.218]], r: 0.023, tip: 1.2 },
  { pts: [[-0.026, -0.164, 0.232], [-0.032, -0.2, 0.232], [-0.022, -0.236, 0.22]], r: 0.021, tip: 1.2 },
];

// Boca en "w" justo debajo de la nariz, sobre el hocico.
const SMILE = [
  [-0.078, -0.082],
  [-0.06, -0.097],
  [-0.036, -0.105],
  [-0.013, -0.098],
  [0, -0.088],
  [0.013, -0.098],
  [0.036, -0.105],
  [0.06, -0.097],
  [0.078, -0.082],
].map(([x, y]) => [x, y, onMuzzle(x, y, 0.003)]);

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
  const perBone = 5;
  const total = segments * length;
  for (let k = 0; k <= segments * perBone; k += 1) {
    const h = (k / (segments * perBone)) * total;
    rings.push({ h, r: r0 + (r1 - r0) * (h / total) });
  }
  // Punta redondeada.
  for (let k = 1; k <= 5; k += 1) {
    const a = (k / 5) * (Math.PI / 2);
    rings.push({ h: total + Math.sin(a) * r1, r: Math.max(1e-4, Math.cos(a) * r1) });
  }

  const radial = 12;
  const positions = [];
  const skinIndex = [];
  const skinWeight = [];
  const indices = [];
  for (const { h, r } of rings) {
    const u = Math.min(h, total - 1e-6) / length;
    const i = Math.min(segments - 1, Math.floor(u));
    const f = u - i;
    let w;
    if (f < 0.5 && i > 0) w = [i - 1, 0.5 - f, i, 0.5 + f];
    else if (f >= 0.5 && i < segments - 1 && h < total) w = [i, 1.5 - f, i + 1, f - 0.5];
    else w = [i, 1, 0, 0];
    for (let j = 0; j <= radial; j += 1) {
      const a = (j / radial) * Math.PI * 2;
      positions.push(Math.cos(a) * r, h, Math.sin(a) * r);
      skinIndex.push(w[0], w[2], 0, 0);
      skinWeight.push(w[1], w[3], 0, 0);
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
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function makeTitiGeometries() {
  const forwardZ = () => new THREE.Vector3(0, 0, 1);
  const mustache = (pts) =>
    makeSweep(pts, profile(0.071, { at: 0.34, base: 0.48, round: 0.1, tip: 0.75 }), { segments: 72, radial: 18, depth: 0.68 });
  const brow = (sx) =>
    mergeGeometries([
      makeSweep(sx > 0 ? BROW : mirror(BROW), profile(0.03, { at: 0.22, base: 0.8, round: 0.12, tip: 0.9 }), { segments: 32, radial: 12, depth: 0.55 }),
      makeSweep(sx > 0 ? BROW_TUFT : mirror(BROW_TUFT), profile(0.017, { at: 0.2, base: 0.8, round: 0.15, tip: 0.9 }), { segments: 20, radial: 10, depth: 0.55 }),
    ]);
  return {
    sphere: new THREE.SphereGeometry(1, 32, 24),
    smallSphere: new THREE.SphereGeometry(1, 14, 10),
    eyeWhite: makeSquircleSphere(),
    nose: makeNose(),
    mustacheL: mustache(MUSTACHE),
    mustacheR: mustache(mirror(MUSTACHE)),
    browL: brow(1),
    browR: brow(-1),
    tuft: mergeGeometries(
      TUFT.map(({ pts, r }) => makeSweep(pts, profile(r, { at: 0.18, base: 0.9, round: 0.05, tip: 1.1 }), { segments: 24, radial: 10, depth: 0.7, forward: forwardZ })),
    ),
    goatee: mergeGeometries(
      GOATEE.map(({ pts, r, tip }) => makeSweep(pts, profile(r, { at: 0.22, base: 0.8, round: 0.12, tip }), { segments: 22, radial: 12, depth: 0.85, forward: forwardZ })),
    ),
    smile: makeSweep(SMILE, line(0.0068), { segments: 48, radial: 8, depth: 0.8 }),
  };
}
