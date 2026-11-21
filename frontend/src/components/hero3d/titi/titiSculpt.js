// "Esculpido" en código: formas suaves hechas con campos de distancia (SDF)
// que se funden entre sí (unión suave), pasadas a una malla. Así la cabeza y el
// torso de Titi son una sola pieza orgánica (mejillas, hocico, pecho y panza
// sin costuras), en lugar de esferas apiladas que se leen como primitivas.
//
// La malla sale de una esfera: cada vértice se empuja desde `center` hasta la
// superficie (sirve para formas "estrelladas" desde el centro, como una cabeza
// o un torso). Las normales salen del gradiente del campo (sombreado suave, sin
// costura) y el color de cada vértice lo pinta `paint` (antifaz, panza).
import * as THREE from 'three';

/** Distancia (aprox.) a un elipsoide de centro c y radios r. */
export function sdEllipsoid(p, c, r) {
  const x = p[0] - c[0];
  const y = p[1] - c[1];
  const z = p[2] - c[2];
  // (Math.sqrt y no Math.hypot: esto corre millones de veces al armar la malla.)
  const ax = x / r[0];
  const ay = y / r[1];
  const az = z / r[2];
  const bx = ax / r[0];
  const by = ay / r[1];
  const bz = az / r[2];
  const k0 = Math.sqrt(ax * ax + ay * ay + az * az);
  const k1 = Math.sqrt(bx * bx + by * by + bz * bz);
  return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(r[0], r[1], r[2]);
}

/** Unión suave (k = ancho de la fusión). */
export function smin(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

/** Resta suave de b a a (hundimientos). */
export const ssub = (a, b, k) => -smin(-a, b, k);

/** Elipse normalizada en 2D: < 1 adentro (para pintar zonas). */
export const ellipse = (x, y, cx, cy, rx, ry) => Math.hypot((x - cx) / rx, (y - cy) / ry);

/** Borde nítido pero suavizado (pintura toon): 1 adentro, 0 afuera. */
export const inside = (e, soft = 0.06) => 1 - THREE.MathUtils.smoothstep(e, 1 - soft, 1 + soft);

/**
 * Primera salida de la superficie desde `from` en la dirección `dir`.
 * @returns {number} distancia recorrida (o `max` si no sale).
 */
export function rayExit(sdf, from, dir, max) {
  const steps = 20;
  const p = [0, 0, 0];
  const at = (t) => {
    p[0] = from[0] + dir[0] * t;
    p[1] = from[1] + dir[1] * t;
    p[2] = from[2] + dir[2] * t;
    return sdf(p);
  };
  let lo = 0;
  let hi = max;
  for (let i = 1; i <= steps; i += 1) {
    const t = (i / steps) * max;
    if (at(t) > 0) {
      hi = t;
      break;
    }
    lo = t;
  }
  for (let i = 0; i < 20; i += 1) {
    const m = (lo + hi) / 2;
    if (at(m) > 0) hi = m;
    else lo = m;
  }
  return (lo + hi) / 2;
}

/**
 * Malla de la superficie del campo `sdf`, vista desde `center`.
 * @param {(p: number[]) => number} sdf
 * @param {{ center?: number[], max?: number, width?: number, height?: number,
 *   paint?: (p: number[], n: number[]) => THREE.Color }} opts
 */
export function makeSculpt(sdf, { center = [0, 0, 0], max = 1, width = 96, height = 64, paint } = {}) {
  const g = new THREE.SphereGeometry(1, width, height);
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const colors = paint ? new Float32Array(pos.count * 3) : null;
  const e = 1e-4;
  const p = [0, 0, 0];
  const q = [0, 0, 0];
  // Derivada del campo en un eje (sin crear arreglos por vértice).
  const diff = (axis) => {
    q[0] = p[0];
    q[1] = p[1];
    q[2] = p[2];
    q[axis] += e;
    const a = sdf(q);
    q[axis] -= 2 * e;
    return a - sdf(q);
  };
  for (let i = 0; i < pos.count; i += 1) {
    const dir = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    const t = rayExit(sdf, center, dir, max);
    p[0] = center[0] + dir[0] * t;
    p[1] = center[1] + dir[1] * t;
    p[2] = center[2] + dir[2] * t;
    const gx = diff(0);
    const gy = diff(1);
    const gz = diff(2);
    const gl = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1;
    const n = [gx / gl, gy / gl, gz / gl];
    pos.setXYZ(i, p[0], p[1], p[2]);
    nor.setXYZ(i, n[0], n[1], n[2]);
    if (colors) {
      const c = paint(p, n);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
  }
  if (colors) g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

/** Mezcla de colores (lineales) por pesos 0..1, en orden: base, luego capas. */
export function layer(base, ...layers) {
  const out = base.clone();
  for (const [color, w] of layers) if (w > 0) out.lerp(color, Math.min(1, w));
  return out;
}
