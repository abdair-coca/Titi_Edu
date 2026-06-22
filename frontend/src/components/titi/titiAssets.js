// titiAssets — fuente única de verdad de la mascota Titi.
// Mapea cada ESTADO de animación a su archivo (GIF/APNG/WebP animado) en
// /public/titi/. Mientras un archivo no exista, el componente cae al PNG
// estático (/Titi.png), así la app nunca se rompe por falta del asset.
//
// Cómo agregar las animaciones:
//   1. Exportá cada animación como /public/titi/titi-<estado>.gif
//      (idealmente WebP animado o APNG con transparencia — ver public/titi/README.md).
//   2. Listo: el componente las toma automáticamente por su `state`.

const DIR = '/titi';

// estado → { src: animación, loop: si corre en loop infinito }
export const TITI_STATES = {
  // 6.4.1 PRUEBA: idle apunta a un placeholder .svg animado para validar el flujo.
  // Cuando exista el GIF real, cambiar a `${DIR}/titi-idle.gif`.
  idle:     { src: `${DIR}/titi-idle.gif`,     loop: true },
  celebra:  { src: `${DIR}/titi-celebra.gif`,  loop: false },
  triste:   { src: `${DIR}/titi-triste.gif`,   loop: false },
  racha:    { src: `${DIR}/titi-racha.gif`,    loop: true },
  saludo:   { src: `${DIR}/titi-saludo.gif`,   loop: false },
  pensando: { src: `${DIR}/titi-pensando.gif`, loop: true },
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
