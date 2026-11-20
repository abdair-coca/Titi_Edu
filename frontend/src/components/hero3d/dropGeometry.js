// Forma de la gota (la moneda de Titi), compartida por la habitación y el cielo
// del header. Perfil de lágrima girado (lathe): punta arriba, base redonda.
// Mide ~0,34 de ancho y 0,42 de alto, con la base en y = 0.
import * as THREE from 'three';

export function makeDropGeometry() {
  const pts = [];
  for (let i = 0; i <= 24; i += 1) {
    const t = Math.PI - (i / 24) * Math.PI;
    pts.push(new THREE.Vector2(0.17 * Math.sin(t) * Math.sin(t / 2), 0.21 * Math.cos(t) + 0.21));
  }
  pts[0].x = 0;
  pts[pts.length - 1].x = 0;
  return new THREE.LatheGeometry(pts, 28);
}
