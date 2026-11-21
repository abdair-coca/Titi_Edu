// Geometrías curvas de Titi: tubos que se afinan (bigote, cejas). El resto del
// cuerpo son esferas y cápsulas escaladas.
import * as THREE from 'three';

/**
 * Tubo a lo largo de una curva con radio variable y sección elíptica.
 * @param {number[][]} points  Puntos de control [x, y, z].
 * @param {(t: number) => number} radius  Radio según el avance 0..1.
 * @param {{ segments?: number, radial?: number, depth?: number }} opts
 *   depth aplana la sección en la binormal (el bigote es más alto que grueso).
 */
export function makeTaperedTube(points, radius, { segments = 40, radial = 12, depth = 1 } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const frames = curve.computeFrenetFrames(segments, false);
  const positions = [];
  const indices = [];
  const p = new THREE.Vector3();
  const v = new THREE.Vector3();

  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    curve.getPointAt(t, p);
    const r = radius(t);
    const n = frames.normals[i];
    const b = frames.binormals[i];
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
  // Tapa del inicio (el final termina en punta o queda dentro de la cabeza).
  curve.getPointAt(0, p);
  const center = positions.length / 3;
  positions.push(p.x, p.y, p.z);
  for (let j = 0; j < radial; j += 1) indices.push(center, j, j + 1);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

// Abultado suave: `start` al comienzo, máximo `peak` en `at`, punta en 0.
const bulge = (start, peak, at) => (t) =>
  t < at ? start + (peak - start) * Math.sin((t / at) * (Math.PI / 2)) : peak * Math.cos(((t - at) / (1 - at)) * (Math.PI / 2)) ** 0.8;

// Mitad izquierda del bigote (lado +x), en coordenadas de la cabeza: nace al
// costado de la nariz, baja y se abre más allá de las orejas y la punta se
// enrosca hacia arriba, como en Titi.png.
const MUSTACHE = [
  [0.055, -0.07, 0.268],
  [0.11, -0.1, 0.252],
  [0.18, -0.15, 0.215],
  [0.26, -0.2, 0.165],
  [0.33, -0.225, 0.125],
  [0.395, -0.205, 0.1],
  [0.43, -0.155, 0.095],
  [0.425, -0.105, 0.11],
];

const mirror = (pts) => pts.map(([x, y, z]) => [-x, y, z]);

export function makeTitiGeometries() {
  const mustache = (pts) => makeTaperedTube(pts, bulge(0.04, 0.088, 0.36), { segments: 48, radial: 16, depth: 0.92 });
  return {
    sphere: new THREE.SphereGeometry(1, 32, 24),
    smallSphere: new THREE.SphereGeometry(1, 14, 10),
    mustacheL: mustache(MUSTACHE),
    mustacheR: mustache(mirror(MUSTACHE)),
    // Chivita: gota blanca que cuelga del mentón.
    goatee: makeTaperedTube([[0, 0.02, 0], [0, -0.04, 0.012], [0.006, -0.1, 0.004], [0.012, -0.135, -0.004]], bulge(0.03, 0.044, 0.3), { segments: 20, radial: 12, depth: 0.7 }),
    // Media sonrisa: arco de toro (dos forman la "w" de la boca).
    smile: new THREE.TorusGeometry(0.024, 0.0065, 8, 16, Math.PI),
    cone: new THREE.ConeGeometry(1, 1, 12),
  };
}
