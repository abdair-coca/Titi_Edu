// HeroScene — habitación de estudio 3D del hero de /courses (chunk diferido,
// lo carga Hero3D).
//
// Vista isométrica de un cuarto cortado (piso + dos paredes) con los objetos de
// las categorías en su lugar natural. Luz suave tipo "horneada": luz de
// ambiente generada en el navegador (sin HDR externo), una luz principal con
// sombras suaves y oclusión pintada en los rincones.
//
// Interacción: arrastrar gira el cuarto (RoomRig), el mouse da paralaje, los
// objetos de categoría filtran el catálogo y los adornos tienen sorpresas.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import { PerformanceMonitor, SoftShadows } from '@react-three/drei';
import HeroObject from './HeroObject.jsx';
import RoomRig from './RoomRig.jsx';
import RoomShell from './RoomShell.jsx';
import RoomToys from './RoomToys.jsx';
import { CATEGORY_SLOTS, COLORS, ROOM } from './roomLayout.js';
import { ContextLossGuard, SoftEnvironment, useWarmup } from './sceneKit.jsx';
import { useRoomTextures } from './roomTextures.js';

const CAMERA_DIR = new THREE.Vector3(1, 0.86, 1).normalize();
const CAMERA_TARGET = new THREE.Vector3(-0.1, 1.55, -0.1);
const HINT_EVERY_MS = 4500;

// Esquinas de la habitación, para encuadrarla según el tamaño del lienzo.
const ROOM_CORNERS = (() => {
  const { half: h, wallHeight: wh, wallThickness: t, floorThickness: f } = ROOM;
  const pts = [];
  for (const x of [-h - t, h]) for (const y of [-f, wh]) for (const z of [-h - t, h]) pts.push(new THREE.Vector3(x, y, z));
  return pts;
})();

// Cámara ortográfica isométrica que encuadra todo el cuarto con margen.
function FitCamera({ margin = 0.94 }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  useLayoutEffect(() => {
    camera.position.copy(CAMERA_TARGET).addScaledVector(CAMERA_DIR, 30);
    camera.lookAt(CAMERA_TARGET);
    camera.updateMatrixWorld();
    const inv = camera.matrixWorldInverse;
    const min = new THREE.Vector2(Infinity, Infinity);
    const max = new THREE.Vector2(-Infinity, -Infinity);
    for (const c of ROOM_CORNERS) {
      const v = c.clone().applyMatrix4(inv);
      min.min(v);
      max.max(v);
    }
    // Centra el cuarto en el lienzo moviendo la cámara en su propio plano.
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    camera.position.addScaledVector(right, (min.x + max.x) / 2).addScaledVector(up, (min.y + max.y) / 2);
    camera.zoom = Math.min(size.width / (max.x - min.x), size.height / (max.y - min.y)) * margin;
    camera.updateProjectionMatrix();
  }, [camera, size, margin]);
  return null;
}

function Lights({ mobile }) {
  const shadowSize = mobile ? 1024 : 2048;
  return (
    <>
      <hemisphereLight args={['#FFF6E5', COLORS.wood, 0.6]} />
      <directionalLight
        castShadow
        position={[4.5, 9, 6.5]}
        intensity={2.8}
        color="#FFF1DA"
        shadow-mapSize={[shadowSize, shadowSize]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.025}
        shadow-radius={6}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        shadow-camera-near={1}
        shadow-camera-far={30}
      />
      {/* Relleno frío desde la ventana */}
      <directionalLight position={[-6, 4, 1.5]} intensity={0.35} color="#DDEEFF" />
    </>
  );
}

// Cada tanto un objeto de categoría da un saltito: pista de que se puede tocar.
function useHint(items, active) {
  const [hint, setHint] = useState({ slug: null, n: 0 });
  const itemsRef = useRef(items);
  itemsRef.current = items;
  useEffect(() => {
    if (!active || items.length === 0) return undefined;
    const id = window.setInterval(() => {
      setHint((h) => {
        const list = itemsRef.current;
        return { slug: list[h.n % list.length].slug, n: h.n + 1 };
      });
    }, HINT_EVERY_MS);
    return () => window.clearInterval(id);
  }, [items.length, active]);
  return hint;
}

// Avisa a Hero3D cuando todos los modelos ya cargaron (sale del Suspense).
function ReadySignal({ onReady }) {
  useEffect(() => {
    onReady();
  }, [onReady]);
  return null;
}

function Room({ items, mobile, onSelect, onHover, onFirstDrag, hint }) {
  const tx = useRoomTextures();
  return (
    <RoomRig onFirstDrag={onFirstDrag}>
      <Lights mobile={mobile} />
      <RoomShell tx={tx} />
      <RoomToys tx={tx} />
      {items.map((item, i) => (
        <HeroObject
          key={item.slug}
          item={item}
          slot={CATEGORY_SLOTS[item.slug]}
          index={i}
          hopSignal={hint.slug === item.slug ? hint.n : 0}
          onSelect={onSelect}
          onHover={onHover}
        />
      ))}
    </RoomRig>
  );
}

export default function HeroScene({ items, mobile, active, onSelect, onHover, onReady, onFail, onFirstDrag }) {
  // Calidad alta solo en desktop: más resolución y sombras con penumbra (PCSS).
  const [high, setHigh] = useState(!mobile);
  const declines = useRef(0);
  const measuring = useWarmup(active);
  const placed = useMemo(() => items.filter((item) => CATEGORY_SLOTS[item.slug]), [items]);
  const hint = useHint(placed, active);

  // Rendimiento bajo (spec H6): primero baja la calidad; si sigue cayendo de
  // forma sostenida, vuelve a la imagen.
  const handleDecline = () => {
    declines.current += 1;
    if (high) setHigh(false);
    else if (declines.current >= 3) onFail('rendimiento bajo');
  };

  return (
    <Canvas
      orthographic
      shadows="soft"
      dpr={high ? 1.5 : 1}
      frameloop={active ? 'always' : 'demand'}
      camera={{ near: 0.1, far: 100, zoom: 60 }}
      gl={{ antialias: !mobile, alpha: true, powerPreference: 'low-power' }}
      // Tono neutro: respeta los colores de la marca (ACES los lava y tira al naranja).
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NeutralToneMapping;
      }}
      // El gesto vertical siempre scrollea la página; el horizontal gira el cuarto.
      style={{ touchAction: 'pan-y' }}
    >
      {/* Sombras con penumbra suave (PCSS) solo en calidad alta; si no, PCF. */}
      {high && <SoftShadows size={18} samples={10} focus={0.35} />}
      <ContextLossGuard onFail={onFail} />
      {measuring && (
        // Sin tope superior: en pantallas de 120/144 Hz el monitor contaba cada
        // "mejora" como vaivén y terminaba volviendo a la imagen sin motivo.
        <PerformanceMonitor bounds={() => [mobile ? 30 : 40, Infinity]} onDecline={handleDecline} />
      )}
      <FitCamera />
      <SoftEnvironment intensity={mobile ? 0.8 : 0.9} />
      <Room items={placed} mobile={mobile} onSelect={onSelect} onHover={onHover} onFirstDrag={onFirstDrag} hint={hint} />
      <ReadySignal onReady={onReady} />
    </Canvas>
  );
}
