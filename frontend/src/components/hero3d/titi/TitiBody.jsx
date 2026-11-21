// TitiBody — el modelo articulado de Titi, armado con esferas, cápsulas y
// barridos (sin archivos externos). Fiel a /Titi.png: pelaje amarillo con
// antifaz claro, ojos grandes con el blanco visible alrededor de la pupila,
// nariz oscura, sonrisa en "w" sobre el bigote, bigote blanco enorme que nace en
// las comisuras y enrosca las puntas para arriba, cejas y chivita blancas en
// mechones, mechón en la cabeza, manos y pies marrón claro y cola larga en
// espiral (una sola malla con esqueleto, sin quiebres).
//
// Estilo: sombreado toon con contorno de dibujo animado (titiMaterials).
// No anima nada: guarda cada articulación en `rig` para que Titi.jsx la mueva.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { BONES, TAIL, TITI_COLORS as C } from './titiLook.js';
import { MUZZLE, makeTailGeometry, makeTitiGeometries, onHead } from './titiGeometry.js';
import { makeOutlineMaterial, makeOutlineUniforms, makeToonMaterial, updateOutline } from './titiMaterials.js';

// Centro de cada ceja (lado +x): ahí giran y suben.
const BROW_PIVOT = [0.13, 0.18, onHead(0.13, 0.18, 0.016)];

function useMaterials() {
  const mats = useMemo(() => {
    const outline = makeOutlineUniforms();
    // Tono de sombra de cada material (multiplica al albedo): cálido en el
    // pelaje, gris lavanda en lo blanco (como el bigote de Titi.png).
    const warm = [0.8, 0.55, 0.48];
    const cool = [0.7, 0.7, 0.8];
    return {
      outline,
      fur: makeToonMaterial(C.fur, { shadow: warm }),
      mask: makeToonMaterial(C.mask, { shadow: warm, rim: 0.2 }),
      belly: makeToonMaterial(C.belly, { shadow: warm, rim: 0.2 }),
      earInner: makeToonMaterial(C.earInner, { shadow: [0.75, 0.58, 0.5], rim: 0.1, spec: 0 }),
      skin: makeToonMaterial(C.skin, { shadow: [0.78, 0.62, 0.57], rim: 0.25, spec: 0.05 }),
      white: makeToonMaterial(C.white, { shadow: cool, rim: 0.22, spec: 0.12 }),
      sclera: makeToonMaterial('#FFFFFA', { shadow: [0.86, 0.86, 0.92], rim: 0, spec: 0, band: 0.2 }),
      mouth: makeToonMaterial(C.mouth, { shadow: [0.85, 0.75, 0.7], rim: 0, spec: 0 }),
      mouthInside: makeToonMaterial(C.mouthInside, { shadow: [0.8, 0.7, 0.7], rim: 0, spec: 0 }),
      // Pupilas y nariz: brillo real (reflejan el ambiente del cuarto).
      eye: new THREE.MeshStandardMaterial({ color: C.eye, roughness: 0.18, metalness: 0 }),
      glint: new THREE.MeshBasicMaterial({ color: '#FFFFFF', toneMapped: false }),
      // Contornos: un tono oscuro de cada color, no negro.
      lineFur: makeOutlineMaterial(C.lineFur, outline),
      lineWhite: makeOutlineMaterial(C.lineWhite, outline),
      lineSkin: makeOutlineMaterial(C.lineSkin, outline),
    };
  }, []);
  useEffect(
    () => () => Object.values(mats).forEach((m) => m.dispose?.()),
    [mats],
  );
  return mats;
}

function useGeometries() {
  const geo = useMemo(() => {
    const capsule = (r, len, r2 = r) => {
      const g = new THREE.CapsuleGeometry(r, len, 6, 14).translate(0, -(len / 2 + r) + r, 0);
      // Se afina hacia la punta (r → r2): brazos y piernas menos "de tubo".
      if (r2 !== r) {
        const pos = g.attributes.position;
        const top = r;
        const bottom = -(len + r);
        for (let i = 0; i < pos.count; i += 1) {
          const k = 1 + (r2 / r - 1) * THREE.MathUtils.clamp((top - pos.getY(i)) / (top - bottom), 0, 1);
          pos.setX(i, pos.getX(i) * k);
          pos.setZ(i, pos.getZ(i) * k);
        }
        g.computeVertexNormals();
      }
      return g;
    };
    return {
      ...makeTitiGeometries(),
      upperArm: capsule(0.064, BONES.upperArm - 0.06, 0.056),
      forearm: capsule(0.056, BONES.forearm - 0.05, 0.05),
      shin: capsule(0.058, BONES.shin - 0.05, 0.052),
      finger: new THREE.CapsuleGeometry(0.016, 0.03, 4, 8),
      toe: new THREE.CapsuleGeometry(0.019, 0.026, 4, 8),
      tail: makeTailGeometry(TAIL),
    };
  }, []);
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose?.()), [geo]);
  return geo;
}

// Pieza escalada con sombras y, si se pide, contorno (`line`).
function Part({ geo, m, line, s, p, r, shadow = true }) {
  return (
    <group position={p} rotation={r} scale={s}>
      <mesh geometry={geo} material={m} castShadow={shadow} receiveShadow={shadow} />
      {line && <mesh geometry={geo} material={line} />}
    </group>
  );
}

function Eye({ side, g, m, rig }) {
  const k = side > 0 ? 'L' : 'R';
  return (
    <group position={[side * 0.1, 0.05, 0.234]} rotation={[0, side * 0.3, 0]}>
      {/* Parpadeo: escala y del ojo entero */}
      <group ref={(o) => { rig[`eye${k}`] = o; }}>
        <Part geo={g.eyeWhite} m={m.sclera} s={[0.064, 0.074, 0.042]} />
        {/* Pupila (un poco abajo y hacia adentro, como en la imagen) */}
        <group ref={(o) => { rig[`pupil${k}`] = o; }} position={[0, 0, 0.026]}>
          <group position={[-side * 0.007, -0.009, 0]}>
            <Part geo={g.sphere} m={m.eye} s={[0.037, 0.048, 0.022]} shadow={false} />
            <Part geo={g.smallSphere} m={m.glint} s={[0.012, 0.014, 0.006]} p={[-0.012, 0.018, 0.019]} shadow={false} />
            <Part geo={g.smallSphere} m={m.glint} s={0.005} p={[0.012, -0.018, 0.018]} shadow={false} />
          </group>
        </group>
      </group>
    </group>
  );
}

function Ear({ side, g, m, rig }) {
  return (
    <group position={[side * 0.262, 0.04, -0.01]} rotation={[0, side * 0.5, side * -0.2]}>
      <group ref={(o) => { rig[side > 0 ? 'earL' : 'earR'] = o; }}>
        <Part geo={g.sphere} m={m.fur} line={m.lineFur} s={[0.105, 0.115, 0.05]} />
        <Part geo={g.sphere} m={m.earInner} s={[0.07, 0.08, 0.03]} p={[side * 0.006, -0.006, 0.03]} />
      </group>
    </group>
  );
}

function Head({ g, m, rig }) {
  return (
    <group ref={(o) => { rig.head = o; }} position={[0, BONES.neckY, 0.01]}>
      <group position={[0, BONES.headY, 0]} scale={1.12}>
        <Part geo={g.sphere} m={m.fur} line={m.lineFur} s={[0.27, 0.245, 0.25]} />
        {/* Mejillas: el volumen donde se apoya el bigote */}
        {[-1, 1].map((sx) => (
          <Part key={sx} geo={g.sphere} m={m.fur} s={[0.1, 0.08, 0.09]} p={[sx * 0.13, -0.11, 0.14]} />
        ))}
        {/* Antifaz claro (ojos) y hocico */}
        {[-1, 1].map((sx) => (
          <Part key={sx} geo={g.sphere} m={m.mask} s={[0.118, 0.122, 0.055]} p={[sx * 0.095, 0.045, 0.19]} r={[0, sx * 0.3, 0]} />
        ))}
        <Part geo={g.sphere} m={m.mask} s={MUZZLE.s} p={MUZZLE.p} />
        {/* Mechón de la coronilla */}
        <Part geo={g.tuft} m={m.fur} line={m.lineFur} />
        <Ear side={1} g={g} m={m} rig={rig} />
        <Ear side={-1} g={g} m={m} rig={rig} />
        <Eye side={1} g={g} m={m} rig={rig} />
        <Eye side={-1} g={g} m={m} rig={rig} />
        {/* Cejas: mechones blancos; suben, bajan y se inclinan (expresión) */}
        {[1, -1].map((sx) => (
          <group key={sx} position={[sx * BROW_PIVOT[0], BROW_PIVOT[1], BROW_PIVOT[2]]}>
            <group ref={(o) => { rig[sx > 0 ? 'browL' : 'browR'] = o; }}>
              <group position={[-sx * BROW_PIVOT[0], -BROW_PIVOT[1], -BROW_PIVOT[2]]}>
                <Part geo={sx > 0 ? g.browL : g.browR} m={m.white} line={m.lineWhite} />
              </group>
            </group>
          </group>
        ))}
        {/* Nariz con brillo */}
        <Part geo={g.nose} m={m.eye} s={[0.062, 0.042, 0.044]} p={[0, -0.028, 0.262]} />
        <Part geo={g.smallSphere} m={m.glint} s={[0.012, 0.007, 0.005]} p={[-0.022, -0.012, 0.302]} r={[0, 0, -0.3]} shadow={false} />
        <Part geo={g.smallSphere} m={m.glint} s={[0.007, 0.005, 0.004]} p={[0.024, -0.014, 0.3]} shadow={false} />
        {/* Boca: sonrisa en "w"; se abre al celebrar o al caer */}
        <group ref={(o) => { rig.smile = o; }}>
          <mesh geometry={g.smile} material={m.mouth} />
        </group>
        <group ref={(o) => { rig.mouth = o; }} position={[0, -0.112, 0.258]} scale={0}>
          <Part geo={g.sphere} m={m.mouthInside} s={[0.042, 0.036, 0.02]} shadow={false} />
        </group>
        {/* Bigote: cada mitad gira desde la comisura (se mueve al hablar y al respirar) */}
        <group ref={(o) => { rig.mustacheL = o; }} position={[0.072, -0.096, 0.26]}>
          <group position={[-0.072, 0.096, -0.26]}>
            <Part geo={g.mustacheL} m={m.white} line={m.lineWhite} />
          </group>
        </group>
        <group ref={(o) => { rig.mustacheR = o; }} position={[-0.072, -0.096, 0.26]}>
          <group position={[0.072, 0.096, -0.26]}>
            <Part geo={g.mustacheR} m={m.white} line={m.lineWhite} />
          </group>
        </group>
        <group ref={(o) => { rig.goatee = o; }} position={[0, -0.16, 0.235]}>
          <group position={[0, 0.16, -0.235]}>
            <Part geo={g.goatee} m={m.white} line={m.lineWhite} />
          </group>
        </group>
      </group>
    </group>
  );
}

function Hand({ g, m }) {
  return (
    <group>
      <Part geo={g.sphere} m={m.skin} line={m.lineSkin} s={[0.056, 0.04, 0.06]} p={[0, -0.02, 0.01]} />
      {[-0.03, 0, 0.03].map((x) => (
        <Part key={x} geo={g.finger} m={m.skin} line={m.lineSkin} p={[x, -0.052, 0.024]} r={[0.35, 0, x * 3]} />
      ))}
    </group>
  );
}

function Arm({ side, g, m, rig }) {
  const k = side > 0 ? 'L' : 'R';
  return (
    <group ref={(o) => { rig[`arm${k}`] = o; }} position={[side * BONES.shoulderX, BONES.shoulderY, BONES.shoulderZ]}>
      <Part geo={g.upperArm} m={m.fur} line={m.lineFur} />
      <group ref={(o) => { rig[`elbow${k}`] = o; }} position={[0, -BONES.upperArm, 0]}>
        <Part geo={g.forearm} m={m.fur} line={m.lineFur} />
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
      <Part geo={g.sphere} m={m.fur} line={m.lineFur} s={[0.128, 0.152, 0.135]} p={[side * 0.025, -0.085, 0]} />
      <group ref={(o) => { rig[`knee${k}`] = o; }} position={[0, -BONES.thigh, 0]}>
        <Part geo={g.shin} m={m.fur} line={m.lineFur} />
        {/* El pie se mantiene plano: Titi.jsx compensa el giro de cadera y rodilla */}
        <group ref={(o) => { rig[`foot${k}`] = o; }} position={[0, -BONES.shin, 0]}>
          <group rotation={[0, side * 0.35, 0]}>
            <Part geo={g.sphere} m={m.skin} line={m.lineSkin} s={[0.07, 0.034, 0.095]} p={[0, -0.004, 0.04]} />
            {[-0.042, -0.014, 0.014, 0.042].map((x) => (
              <Part key={x} geo={g.toe} m={m.skin} line={m.lineSkin} p={[x, -0.012, 0.122]} r={[Math.PI / 2, 0, x * 2]} />
            ))}
          </group>
        </group>
      </group>
    </group>
  );
}

// Cola: una malla continua sobre una cadena de huesos (cada uno cuelga del
// anterior). Titi.jsx dobla los huesos; la malla los sigue sin quiebres.
function Tail({ g, m, rig }) {
  const anchor = useRef(null);
  useLayoutEffect(() => {
    const bones = [];
    for (let i = 0; i < TAIL.segments; i += 1) {
      const bone = new THREE.Bone();
      bone.position.y = i === 0 ? 0 : TAIL.length;
      if (i > 0) bones[i - 1].add(bone);
      bones.push(bone);
    }
    const skin = new THREE.SkinnedMesh(g.tail, m.fur);
    const line = new THREE.SkinnedMesh(g.tail, m.lineFur);
    skin.castShadow = true;
    skin.receiveShadow = true;
    // La caja de la pose recta no sirve para la cola enroscada.
    skin.frustumCulled = false;
    line.frustumCulled = false;
    const root = anchor.current;
    root.add(bones[0], skin, line);
    root.updateMatrixWorld(true);
    const skeleton = new THREE.Skeleton(bones);
    skin.bind(skeleton);
    line.bind(skeleton);
    rig.tail = bones;
    return () => {
      root.remove(bones[0], skin, line);
      skeleton.dispose();
    };
  }, [g, m, rig]);
  return <group ref={anchor} position={[0.09, 0.05, -0.17]} rotation={[0, -1.35, 0]} />;
}

// Grosor del contorno según el zoom (fino en el cuarto, algo más de cerca).
function OutlineSizer({ uniforms }) {
  useFrame((state) => updateOutline(uniforms, state.camera, state.size, state.viewport.dpr));
  return null;
}

/**
 * @param {object} rig  Objeto donde se guardan las articulaciones (lo anima Titi.jsx).
 */
export default function TitiBody({ rig }) {
  const m = useMaterials();
  const g = useGeometries();
  return (
    <group ref={(o) => { rig.hips = o; }}>
      <OutlineSizer uniforms={m.outline} />
      <group ref={(o) => { rig.torso = o; }}>
        <group ref={(o) => { rig.chest = o; }}>
          <Part geo={g.sphere} m={m.fur} line={m.lineFur} s={[0.25, 0.21, 0.22]} p={[0, 0.1, -0.015]} />
          <Part geo={g.sphere} m={m.fur} line={m.lineFur} s={[0.185, 0.2, 0.165]} p={[0, 0.27, 0]} />
          <Part geo={g.sphere} m={m.belly} s={[0.145, 0.2, 0.08]} p={[0, 0.17, 0.125]} />
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
