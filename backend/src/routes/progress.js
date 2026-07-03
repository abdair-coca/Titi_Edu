import { Router } from 'express';
import prisma from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { rachaEstaActiva } from '../services/progress.service.js';

const router = Router();

// --- Helpers ---

// El JWT actual lleva el id de Neo4j. En Postgres ese id vive en `Usuario.neoId`.
async function loadCurrentUser(req, res) {
  if (req.dbUser) return req.dbUser;
  const usuario = await prisma.usuario.findUnique({
    where: { neoId: req.user.id },
  });
  if (!usuario) {
    res.status(401).json({ success: false, message: 'Usuario no encontrado' });
    return null;
  }
  req.dbUser = usuario;
  return usuario;
}

/** Catálogo completo de logros con flag de desbloqueo para un usuario. */
async function buildAchievements(usuarioId) {
  const [logros, mios] = await Promise.all([
    prisma.logro.findMany({ orderBy: { nombre: 'asc' } }),
    prisma.logroUsuario.findMany({ where: { usuarioId } }),
  ]);
  const fechaPorLogro = new Map(mios.map((m) => [m.logroId, m.fechaObtenido]));
  return logros.map((l) => ({
    id: l.id,
    nombre: l.nombre,
    descripcion: l.descripcion,
    icono: l.icono,
    tipo: l.tipo,
    condicion: l.condicion,
    desbloqueado: fechaPorLogro.has(l.id),
    fechaObtenido: fechaPorLogro.get(l.id) ?? null,
  }));
}

// ---- GET /api/progress/streak — mi racha actual ----
router.get('/streak', requireAuth, async (req, res) => {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { neoId: req.user.id },
      select: { racha: true, ultimaActividad: true },
    });
    if (!usuario) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }
    res.json({
      success: true,
      data: {
        racha: usuario.racha,
        ultimaActividad: usuario.ultimaActividad,
        estaActiva: rachaEstaActiva(usuario.ultimaActividad),
      },
    });
  } catch (err) {
    console.error('GET /progress/streak error', err);
    res.status(500).json({ success: false, message: 'Error obteniendo racha' });
  }
});

// ---- GET /api/progress/achievements — mis logros (catálogo + desbloqueados) ----
router.get('/achievements', requireAuth, async (req, res) => {
  try {
    const usuario = await loadCurrentUser(req, res);
    if (!usuario) return;
    const logros = await buildAchievements(usuario.id);
    res.json({ success: true, data: { logros } });
  } catch (err) {
    console.error('GET /progress/achievements error', err);
    res.status(500).json({ success: false, message: 'Error obteniendo logros' });
  }
});

// ---- GET /api/progress/certificates — mis certificados ----
router.get('/certificates', requireAuth, async (req, res) => {
  try {
    const usuario = await loadCurrentUser(req, res);
    if (!usuario) return;

    const certificados = await prisma.certificado.findMany({
      where: { usuarioId: usuario.id },
      orderBy: { fechaEmision: 'desc' },
      include: {
        curso: {
          select: {
            id: true,
            titulo: true,
            portadaUrl: true,
            categoria: { select: { nombre: true, icono: true } },
          },
        },
      },
    });

    res.json({ success: true, data: { certificados } });
  } catch (err) {
    console.error('GET /progress/certificates error', err);
    res.status(500).json({ success: false, message: 'Error obteniendo certificados' });
  }
});

// ---- GET /api/progress/certificates/verify/:codigo — verificación pública ----
router.get('/certificates/verify/:codigo', async (req, res) => {
  try {
    const certificado = await prisma.certificado.findUnique({
      where: { codigoVerif: req.params.codigo },
      include: {
        curso: { select: { id: true, titulo: true } },
        usuario: { select: { username: true } },
      },
    });
    if (!certificado) {
      return res.status(404).json({
        success: false,
        message: 'Certificado no encontrado. Verificá que el código sea correcto.',
      });
    }
    res.json({
      success: true,
      data: {
        certificado: {
          codigoVerif: certificado.codigoVerif,
          fechaEmision: certificado.fechaEmision,
          curso: certificado.curso,
          username: certificado.usuario.username,
        },
      },
    });
  } catch (err) {
    console.error('GET /progress/certificates/verify/:codigo error', err);
    res.status(500).json({ success: false, message: 'Error verificando certificado' });
  }
});

// ---- GET /api/progress/certificate/:courseId — mi certificado de un curso ----
router.get('/certificate/:courseId', requireAuth, async (req, res) => {
  try {
    const usuario = await loadCurrentUser(req, res);
    if (!usuario) return;

    const certificado = await prisma.certificado.findFirst({
      where: { usuarioId: usuario.id, cursoId: req.params.courseId },
      include: { curso: { select: { id: true, titulo: true } } },
    });
    if (!certificado) {
      return res.status(404).json({
        success: false,
        message: 'Aún no tenés certificado de este curso',
      });
    }
    res.json({ success: true, data: { certificado } });
  } catch (err) {
    console.error('GET /progress/certificate/:courseId error', err);
    res.status(500).json({ success: false, message: 'Error obteniendo certificado' });
  }
});

// ---- GET /api/progress/:username/achievements — logros de un usuario (requiere login) ----
router.get('/:username/achievements', requireAuth, async (req, res) => {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { username: req.params.username },
      select: { id: true },
    });
    if (!usuario) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }
    const logros = await buildAchievements(usuario.id);
    res.json({ success: true, data: { logros } });
  } catch (err) {
    console.error('GET /progress/:username/achievements error', err);
    res.status(500).json({ success: false, message: 'Error obteniendo logros' });
  }
});

// ---- GET /api/progress/:username/streak — racha de un usuario (requiere login) ----
router.get('/:username/streak', requireAuth, async (req, res) => {
  try {
    const { username } = req.params;

    const usuario = await prisma.usuario.findUnique({
      where: { username },
      select: {
        racha: true,
        ultimaActividad: true,
      },
    });
    if (!usuario) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }
    res.json({
      success: true,
      data: {
        racha: usuario.racha,
        ultimaActividad: usuario.ultimaActividad,
        estaActiva: rachaEstaActiva(usuario.ultimaActividad),
      },
    });
  } catch (err) {
    console.error('GET /progress/:username/streak error', err);
    res.status(500).json({ success: false, message: 'Error obteniendo racha' });
  }
});

export default router;
