import { Router } from 'express';
import prisma from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// --- Helpers (idénticos al patrón de routes/courses.js) ---

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

function requireRole(...roles) {
  return async (req, res, next) => {
    try {
      const usuario = await loadCurrentUser(req, res);
      if (!usuario) return;
      if (!roles.includes(usuario.rol)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para esta acción',
        });
      }
      next();
    } catch (err) {
      console.error('requireRole error', err);
      res.status(500).json({ success: false, message: 'Error verificando permisos' });
    }
  };
}

// ---- POST /api/courses/:courseId/modules  — crear módulo (solo autor PROFESOR) ----
router.post(
  '/courses/:courseId/modules',
  requireAuth,
  requireRole('PROFESOR'),
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
      if (curso.creadorId !== req.dbUser.id) {
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

// ---- GET /api/modules/:id/lessons  — público, módulo con lecciones ordenadas ----
router.get('/modules/:id/lessons', async (req, res) => {
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
