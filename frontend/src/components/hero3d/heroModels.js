// Modelos 3D del hero de /courses (archivos en public/models/hero/, créditos en
// public/models/CREDITS.md). No importa three: lo usa Courses (chunk principal)
// para saber qué categorías tienen objeto antes de descargar la escena.
//
// `rotation` orienta cada modelo hacia la cámara (radianes, [x, y, z]); los
// modelos vienen de autores distintos y no comparten frente.

export const HERO_MODELS = {
  programacion: { url: '/models/hero/programacion.glb', rotation: [0.35, 2.6, 0] },
  idiomas: { url: '/models/hero/idiomas.glb', rotation: [0.1, -0.4, 0] },
  matematicas: { url: '/models/hero/matematicas.glb', rotation: [0.6, -0.3, 0] },
  diseno: { url: '/models/hero/diseno.glb', rotation: [1.0, 0, 0.2] },
  ciencias: { url: '/models/hero/ciencias.glb', rotation: [0.1, 0, 0] },
  negocios: { url: '/models/hero/negocios.glb', rotation: [0.15, -0.5, 0] },
  humanidades: { url: '/models/hero/humanidades.glb', rotation: [0.15, -0.4, 0] },
  musica: { url: '/models/hero/musica.glb', rotation: [0.1, 1.57, -0.45] },
};

// Cuántos objetos entran según el ancho (spec H2): desktop hasta 8, mobile 4.
export const HERO_MAX_OBJECTS = { desktop: 8, mobile: 4 };
