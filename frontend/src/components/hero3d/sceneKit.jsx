// Piezas compartidas por las escenas 3D de /courses (la habitación y el cielo
// del header): luz de ambiente, guardia de contexto y calentamiento del monitor
// de rendimiento. Viven en los chunks diferidos (importan three).
import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';

// Luz de ambiente hecha con paneles emisivos (como los Lightformer de drei),
// procesada una sola vez: reflejos y relleno suaves sin descargar un HDR.
export function SoftEnvironment({ intensity = 0.7 }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const env = new THREE.Scene();
    env.background = new THREE.Color('#5A4A3A');
    const panels = [
      { color: '#FFF4DC', strength: 3, size: [10, 10], pos: [0, 6, 0], rot: [Math.PI / 2, 0, 0] },
      { color: '#FFE9B0', strength: 2, size: [8, 5], pos: [6, 2, 6], rot: [0, Math.PI / 4, 0] },
      { color: '#DDEEFF', strength: 1.4, size: [5, 4], pos: [-6, 2, 1], rot: [0, Math.PI / 2, 0] },
    ];
    const disposables = [];
    for (const p of panels) {
      const geometry = new THREE.PlaneGeometry(...p.size);
      const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(p.color).multiplyScalar(p.strength), side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...p.pos);
      mesh.lookAt(0, 0, 0);
      env.add(mesh);
      disposables.push(geometry, material);
    }
    const pmrem = new THREE.PMREMGenerator(gl);
    const target = pmrem.fromScene(env, 0.04);
    scene.environment = target.texture;
    scene.environmentIntensity = intensity;
    return () => {
      scene.environment = null;
      target.dispose();
      pmrem.dispose();
      disposables.forEach((d) => d.dispose());
    };
  }, [gl, scene, intensity]);
  return null;
}

// Pérdida del contexto WebGL → imagen. El listener se quita al desmontar,
// porque R3F libera el contexto a propósito al salir de la página.
export function ContextLossGuard({ onFail }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const el = gl.domElement;
    const onLost = () => onFail('contexto WebGL perdido');
    el.addEventListener('webglcontextlost', onLost);
    return () => el.removeEventListener('webglcontextlost', onLost);
  }, [gl, onFail]);
  return null;
}

// El monitor de rendimiento mide recién tras un calentamiento (compilar shaders
// y subir modelos traba los primeros frames) y vuelve a empezar cada vez que la
// escena vuelve a estar visible.
export function useWarmup(active, ms = 3000) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(false);
    if (!active) return undefined;
    const id = window.setTimeout(() => setReady(true), ms);
    return () => window.clearTimeout(id);
  }, [active, ms]);
  return ready;
}
