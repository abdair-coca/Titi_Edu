import { Router } from 'express';
import prisma from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { gotasDeLaSemana } from '../services/gotas.service.js';

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

// ---- GET /api/gotas — saldo, total y gotas de la semana ----
router.get('/', requireAuth, async (req, res) => {
  try {
    const usuario = await loadCurrentUser(req, res);
    if (!usuario) return;
    const semana = await gotasDeLaSemana(usuario.id);
    res.json({
      success: true,
      data: { saldo: usuario.gotasSaldo, total: usuario.gotasTotal, semana },
    });
  } catch (err) {
    console.error('GET /gotas error', err);
    res.status(500).json({ success: false, message: 'Error obteniendo gotas' });
  }
});

// ---- GET /api/gotas/history — movimientos paginados (cursor por createdAt) ----
router.get('/history', requireAuth, async (req, res) => {
  try {
    const usuario = await loadCurrentUser(req, res);
    if (!usuario) return;

    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const cursor = (req.query.cursor ?? '').toString().trim() || null;

    const movimientos = await prisma.movimientoGota.findMany({
      where: {
        usuarioId: usuario.id,
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, cantidad: true, motivo: true, refId: true, createdAt: true },
    });

    const nextCursor =
      movimientos.length === limit ? movimientos[movimientos.length - 1].createdAt.toISOString() : null;

    res.json({ success: true, data: { movimientos, nextCursor } });
  } catch (err) {
    console.error('GET /gotas/history error', err);
    res.status(500).json({ success: false, message: 'Error obteniendo historial de gotas' });
  }
});

// ---- GET /api/gotas/activity — feed de actividad académica reciente ----
// Solo motivos académicos (leccion/evaluacion/curso) — sin gotas sociales.
// Resuelve los títulos con 3 queries `IN` batched (nunca N+1).
const MOTIVOS_ACTIVIDAD = ['leccion', 'evaluacion', 'curso'];

router.get('/activity', requireAuth, async (req, res) => {
  try {
    const usuario = await loadCurrentUser(req, res);
    if (!usuario) return;

    const limit = Math.min(30, Math.max(1, Number(req.query.limit) || 10));

    const movimientos = await prisma.movimientoGota.findMany({
      where: { usuarioId: usuario.id, motivo: { in: MOTIVOS_ACTIVIDAD } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { cantidad: true, motivo: true, refId: true, createdAt: true },
    });

    const idsPorTipo = { leccion: [], evaluacion: [], curso: [] };
    for (const m of movimientos) {
      if (m.refId) idsPorTipo[m.motivo]?.push(m.refId);
    }

    const [lecciones, evaluaciones, cursos] = await Promise.all([
      idsPorTipo.leccion.length
        ? prisma.leccion.findMany({ where: { id: { in: idsPorTipo.leccion } }, select: { id: true, titulo: true } })
        : [],
      idsPorTipo.evaluacion.length
        ? prisma.evaluacion.findMany({ where: { id: { in: idsPorTipo.evaluacion } }, select: { id: true, titulo: true } })
        : [],
      idsPorTipo.curso.length
        ? prisma.curso.findMany({ where: { id: { in: idsPorTipo.curso } }, select: { id: true, titulo: true } })
        : [],
    ]);

    const titulosPorTipo = {
      leccion: new Map(lecciones.map((l) => [l.id, l.titulo])),
      evaluacion: new Map(evaluaciones.map((e) => [e.id, e.titulo])),
      curso: new Map(cursos.map((c) => [c.id, c.titulo])),
    };

    const actividad = movimientos.map((m) => ({
      tipo: m.motivo,
      titulo: titulosPorTipo[m.motivo]?.get(m.refId) || 'Contenido eliminado',
      cantidad: m.cantidad,
      createdAt: m.createdAt,
    }));

    res.json({ success: true, data: { actividad } });
  } catch (err) {
    console.error('GET /gotas/activity error', err);
    res.status(500).json({ success: false, message: 'Error obteniendo actividad reciente' });
  }
});

export default router;
