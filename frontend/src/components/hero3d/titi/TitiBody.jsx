// TitiBody — el modelo articulado de Titi, armado con esferas, cápsulas y tubos
// (sin archivos externos). Fiel a /Titi.png: pelaje amarillo con antifaz claro,
// ojos grandes, nariz oscura, sonrisa en "w", bigote blanco enorme con las
// puntas para arriba, cejas y chivita blancas, mechón en la cabeza, manos y
// pies marrón claro y cola larga enroscada.
//
// No anima nada: guarda cada articulación en `rig` para que Titi.jsx la mueva.
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { BONES, TAIL, TITI_COLORS as C } from './titiLook.js';
import { makeTitiGeometries } from './titiGeometry.js';

function useMaterials() {
  const mats = useMemo(() => {
    const std = (color, roughness = 0.62) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
    return {
      fur: std(C.fur),
      mask: std(C.mask),
      belly: std(C.belly, 0.7),
      earInner: std(C.earInner, 0.7),
      skin: std(C.skin, 0.66),
      white: std(C.white, 0.55),
      eye: std(C.eye, 0.22),
      mouth: std(C.mouth, 0.5),
      mouthInside: std(C.mouthInside, 0.6),
      glint: new THREE.MeshBasicMaterial({ color: '#FFFFFF', toneMapped: false }),
    };
  }, []);
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
  return mats;
}

function useGeometries() {
  const geo = useMemo(() => {
    const capsule = (r, len) => new THREE.CapsuleGeometry(r, len, 4, 12).translate(0, -(len / 2 + r) + r, 0);
    const radius = (i) => TAIL.radius[0] + ((TAIL.radius[1] - TAIL.radius[0]) * i) / (TAIL.segments - 1);
    return {
      ...makeTitiGeometries(),
      upperArm: capsule(0.054, BONES.upperArm - 0.054),
      forearm: capsule(0.048, BONES.forearm - 0.048),
      shin: capsule(0.05, BONES.shin - 0.05),
      finger: new THREE.CapsuleGeometry(0.014, 0.03, 3, 8),
      tail: Array.from({ length: TAIL.segments }, (_, i) =>
        new THREE.CapsuleGeometry(radius(i), TAIL.length, 3, 10).translate(0, TAIL.length / 2, 0),
      ),
    };
  }, []);
  useEffect(() => () => Object.values(geo).flat().forEach((g) => g.dispose?.()), [geo]);
  return geo;
}

// Esfera escalada con sombras (casi todo Titi está hecho de esto).
function Ball({ geo, m, s, p, r, shadow = true }) {
  return <mesh geometry={geo} material={m} scale={s} position={p} rotation={r} castShadow={shadow} receiveShadow={shadow} />;
}

function Eye({ side, g, m, rig }) {
  return (
    <group position={[side * 0.092, 0.035, 0.226]} rotation={[0, side * 0.3, 0]}>
      {/* Parpadeo: escala y del ojo entero */}
      <group ref={(o) => { rig[side > 0 ? 'eyeL' : 'eyeR'] = o; }}>
        <Ball geo={g.sphere} m={m.white} s={[0.072, 0.082, 0.04]} />
        <group ref={(o) => { rig[side > 0 ? 'pupilL' : 'pupilR'] = o; }} position={[0, 0, 0.026]}>
          <Ball geo={g.sphere} m={m.eye} s={[0.048, 0.062, 0.024]} p={[-side * 0.008, -0.004, 0]} />
          <Ball geo={g.smallSphere} m={m.glint} s={0.013} p={[0.012, 0.024, 0.02]} shadow={false} />
        </group>
      </group>
    </group>
  );
}

function Ear({ side, g, m, rig }) {
  return (
    <group position={[side * 0.262, 0.035, -0.01]} rotation={[0, side * 0.5, side * -0.2]}>
      <group ref={(o) => { rig[side > 0 ? 'earL' : 'earR'] = o; }}>
        <Ball geo={g.sphere} m={m.fur} s={[0.105, 0.115, 0.045]} />
        <Ball geo={g.sphere} m={m.earInner} s={[0.07, 0.08, 0.03]} p={[side * 0.008, -0.005, 0.024]} />
      </group>
    </group>
  );
}

function Head({ g, m, rig }) {
  return (
    <group ref={(o) => { rig.head = o; }} position={[0, BONES.neckY, 0.01]}>
      <group position={[0, BONES.headY, 0]} scale={1.12}>
        <Ball geo={g.sphere} m={m.fur} s={[0.27, 0.245, 0.25]} />
        {/* Antifaz claro (ojos) y hocico */}
        {[-1, 1].map((sx) => (
          <Ball key={sx} geo={g.sphere} m={m.mask} s={[0.11, 0.115, 0.07]} p={[sx * 0.09, 0.03, 0.19]} r={[0, sx * 0.3, 0]} />
        ))}
        <Ball geo={g.sphere} m={m.mask} s={[0.13, 0.095, 0.085]} p={[0, -0.075, 0.185]} />
        {/* Mechón de la coronilla */}
        {[[-0.045, 0.45, 0.09], [0.0, 0.0, 0.14], [0.05, -0.45, 0.11]].map(([x, tilt, h]) => (
          <Ball key={x} geo={g.cone} m={m.fur} s={[0.032, h, 0.03]} p={[x - tilt * 0.04, 0.225 + h / 2 - 0.02, 0.0]} r={[-0.1, 0, tilt]} />
        ))}
        <Ear side={1} g={g} m={m} rig={rig} />
        <Ear side={-1} g={g} m={m} rig={rig} />
        <Eye side={1} g={g} m={m} rig={rig} />
        <Eye side={-1} g={g} m={m} rig={rig} />
        {/* Cejas: mechones blancos sobre el antifaz, más altos hacia adentro */}
        {[-1, 1].map((sx) => (
          <Ball key={sx} geo={g.sphere} m={m.white} s={[0.08, 0.032, 0.03]} p={[sx * 0.098, 0.165, 0.168]} r={[-0.5, sx * 0.42, sx * -0.2]} />
        ))}
        {/* Nariz con brillo */}
        <Ball geo={g.sphere} m={m.eye} s={[0.06, 0.04, 0.042]} p={[0, -0.03, 0.262]} />
        <Ball geo={g.smallSphere} m={m.glint} s={[0.014, 0.008, 0.006]} p={[-0.015, -0.014, 0.3]} shadow={false} />
        {/* Boca: sonrisa en "w"; se abre al celebrar o al caer */}
        <group ref={(o) => { rig.smile = o; }}>
          {[-1, 1].map((sx) => (
            <mesh key={sx} geometry={g.smile} material={m.mouth} position={[sx * 0.023, -0.088, 0.274]} rotation={[0.25, 0, Math.PI]} />
          ))}
        </group>
        <group ref={(o) => { rig.mouth = o; }} position={[0, -0.1, 0.262]} scale={0}>
          <Ball geo={g.sphere} m={m.mouthInside} s={[0.045, 0.04, 0.02]} shadow={false} />
        </group>
        {/* Bigote y chivita */}
        <mesh geometry={g.mustacheL} material={m.white} castShadow receiveShadow />
        <mesh geometry={g.mustacheR} material={m.white} castShadow receiveShadow />
        <mesh geometry={g.goatee} material={m.white} position={[0, -0.22, 0.19]} rotation={[0.2, 0, 0]} castShadow />
      </group>
    </group>
  );
}

function Hand({ g, m }) {
  return (
    <group>
      <Ball geo={g.sphere} m={m.skin} s={[0.05, 0.035, 0.055]} p={[0, -0.02, 0.01]} />
      {[-0.026, 0, 0.026].map((x) => (
        <mesh key={x} geometry={g.finger} material={m.skin} position={[x, -0.05, 0.02]} rotation={[0.35, 0, x * 3]} castShadow />
      ))}
    </group>
  );
}

function Arm({ side, g, m, rig }) {
  const k = side > 0 ? 'L' : 'R';
  return (
    <group ref={(o) => { rig[`arm${k}`] = o; }} position={[side * BONES.shoulderX, BONES.shoulderY, BONES.shoulderZ]}>
      <mesh geometry={g.upperArm} material={m.fur} castShadow receiveShadow />
      <group ref={(o) => { rig[`elbow${k}`] = o; }} position={[0, -BONES.upperArm, 0]}>
        <mesh geometry={g.forearm} material={m.fur} castShadow receiveShadow />
        <group position={[0, -BONES.forearm, 0]}>
          <Hand g={g} m={m} />
        </group>
      </group>
    </group>
  );
}

function Leg({ side, g, m, rig }) {
  const k = side > 0 ? 'L' : 'R';
  return (
    <group ref={(o) => { rig[`leg${k}`] = o; }} position={[side * BONES.hipJointX, BONES.hipJointY, 0.02]}>
      {/* Muslo ancho: de frente se ven las ancas a los costados */}
      <Ball geo={g.sphere} m={m.fur} s={[0.125, 0.15, 0.13]} p={[side * 0.025, -0.085, 0]} />
      <group ref={(o) => { rig[`knee${k}`] = o; }} position={[0, -BONES.thigh, 0]}>
        <mesh geometry={g.shin} material={m.fur} castShadow receiveShadow />
        {/* El pie se mantiene plano: Titi.jsx compensa el giro de cadera y rodilla */}
        <group ref={(o) => { rig[`foot${k}`] = o; }} position={[0, -BONES.shin, 0]}>
          <group rotation={[0, side * 0.35, 0]}>
            <Ball geo={g.sphere} m={m.skin} s={[0.066, 0.032, 0.09]} p={[0, -0.004, 0.04]} />
            {[-0.04, -0.014, 0.012, 0.038].map((x) => (
              <mesh key={x} geometry={g.finger} material={m.skin} position={[x, -0.014, 0.12]} rotation={[Math.PI / 2, 0, x * 2]} castShadow />
            ))}
          </group>
        </group>
      </group>
    </group>
  );
}

function Tail({ g, m, rig }) {
  // Cadena de segmentos: cada uno cuelga del anterior y se curva un poco más.
  rig.tail = [];
  let chain = null;
  for (let i = TAIL.segments - 1; i >= 0; i -= 1) {
    chain = (
      <group key={i} ref={(o) => { rig.tail[i] = o; }} position={[0, i === 0 ? 0 : TAIL.length, 0]}>
        <mesh geometry={g.tail[i]} material={m.fur} castShadow receiveShadow />
        {chain}
      </group>
    );
  }
  return (
    <group position={[0.09, 0.05, -0.17]} rotation={[0, -1.35, 0]}>
      {chain}
    </group>
  );
}

/**
 * @param {object} rig  Objeto donde se guardan las articulaciones (lo anima Titi.jsx).
 */
export default function TitiBody({ rig }) {
  const m = useMaterials();
  const g = useGeometries();
  return (
    <group ref={(o) => { rig.hips = o; }}>
      <group ref={(o) => { rig.torso = o; }}>
        <group ref={(o) => { rig.chest = o; }}>
          <Ball geo={g.sphere} m={m.fur} s={[0.25, 0.21, 0.22]} p={[0, 0.1, -0.015]} />
          <Ball geo={g.sphere} m={m.fur} s={[0.185, 0.2, 0.165]} p={[0, 0.27, 0]} />
          <Ball geo={g.sphere} m={m.belly} s={[0.145, 0.2, 0.08]} p={[0, 0.17, 0.125]} />
        </group>
        <Head g={g} m={m} rig={rig} />
        <Arm side={1} g={g} m={m} rig={rig} />
        <Arm side={-1} g={g} m={m} rig={rig} />
      </group>
      <Leg side={1} g={g} m={m} rig={rig} />
      <Leg side={-1} g={g} m={m} rig={rig} />
      <Tail g={g} m={m} rig={rig} />
    </group>
  );
}
