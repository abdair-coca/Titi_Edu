// Aplica una pose (titiPoses) a las articulaciones del modelo (TitiBody).
// Lo usan Titi.jsx en cada frame y el laboratorio visual (titi-lab.html), así
// las capturas muestran exactamente lo mismo que el cuarto.
import { BONES, HIPS_SIT, HIPS_STAND, TAIL } from './titiLook.js';

// La cola sale hacia el costado, sube y termina en una espiral que se ve de
// frente (como en Titi.png): las últimas vueltas cierran casi un círculo.
// Curvatura de cada segmento respecto del anterior.
const TAIL_BASE = -1.62;
const TAIL_CURL = [0, 0.04, 0.04, 0.04, 0.05, 0.6, 0.6, 0.05, 0.05, 0.66, 0.74, 0.82, 0.9, 0.98];

const BROW_LIFT = 0.018; // cuánto suben las cejas con brow = 1 (unidades de la cabeza)
const BROW_TURN = 0.22; // y cuánto se inclinan (adentro arriba = sorpresa)

/**
 * @param {object} rig   Articulaciones guardadas por TitiBody.
 * @param {object} pose  Valores de POSE_KEYS (ya amortiguados).
 * @param {{ time: number, lid?: number, px?: number, py?: number, twitch?: number, ear?: number, tailLag?: number }} face
 *   time: reloj; lid: apertura de los párpados 0..1; px/py: desvío de pupilas;
 *   twitch: olfateo del bigote (-1..1); ear: sacudida de oreja (+ izq., - der.);
 *   tailLag: la cola se queda atrás al girar (radianes).
 */
export function applyPose(rig, pose, { time, lid = 1, px = 0, py = 0, twitch = 0, ear = 0, tailLag = 0 }) {
  // Respiración: el pecho se infla, la cabeza y los hombros acompañan apenas.
  const breath = Math.sin(time * 2.4);
  rig.hips.position.y = HIPS_STAND + (HIPS_SIT - HIPS_STAND) * pose.sit + pose.lift;
  rig.torso.rotation.set(pose.lean, 0, pose.roll);
  rig.chest.scale.set(1, 1 + breath * 0.018, 1 + breath * 0.012);
  rig.head.position.y = BONES.neckY + breath * 0.005;
  rig.head.rotation.set(pose.headPitch, pose.headYaw, pose.headRoll, 'YXZ');
  rig.armL.rotation.set(pose.armLX, 0, pose.armLZ + breath * 0.015);
  rig.armR.rotation.set(pose.armRX, 0, pose.armRZ - breath * 0.015);
  rig.elbowL.rotation.x = pose.elbowL;
  rig.elbowR.rotation.x = pose.elbowR;
  rig.legL.rotation.x = pose.legLX;
  rig.legR.rotation.x = pose.legRX;
  rig.kneeL.rotation.x = pose.kneeL;
  rig.kneeR.rotation.x = pose.kneeR;
  rig.footL.rotation.x = -(pose.legLX + pose.kneeL);
  rig.footR.rotation.x = -(pose.legRX + pose.kneeR);
  const wiggle = Math.sin(time * 22) * 0.18 * pose.ears;
  rig.earL.rotation.z = wiggle + Math.max(0, ear) * 0.45;
  rig.earR.rotation.z = -wiggle - Math.max(0, -ear) * 0.45;

  // Ojos y cejas.
  rig.eyeL.scale.y = lid;
  rig.eyeR.scale.y = lid;
  rig.pupilL.position.set(px, py, 0.026);
  rig.pupilR.position.set(px, py, 0.026);
  // Al parpadear las cejas bajan un poquito (se lee como un párpado de verdad).
  const blinkDip = (1 - lid) * 0.006;
  rig.browL.position.y = BROW_LIFT * (pose.brow + pose.browTilt * 0.9) - blinkDip;
  rig.browR.position.y = BROW_LIFT * (pose.brow - pose.browTilt * 0.9) - blinkDip;
  rig.browL.rotation.z = -BROW_TURN * pose.brow - 0.12 * pose.browTilt;
  rig.browR.rotation.z = BROW_TURN * pose.brow - 0.12 * pose.browTilt;

  // Boca, bigote y chivita.
  rig.mouth.scale.setScalar(pose.mouth);
  rig.smile.visible = pose.mouth < 0.35;
  const stache = pose.stache * 0.2 + twitch * 0.09 + breath * 0.02 + pose.mouth * 0.1;
  rig.mustacheL.rotation.set(0, twitch * 0.05, stache);
  rig.mustacheR.rotation.set(0, -twitch * 0.05, -stache);
  rig.goatee.rotation.set(-0.3 * pose.mouth + Math.sin(time * 1.7) * 0.04, 0, twitch * 0.06);

  // Cola: sale hacia atrás y se enrosca en espiral; se mece sola con una onda
  // que viaja de la base a la punta, y se queda atrás un instante al girar.
  rig.tail[0].rotation.set(TAIL_BASE + pose.tailSway * 0.3, 0, pose.tailSway + tailLag);
  const n = TAIL.segments;
  for (let i = 1; i < n; i += 1) {
    const along = i / n;
    rig.tail[i].rotation.x = TAIL_CURL[i] * pose.tailCurl + Math.sin(time * 2 - i * 0.55) * 0.045 * (0.4 + along);
    rig.tail[i].rotation.z = pose.tailSway * 0.12 + Math.sin(time * 1.6 - i * 0.5) * 0.04 * along + tailLag * 0.25 * (1 - along);
  }
}
