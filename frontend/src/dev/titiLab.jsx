// Laboratorio visual de Titi 3D (solo desarrollo: `npm run dev` → /titi-lab.html).
// Muestra a Titi con la misma luz, ambiente y tono que el cuarto de /courses,
// quieto en una pose, para compararlo con /Titi.png desde varios ángulos.
// Lo usa scripts/titi-shots.mjs para sacar capturas reproducibles.
//
// Parámetros de la URL:
//   view   yaw relativo a Titi en grados (0 = de frente, 90 = su costado izq.)
//   pitch  elevación de la cámara en grados (el cuarto usa ~31°)
//   zoom   1 = cuerpo entero; 3 = primer plano de la cara
//   mode   pose de titiPoses (sit, stand, wave, think, celebrate, walk, carried…)
//   t      segundos dentro de la pose · lid  apertura de ojos 0..1
//   ty     altura del punto que mira la cámara · shadows=0 sin sombras
import { StrictMode, useLayoutEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import { SoftShadows } from '@react-three/drei';
import TitiBody from '../components/hero3d/titi/TitiBody.jsx';
import { poseFor } from '../components/hero3d/titi/titiPoses.js';
import { applyPose } from '../components/hero3d/titi/titiRig.js';
import { TITI_SCALE } from '../components/hero3d/titi/titiLook.js';
import { FACE_CAMERA } from '../components/hero3d/titi/titiBrain.js';
import { COLORS } from '../components/hero3d/roomLayout.js';
import { SoftEnvironment } from '../components/hero3d/sceneKit.jsx';

const q = new URLSearchParams(window.location.search);
const num = (k, d) => (q.has(k) ? Number(q.get(k)) : d);
const VIEW = num('view', 0);
const PITCH = num('pitch', 31);
const ZOOM = num('zoom', 1);
const MODE = q.get('mode') || 'sit';
const T = num('t', 0.6);
const LID = num('lid', 1);
const TIME = num('time', 0);
const SHADOWS = q.get('shadows') !== '0';

function Rig() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  useLayoutEffect(() => {
    const yaw = FACE_CAMERA + (VIEW * Math.PI) / 180;
    const pitch = (PITCH * Math.PI) / 180;
    const target = new THREE.Vector3(0, num('ty', ZOOM > 1.6 ? 0.8 : 0.6), 0);
    const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    camera.position.copy(target).addScaledVector(dir, 20);
    camera.lookAt(target);
    camera.zoom = (Math.min(size.width, size.height) / 1.5) * ZOOM;
    camera.updateProjectionMatrix();
  }, [camera, size]);
  return null;
}

function Posed() {
  const rig = useMemo(() => ({}), []);
  const ref = useRef(null);
  useLayoutEffect(() => {
    const pose = poseFor(MODE, T, { time: TIME, phase: T * 7, speed: 0.5 });
    applyPose(rig, pose, { time: TIME, lid: LID });
    window.__titiLabReady = true;
  }, [rig]);
  return (
    <group ref={ref} rotation={[0, FACE_CAMERA, 0]} scale={TITI_SCALE}>
      <TitiBody rig={rig} />
    </group>
  );
}

function Lights() {
  return (
    <>
      <hemisphereLight args={['#FFF6E5', COLORS.wood, 0.6]} />
      <directionalLight
        castShadow={SHADOWS}
        position={[4.5, 9, 6.5]}
        intensity={2.8}
        color="#FFF1DA"
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.025}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={3}
        shadow-camera-bottom={-3}
      />
      <directionalLight position={[-6, 4, 1.5]} intensity={0.35} color="#DDEEFF" />
    </>
  );
}

function Lab() {
  return (
    <Canvas
      orthographic
      shadows="soft"
      dpr={1.5}
      frameloop="always"
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      camera={{ near: 0.1, far: 100 }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NeutralToneMapping;
        // Para medir llamadas de dibujo y triángulos desde las capturas.
        window.__titiGl = gl;
      }}
    >
      <color attach="background" args={[COLORS.cream]} />
      <SoftShadows size={18} samples={10} focus={0.35} />
      <SoftEnvironment intensity={0.9} />
      <Lights />
      <Rig />
      <Posed />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[2.2, 48]} />
        <meshStandardMaterial color={COLORS.woodLight} roughness={0.7} />
      </mesh>
    </Canvas>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Lab />
  </StrictMode>,
);
