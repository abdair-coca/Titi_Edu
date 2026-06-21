import { Router } from 'express';
import prisma from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { rankingAmigos, cerrarSemanaYPremiar } from '../services/ranking.service.js';

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

// ---- GET /api/ranking/friends — leaderboard semanal de amigos + mi posición ----
// De paso cierra/premia la semana pasada (lazy) si corresponde.
router.get('/friends', requireAuth, async (req, res) => {
  try {
    const usuario = await loadCurrentUser(req, res);
    if (!usuario) return;
    const premio = await cerrarSemanaYPremiar(usuario);
    const { tabla, miPosicion } = await rankingAmigos(usuario);
    res.json({ success: true, data: { tabla, miPosicion, premio } });
  } catch (err) {
    console.error('GET /ranking/friends error', err);
    res.status(500).json({ success: false, message: 'Error obteniendo el ranking' });
  }
});

export default router;
