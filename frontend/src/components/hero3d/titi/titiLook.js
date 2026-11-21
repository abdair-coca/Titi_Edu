// Colores y medidas de Titi 3D, tomados de /Titi.png y de las animaciones de
// public/titi/ (fuente de verdad del personaje). Sin three: lo usan el modelo,
// las poses y los tests.
//
// Unidades "de modelo": Titi sentado mide ~1 de alto; en el cuarto se escala con
// TITI_SCALE. Titi mira hacia +z; su lado izquierdo (lado = +1) queda en +x.

export const TITI_COLORS = {
  fur: '#FBCA2F', // pelaje (muestra del pecho y la frente)
  mask: '#FCDC55', // antifaz claro alrededor de ojos y hocico
  belly: '#FDDF6E', // panza clara (animaciones celebra / curioso)
  earInner: '#DB9A0A',
  skin: '#CA855B', // manos y pies
  white: '#FDFDF1', // bigote, cejas, chivita y ojos
  eye: '#171C32', // pupilas y nariz
  mouth: '#C47F3C',
  mouthInside: '#7A2E2E',
  // Contornos: versión oscura y cálida de cada color (nunca negro puro).
  lineFur: '#9A5B06',
  lineWhite: '#B9AC93',
  lineSkin: '#7E4528',
};

export const TITI_SCALE = 1.1;

// Largo de cada hueso y posición de las articulaciones.
export const BONES = {
  hipJointY: 0.04, // cadera respecto del centro de la pelvis
  hipJointX: 0.145,
  thigh: 0.18,
  shin: 0.16,
  foot: 0.035, // alto del pie apoyado
  shoulderY: 0.34,
  shoulderX: 0.14,
  shoulderZ: 0.09,
  upperArm: 0.23,
  forearm: 0.22,
  neckY: 0.4,
  headY: 0.19, // del cuello al centro de la cabeza
};

// Altura de la pelvis sentado (muslos horizontales, canillas verticales) y de
// pie (piernas estiradas). El pose "sit" interpola entre las dos.
export const HIPS_SIT = BONES.shin + BONES.foot - BONES.hipJointY;
export const HIPS_STAND = BONES.thigh + BONES.shin + BONES.foot - BONES.hipJointY;

// Muchos huesos cortos: cada articulación dobla poco y la malla no se pellizca
// en la parte de adentro de la espiral.
export const TAIL = {
  segments: 20,
  length: 0.049,
  radius: [0.038, 0.031], // de la base a la punta (casi pareja hasta el final, como en la imagen)
};
