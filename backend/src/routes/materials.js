import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import prisma from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const materialsDir = path.join(__dirname, '..', 'uploads', 'materials');
if (!fs.existsSync(materialsDir)) fs.mkdirSync(materialsDir, { recursive: true });

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

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, materialsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ---- POST /api/lessons/:lessonId/materials — subir material (autor del curso) ----
router.post('/lessons/:lessonId/materials', requireAuth, upload.single('file'), async (req, res) => {
  try {
    const usuario = await loadCurrentUser(req, res);
    if (!usuario) {
      if (req.file) fs.promises.unlink(req.file.path).catch(() => {});
      return;
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Archivo requerido (campo "file")' });
    }

    const nombre = (req.body?.nombre ?? req.file.originalname).toString().trim();
    const tipo = (req.body?.tipo ?? 'otro').toString().trim();

    if (!TIPOS_VALIDOS.includes(tipo)) {
      fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(400).json({
        success: false,
        message: `tipo debe ser uno de: ${TIPOS_VALIDOS.join(', ')}`,
      });
    }

    const mimeRegex = TIPO_MIMETYPES[tipo];
    if (!mimeRegex.test(req.file.mimetype)) {
      fs.promises.unlink(req.file.path).catch(() => {});
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
      fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(404).json({ success: false, message: 'Lección no encontrada' });
    }
    if (leccion.modulo.curso.creadorId !== usuario.id) {
      fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(403).json({
        success: false,
        message: 'Solo el autor del curso puede subir materiales',
      });
    }

    const material = await prisma.material.create({
      data: {
        nombre,
        tipo,
        url: `/uploads/materials/${req.file.filename}`,
        leccionId: leccion.id,
      },
    });

    res.status(201).json({ success: true, data: { material } });
  } catch (err) {
    console.error('POST /lessons/:lessonId/materials error', err);
    if (req.file) fs.promises.unlink(req.file.path).catch(() => {});
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

    // Borrar archivo del disco si está en uploads/materials/
    if (material.url?.startsWith('/uploads/materials/')) {
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
