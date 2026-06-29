import { Router } from 'express';
import prisma from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { catalogoConInventario, inventarioDe, comprarItem, activarMultiplicador } from '../services/tienda.service.js';

const router = Router();

// El JWT lleva el id de Neo4j; en Postgres vive en Usuario.neoId.
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

// ---- GET /api/shop/items — catálogo activo + mi cantidad por ítem ----
router.get('/items', requireAuth, async (req, res) => {
  try {
    const usuario = await loadCurrentUser(req, res);
    if (!usuario) return;
    const items = await catalogoConInventario(usuario.id);
    res.json({ success: true, data: { items, saldo: usuario.gotasSaldo } });
  } catch (err) {
    console.error('GET /shop/items error', err);
    res.status(500).json({ success: false, message: 'Error obteniendo la tienda' });
  }
});

// ---- GET /api/shop/inventory — mi inventario de consumibles ----
router.get('/inventory', requireAuth, async (req, res) => {
  try {
    const usuario = await loadCurrentUser(req, res);
    if (!usuario) return;
    const items = await inventarioDe(usuario.id);
    res.json({ success: true, data: { items } });
  } catch (err) {
    console.error('GET /shop/inventory error', err);
    res.status(500).json({ success: false, message: 'Error obteniendo el inventario' });
  }
});

// ---- POST /api/shop/buy — comprar un ítem (debita gotas) ----
router.post('/buy', requireAuth, async (req, res) => {
  try {
    const usuario = await loadCurrentUser(req, res);
    if (!usuario) return;
    const codigo = (req.body?.codigo ?? '').toString().trim();
    if (!codigo) {
      return res.status(400).json({ success: false, message: 'Falta el código del ítem' });
    }

    const r = await comprarItem(usuario.id, codigo);
    if (!r.ok) {
      const map = {
        no_encontrado: [404, 'Ese ítem no existe o no está disponible'],
        saldo: [409, 'No tenés gotas suficientes para comprar este ítem'],
        stack: [409, 'Ya tenés el máximo de este ítem'],
      };
      const [status, message] = map[r.error] || [400, 'No se pudo completar la compra'];
      return res.status(status).json({ success: false, message });
    }

    res.json({ success: true, data: { saldo: r.saldo, cantidad: r.cantidad } });
  } catch (err) {
    console.error('POST /shop/buy error', err);
    res.status(500).json({ success: false, message: 'Error procesando la compra' });
  }
});

// ---- POST /api/shop/use — uso manual de un consumible ----
// Solo aplica a 'multiplicador_gotas' (abre la ventana x2). 'congelar_racha' e
// 'intento_extra' se consumen solos en su trigger, no por acá.
router.post('/use', requireAuth, async (req, res) => {
  try {
    const usuario = await loadCurrentUser(req, res);
    if (!usuario) return;
    const codigo = (req.body?.codigo ?? '').toString().trim();
    if (!codigo) {
      return res.status(400).json({ success: false, message: 'Falta el código del ítem' });
    }

    if (codigo === 'multiplicador_gotas') {
      const r = await activarMultiplicador(usuario.id);
      if (!r.ok) {
        return res.status(409).json({ success: false, message: 'No tenés un multiplicador para usar' });
      }
      return res.json({ success: true, data: { multiplicadorHasta: r.hasta } });
    }

    return res.status(400).json({
      success: false,
      message: 'Este ítem se usa automáticamente cuando corresponde',
    });
  } catch (err) {
    console.error('POST /shop/use error', err);
    res.status(500).json({ success: false, message: 'Error usando el ítem' });
  }
});

export default router;
