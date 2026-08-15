import { Router } from 'express';
import prisma from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole, isOwnerOrAdmin, ensureCourseContentAccess } from '../middleware/permissions.js';

const router = Router();

const authoringMoved = (req, res) => res.status(410).json({
  success: false,
  message: 'Esta operaciÃ³n docente requiere /api/authoring con control de concurrencia e idempotencia',
});

router.post('/courses/:courseId/modules', requireAuth, authoringMoved);
router.put('/modules/:id', requireAuth, authoringMoved);
router.delete('/modules/:id', requireAuth, authoringMoved);

// ---- POST /api/courses/:courseId/modules  — crear módulo (autor del curso o ADMIN) ----
router.post(
  '/courses/:courseId/modules',
  requireAuth,
  requireRole('PROFESOR', 'ADMIN'),
  async (req, res) => {
    try {
      const { courseId } = req.params;
      const { titulo, descripcion, orden } = req.body || {};

      if (!titulo || orden === undefined || orden === null) {
        return res.status(400).json({
          success: false,
          message: 'titulo y orden son requeridos',
        });
      }

      const ordenNum = Number(orden);
      if (!Number.isInteger(ordenNum)) {
        return res.status(400).json({
          success: false,
          message: 'orden debe ser un número entero',
        });
      }

      const curso = await prisma.curso.findUnique({
        where: { id: courseId },
        select: { id: true, creadorId: true },
      });
      if (!curso) {
        return res.status(404).json({ success: false, message: 'Curso no encontrado' });
      }
      if (!isOwnerOrAdmin(req.dbUser, curso.creadorId)) {
        return res.status(403).json({
          success: false,
          message: 'Solo el autor del curso puede agregar módulos',
        });
      }

      const modulo = await prisma.modulo.create({
        data: {
          titulo: String(titulo).trim(),
          descripcion:
            descripcion !== undefined && descripcion !== null
              ? String(descripcion).trim()
              : null,
          orden: ordenNum,
          cursoId: curso.id,
        },
      });

      res.status(201).json({ success: true, data: { modulo } });
    } catch (err) {
      console.error('POST /api/courses/:courseId/modules error', err);
      res.status(500).json({ success: false, message: 'Error creando módulo' });
    }
  },
);

// ---- GET /api/courses/:courseId/modules — público, módulos del curso ordenados ----
router.get('/courses/:courseId/modules', async (req, res) => {
  try {
    const modulos = await prisma.modulo.findMany({
      where: { cursoId: req.params.courseId, estado: 'PUBLICADO', curso: { publicado: true } },
      orderBy: { orden: 'asc' },
      include: {
        _count: { select: { lecciones: true } },
        evaluacion: { select: { id: true, titulo: true } },
      },
    });
    res.json({ success: true, data: { modulos } });
  } catch (err) {
    console.error('GET /api/courses/:courseId/modules error', err);
    res.status(500).json({ success: false, message: 'Error obteniendo módulos' });
  }
});

// ---- PUT /api/modules/:id — editar módulo (autor del curso o ADMIN) ----
router.put('/modules/:id', requireAuth, requireRole('PROFESOR', 'ADMIN'), async (req, res) => {
  try {
    const modulo = await prisma.modulo.findUnique({
      where: { id: req.params.id },
      include: { curso: { select: { creadorId: true } } },
    });
    if (!modulo) {
      return res.status(404).json({ success: false, message: 'Módulo no encontrado' });
    }

    if (modulo.estado === 'PUBLICADO') {
      return res.status(409).json({ success: false, message: 'Despublica el módulo antes de editarlo' });
    }
    if (!isOwnerOrAdmin(req.dbUser, modulo.curso.creadorId)) {
      return res.status(403).json({
        success: false,
        message: 'Solo el autor del curso puede editar el módulo',
      });
    }

    const { titulo, descripcion, orden } = req.body || {};
    const data = {};
    if (titulo !== undefined) data.titulo = String(titulo).trim();
    if (descripcion !== undefined) {
      data.descripcion = descripcion === null || descripcion === '' ? null : String(descripcion).trim();
    }
    if (orden !== undefined) {
      const ordenNum = Number(orden);
      if (!Number.isInteger(ordenNum)) {
        return res.status(400).json({ success: false, message: 'orden debe ser un número entero' });
      }
      data.orden = ordenNum;
    }
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ success: false, message: 'No hay campos para actualizar' });
    }

    const updated = await prisma.modulo.update({ where: { id: req.params.id }, data });
    res.json({ success: true, data: { modulo: updated } });
  } catch (err) {
    console.error('PUT /api/modules/:id error', err);
    res.status(500).json({ success: false, message: 'Error editando módulo' });
  }
});

// ---- DELETE /api/modules/:id — borrar módulo + cascada (autor del curso o ADMIN) ----
router.delete('/modules/:id', requireAuth, requireRole('PROFESOR', 'ADMIN'), async (req, res) => {
  try {
    const modulo = await prisma.modulo.findUnique({
      where: { id: req.params.id },
      include: {
        curso: { select: { creadorId: true } },
        lecciones: { select: { id: true } },
      },
    });
    if (!modulo) {
      return res.status(404).json({ success: false, message: 'Módulo no encontrado' });
    }
    if (!isOwnerOrAdmin(req.dbUser, modulo.curso.creadorId)) {
      return res.status(403).json({
        success: false,
        message: 'Solo el autor del curso puede borrar el módulo',
      });
    }

    const leccionIds = modulo.lecciones.map((l) => l.id);
    await prisma.$transaction(async (tx) => {
      if (leccionIds.length) {
        await tx.material.deleteMany({ where: { leccionId: { in: leccionIds } } });
        await tx.progreso.deleteMany({ where: { leccionId: { in: leccionIds } } });
        await tx.comentarioLeccion.deleteMany({ where: { leccionId: { in: leccionIds } } });
        await tx.leccion.deleteMany({ where: { id: { in: leccionIds } } });
      }
      await tx.evaluacion.deleteMany({ where: { moduloId: modulo.id } });
      await tx.modulo.delete({ where: { id: modulo.id } });
    });

    res.json({ success: true, data: { deleted: modulo.id } });
  } catch (err) {
    console.error('DELETE /api/modules/:id error', err);
    res.status(500).json({ success: false, message: 'Error borrando módulo' });
  }
});

// ---- GET /api/modules/:id/lessons  — módulo con lecciones ordenadas (login + inscripción) ----
router.get('/modules/:id/lessons', requireAuth, async (req, res) => {
  try {
    const modulo = await prisma.modulo.findUnique({
      where: { id: req.params.id },
      include: {
        lecciones: {
          orderBy: { orden: 'asc' },
        },
      },
    });

    if (!modulo) {
      return res.status(404).json({ success: false, message: 'Módulo no encontrado' });
    }

    if (modulo.estado !== 'PUBLICADO') {
      return res.status(404).json({ success: false, message: 'Módulo no encontrado' });
    }
    const visibleCourse = await prisma.curso.findFirst({ where: { id: modulo.cursoId, publicado: true }, select: { id: true } });
    if (!visibleCourse) return res.status(404).json({ success: false, message: 'MÃ³dulo no encontrado' });

    const access = await ensureCourseContentAccess(req, res, modulo.cursoId);
    if (!access) return;

    const { lecciones, ...moduloSinLecciones } = modulo;

    res.json({
      success: true,
      data: { modulo: moduloSinLecciones, lecciones },
    });
  } catch (err) {
    console.error('GET /api/modules/:id/lessons error', err);
    res.status(500).json({ success: false, message: 'Error obteniendo lecciones' });
  }
});

export default router;
