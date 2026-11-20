// SkyScene — cielo 3D del header de /courses (chunk diferido, lo carga HeroSky).
//
// Objetos armados con figuras básicas y la misma luz suave de la habitación
// (luz de ambiente generada en el navegador, hemisférica y principal cálida).
// Elenco: dron repartidor, dron chico, avión de papel, gotas y nubes en
// pantallas medianas y grandes; en celular solo el repartidor y el avión.
//
// El lienzo no recibe eventos: los toma del contenedor del hero
// (`eventSource`) y calcula el puntero respecto del propio lienzo.
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { COLORS } from '../hero3d/roomLayout.js';
import { ContextLossGuard, SoftEnvironment, useWarmup } from '../hero3d/sceneKit.jsx';
import Clouds from './Clouds.jsx';
import { DeliveryDrone, ScoutDrone } from './Drone.jsx';
import PaperPlane from './PaperPlane.jsx';
import SkyDrops from './SkyDrops.jsx';
import { SkyContext, useSky } from './skyKit.js';

// Tamaños en px del lienzo (desktop / celular).
const SIZES = {
  delivery: [104, 86],
  scout: [68, 0],
  plane: [82, 70],
  drop: [28, 22],
  cloud: [132, 0],
};

// Puntero relativo al lienzo aunque el evento venga de otro elemento del hero.
function computeFromCanvas(event, state) {
  const r = state.gl.domElement.getBoundingClientRect();
  state.pointer.set(((event.clientX - r.left) / r.width) * 2 - 1, -((event.clientY - r.top) / r.height) * 2 + 1);
  state.raycaster.setFromCamera(state.pointer, state.camera);
}

function Lights() {
  return (
    <>
      <hemisphereLight args={['#FFF6E5', COLORS.wood, 0.75]} />
      <directionalLight position={[4, 7, 9]} intensity={2.4} color="#FFF1DA" />
      <directionalLight position={[-7, 2, 4]} intensity={0.35} color="#DDEEFF" />
    </>
  );
}

function ReadySignal({ onReady }) {
  useEffect(() => {
    // Un frame después, para que el fundido muestre la escena ya dibujada.
    const id = requestAnimationFrame(() => onReady());
    return () => cancelAnimationFrame(id);
  }, [onReady]);
  return null;
}

// Cursor de puntero sobre el contenedor mientras hay un objeto debajo.
function useHoverCursor(eventSource) {
  const count = useRef(0);
  useEffect(
    () => () => {
      if (eventSource.current) eventSource.current.style.cursor = '';
    },
    [eventSource],
  );
  return useMemo(
    () => (on) => {
      count.current = Math.max(0, count.current + (on ? 1 : -1));
      if (eventSource.current) eventSource.current.style.cursor = count.current > 0 ? 'pointer' : '';
    },
    [eventSource],
  );
}

function Cast({ mobile }) {
  const size = (key) => SIZES[key][mobile ? 1 : 0];
  const { drops } = useSky();
  return (
    <>
      {!mobile && <Clouds count={3} sizePx={size('cloud')} />}
      <SkyDrops apiRef={drops} rising={mobile ? 0 : 3} sizePx={size('drop')} />
      <PaperPlane sizePx={size('plane')} />
      {!mobile && <ScoutDrone sizePx={size('scout')} />}
      <DeliveryDrone sizePx={size('delivery')} />
    </>
  );
}

function SkyRoot({ layout, mobile, pointerRef, eventSource, children }) {
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const drops = useRef(null);
  const setHover = useHoverCursor(eventSource);
  const value = useMemo(
    () => ({ layoutRef, pointerRef, drops, mobile, setHover }),
    [pointerRef, mobile, setHover],
  );
  return <SkyContext.Provider value={value}>{children}</SkyContext.Provider>;
}

export default function SkyScene({ layout, mobile, active, pointerRef, eventSource, onReady, onFail }) {
  const measuring = useWarmup(active);

  // Rendimiento bajo: a la primera caída sostenida se apaga el cielo (el
  // header queda como siempre). Es decoración: le deja los recursos a la
  // habitación, que tiene su propia escalera de calidad.
  const handleDecline = () => onFail('rendimiento bajo');

  return (
    <Canvas
      dpr={mobile ? 1 : 1.5}
      frameloop={active ? 'always' : 'demand'}
      camera={{ fov: 30, near: 0.1, far: 60, position: [0, 0, 14] }}
      gl={{ antialias: !mobile, alpha: true, powerPreference: 'low-power' }}
      eventSource={eventSource}
      onCreated={({ gl, setEvents }) => {
        gl.toneMapping = THREE.NeutralToneMapping;
        setEvents({ compute: computeFromCanvas });
      }}
    >
      <ContextLossGuard onFail={onFail} />
      {measuring && <PerformanceMonitor bounds={() => [mobile ? 30 : 40, Infinity]} onDecline={handleDecline} />}
      <SoftEnvironment intensity={mobile ? 0.8 : 0.9} />
      <Lights />
      <SkyRoot layout={layout} mobile={mobile} pointerRef={pointerRef} eventSource={eventSource}>
        <Cast mobile={mobile} />
      </SkyRoot>
      <ReadySignal onReady={onReady} />
    </Canvas>
  );
}
