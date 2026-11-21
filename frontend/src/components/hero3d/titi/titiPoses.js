// Poses de Titi: para cada modo devuelve los ángulos objetivo de cada
// articulación (radianes). El modelo se acerca a esos valores con
// amortiguación, así que pasar de un modo a otro siempre es suave.
// Sin three: funciones puras, testeables en Node.
//
// Reposo vivo: la cabeza nunca queda clavada; deriva despacio (suma de senos
// con períodos que no se repiten seguido).
const idleHead = (time) => ({
  headYaw: Math.sin(time * 0.43) * 0.06 + Math.sin(time * 0.17 + 1.3) * 0.05,
  headPitch: Math.sin(time * 0.31 + 0.7) * 0.035,
  headRoll: Math.sin(time * 0.37 + 2.1) * 0.05,
});

// Convención: brazo/pierna "L" es el lado +x (izquierdo de Titi). En los
// brazos, rotar en x negativo los lleva hacia adelante; en z, hacia afuera es
// +z para L y -z para R. En el cuello, pitch negativo mira hacia arriba.

export const POSE_KEYS = [
  'sit', 'lift', 'lean', 'roll',
  'headYaw', 'headPitch', 'headRoll',
  'armLX', 'armLZ', 'elbowL', 'armRX', 'armRZ', 'elbowR',
  'legLX', 'kneeL', 'legRX', 'kneeR',
  'tailCurl', 'tailSway', 'mouth', 'ears',
  'brow', 'browTilt', 'stache',
];

const SIT = {
  sit: 1, lift: 0, lean: 0, roll: 0,
  headYaw: 0, headPitch: 0, headRoll: 0,
  armLX: -0.3, armLZ: -0.2, elbowL: -0.05,
  armRX: -0.3, armRZ: 0.2, elbowR: -0.05,
  legLX: -1.5, kneeL: 1.5, legRX: -1.5, kneeR: 1.5,
  tailCurl: 1, tailSway: 0, mouth: 0, ears: 0,
  // Cara: brow sube (+) o frunce (-) las cejas; browTilt levanta una sola
  // (la izquierda con +); stache levanta (+) o baja (-) las puntas del bigote.
  brow: 0, browTilt: 0, stache: 0,
};

const STAND = {
  ...SIT,
  sit: 0,
  armLX: 0.05, armLZ: 0.16, elbowL: -0.2,
  armRX: 0.05, armRZ: -0.16, elbowR: -0.2,
  legLX: 0, kneeL: 0, legRX: 0, kneeR: 0,
};

/** Pose neutra (para inicializar el estado del modelo). */
export const restPose = () => ({ ...SIT });

/**
 * @param {string} mode  Modo del cerebro (titiBrain): sit, stand, walk, wave, think, celebrate, carried, fall, land, dizzy.
 * @param {number} t     Segundos dentro del modo.
 * @param {{ time: number, phase: number, speed: number, swayX?: number, swayZ?: number }} ctx
 *   time: reloj global; phase/speed: ciclo de paso; swayX/Z: velocidad al cargarlo.
 */
export function poseFor(mode, t, ctx) {
  const { time, phase = 0, speed = 0, swayX = 0, swayZ = 0 } = ctx;
  const tail = Math.sin(time * 1.4) * 0.08;

  switch (mode) {
    case 'walk': {
      const s = Math.sin(phase);
      const k = Math.min(1, speed * 2.2); // a menos velocidad, pasos más cortos
      return {
        ...STAND,
        lift: Math.abs(Math.cos(phase)) * 0.025 * k,
        lean: 0.08 * k,
        roll: s * 0.07 * k,
        legLX: s * 0.6 * k,
        kneeL: Math.max(0, -Math.cos(phase)) * 0.8 * k,
        legRX: -s * 0.6 * k,
        kneeR: Math.max(0, Math.cos(phase)) * 0.8 * k,
        armLX: -s * 0.45 * k,
        armRX: s * 0.45 * k,
        headRoll: -s * 0.04 * k,
        headPitch: Math.abs(s) * 0.03 * k,
        tailSway: s * 0.18 * k,
        tailCurl: 0.85,
        stache: Math.abs(Math.cos(phase)) * 0.25 * k - 0.1,
      };
    }
    case 'stand':
      // Mira a su alrededor (la mirada la suma el modelo).
      return { ...STAND, ...idleHead(time), headYaw: Math.sin(t * 0.9) * 0.5, tailSway: tail, brow: 0.25 };
    case 'wave':
      // Saluda con la mano izquierda (queda a la derecha de la pantalla).
      return {
        ...STAND,
        armLX: -0.25, armLZ: 2.45 + Math.sin(t * 11) * 0.28, elbowL: -0.35,
        headRoll: -0.12, mouth: 0.3, tailSway: tail * 2, ears: 1,
        brow: 0.6, stache: 0.55 + Math.sin(t * 11) * 0.08,
      };
    case 'think':
      // Mano en el mentón y la vista arriba, como curiousTiti.
      return {
        ...STAND,
        armRX: -1.05, armRZ: 0.55, elbowR: -2.15,
        armLX: 0.15, armLZ: 0.45, elbowL: -1.3,
        headPitch: -0.28, headRoll: 0.12, tailSway: tail,
        brow: 0.1, browTilt: 1, stache: -0.25 + Math.sin(t * 3) * 0.06,
      };
    case 'celebrate': {
      // Brazos arriba y dos saltitos, como celebrationTiti.
      const hop = t < 0.9 ? Math.abs(Math.sin((t / 0.45) * Math.PI)) * 0.16 : 0;
      return {
        ...STAND,
        lift: hop,
        armLX: -0.2, armLZ: 2.65 + Math.sin(t * 14) * 0.12, elbowL: -0.25,
        armRX: -0.2, armRZ: -2.65 - Math.sin(t * 14) * 0.12, elbowR: -0.25,
        legLX: hop > 0.02 ? -0.35 : 0, kneeL: hop > 0.02 ? 0.6 : 0,
        legRX: hop > 0.02 ? -0.35 : 0, kneeR: hop > 0.02 ? 0.6 : 0,
        headPitch: -0.12, mouth: 1, tailCurl: 1.25, tailSway: Math.sin(t * 12) * 0.25, ears: 1,
        brow: 1, stache: 0.9 + Math.sin(t * 14) * 0.15,
      };
    }
    case 'carried':
    case 'fall': {
      // Colgando: piernas que se balancean, brazos agitados, boca en "o".
      const flail = Math.sin(time * 9) * 0.22;
      const arms = mode === 'fall' ? 1.7 : 2.35;
      return {
        ...STAND,
        lean: -swayZ * 0.6,
        roll: swayX * 0.6,
        armLX: -0.3, armLZ: arms + flail, elbowL: -0.4,
        armRX: -0.3, armRZ: -arms + flail, elbowR: -0.4,
        legLX: -0.25 + Math.sin(time * 4) * 0.3 - swayZ, kneeL: 0.45,
        legRX: -0.25 - Math.sin(time * 4) * 0.3 - swayZ, kneeR: 0.45,
        headPitch: 0.15, mouth: 0.8,
        tailCurl: 0.6, tailSway: Math.sin(time * 5) * 0.35 - swayX * 2,
        brow: 1, stache: -0.4 + Math.sin(time * 9) * 0.25,
      };
    }
    case 'land':
      return { ...SIT, armLZ: 0.6, armRZ: -0.6, armLX: -0.2, armRX: -0.2, mouth: 0.6, tailCurl: 0.8, brow: -0.8, stache: 0.7 };
    case 'dizzy': {
      // Sacude la cabeza tras la caída, cada vez menos.
      const fade = Math.max(0, 1 - t / 1.1);
      return {
        ...SIT,
        headRoll: Math.sin(t * 13) * 0.3 * fade,
        headYaw: Math.sin(t * 6.5) * 0.25 * fade,
        mouth: 0.25 * fade,
        brow: -0.3 * fade,
        browTilt: Math.sin(t * 9) * fade,
        stache: Math.sin(t * 13 + 1) * 0.5 * fade,
      };
    }
    case 'sit':
    default:
      return { ...SIT, ...idleHead(time), tailSway: tail };
  }
}
