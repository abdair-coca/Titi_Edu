// HeroObject — un objeto de categoría en la escena del hero.
//
// - Carga el modelo (meshopt) y pasa sus materiales a toon plano con los mismos
//   colores: sin reflejos ni brillos, coherente con la UI plana de Titi.
// - Normaliza tamaño y centro, porque cada modelo viene en otra escala.
// - Entra con pop escalonado, flota en loop y crece al hover (tokens MOTION).
// - Click / tap: filtra el catálogo por su categoría.
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import { Float, Html, useGLTF } from '@react-three/drei';
import { MOTION } from '../../lib/motion.js';
import { HERO_MODELS } from './heroModels.js';

// Rampa de 3 tonos para el sombreado toon (sombra, medio, luz), sin degradé.
let toonRamp;
function getToonRamp() {
  if (!toonRamp) {
    toonRamp = new THREE.DataTexture(new Uint8Array([110, 190, 255]), 3, 1, THREE.RedFormat);
    toonRamp.minFilter = THREE.NearestFilter;
    toonRamp.magFilter = THREE.NearestFilter;
    toonRamp.needsUpdate = true;
  }
  return toonRamp;
}

function toToon(material) {
  return new THREE.MeshToonMaterial({
    color: material.color ? material.color.clone() : new THREE.Color('#FFFFFF'),
    map: material.map || null,
    gradientMap: getToonRamp(),
    transparent: material.transparent,
    opacity: material.opacity ?? 1,
    side: material.side,
  });
}

// Clona el modelo con materiales toon propios y calcula escala y centro para
// que su lado más largo mida `size`.
function useToonModel(url, size) {
  const { scene } = useGLTF(url, false, true);

  const model = useMemo(() => {
    const root = scene.clone(true);
    const materials = [];
    root.traverse((node) => {
      if (!node.isMesh) return;
      const convert = (m) => {
        const toon = toToon(m);
        materials.push(toon);
        return toon;
      };
      node.material = Array.isArray(node.material) ? node.material.map(convert) : convert(node.material);
    });
    const box = new THREE.Box3().setFromObject(root);
    const dims = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const scale = size / Math.max(dims.x, dims.y, dims.z || 1);
    return { root, materials, scale, offset: center.multiplyScalar(-1) };
  }, [scene, size]);

  useEffect(() => () => model.materials.forEach((m) => m.dispose()), [model]);

  return model;
}

export default function HeroObject({ item, index, position, size, onSelect }) {
  const config = HERO_MODELS[item.slug];
  const { root, scale, offset } = useToonModel(config.url, size);
  // Dos grupos para que los tweens no se pisen: uno para la entrada, otro para el hover.
  const popRef = useRef(null);
  const hoverRef = useRef(null);
  const [hovered, setHovered] = useState(false);

  // Entrada: pop escalonado, cada uno ≤ 400 ms y como mucho 3 a la vez (motion.md).
  useEffect(() => {
    const g = popRef.current;
    if (!g) return undefined;
    const tween = gsap.fromTo(
      g.scale,
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 1, z: 1, duration: MOTION.dur.base, ease: MOTION.ease.pop, delay: index * 0.1 },
    );
    return () => tween.kill();
  }, [index]);

  // Hover: crece y se eleva con rebote leve.
  useEffect(() => {
    const g = hoverRef.current;
    if (!g) return undefined;
    const s = hovered ? 1.18 : 1;
    const tweens = [
      gsap.to(g.scale, { x: s, y: s, z: s, duration: MOTION.dur.base, ease: MOTION.ease.pop, overwrite: true }),
      gsap.to(g.position, { y: hovered ? 0.18 : 0, duration: MOTION.dur.base, ease: MOTION.ease.pop, overwrite: true }),
    ];
    return () => tweens.forEach((t) => t.kill());
  }, [hovered]);

  // El cursor de mano solo mientras hay un objeto bajo el mouse.
  useEffect(() => {
    if (!hovered) return undefined;
    document.body.style.cursor = 'pointer';
    return () => {
      document.body.style.cursor = '';
    };
  }, [hovered]);

  return (
    <group position={position}>
      <Float speed={1.4} rotationIntensity={0.35} floatIntensity={0.5} floatingRange={[-0.08, 0.08]}>
        <group ref={popRef} scale={0}>
          <group
            ref={hoverRef}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHovered(true);
            }}
            onPointerOut={() => setHovered(false)}
            onClick={(e) => {
              e.stopPropagation();
              // La página scrollea a Tendencias y el puntero ya no "sale" del objeto.
              setHovered(false);
              onSelect(item.id);
            }}
          >
            <group rotation={config.rotation}>
              <group scale={scale}>
                <primitive object={root} position={offset} />
              </group>
            </group>
          </group>
        </group>
        {hovered && (
          <Html center position={[0, size * 0.78, 0]} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
            <span className="block whitespace-nowrap rounded-full border-2 border-titi-dark bg-white px-3 py-1 text-sm font-extrabold text-titi-dark shadow-[0_3px_0px_#1A1A2E] titi-pop-in">
              {item.nombre}
            </span>
          </Html>
        )}
      </Float>
    </group>
  );
}

Object.values(HERO_MODELS).forEach(({ url }) => useGLTF.preload(url, false, true));
