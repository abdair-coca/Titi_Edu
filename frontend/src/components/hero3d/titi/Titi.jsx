// Titi — la mascota en 3D, viva dentro de la habitación de /courses.
//
// - Vida propia (titiBrain): se sienta, mira alrededor, camina a otro punto
//   libre y ahí se sienta, saluda o piensa.
// - Siempre vivo: respira, parpadea, mueve la cola y sigue al mouse con la
//   cabeza y los ojos (en pantallas táctiles mira a la cámara).
// - En celular no proyecta sombra real: solo la mancha de contacto.
// - Tocarlo: celebra con los brazos arriba. Arrastrarlo: queda colgando del
//   puntero (piernas y cola se balancean); al soltarlo cae, se aplasta y se
//   marea. El arrastre de Titi no gira el cuarto (RoomRig.grab).
//
// El modelo (TitiBody) solo tiene las articulaciones; acá se mueven por frame
// acercándose con amortiguación a la pose del modo actual (titiPoses).
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import TitiBody from './TitiBody.jsx';
import { POSE_KEYS, poseFor, restPose } from './titiPoses.js';
import { CARRY_HEIGHT, carryTo, createBrain, drop, grab, poke, stepBrain } from './titiBrain.js';
import { HIPS_SIT, HIPS_STAND, TAIL, TITI_SCALE } from './titiLook.js';
import { CAMERA_DIR } from '../roomLayout.js';
import { useRoomInput } from '../RoomRig.jsx';

const CLICK_PX = 6;
const MAX_DT = 1 / 20; // tras volver de una pestaña oculta, sin saltos
// La cola sale hacia el costado, sube y termina en una espiral que se ve de
// frente (como en Titi.png). Curvatura de cada segmento respecto del anterior.
const TAIL_BASE = -1.62;
const TAIL_CURL = [0, 0.04, 0.04, 0.04, 0.05, 0.6, 0.6, 0.05, 0.05, 0.62, 0.64, 0.66, 0.68, 0.7];

// Cuánto sigue la cabeza al mouse/cámara según lo que esté haciendo.
const LOOK_WEIGHT = { sit: 1, stand: 0.6, land: 0.5, dizzy: 0.3, wave: 0.8, celebrate: 0.7, think: 0, walk: 0.35, carried: 0.3, fall: 0.2 };

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const damp = (k, dt) => 1 - Math.exp(-k * dt);

const hasFinePointer = () =>
  typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

// Parpadeo: cada 2–5 s cierra los ojos 120 ms (a veces dos veces seguidas).
function blinkLid(blink, dt) {
  blink.wait -= dt;
  if (blink.wait <= 0) {
    blink.wait = 2 + Math.random() * 3;
    blink.left = Math.random() < 0.2 ? 0.36 : 0.12;
  }
  if (blink.left > 0) {
    blink.left -= dt;
    return Math.abs(Math.sin((blink.left / 0.12) * Math.PI)) > 0.5 ? 0.1 : 1;
  }
  return 1;
}

/**
 * @param {THREE.Texture} blobMap  Mancha de contacto del cuarto (roomTextures).
 * @param {boolean} mobile  En celular no proyecta sombra real (solo la mancha).
 */
export default function Titi({ blobMap, mobile }) {
  const input = useRoomInput();
  const camera = useThree((s) => s.camera);
  const el = useThree((s) => s.events.connected || s.gl.domElement);
  const root = useRef(null);
  const squash = useRef(null);
  const blob = useRef(null);
  const rig = useMemo(() => ({}), []);
  const brain = useMemo(createBrain, []);
  const pose = useMemo(restPose, []);
  const blink = useMemo(() => ({ wait: 2, left: 0 }), []);
  const press = useRef(null);
  const hovered = useRef(false);
  const ndc = useMemo(() => new THREE.Vector2(), []);
  const fine = useMemo(hasFinePointer, []);
  const tmp = useMemo(
    () => ({ ray: new THREE.Raycaster(), q: new THREE.Quaternion(), dir: new THREE.Vector3(), o: new THREE.Vector3(), right: new THREE.Vector3(), up: new THREE.Vector3() }),
    [],
  );

  // Puntero → coordenadas normalizadas del lienzo (para el rayo al cargarlo).
  const setNdc = (e) => {
    const r = el.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  };

  // En celular, sin sombra real: el mapa de sombras no se redibuja por Titi.
  useEffect(() => {
    root.current.traverse((o) => {
      if (!o.isMesh) return;
      o.userData.castShadow ??= o.castShadow;
      o.castShadow = o.userData.castShadow && !mobile;
    });
  }, [mobile]);

  useEffect(() => {
    const onMove = (e) => {
      const p = press.current;
      if (!p || p.id !== e.pointerId) return;
      setNdc(e);
      if (!p.carrying && Math.hypot(e.clientX - p.x0, e.clientY - p.y0) > CLICK_PX) {
        p.carrying = true;
        grab(brain);
      }
    };
    const onUp = (e) => {
      const p = press.current;
      if (!p || p.id !== e.pointerId) return;
      press.current = null;
      if (p.carrying) drop(brain);
      else if (e.type === 'pointerup') poke(brain);
      input.release(p.carrying);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [brain, input, el]);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, MAX_DT);
    const time = state.clock.elapsedTime;
    const g = root.current;
    const parent = g?.parent;
    if (!g || !parent || !rig.hips) return;

    // Cargado: el punto del piso bajo el puntero, a la altura a la que cuelga.
    if (press.current?.carrying) {
      tmp.ray.setFromCamera(ndc, camera);
      parent.getWorldQuaternion(tmp.q).invert();
      tmp.o.copy(tmp.ray.ray.origin);
      parent.worldToLocal(tmp.o);
      tmp.dir.copy(tmp.ray.ray.direction).applyQuaternion(tmp.q);
      const h = CARRY_HEIGHT + 0.45 * TITI_SCALE;
      if (Math.abs(tmp.dir.y) > 1e-4) {
        const t = (h - tmp.o.y) / tmp.dir.y;
        carryTo(brain, tmp.o.x + tmp.dir.x * t, tmp.o.z + tmp.dir.z * t);
      }
    }

    stepBrain(brain, dt);
    const target = poseFor(brain.mode, brain.t, {
      time,
      phase: brain.phase,
      speed: brain.speed,
      swayX: clamp(brain.vx * 0.25, -0.6, 0.6),
      swayZ: clamp(brain.vz * 0.25, -0.6, 0.6),
    });

    // Mirada: hacia la cámara, desviada hacia donde está el mouse. Se calcula
    // en el espacio del cuarto (que puede estar girado).
    parent.getWorldQuaternion(tmp.q).invert();
    tmp.dir.set(...CAMERA_DIR).normalize().applyQuaternion(tmp.q);
    if (fine) {
      tmp.right.setFromMatrixColumn(camera.matrixWorld, 0).applyQuaternion(tmp.q);
      tmp.up.setFromMatrixColumn(camera.matrixWorld, 1).applyQuaternion(tmp.q);
      tmp.dir.addScaledVector(tmp.right, state.pointer.x * 0.9).addScaledVector(tmp.up, state.pointer.y * 0.5);
    }
    const lookYaw = wrap(Math.atan2(tmp.dir.x, tmp.dir.z) - brain.yaw);
    const lookPitch = -Math.atan2(tmp.dir.y, Math.hypot(tmp.dir.x, tmp.dir.z)) * 0.55;
    // Si lo que mira quedó atrás, no se tuerce el cuello: mira al frente.
    const w = (LOOK_WEIGHT[brain.mode] ?? 0.5) * (Math.abs(lookYaw) > 1.9 ? 0 : 1);
    target.headYaw += clamp(lookYaw, -1.05, 1.05) * w;
    target.headPitch += clamp(lookPitch, -0.45, 0.35) * w;
    if (hovered.current && brain.mode === 'sit') target.ears = 1;

    // Acercarse a la pose objetivo; al caminar, más rápido para que el paso no
    // se lave.
    const k = damp(brain.mode === 'walk' ? 18 : 9, dt);
    let motion = 0;
    for (const key of POSE_KEYS) {
      const d = (target[key] - pose[key]) * k;
      pose[key] += d;
      motion += Math.abs(d);
    }

    // Raíz: posición en el cuarto, altura (cargado/cayendo) y giro.
    const prevX = g.position.x;
    const prevZ = g.position.z;
    g.position.set(brain.x, brain.y, brain.z);
    g.rotation.y = brain.yaw;
    motion += Math.abs(g.position.x - prevX) + Math.abs(g.position.z - prevZ);

    // Aplastón al caer al piso.
    const sq = brain.mode === 'land' ? 1 - 0.22 * Math.sin(Math.min(1, brain.t / 0.35) * Math.PI) : 1;
    squash.current.scale.set(1 + (1 - sq) * 0.6, sq, 1 + (1 - sq) * 0.6);

    // Cuerpo.
    rig.hips.position.y = HIPS_STAND + (HIPS_SIT - HIPS_STAND) * pose.sit + pose.lift;
    rig.torso.rotation.set(pose.lean, 0, pose.roll);
    rig.chest.scale.set(1, 1 + Math.sin(time * 2.4) * 0.018, 1 + Math.sin(time * 2.4) * 0.012);
    rig.head.rotation.set(pose.headPitch, pose.headYaw, pose.headRoll, 'YXZ');
    rig.armL.rotation.set(pose.armLX, 0, pose.armLZ);
    rig.armR.rotation.set(pose.armRX, 0, pose.armRZ);
    rig.elbowL.rotation.x = pose.elbowL;
    rig.elbowR.rotation.x = pose.elbowR;
    rig.legL.rotation.x = pose.legLX;
    rig.legR.rotation.x = pose.legRX;
    rig.kneeL.rotation.x = pose.kneeL;
    rig.kneeR.rotation.x = pose.kneeR;
    rig.footL.rotation.x = -(pose.legLX + pose.kneeL);
    rig.footR.rotation.x = -(pose.legRX + pose.kneeR);
    const wiggle = Math.sin(time * 22) * 0.18 * pose.ears;
    rig.earL.rotation.z = wiggle;
    rig.earR.rotation.z = -wiggle;

    // Cara: parpadeo, pupilas que terminan de mirar y boca.
    const lid = brain.mode === 'dizzy' ? 0.45 : blinkLid(blink, dt);
    rig.eyeL.scale.y = lid;
    rig.eyeR.scale.y = lid;
    const px = clamp(lookYaw * w - pose.headYaw, -1, 1) * 0.012;
    const py = brain.mode === 'think' ? 0.014 : clamp(-lookPitch * w + pose.headPitch, -1, 1) * 0.01;
    rig.pupilL.position.set(px, py, 0.026);
    rig.pupilR.position.set(px, py, 0.026);
    rig.mouth.scale.setScalar(pose.mouth);
    rig.smile.visible = pose.mouth < 0.35;

    // Cola: sale hacia atrás y se enrosca en espiral; se mece sola.
    rig.tail[0].rotation.set(TAIL_BASE + pose.tailSway * 0.3, 0, pose.tailSway);
    for (let i = 1; i < TAIL.segments; i += 1) {
      rig.tail[i].rotation.x = TAIL_CURL[i] * pose.tailCurl + Math.sin(time * 2 + i * 0.6) * 0.04;
      rig.tail[i].rotation.z = pose.tailSway * 0.12;
    }

    // Mancha de contacto: se achica y aclara cuando está en el aire.
    const air = clamp(brain.y / CARRY_HEIGHT, 0, 1);
    blob.current.position.set(brain.x, 0.008, brain.z);
    blob.current.scale.setScalar(0.95 * (1 - air * 0.45));
    blob.current.material.opacity = 1 - air * 0.6;

    // Las sombras del cuarto se redibujan solo si algo se movió de verdad.
    if (!mobile && motion > 0.004) input.poke();
  });

  const setHover = (on) => {
    if (on === hovered.current || (on && input.isDragging())) return;
    hovered.current = on;
    if (on) input.hoverStart();
    else input.hoverEnd();
  };

  return (
    <>
      <group ref={root}>
        <group scale={TITI_SCALE}>
          <group ref={squash}>
            <TitiBody rig={rig} />
          </group>
          {/* Área de toque: un poco más grande que Titi, fácil en mobile */}
          <mesh
            position={[0, 0.5, 0.02]}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHover(true);
            }}
            onPointerOut={() => setHover(false)}
            onPointerDown={(e) => {
              const ev = e.nativeEvent;
              if (ev.pointerType === 'mouse' && ev.button !== 0) return;
              e.stopPropagation();
              input.grab();
              press.current = { id: ev.pointerId, x0: ev.clientX, y0: ev.clientY, carrying: false };
              setNdc(ev);
            }}
          >
            <capsuleGeometry args={[0.36, 0.5, 4, 10]} />
            <meshBasicMaterial visible={false} />
          </mesh>
        </group>
      </group>
      <mesh ref={blob} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={blobMap} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </>
  );
}
