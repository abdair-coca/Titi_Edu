import { Router } from 'express';
import prisma from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { misionesDeHoy } from '../services/mision.service.js';

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

// ---- GET /api/missions/today — las 3 misiones de hoy (las asigna si faltan) ----
router.get('/today', requireAuth, async (req, res) => {
  try {
    const usuario = await loadCurrentUser(req, res);
    if (!usuario) return;
    const misiones = await misionesDeHoy(usuario.id);
    res.json({
      success: true,
      data: {
        misiones: misiones.map((mu) => ({
          id: mu.id,
          codigo: mu.mision.codigo,
          titulo: mu.mision.titulo,
          descripcion: mu.mision.descripcion,
          meta: mu.mision.meta,
          recompensa: mu.mision.recompensa,
          progreso: mu.progreso,
          completada: mu.completada,
        })),
      },
    });
  } catch (err) {
    console.error('GET /missions/today error', err);
    res.status(500).json({ success: false, message: 'Error obteniendo misiones' });
  }
});

export default router;
