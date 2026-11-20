// RoomShell — la parte fija de la habitación: piso, paredes, ventana, repisas,
// escritorio, alfombra y adornos. Nada de esto es tocable; los objetos de
// categoría y los juguetes con sorpresa viven aparte.
//
// Estilo "horneado": paredes y piso con el corte a la vista (otro tono en el
// espesor), oclusión pintada en los rincones y manchas de contacto bajo los
// muebles. Las sombras reales las proyecta la luz principal de HeroScene.
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import { COLORS, ROOM } from './roomLayout.js';

const { half: H, wallHeight: WH, wallThickness: T, floorThickness: F, deskHeight: DH } = ROOM;

// Caja redondeada con sombras y material mate. `rough` baja para lo brilloso.
export function Part({ args, radius = 0.03, color, rough = 0.72, emissive, ...props }) {
  return (
    <RoundedBox args={args} radius={radius} smoothness={2} bevelSegments={2} castShadow receiveShadow {...props}>
      <meshStandardMaterial
        color={color}
        roughness={rough}
        emissive={emissive || '#000000'}
        emissiveIntensity={emissive ? 0.35 : 0}
      />
    </RoundedBox>
  );
}

// Mancha de contacto en el piso (oclusión bajo un mueble).
export function Blob({ map, position, scale = 1 }) {
  return (
    <mesh position={[position[0], 0.006, position[1]]} rotation={[-Math.PI / 2, 0, 0]} scale={scale} renderOrder={1}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={map} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

function Shell({ tx }) {
  return (
    <group>
      {/* Piso: losa con el corte en madera oscura y tablas encima */}
      <Part args={[2 * H + T, F, 2 * H + T]} radius={0.06} position={[-T / 2, -F / 2, -T / 2]} color={COLORS.woodDark} />
      <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[2 * H, 2 * H]} />
        <meshStandardMaterial map={tx.floor} color={COLORS.wood} roughness={0.62} />
      </mesh>

      {/* Paredes: núcleo amarillo (se ve en el espesor) y cara interior clara */}
      <Part args={[2 * H + T, WH, T]} radius={0.05} position={[-T / 2, WH / 2, -H - T / 2]} color={COLORS.yellow} />
      <mesh position={[0, WH / 2, -H + 0.003]} receiveShadow>
        <planeGeometry args={[2 * H, WH]} />
        <meshStandardMaterial map={tx.backWall} color={COLORS.yellowLight} roughness={0.9} />
      </mesh>
      <Part args={[T, WH, 2 * H]} radius={0.05} position={[-H - T / 2, WH / 2, 0]} color={COLORS.yellow} />
      <mesh position={[-H + 0.003, WH / 2, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[2 * H, WH]} />
        <meshStandardMaterial map={tx.leftWall} color={COLORS.yellowLight} roughness={0.9} />
      </mesh>

      {/* Zócalos */}
      <Part args={[2 * H, 0.16, 0.05]} radius={0.015} position={[0, 0.08, -H + 0.03]} color={COLORS.cream} />
      <Part args={[0.05, 0.16, 2 * H]} radius={0.015} position={[-H + 0.03, 0.08, 0]} color={COLORS.cream} />

      {/* "Titi" pintado en la pared del fondo */}
      <mesh position={[-0.95, 2.72, -H + 0.01]}>
        <planeGeometry args={[2.3, 1.15]} />
        <meshStandardMaterial map={tx.lettering} transparent roughness={0.9} depthWrite={false} />
      </mesh>
    </group>
  );
}

// Ventana en la pared izquierda, con cielo que brilla un poco.
function Window() {
  const z = 1.35;
  const y = 2.35;
  const w = 1.6;
  const h = 1.45;
  const x = -H + 0.06;
  return (
    <group position={[x, y, z]}>
      <mesh position={[-0.03, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color={COLORS.sky} emissive={COLORS.sky} emissiveIntensity={0.45} roughness={0.3} />
      </mesh>
      <Part args={[0.12, 0.1, w + 0.1]} position={[0, h / 2, 0]} color={COLORS.cream} />
      <Part args={[0.12, 0.1, w + 0.1]} position={[0, -h / 2, 0]} color={COLORS.cream} />
      <Part args={[0.12, h, 0.1]} position={[0, 0, w / 2]} color={COLORS.cream} />
      <Part args={[0.12, h, 0.1]} position={[0, 0, -w / 2]} color={COLORS.cream} />
      <Part args={[0.08, h, 0.06]} position={[0, 0, 0]} color={COLORS.cream} />
      <Part args={[0.08, 0.06, w]} position={[0, 0.1, 0]} color={COLORS.cream} />
      {/* Alféizar */}
      <Part args={[0.3, 0.07, w + 0.3]} position={[0.1, -h / 2 - 0.06, 0]} color={COLORS.woodLight} />
    </group>
  );
}

// Repisas en la pared izquierda, con adornos (los objetos de categoría se
// suman encima desde HeroScene).
function Shelves() {
  const z = -1.25;
  const len = 1.85;
  const depth = 0.55;
  const x = -H + depth / 2;
  return (
    <group>
      {[1.69, 2.59].map((y) => (
        <group key={y}>
          <Part args={[depth, 0.06, len]} radius={0.02} position={[x, y, z]} color={COLORS.woodLight} />
          <Part args={[0.35, 0.18, 0.05]} radius={0.015} position={[-H + 0.18, y - 0.12, z - len / 2 + 0.2]} color={COLORS.wood} />
          <Part args={[0.35, 0.18, 0.05]} radius={0.015} position={[-H + 0.18, y - 0.12, z + len / 2 - 0.2]} color={COLORS.wood} />
        </group>
      ))}
      {/* Libros acostados en la repisa de abajo */}
      <Part args={[0.36, 0.07, 0.26]} radius={0.015} position={[-H + 0.24, 1.755, -1.3]} color={COLORS.achievement} />
      <Part args={[0.32, 0.07, 0.24]} radius={0.015} position={[-H + 0.24, 1.825, -1.3]} color={COLORS.streak} />
      {/* Trofeo dorado arriba */}
      <group position={[-H + 0.26, 2.62, -0.55]}>
        <mesh position={[0, 0.05, 0]} castShadow>
          <cylinderGeometry args={[0.1, 0.12, 0.1, 16]} />
          <meshStandardMaterial color={COLORS.dark} roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.16, 0]} castShadow>
          <cylinderGeometry args={[0.025, 0.025, 0.14, 8]} />
          <meshStandardMaterial color={COLORS.certificate} roughness={0.3} metalness={0.3} />
        </mesh>
        <mesh position={[0, 0.3, 0]} castShadow>
          <cylinderGeometry args={[0.13, 0.05, 0.18, 16]} />
          <meshStandardMaterial color={COLORS.certificate} roughness={0.3} metalness={0.3} />
        </mesh>
      </group>
      {/* Maceta chica arriba */}
      <group position={[-H + 0.26, 2.62, -1.98]}>
        <mesh position={[0, 0.1, 0]} castShadow>
          <cylinderGeometry args={[0.11, 0.08, 0.2, 14]} />
          <meshStandardMaterial color={COLORS.cream} roughness={0.7} />
        </mesh>
        {[[0, 0.3, 0, 0.15], [0.06, 0.24, 0.08, 0.11], [-0.05, 0.25, -0.07, 0.11]].map(([px, py, pz, r]) => (
          <mesh key={`${px}${pz}`} position={[px, py, pz]} castShadow>
            <icosahedronGeometry args={[r, 0]} />
            <meshStandardMaterial color={COLORS.leaf} roughness={0.8} flatShading />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// Escritorio contra la pared del fondo, con taza, notas y diploma colgado.
function Desk() {
  const x = 1.5;
  const z = -2.35;
  const depth = 1.2;
  return (
    <group>
      <Part args={[2.7, 0.1, depth]} radius={0.04} position={[x, DH - 0.05, z]} color={COLORS.woodLight} />
      <Part args={[0.1, DH - 0.1, depth - 0.1]} position={[0.3, (DH - 0.1) / 2, z]} color={COLORS.darkMid} />
      <Part args={[0.62, DH - 0.1, depth - 0.1]} position={[2.48, (DH - 0.1) / 2, z]} color={COLORS.darkMid} />
      {[0.25, 0.65, 1.05].map((y) => (
        <group key={y}>
          <Part args={[0.54, 0.34, 0.04]} radius={0.015} position={[2.48, y, z + depth / 2 - 0.05]} color={COLORS.dark} />
          <Part args={[0.16, 0.04, 0.05]} radius={0.015} position={[2.48, y + 0.06, z + depth / 2 - 0.02]} color={COLORS.yellow} rough={0.4} />
        </group>
      ))}

      {/* Taza */}
      <group position={[1.85, DH, -1.95]}>
        <mesh position={[0, 0.12, 0]} castShadow>
          <cylinderGeometry args={[0.09, 0.08, 0.24, 18]} />
          <meshStandardMaterial color={COLORS.streak} roughness={0.35} />
        </mesh>
        <mesh position={[0.1, 0.12, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <torusGeometry args={[0.055, 0.018, 8, 16]} />
          <meshStandardMaterial color={COLORS.streak} roughness={0.35} />
        </mesh>
      </group>

      {/* Notas adhesivas en la pared */}
      {[
        [0.55, 2.0, COLORS.yellow, 0.08],
        [0.85, 2.12, COLORS.streak, -0.06],
        [0.62, 2.32, COLORS.achievement, 0.04],
      ].map(([nx, ny, color, rz]) => (
        <Part key={nx + ny} args={[0.24, 0.24, 0.015]} radius={0.006} position={[nx, ny, -H + 0.02]} rotation={[0, 0, rz]} color={color} />
      ))}

      {/* Diploma enmarcado */}
      <group position={[1.35, 2.55, -H + 0.04]}>
        <Part args={[0.9, 0.66, 0.05]} radius={0.02} color={COLORS.dark} />
        <Part args={[0.76, 0.52, 0.02]} radius={0.01} position={[0, 0, 0.025]} color={COLORS.cream} rough={0.9} />
        <Part args={[0.44, 0.05, 0.02]} radius={0.01} position={[0, 0.12, 0.04]} color={COLORS.certificate} />
        <Part args={[0.3, 0.04, 0.02]} radius={0.01} position={[0, 0.02, 0.04]} color={COLORS.yellowDark} />
        <mesh position={[0.24, -0.13, 0.05]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.07, 0.07, 0.02, 16]} />
          <meshStandardMaterial color={COLORS.certificate} roughness={0.35} metalness={0.25} />
        </mesh>
      </group>
    </group>
  );
}

// Alfombra redonda, banquito (donde descansa la paleta) y atril con pintura.
function FloorDecor({ tx }) {
  return (
    <group>
      <mesh position={[-0.35, 0.02, 0.85]} receiveShadow>
        <cylinderGeometry args={[1.45, 1.45, 0.035, 48]} />
        <meshStandardMaterial color={COLORS.achievement} roughness={0.95} />
      </mesh>
      <mesh position={[-0.35, 0.04, 0.85]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <ringGeometry args={[1.08, 1.18, 48]} />
        <meshStandardMaterial color={COLORS.cream} roughness={0.95} />
      </mesh>

      {/* Banquito */}
      <group position={[-1.05, 0, 2.0]}>
        <mesh position={[0, 0.6, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.36, 0.36, 0.08, 28]} />
          <meshStandardMaterial color={COLORS.woodLight} roughness={0.7} />
        </mesh>
        {[0, 2.1, 4.2].map((a) => (
          <mesh key={a} position={[Math.cos(a) * 0.22, 0.28, Math.sin(a) * 0.22]} rotation={[Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12]} castShadow>
            <cylinderGeometry args={[0.035, 0.03, 0.58, 8]} />
            <meshStandardMaterial color={COLORS.wood} roughness={0.7} />
          </mesh>
        ))}
      </group>
      <Blob map={tx.blob} position={[-1.05, 2.0]} scale={1.0} />

      {/* Atril con una pintura */}
      <group position={[-2.05, 0, 0.55]} rotation={[0, 0.9, 0]}>
        {[-0.32, 0.32].map((lx) => (
          <mesh key={lx} position={[lx, 0.9, 0.1]} rotation={[0.12, 0, lx > 0 ? 0.08 : -0.08]} castShadow>
            <boxGeometry args={[0.06, 1.85, 0.06]} />
            <meshStandardMaterial color={COLORS.wood} roughness={0.7} />
          </mesh>
        ))}
        <mesh position={[0, 0.85, -0.32]} rotation={[-0.32, 0, 0]} castShadow>
          <boxGeometry args={[0.06, 1.75, 0.06]} />
          <meshStandardMaterial color={COLORS.wood} roughness={0.7} />
        </mesh>
        <Part args={[0.82, 0.06, 0.16]} radius={0.02} position={[0, 0.82, 0.18]} color={COLORS.woodLight} />
        <group position={[0, 1.33, 0.13]} rotation={[-0.12, 0, 0]}>
          <Part args={[0.82, 1.0, 0.05]} radius={0.02} color={COLORS.cream} />
          <mesh position={[0, 0, 0.03]}>
            <planeGeometry args={[0.72, 0.9]} />
            <meshStandardMaterial map={tx.painting} roughness={0.85} />
          </mesh>
        </group>
      </group>
      <Blob map={tx.blob} position={[-2.05, 0.55]} scale={1.2} />

      {/* Contacto bajo el escritorio y la guitarra */}
      <Blob map={tx.blob} position={[0.3, -2.35]} scale={[0.5, 1.4, 1]} />
      <Blob map={tx.blob} position={[2.48, -2.35]} scale={[1.0, 1.5, 1]} />
      <Blob map={tx.blob} position={[-1.35, -2.6]} scale={0.8} />
      <Blob map={tx.blob} position={[2.55, -0.65]} scale={1.1} />
    </group>
  );
}

// Guirnalda de luces colgada en lo alto de las dos paredes: una curva por
// pared, focos sin sombra con brillo propio (un solo draw call).
function FairyLights() {
  const { curves, bulbs } = useMemo(() => {
    const y = WH - 0.32;
    const sag = (a, b, n) =>
      Array.from({ length: n + 1 }, (_, i) => {
        const t = i / n;
        return new THREE.Vector3().lerpVectors(a, b, t).setY(y - Math.sin(t * Math.PI * 3) ** 2 * 0.22);
      });
    const back = sag(new THREE.Vector3(-H + 0.1, y, -H + 0.06), new THREE.Vector3(H - 0.15, y, -H + 0.06), 24);
    const left = sag(new THREE.Vector3(-H + 0.06, y, -H + 0.1), new THREE.Vector3(-H + 0.06, y, H - 0.15), 24);
    return {
      curves: [back, left].map((pts) => new THREE.CatmullRomCurve3(pts)),
      bulbs: [...back, ...left].filter((_, i) => i % 2 === 0),
    };
  }, []);
  const mesh = useRef(null);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const tint = [COLORS.yellow, COLORS.streak, COLORS.cream];
    bulbs.forEach((p, i) => {
      mesh.current.setMatrixAt(i, m.makeTranslation(p.x, p.y - 0.05, p.z));
      mesh.current.setColorAt(i, new THREE.Color(tint[i % 3]).multiplyScalar(1.4));
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.instanceColor.needsUpdate = true;
  }, [bulbs]);
  return (
    <group>
      {curves.map((curve, i) => (
        <mesh key={i}>
          <tubeGeometry args={[curve, 64, 0.008, 4, false]} />
          <meshStandardMaterial color={COLORS.dark} roughness={0.6} />
        </mesh>
      ))}
      <instancedMesh ref={mesh} args={[undefined, undefined, bulbs.length]}>
        <sphereGeometry args={[0.045, 10, 8]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

// Pila de libros en el piso, junto a la pared izquierda.
function FloorBooks({ blob }) {
  const books = [
    [0.62, 0.12, 0.44, COLORS.darkMid, 0],
    [0.56, 0.11, 0.4, COLORS.yellow, 0.25],
    [0.5, 0.1, 0.38, COLORS.achievement, -0.15],
  ];
  let y = 0;
  return (
    <group position={[-2.45, 0, 2.35]}>
      {books.map(([w, h, d, color, ry]) => {
        y += h;
        return <Part key={color} args={[w, h, d]} radius={0.02} position={[0, y - h / 2, 0]} rotation={[0, ry, 0]} color={color} />;
      })}
      <Blob map={blob} position={[0, 0]} scale={0.9} />
    </group>
  );
}

export default function RoomShell({ tx }) {
  return (
    <group>
      <Shell tx={tx} />
      <Window />
      <Shelves />
      <Desk />
      <FloorDecor tx={tx} />
      <FairyLights />
      <FloorBooks blob={tx.blob} />
    </group>
  );
}
