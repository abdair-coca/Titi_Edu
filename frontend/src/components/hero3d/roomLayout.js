// Medidas, colores y ubicaciones de la habitación 3D del hero (chunk diferido).
//
// Coordenadas en unidades de mundo: el piso va de -3 a 3 en x y z, con la pared
// del fondo en z = -3 y la pared izquierda en x = -3. La cámara mira desde +x +z
// (vista isométrica), así que las dos paredes quedan detrás de los muebles.

export const ROOM = {
  half: 3, // medio lado del piso
  wallHeight: 3.9,
  wallThickness: 0.28,
  floorThickness: 0.36,
  deskHeight: 1.42,
};

// Paleta Titi + maderas cálidas. Solo vive en el render WebGL; la UI sigue plana.
export const COLORS = {
  yellow: '#FFD93D',
  yellowLight: '#FFF3B0',
  yellowDark: '#E6B800',
  cream: '#FFFBF0',
  dark: '#1A1A2E',
  darkMid: '#16213E',
  streak: '#FF6B35',
  achievement: '#A855F7',
  certificate: '#F59E0B',
  woodLight: '#F2C894',
  wood: '#E9B57C',
  woodDark: '#A86B3C',
  leaf: '#3FAE5A',
  leafDark: '#2E8B47',
  sky: '#BFE3FF',
};

// Dónde va cada objeto de categoría dentro de la habitación.
// - position: punto de apoyo (la base del modelo queda sobre ese punto).
// - rotation: orientación del modelo en radianes [x, y, z].
// - size: lado más largo del modelo ya orientado.
export const CATEGORY_SLOTS = {
  programacion: { position: [1.05, ROOM.deskHeight, -2.35], rotation: [0, 3.0, 0], size: 0.95 },
  matematicas: { position: [2.25, ROOM.deskHeight, -2.05], rotation: [0.25, -0.5, 0], size: 0.68 },
  humanidades: { position: [-2.72, 2.62, -1.25], rotation: [0, Math.PI / 2, 0], size: 0.95 },
  idiomas: { position: [-2.7, 1.72, -1.85], rotation: [0, 0.6, 0], size: 0.7 },
  ciencias: { position: [-2.7, 1.72, -0.72], rotation: [0, 0, 0], size: 0.56 },
  diseno: { position: [-1.05, 0.64, 2.0], rotation: [0, 0.5, 0], size: 0.62 },
  negocios: { position: [2.55, 0, -0.65], rotation: [0, -1.2, 0], size: 0.85 },
  musica: { position: [-1.35, 0, -2.62], rotation: [-0.22, Math.PI / 2, 0], size: 1.95 },
};

// Dirección desde la que mira la cámara isométrica (desde +x +z, en alto).
export const CAMERA_DIR = [1, 0.86, 1];

// Rango del giro al arrastrar y de la paralaje del puntero (radianes).
export const CONTROLS = {
  maxYaw: 0.6, // ±35°
  dragSpeed: 1.7, // radianes por ancho del lienzo arrastrado
  parallaxYaw: 0.06,
  parallaxPitch: 0.035,
  returnAfterMs: 4000,
};
