import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import prisma from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { cloudinaryEnabled, uploadBuffer, destroyAsset } from '../services/upload.service.js';

const router = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const materialsDir = path.join(__dirname, '..', 'uploads', 'materials');
if (!fs.existsSync(materialsDir)) fs.mkdirSync(materialsDir, { recursive: true });

// Cloudinary trata pdf/word/codigo como 'raw' y las imágenes como 'image'.
const resourceTypeFor = (tipo) => (tipo === 'imagen' ? 'image' : 'raw');

// Sube el material: Cloudinary si hay credenciales, disco si no.
// Devuelve { url, publicId } (publicId null en modo disco).
async function storeMaterial(file, tipo) {
  if (cloudinaryEnabled) {
    return uploadBuffer(file.buffer, 'titi/materials', resourceTypeFor(tipo));
  }
  const ext = path.extname(file.originalname).toLowerCase();
  const filename = `${randomUUID()}${ext}`;
  await fs.promises.writeFile(path.join(materialsDir, filename), file.buffer);
  return { url: `/uploads/materials/${filename}`, publicId: null };
}

async function loadCurrentUser(req, res) {
  if (req.dbUser) return req.dbUser;
  const usuario = await prisma.usuario.findUnique({ where: { neoId: req.user.id } });
  if (!usuario) {
    res.status(401).json({ success: false, message: 'Usuario no encontrado' });
    return null;
  }
  req.dbUser = usuario;
  return usuario;
}

const TIPOS_VALIDOS = ['pdf', 'word', 'imagen', 'codigo', 'otro'];

const TIPO_MIMETYPES = {
  pdf: /^application\/pdf$/,
  word: /^application\/(msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document)$/,
  imagen: /^image\/(jpeg|jpg|png|gif|webp)$/,
  codigo: /^(text\/.*|application\/(json|javascript|xml|x-python|x-sh|zip))$/,
  otro: /.*/,
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ---- POST /api/lessons/:lessonId/materials — subir material (autor del curso) ----
router.post('/lessons/:lessonId/materials', requireAuth, upload.single('file'), async (req, res) => {
  try {
    const usuario = await loadCurrentUser(req, res);
    if (!usuario) return;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Archivo requerido (campo "file")' });
    }

    const nombre = (req.body?.nombre ?? req.file.originalname).toString().trim();
    const tipo = (req.body?.tipo ?? 'otro').toString().trim();

    if (!TIPOS_VALIDOS.includes(tipo)) {
      return res.status(400).json({
        success: false,
        message: `tipo debe ser uno de: ${TIPOS_VALIDOS.join(', ')}`,
      });
    }

    const mimeRegex = TIPO_MIMETYPES[tipo];
    if (!mimeRegex.test(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: `El archivo no parece ser de tipo "${tipo}" (mimetype: ${req.file.mimetype})`,
      });
    }

    const leccion = await prisma.leccion.findUnique({
      where: { id: req.params.lessonId },
      include: { modulo: { include: { curso: { select: { creadorId: true } } } } },
    });
    if (!leccion) {
      return res.status(404).json({ success: false, message: 'Lección no encontrada' });
    }
    if (leccion.modulo.curso.creadorId !== usuario.id) {
      return res.status(403).json({
        success: false,
        message: 'Solo el autor del curso puede subir materiales',
      });
    }

    // Validación pasada → recién ahora subimos el archivo
    const { url, publicId } = await storeMaterial(req.file, tipo);

    const material = await prisma.material.create({
      data: {
        nombre,
        tipo,
        url,
        publicId,
        leccionId: leccion.id,
      },
    });

    res.status(201).json({ success: true, data: { material } });
  } catch (err) {
    console.error('POST /lessons/:lessonId/materials error', err);
    res.status(500).json({ success: false, message: 'Error subiendo material' });
  }
});

// ---- DELETE /api/materials/:id — borrar material (autor del curso) ----
router.delete('/materials/:id', requireAuth, async (req, res) => {
  try {
    const usuario = await loadCurrentUser(req, res);
    if (!usuario) return;

    const material = await prisma.material.findUnique({
      where: { id: req.params.id },
      include: {
        leccion: { include: { modulo: { include: { curso: { select: { creadorId: true } } } } } },
      },
    });
    if (!material) {
      return res.status(404).json({ success: false, message: 'Material no encontrado' });
    }
    if (material.leccion.modulo.curso.creadorId !== usuario.id && usuario.rol !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Solo el autor del curso puede borrar materiales',
      });
    }

    // Borra el asset: Cloudinary si hay publicId, disco si es legacy
    if (material.publicId) {
      await destroyAsset(material.publicId, resourceTypeFor(material.tipo));
    } else if (material.url?.startsWith('/uploads/materials/')) {
      const filePath = path.join(materialsDir, path.basename(material.url));
      fs.promises.unlink(filePath).catch(() => {});
    }

    await prisma.material.delete({ where: { id: material.id } });
    res.json({ success: true, data: { deleted: material.id } });
  } catch (err) {
    console.error('DELETE /materials/:id error', err);
    res.status(500).json({ success: false, message: 'Error borrando material' });
  }
});

export default router;
