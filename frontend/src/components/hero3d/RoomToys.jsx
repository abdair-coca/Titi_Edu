// RoomToys — adornos de la habitación con sorpresa al tocarlos (no navegan):
// lámpara que se prende y apaga, planta que se sacude, reloj que gira las
// agujas, gota que rebota, pelota que rueda y silla que da una vuelta.
// Cada respuesta dura ≤ 400 ms (motion.md); el segundero del reloj es un loop
// ambiental.
import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import { useFrame } from '@react-three/fiber';
import { MOTION } from '../../lib/motion.js';
import { COLORS, ROOM } from './roomLayout.js';
import { Blob, Part } from './RoomShell.jsx';
import { useRoomInput } from './RoomRig.jsx';
import { makeDropGeometry } from './dropGeometry.js';

const { half: H, deskHeight: DH } = ROOM;
const TAU = Math.PI * 2;

// Envoltorio tocable: cursor de puntero, pop leve al pasar y click que ignora
// los arrastres (soltar tras girar la habitación no dispara la sorpresa).
function Toy({ onActivate, children, ...props }) {
  const input = useRoomInput();
  const pop = useRef(null);
  const over = useRef(false);
  const hover = (on) => {
    if (on === over.current) return;
    over.current = on;
    if (on) input.hoverStart();
    else input.hoverEnd();
    const s = on ? 1.06 : 1;
    gsap.to(pop.current.scale, { x: s, y: s, z: s, duration: MOTION.dur.fast, ease: MOTION.ease.pop, overwrite: true });
  };
  return (
    <group
      {...props}
      onPointerOver={(e) => {
        e.stopPropagation();
        if (!input.isDragging()) hover(true);
      }}
      onPointerOut={() => hover(false)}
      onClick={(e) => {
        e.stopPropagation();
        if (!input.wasDrag()) onActivate();
      }}
    >
      <group ref={pop}>{children}</group>
    </group>
  );
}

function Lamp() {
  const light = useRef(null);
  const bulb = useRef(null);
  const [on, setOn] = useState(true);
  const toggle = () => {
    const next = !on;
    setOn(next);
    gsap.to(light.current, { intensity: next ? 2.6 : 0, duration: MOTION.dur.base, ease: MOTION.ease.out });
    gsap.to(bulb.current, { emissiveIntensity: next ? 2.2 : 0, duration: MOTION.dur.base, ease: MOTION.ease.out });
  };
  return (
    <Toy onActivate={toggle} position={[0.55, DH, -2.7]} rotation={[0, 0.5, 0]}>
      <mesh position={[0, 0.03, 0]} castShadow>
        <cylinderGeometry args={[0.17, 0.19, 0.06, 20]} />
        <meshStandardMaterial color={COLORS.dark} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.36, 0]} rotation={[0, 0, -0.18]} castShadow>
        <cylinderGeometry args={[0.025, 0.025, 0.68, 8]} />
        <meshStandardMaterial color={COLORS.dark} roughness={0.5} />
      </mesh>
      <mesh position={[0.17, 0.72, 0]} rotation={[0, 0, -1.1]} castShadow>
        <cylinderGeometry args={[0.025, 0.025, 0.42, 8]} />
        <meshStandardMaterial color={COLORS.dark} roughness={0.5} />
      </mesh>
      <group position={[0.36, 0.78, 0]} rotation={[0, 0, -0.65]}>
        <mesh castShadow>
          <coneGeometry args={[0.19, 0.26, 20, 1, true]} />
          <meshStandardMaterial color={COLORS.yellow} roughness={0.4} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, -0.1, 0]}>
          <sphereGeometry args={[0.07, 14, 10]} />
          <meshStandardMaterial ref={bulb} color={COLORS.cream} emissive="#FFE7A0" emissiveIntensity={2.2} />
        </mesh>
        <pointLight ref={light} position={[0, -0.22, 0]} color="#FFC870" intensity={2.6} distance={3.2} decay={1.6} />
      </group>
    </Toy>
  );
}

// Hojas anchas alrededor del tallo: las de afuera caen, las del centro suben.
const LEAVES = Array.from({ length: 13 }, (_, i) => {
  const ring = i < 8 ? 0 : 1;
  const a = ring ? (i / 5) * TAU + 0.4 : (i / 8) * TAU;
  return { a, tilt: ring ? 0.45 : 1.05 + (i % 2) * 0.2, len: ring ? 0.42 : 0.38 + (i % 3) * 0.05, dark: i % 3 === 0 };
});

function Plant({ blob }) {
  const leaves = useRef(null);
  const wiggle = () => {
    gsap.fromTo(
      leaves.current.rotation,
      { z: 0 },
      { keyframes: { z: [0.16, -0.12, 0.06, 0] }, duration: MOTION.dur.slow, ease: 'none', overwrite: true },
    );
  };
  return (
    <>
      <Toy onActivate={wiggle} position={[-2.4, 0, -2.35]}>
        <mesh position={[0, 0.24, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.3, 0.23, 0.48, 22]} />
          <meshStandardMaterial color={COLORS.streak} roughness={0.65} />
        </mesh>
        <mesh position={[0, 0.47, 0]}>
          <cylinderGeometry args={[0.27, 0.27, 0.02, 22]} />
          <meshStandardMaterial color={COLORS.woodDark} roughness={1} />
        </mesh>
        <group ref={leaves} position={[0, 0.47, 0]}>
          {LEAVES.map(({ a, tilt, len, dark }) => (
            <group key={a} rotation={[0, a, 0]}>
              <group rotation={[tilt, 0, 0]}>
                <mesh position={[0, len, 0]} scale={[0.17, len, 0.045]} castShadow>
                  <sphereGeometry args={[1, 12, 8]} />
                  <meshStandardMaterial color={dark ? COLORS.leafDark : COLORS.leaf} roughness={0.6} />
                </mesh>
              </group>
            </group>
          ))}
        </group>
      </Toy>
      <Blob map={blob} position={[-2.4, -2.35]} scale={1.1} />
    </>
  );
}

// Reloj de pared con la hora real; al tocarlo las agujas dan una vuelta rápida.
function Clock() {
  const minute = useRef(null);
  const hour = useRef(null);
  const second = useRef(null);
  const spin = useRef({ extra: 0 });
  useFrame(() => {
    const now = new Date();
    const s = now.getSeconds() + now.getMilliseconds() / 1000;
    const m = now.getMinutes() + s / 60;
    const h = (now.getHours() % 12) + m / 60;
    const extra = spin.current.extra;
    second.current.rotation.z = -(s / 60) * TAU;
    minute.current.rotation.z = -(m / 60) * TAU - extra;
    hour.current.rotation.z = -(h / 12) * TAU - extra / 12;
  });
  const spinHands = () => {
    gsap.fromTo(spin.current, { extra: 0 }, { extra: TAU, duration: MOTION.dur.slow, ease: MOTION.ease.out, overwrite: true, onComplete: () => { spin.current.extra = 0; } });
  };
  return (
    <Toy onActivate={spinHands} position={[2.2, 3.0, -H + 0.06]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.36, 0.36, 0.08, 32]} />
        <meshStandardMaterial color={COLORS.dark} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0, 0.042]}>
        <circleGeometry args={[0.3, 32]} />
        <meshStandardMaterial color={COLORS.cream} roughness={0.8} />
      </mesh>
      {Array.from({ length: 12 }, (_, i) => (
        <mesh key={i} position={[Math.sin((i / 12) * TAU) * 0.25, Math.cos((i / 12) * TAU) * 0.25, 0.046]}>
          <circleGeometry args={[i % 3 === 0 ? 0.025 : 0.014, 8]} />
          <meshBasicMaterial color={COLORS.dark} />
        </mesh>
      ))}
      <group ref={hour} position={[0, 0, 0.05]}>
        <mesh position={[0, 0.07, 0]}>
          <boxGeometry args={[0.035, 0.15, 0.01]} />
          <meshStandardMaterial color={COLORS.dark} />
        </mesh>
      </group>
      <group ref={minute} position={[0, 0, 0.056]}>
        <mesh position={[0, 0.1, 0]}>
          <boxGeometry args={[0.025, 0.22, 0.01]} />
          <meshStandardMaterial color={COLORS.dark} />
        </mesh>
      </group>
      <group ref={second} position={[0, 0, 0.062]}>
        <mesh position={[0, 0.09, 0]}>
          <boxGeometry args={[0.01, 0.24, 0.005]} />
          <meshBasicMaterial color={COLORS.streak} />
        </mesh>
      </group>
    </Toy>
  );
}

// Gota (la moneda de Titi) de juguete: rebota con estirón y aplastón.
function GotaToy() {
  const body = useRef(null);
  const geometry = useMemo(makeDropGeometry, []);
  const bounce = () => {
    const b = body.current;
    gsap.timeline({ overwrite: true })
      .to(b.position, { y: 0.4, duration: 0.14, ease: MOTION.ease.out })
      .to(b.scale, { x: 0.9, y: 1.12, z: 0.9, duration: 0.14, ease: MOTION.ease.out }, 0)
      .to(b.position, { y: 0, duration: 0.12, ease: MOTION.ease.in })
      .to(b.scale, { x: 1.15, y: 0.82, z: 1.15, duration: 0.05, ease: MOTION.ease.in })
      .to(b.scale, { x: 1, y: 1, z: 1, duration: 0.09, ease: MOTION.ease.pop });
  };
  return (
    <Toy onActivate={bounce} position={[1.78, DH, -2.6]} rotation={[0, 0.6, 0]}>
      <group ref={body}>
        <mesh geometry={geometry} castShadow>
          <meshStandardMaterial color={COLORS.yellow} roughness={0.22} />
        </mesh>
        {[-0.05, 0.05].map((x) => (
          <mesh key={x} position={[x, 0.15, 0.13]}>
            <sphereGeometry args={[0.022, 10, 8]} />
            <meshStandardMaterial color={COLORS.dark} roughness={0.3} />
          </mesh>
        ))}
      </group>
    </Toy>
  );
}

// Pelota sobre la alfombra: cada toque la hace rodar al otro lado.
function Ball({ map }) {
  const ball = useRef(null);
  const side = useRef(0);
  const r = 0.2;
  const spots = [0.35, -0.75];
  const roll = () => {
    side.current = 1 - side.current;
    const x = spots[side.current];
    gsap.to(ball.current.position, { x, duration: MOTION.dur.slow, ease: MOTION.ease.out, overwrite: true });
    gsap.to(ball.current.rotation, { z: -(x - spots[0]) / r, duration: MOTION.dur.slow, ease: MOTION.ease.out, overwrite: true });
  };
  return (
    <Toy onActivate={roll}>
      <mesh ref={ball} position={[spots[0], r + 0.035, 1.5]} castShadow>
        <sphereGeometry args={[r, 24, 16]} />
        <meshStandardMaterial map={map} roughness={0.3} />
      </mesh>
    </Toy>
  );
}

// Silla de escritorio: al tocarla gira el asiento una vuelta entera.
function Chair({ blob }) {
  const seat = useRef(null);
  const spinChair = () => {
    gsap.fromTo(seat.current.rotation, { y: 0 }, { y: TAU, duration: MOTION.dur.slow, ease: MOTION.ease.out, overwrite: true });
  };
  return (
    <>
      <Toy onActivate={spinChair} position={[1.45, 0, -1.15]} rotation={[0, -0.25, 0]}>
        {Array.from({ length: 5 }, (_, i) => {
          const a = (i / 5) * TAU;
          return (
            <group key={i} rotation={[0, a, 0]}>
              <Part args={[0.06, 0.06, 0.42]} radius={0.02} position={[0, 0.1, 0.2]} color={COLORS.dark} />
              <mesh position={[0, 0.05, 0.4]} castShadow>
                <sphereGeometry args={[0.05, 10, 8]} />
                <meshStandardMaterial color={COLORS.darkMid} roughness={0.4} />
              </mesh>
            </group>
          );
        })}
        <mesh position={[0, 0.45, 0]} castShadow>
          <cylinderGeometry args={[0.045, 0.045, 0.7, 10]} />
          <meshStandardMaterial color={COLORS.dark} roughness={0.35} metalness={0.3} />
        </mesh>
        <group ref={seat}>
          <Part args={[0.78, 0.14, 0.72]} radius={0.06} position={[0, 0.84, 0]} color={COLORS.streak} rough={0.6} />
          <Part args={[0.06, 0.5, 0.06]} radius={0.02} position={[0, 1.05, 0.34]} color={COLORS.dark} />
          <Part args={[0.74, 0.62, 0.12]} radius={0.06} position={[0, 1.42, 0.38]} rotation={[-0.08, 0, 0]} color={COLORS.streak} rough={0.6} />
        </group>
      </Toy>
      <Blob map={blob} position={[1.45, -1.15]} scale={1.3} />
    </>
  );
}

// Puf amarillo: se aplasta y vuelve con rebote.
function Pouf({ blob }) {
  const body = useRef(null);
  const squish = () => {
    gsap.timeline({ overwrite: true })
      .to(body.current.scale, { x: 1.12, y: 0.78, z: 1.12, duration: 0.12, ease: MOTION.ease.out })
      .to(body.current.scale, { x: 1, y: 1, z: 1, duration: 0.26, ease: MOTION.ease.pop });
  };
  return (
    <>
      <Toy onActivate={squish} position={[1.8, 0, 1.45]}>
        <group ref={body}>
          <mesh position={[0, 0.34, 0]} scale={[0.62, 0.38, 0.62]} castShadow receiveShadow>
            <sphereGeometry args={[1, 28, 18]} />
            <meshStandardMaterial color={COLORS.yellow} roughness={0.85} />
          </mesh>
          <mesh position={[0, 0.66, 0]} scale={[0.42, 0.12, 0.42]} castShadow>
            <sphereGeometry args={[1, 20, 12]} />
            <meshStandardMaterial color={COLORS.yellowDark} roughness={0.85} />
          </mesh>
        </group>
      </Toy>
      <Blob map={blob} position={[1.8, 1.45]} scale={1.6} />
    </>
  );
}

export default function RoomToys({ tx }) {
  return (
    <group>
      <Lamp />
      <Plant blob={tx.blob} />
      <Clock />
      <GotaToy />
      <Ball map={tx.ball} />
      <Chair blob={tx.blob} />
      <Pouf blob={tx.blob} />
    </group>
  );
}
