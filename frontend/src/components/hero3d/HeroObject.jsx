// HeroObject — un objeto de categoría apoyado en su lugar de la habitación.
//
// - Carga el modelo (meshopt) y pasa sus materiales a estándar mate con los
//   mismos colores, para que reciba la misma luz suave y sombras que el cuarto.
// - Lo orienta, lo escala a `size` y lo apoya por su base en `position`.
// - Saluda con un saltito escalonado al aparecer y otro de vez en cuando (pista
//   de que se puede tocar); al hover crece, sube y muestra su nombre.
// - Click / tap (sin arrastre): filtra el catálogo por su categoría.
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import { Html, useGLTF } from '@react-three/drei';
import { MOTION } from '../../lib/motion.js';
import { HERO_MODELS } from './heroModels.js';
import { useRoomInput } from './RoomRig.jsx';

const WHITE = new THREE.Color('#FFFFFF');

function toSoft(material) {
  return new THREE.MeshStandardMaterial({
    color: material.color ? material.color.clone() : WHITE.clone(),
    map: material.map || null,
    roughness: 0.55,
    metalness: 0,
    transparent: material.transparent,
    opacity: material.opacity ?? 1,
    side: material.side,
  });
}

// Clona el modelo con materiales propios, lo orienta y calcula escala y apoyo.
function useRoomModel(url, rotation, size) {
  const { scene } = useGLTF(url, false, true);

  const model = useMemo(() => {
    const root = new THREE.Group();
    root.rotation.set(...rotation);
    root.add(scene.clone(true));
    const materials = [];
    root.traverse((node) => {
      if (!node.isMesh) return;
      node.castShadow = true;
      node.receiveShadow = true;
      // Algunos modelos vienen sin normales y la luz los dejaría negros.
      if (!node.geometry.attributes.normal) {
        node.geometry = node.geometry.clone();
        node.geometry.computeVertexNormals();
      }
      const convert = (m) => {
        const soft = toSoft(m);
        materials.push(soft);
        return soft;
      };
      node.material = Array.isArray(node.material) ? node.material.map(convert) : convert(node.material);
    });
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const dims = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const scale = size / Math.max(dims.x, dims.y, dims.z || 1);
    return {
      root,
      materials,
      scale,
      offset: [-center.x, -box.min.y, -center.z],
      dims: dims.multiplyScalar(scale),
    };
  }, [scene, rotation, size]);

  useEffect(() => () => model.materials.forEach((m) => m.dispose()), [model]);

  return model;
}

// Saltito corto: sube y vuelve con rebote (≤ 400 ms en total).
function hop(group, delay = 0) {
  return gsap.timeline({ delay })
    .to(group.position, { y: 0.22, duration: 0.16, ease: MOTION.ease.out })
    .to(group.position, { y: 0, duration: 0.22, ease: MOTION.ease.pop });
}

export default function HeroObject({ item, slot, index, hopSignal, onSelect, onHover }) {
  const config = HERO_MODELS[item.slug];
  const { root, scale, offset, dims } = useRoomModel(config.url, slot.rotation, slot.size);
  const input = useRoomInput();
  // Grupos separados para que el saltito y el hover no se pisen.
  const hopRef = useRef(null);
  const hoverRef = useRef(null);
  const [hovered, setHovered] = useState(false);

  // Saludo de entrada, escalonado: como mucho 3 objetos a la vez (motion.md).
  useEffect(() => {
    const tl = hop(hopRef.current, 0.45 + index * 0.12);
    return () => tl.kill();
  }, [index]);

  // Pista periódica que manda HeroScene (un objeto a la vez). Solo depende de
  // la señal: dejar el hover no debe disparar otro saltito.
  useEffect(() => {
    if (!hopSignal || hovered) return undefined;
    const tl = hop(hopRef.current);
    return () => tl.kill();
  }, [hopSignal]);

  // Hover: crece y se eleva con rebote leve.
  useEffect(() => {
    const g = hoverRef.current;
    const s = hovered ? 1.14 : 1;
    const tweens = [
      gsap.to(g.scale, { x: s, y: s, z: s, duration: MOTION.dur.base, ease: MOTION.ease.pop, overwrite: true }),
      gsap.to(g.position, { y: hovered ? 0.12 : 0, duration: MOTION.dur.base, ease: MOTION.ease.pop, overwrite: true }),
    ];
    return () => tweens.forEach((t) => t.kill());
  }, [hovered]);

  // Caja invisible del tamaño del modelo (mínimo 0.3 por lado): los objetos
  // chatos o finos (calculadora, paleta) se tocan fácil en mobile sin tapar a
  // los vecinos.
  const hit = [Math.max(dims.x, 0.3), Math.max(dims.y, 0.3), Math.max(dims.z, 0.3)];

  const setHover = (on) => {
    // Mientras se gira el cuarto, pasar por encima no muestra etiquetas.
    if (on === hovered || (on && input.isDragging())) return;
    setHovered(on);
    // El título del hero muestra la categoría que tiene el mouse encima.
    onHover?.(on ? item : null);
    if (on) input.hoverStart();
    else input.hoverEnd();
  };

  return (
    <group position={slot.position}>
      <group ref={hopRef}>
        <group
          ref={hoverRef}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHover(true);
          }}
          onPointerOut={() => setHover(false)}
          onClick={(e) => {
            e.stopPropagation();
            if (input.wasDrag()) return;
            // La página scrollea a Tendencias y el puntero ya no "sale" del objeto.
            setHover(false);
            onSelect(item.id);
          }}
        >
          <group scale={scale}>
            <primitive object={root} position={offset} />
          </group>
          <mesh position={[0, dims.y / 2, 0]}>
            <boxGeometry args={hit} />
            <meshBasicMaterial visible={false} />
          </mesh>
        </group>
      </group>
      {hovered && (
        <Html center position={[0, dims.y + 0.42, 0]} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <span className="block whitespace-nowrap rounded-full border-2 border-titi-dark bg-white px-3 py-1 text-sm font-extrabold text-titi-dark shadow-[0_3px_0px_#1A1A2E] titi-pop-in">
            {item.nombre}
          </span>
        </Html>
      )}
    </group>
  );
}

Object.values(HERO_MODELS).forEach(({ url }) => useGLTF.preload(url, false, true));
