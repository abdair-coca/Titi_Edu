// titiAssets — fuente única de verdad de la mascota Titi.
// Mapea cada ESTADO de animación a su archivo (GIF/APNG/WebP animado) en
// /public/titi/. Mientras un archivo no exista, el componente cae al PNG
// estático (/Titi.png), así la app nunca se rompe por falta del asset.
//
// Cómo agregar/cambiar animaciones:
//   1. Poné el WebP animado en /public/titi/ (cualquier nombre — los actuales son
//      idleTiti / celebrationTiti / sadTiti / streakTiti / grettingTiti / curiousTiti).
//   2. Apuntá el `src` del estado correspondiente acá abajo. El componente la toma
//      automáticamente por su `state`.
//
// El campo `loop` es informativo + lo respeta TitiMascot: las animaciones con
// loop:false (celebra, triste, saludo) se exportan con loop-count=1 y el
// componente las re-dispara con `key` cada vez que cambia el estado.

const DIR = '/titi';

// estado → { src: animación, loop: si corre en loop infinito }
// Los archivos conservan los nombres con que se exportaron (no se renombran).
export const TITI_STATES = {
  idle:     { src: `${DIR}/idleTiti.webp`,        loop: true },
  celebra:  { src: `${DIR}/celebrationTiti.webp`, loop: false },
  triste:   { src: `${DIR}/sadTiti.webp`,         loop: false },
  racha:    { src: `${DIR}/streakTiti.webp`,      loop: true },
  saludo:   { src: `${DIR}/grettingTiti.webp`,    loop: false },
  pensando: { src: `${DIR}/curiousTiti.webp`,     loop: true },
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
