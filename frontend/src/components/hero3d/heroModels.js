// Modelos 3D del hero de /courses (archivos en public/models/hero/, créditos en
// public/models/CREDITS.md). No importa three: lo usa Courses (chunk principal)
// para saber qué categorías tienen objeto antes de descargar la escena.
// Dónde va cada uno dentro de la habitación: `CATEGORY_SLOTS` en roomLayout.js.

export const HERO_MODELS = {
  programacion: { url: '/models/hero/programacion.glb' },
  idiomas: { url: '/models/hero/idiomas.glb' },
  matematicas: { url: '/models/hero/matematicas.glb' },
  diseno: { url: '/models/hero/diseno.glb' },
  ciencias: { url: '/models/hero/ciencias.glb' },
  negocios: { url: '/models/hero/negocios.glb' },
  humanidades: { url: '/models/hero/humanidades.glb' },
  musica: { url: '/models/hero/musica.glb' },
};
