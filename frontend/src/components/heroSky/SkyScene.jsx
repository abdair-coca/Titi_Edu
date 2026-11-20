// SkyScene — cielo 3D del hero de /courses (chunk diferido, lo carga HeroSky).
//
// Objetos armados con figuras básicas y la misma luz suave de la habitación
// (luz de ambiente generada en el navegador, hemisférica y principal cálida).
// Elenco: dron repartidor, dron chico, avión de papel, gotas y globos en
// pantallas medianas y grandes; en celular solo el repartidor y el avión.
// Las letras del título son HTML: el cielo les manda golpes por el puente
// (`bridge`) y escucha cuando tocan una letra o enfocan el buscador.
//
// Dos lienzos (change rediseno-hero-cursos), en desktop/tablet:
// - Fondo (siempre detrás del texto): drones y gotas.
// - Medio (`midHost`): avión y globos. Cambia de capa (detrás o delante del
//   texto) para que pasen por detrás y por delante de las letras, como si
//   fueran parte del escenario. En celular todo va en el lienzo de fondo.
//
// Los lienzos no reciben eventos: los toman del contenedor del hero
// (`eventSource`) y calculan el puntero respecto de sí mismos.
import { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { COLORS } from '../hero3d/roomLayout.js';
import { ContextLossGuard, SoftEnvironment, useWarmup } from '../hero3d/sceneKit.jsx';
import Balloons from './Balloons.jsx';
import { DeliveryDrone, ScoutDrone } from './Drone.jsx';
import PaperPlane from './PaperPlane.jsx';
import SkyDrops from './SkyDrops.jsx';
import { SkyContext } from './skyKit.js';

// Tamaños en px del lienzo (desktop / celular).
const SIZES = {
  delivery: [104, 86],
  scout: [68, 0],
  plane: [82, 70],
  drop: [28, 22],
  balloon: [46, 0],
};
const sizeFor = (key, mobile) => SIZES[key][mobile ? 1 : 0];

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

// Drones registrados para visitar letras: { pos, available(), visit(letter) }.
function useDroneRegistry() {
  const drones = useRef(new Set());
  const register = useMemo(
    () => (drone) => {
      drones.current.add(drone);
      return () => drones.current.delete(drone);
    },
    [],
  );
  return [drones, register];
}

// Escucha al título y al buscador: tocar una letra manda al dron más cercano;
// el foco del buscador hace que los drones lo miren.
function useBridgeListeners(bridge, layoutRef, drones, focusRef) {
  useEffect(() => {
    if (!bridge) return undefined;
    const offTap = bridge.on('letterTap', ({ index }) => {
      const letter = layoutRef.current?.letters?.[index];
      if (!letter) return;
      let best = null;
      let bestDist = Infinity;
      for (const d of drones.current) {
        if (!d.available()) continue;
        const dist = Math.hypot(d.pos.current.x - letter.cx, d.pos.current.y - letter.top);
        if (dist < bestDist) {
          best = d;
          bestDist = dist;
        }
      }
      best?.visit(letter);
    });
    const offFocus = bridge.on('focus', ({ on }) => {
      focusRef.current = on;
    });
    return () => {
      offTap();
      offFocus();
    };
  }, [bridge, layoutRef, drones, focusRef]);
}

// Capa del lienzo medio: detrás del texto (-5, sobre el fondo -10) o delante (10).
// Se escribe directo en el DOM (sin renders).
function useMidLayer(midHost) {
  return useMemo(() => {
    if (!midHost) return null;
    let front = false;
    return {
      isFront: () => front,
      set(next) {
        if (next === front) return;
        front = next;
        midHost.style.zIndex = next ? '10' : '-5';
      },
    };
  }, [midHost]);
}

// Estado compartido por los dos lienzos (el contexto de React no cruza un
// Canvas, así que cada uno lo vuelve a proveer con el mismo valor).
function useSkyShared({ layout, mobile, pointerRef, bridge, eventSource, midHost }) {
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const drops = useRef(null);
  const focusRef = useRef(false);
  // Cajas (px) de lo que hay en el lienzo medio, para cambiar de capa solo
  // cuando nada toca una letra.
  const midRects = useRef(new Map());
  const [drones, registerDrone] = useDroneRegistry();
  const setHover = useHoverCursor(eventSource);
  const midLayer = useMidLayer(midHost);
  useBridgeListeners(bridge, layoutRef, drones, focusRef);
  return useMemo(
    () => ({ layoutRef, pointerRef, drops, mobile, setHover, bridge, focusRef, registerDrone, midLayer, midRects }),
    [pointerRef, mobile, setHover, bridge, registerDrone, midLayer],
  );
}

function SkyCanvas({ shared, active, eventSource, onFail, children }) {
  return (
    <Canvas
      dpr={shared.mobile ? 1 : 1.5}
      frameloop={active ? 'always' : 'demand'}
      camera={{ fov: 30, near: 0.1, far: 60, position: [0, 0, 14] }}
      gl={{ antialias: !shared.mobile, alpha: true, powerPreference: 'low-power' }}
      eventSource={eventSource}
      onCreated={({ gl, setEvents }) => {
        gl.toneMapping = THREE.NeutralToneMapping;
        setEvents({ compute: computeFromCanvas });
      }}
    >
      <ContextLossGuard onFail={onFail} />
      <SoftEnvironment intensity={shared.mobile ? 0.8 : 0.9} />
      <Lights />
      <SkyContext.Provider value={shared}>{children}</SkyContext.Provider>
    </Canvas>
  );
}

export default function SkyScene({ layout, mobile, active, pointerRef, bridge, eventSource, midHost, onReady, onFail }) {
  const measuring = useWarmup(active);
  const shared = useSkyShared({ layout, mobile, pointerRef, bridge, eventSource, midHost });
  const size = (key) => sizeFor(key, mobile);
  const layered = Boolean(midHost) && !mobile;

  // Rendimiento bajo: a la primera caída sostenida se apaga el cielo (el
  // header queda como siempre). Es decoración: le deja los recursos a la
  // habitación, que tiene su propia escalera de calidad.
  const handleDecline = () => onFail('rendimiento bajo');

  const plane = <PaperPlane sizePx={size('plane')} />;

  return (
    <>
      <SkyCanvas shared={shared} active={active} eventSource={eventSource} onFail={onFail}>
        {measuring && <PerformanceMonitor bounds={() => [mobile ? 30 : 40, Infinity]} onDecline={handleDecline} />}
        <SkyDrops apiRef={shared.drops} sizePx={size('drop')} />
        {!layered && plane}
        {!mobile && <ScoutDrone sizePx={size('scout')} />}
        <DeliveryDrone sizePx={size('delivery')} />
        <ReadySignal onReady={onReady} />
      </SkyCanvas>
      {layered &&
        createPortal(
          <SkyCanvas shared={shared} active={active} eventSource={eventSource} onFail={onFail}>
            <Balloons sizePx={size('balloon')} />
            {plane}
          </SkyCanvas>,
          midHost,
        )}
    </>
  );
}
