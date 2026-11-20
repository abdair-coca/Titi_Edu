// HeroScene — escena 3D del hero de /courses (chunk diferido, lo carga Hero3D).
//
// Objetos low-poly de las categorías flotando en un anillo alrededor del
// centro. Cámara fija: sin drag, zoom ni nada que capture el scroll (spec H3).
// Con mouse, la escena se inclina levemente hacia el puntero (±6°).
import { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import HeroObject from './HeroObject.jsx';
import TitiMascot from '../TitiMascot.jsx';

// Titi en el centro del anillo: solo si se ve bien en el hero (decisión del
// change). Apagar acá si no aporta.
const SHOW_TITI = true;

// Posiciones [x, y, z] en unidades de mundo. La cámara (z=10, fov 35) ve unas
// ±4.2 en x y ±3.1 en y; el centro queda libre para Titi.
const SLOTS = {
  desktop: [
    [-3.0, 1.55, 0.3],
    [-1.0, 2.2, -0.4],
    [1.1, 2.2, 0.2],
    [3.05, 1.5, -0.3],
    [3.15, -0.7, 0.4],
    [1.75, -2.15, -0.2],
    [-1.75, -2.15, 0.3],
    [-3.15, -0.65, -0.4],
  ],
  mobile: [
    [-2.55, 1.45, 0],
    [2.55, 1.45, 0],
    [2.55, -1.55, 0],
    [-2.55, -1.55, 0],
  ],
};

const MAX_TILT = 0.105; // ±6° en radianes, igual que Titi en el login

const hasFinePointer = () =>
  typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

// Inclina el grupo hacia el puntero (solo mouse). El puntero se lee de la
// ventana para que la escena reaccione aunque el mouse esté sobre el texto.
function PointerTilt({ children }) {
  const group = useRef(null);
  const target = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!hasFinePointer()) return undefined;
    const onMove = (e) => {
      if (e.pointerType !== 'mouse') return;
      target.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      target.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    const k = Math.min(1, delta * 4);
    g.rotation.y += (target.current.x * MAX_TILT - g.rotation.y) * k;
    g.rotation.x += (target.current.y * MAX_TILT - g.rotation.x) * k;
  });

  return <group ref={group}>{children}</group>;
}

// Pérdida del contexto WebGL → imagen. El listener se quita al desmontar,
// porque R3F libera el contexto a propósito al salir de la página.
function ContextLossGuard({ onFail }) {
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
function useWarmup(active, ms = 3000) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(false);
    if (!active) return undefined;
    const id = window.setTimeout(() => setReady(true), ms);
    return () => window.clearTimeout(id);
  }, [active, ms]);
  return ready;
}

// Avisa a Hero3D cuando todos los modelos ya cargaron (sale del Suspense).
function ReadySignal({ onReady }) {
  useEffect(() => {
    onReady();
  }, [onReady]);
  return null;
}

export default function HeroScene({ items, mobile, active, onSelect, onReady, onFail }) {
  const [dpr, setDpr] = useState(mobile ? 1 : 1.5);
  const declines = useRef(0);
  const measuring = useWarmup(active);
  const slots = mobile ? SLOTS.mobile : SLOTS.desktop;
  const size = mobile ? 1.75 : 1.35;

  // Rendimiento bajo (spec H6): primero baja la resolución; si sigue cayendo
  // de forma sostenida, vuelve a la imagen.
  const handleDecline = () => {
    declines.current += 1;
    if (dpr > 1) setDpr(1);
    else if (declines.current >= 3) onFail('rendimiento bajo');
  };

  return (
    <>
      <Canvas
        dpr={dpr}
        frameloop={active ? 'always' : 'demand'}
        camera={{ position: [0, 0, 10], fov: 35 }}
        gl={{ antialias: !mobile, alpha: true, powerPreference: 'low-power' }}
        // En mobile el gesto vertical siempre scrollea la página.
        style={{ touchAction: 'pan-y' }}
      >
        <ContextLossGuard onFail={onFail} />
        {measuring && (
          <PerformanceMonitor
            bounds={() => (mobile ? [30, 60] : [40, 60])}
            onDecline={handleDecline}
            flipflops={6}
            onFallback={() => onFail('rendimiento inestable')}
          />
        )}
        <ambientLight intensity={1.4} />
        <directionalLight position={[3, 5, 6]} intensity={1.8} />
        <PointerTilt>
          {items.map((item, i) => (
            <HeroObject
              key={item.slug}
              item={item}
              index={i}
              position={slots[i]}
              size={size}
              onSelect={onSelect}
            />
          ))}
        </PointerTilt>
        <ReadySignal onReady={onReady} />
      </Canvas>

      {SHOW_TITI && (
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <TitiMascot state="idle" size={mobile ? 'lg' : 'xl'} message="" />
        </div>
      )}
    </>
  );
}
