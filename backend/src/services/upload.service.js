import { v2 as cloudinary } from 'cloudinary';

// Helper de almacenamiento — concentra la subida/borrado contra Cloudinary.
// Patrón espejo del de Neo4j (neo4j-sync.service.js): el resto del código
// llama estas funciones sin conocer el SDK.
//
// Si faltan credenciales, `cloudinaryEnabled` queda en false y las rutas
// caen a disco local (solo dev) en vez de romper el flujo de quien clona
// el repo sin una cuenta de Cloudinary.

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;

export const cloudinaryEnabled = Boolean(CLOUD_NAME && API_KEY && API_SECRET);

if (cloudinaryEnabled) {
  cloudinary.config({
    cloud_name: CLOUD_NAME,
    api_key: API_KEY,
    api_secret: API_SECRET,
  });
} else {
  console.warn(
    'Cloudinary sin credenciales — los archivos caen a disco local (solo dev). ' +
    'Configurá CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET.'
  );
}

/**
 * Sube un buffer (multer memoryStorage) a Cloudinary.
 * @param {Buffer} buffer - contenido del archivo
 * @param {string} folder - carpeta destino, ej. 'titi/posts' | 'titi/materials'
 * @param {'auto'|'image'|'raw'|'video'} resourceType - tipo de recurso
 * @returns {Promise<{ url: string, publicId: string }>}
 */
export function uploadBuffer(buffer, folder, resourceType = 'auto') {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType },
      (err, result) => {
        if (err) return reject(err);
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(buffer);
  });
}

/**
 * Borra un asset de Cloudinary por publicId.
 * try/catch que loguea pero no rompe (igual que la sync de Neo4j): borrar
 * el row no debe fallar porque el asset remoto ya no esté.
 * @param {string} publicId
 * @param {'image'|'raw'|'video'} resourceType
 */
export async function destroyAsset(publicId, resourceType = 'image') {
  if (!cloudinaryEnabled || !publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (err) {
    console.error('No se pudo borrar asset de Cloudinary:', err);
  }
}
