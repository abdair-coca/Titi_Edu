import { Router } from 'express';
import prisma from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

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

function requireRole(...roles) {
  return async (req, res, next) => {
    try {
      const usuario = await loadCurrentUser(req, res);
      if (!usuario) return;
      if (!roles.includes(usuario.rol)) {
        return res.status(403).json({ success: false, message: 'No tienes permiso para esta acción' });
      }
      next();
    } catch (err) {
      console.error('requireRole error', err);
      res.status(500).json({ success: false, message: 'Error verificando permisos' });
    }
  };
}

// ---- GET / — público ----
router.get('/', async (req, res) => {
  try {
    const categorias = await prisma.categoria.findMany({
      orderBy: { nombre: 'asc' },
      include: { _count: { select: { cursos: true } } },
    });
    res.json({ success: true, data: { categorias } });
  } catch (err) {
    console.error('GET /categories error', err);
    res.status(500).json({ success: false, message: 'Error obteniendo categorías' });
  }
});

// ---- POST / — ADMIN (preparado para Etapa 4) ----
router.post('/', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const { nombre, icono } = req.body || {};
    if (!nombre || !icono) {
      return res.status(400).json({ success: false, message: 'nombre e icono son requeridos' });
    }
    try {
      const categoria = await prisma.categoria.create({
        data: { nombre: String(nombre).trim(), icono: String(icono).trim() },
      });
      res.status(201).json({ success: true, data: { categoria } });
    } catch (err) {
      if (err.code === 'P2002') {
        return res.status(409).json({ success: false, message: 'Ya existe una categoría con ese nombre' });
      }
      throw err;
    }
  } catch (err) {
    console.error('POST /categories error', err);
    res.status(500).json({ success: false, message: 'Error creando categoría' });
  }
});

export default router;
