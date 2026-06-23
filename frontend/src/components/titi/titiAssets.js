// titiAssets — fuente única de verdad de la mascota Titi.
// Mapea cada ESTADO de animación a su archivo (GIF/APNG/WebP animado) en
// /public/titi/. Mientras un archivo no exista, el componente cae al PNG
// estático (/Titi.png), así la app nunca se rompe por falta del asset.
//
// Cómo agregar las animaciones:
//   1. Exportá cada animación como WebP animado en /public/titi/titi-<estado>.webp
//      (transparencia suave, ~30x más liviano que GIF — ver public/titi/README.md).
//   2. Listo: el componente las toma automáticamente por su `state`.
//
// El campo `loop` es informativo + lo respeta TitiMascot: las animaciones con
// loop:false (celebra, triste, saludo) se exportan con loop-count=1 y el
// componente las re-dispara con `key` cada vez que cambia el estado.

const DIR = '/titi';

// estado → { src: animación, loop: si corre en loop infinito }
export const TITI_STATES = {
  idle:     { src: `${DIR}/titi-idle.webp`,     loop: true },
  celebra:  { src: `${DIR}/titi-celebra.webp`,  loop: false },
  triste:   { src: `${DIR}/titi-triste.webp`,   loop: false },
  racha:    { src: `${DIR}/titi-racha.webp`,    loop: true },
  saludo:   { src: `${DIR}/titi-saludo.webp`,   loop: false },
  pensando: { src: `${DIR}/titi-pensando.webp`, loop: true },
};

// El poster estático (y fallback universal) es el Titi.png de siempre.
export const TITI_POSTER = '/Titi.png';

// Los "moods" que ya usa la app mapean a un estado de animación.
export const MOOD_TO_STATE = {
  happy: 'celebra',
  celebrating: 'celebra',
  proud: 'celebra',
  surprised: 'celebra',
  sad: 'triste',
  motivating: 'idle',
  idle: 'idle',
  fire: 'racha',
};
