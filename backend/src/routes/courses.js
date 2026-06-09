import { Router } from 'express';
import prisma from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';

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

// ---- GET /  — catálogo público ----
router.get('/', async (req, res) => {
  try {
    const { categoria, nivel, search } = req.query;

    const where = { publicado: true };
    if (categoria) where.categoriaId = String(categoria);
    if (nivel) where.nivel = String(nivel);
    if (search) {
      const q = String(search);
      where.OR = [
        { titulo: { contains: q, mode: 'insensitive' } },
        { descripcion: { contains: q, mode: 'insensitive' } },
      ];
    }

    const cursos = await prisma.curso.findMany({
      where,
      include: {
        categoria: true,
        creador: { select: { id: true, username: true } },
        _count: { select: { inscripciones: true, modulos: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: { cursos } });
  } catch (err) {
    console.error('GET /courses error', err);
    res.status(500).json({ success: false, message: 'Error obteniendo cursos' });
  }
});

// ---- GET /my/enrolled  — mis inscripciones ----
// Va antes que /:id (no choca por número de segmentos, pero queda más claro).
router.get('/my/enrolled', requireAuth, async (req, res) => {
  try {
    const usuario = await loadCurrentUser(req, res);
    if (!usuario) return;

    const inscripciones = await prisma.inscripcion.findMany({
      where: { usuarioId: usuario.id },
      include: {
        curso: {
          include: {
            categoria: true,
            creador: { select: { id: true, username: true } },
            _count: { select: { modulos: true } },
          },
        },
      },
      orderBy: { fechaInscripcion: 'desc' },
    });

    res.json({ success: true, data: { inscripciones } });
  } catch (err) {
    console.error('GET /courses/my/enrolled error', err);
    res.status(500).json({ success: false, message: 'Error obteniendo inscripciones' });
  }
});

// ---- GET /my/teaching  — mis cursos como profesor ----
router.get('/my/teaching', requireAuth, async (req, res) => {
  try {
    const usuario = await loadCurrentUser(req, res);
    if (!usuario) return;
    if (usuario.rol !== 'PROFESOR' && usuario.rol !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Solo profesores pueden acceder a esta ruta',
      });
    }

    const cursos = await prisma.curso.findMany({
      where: {
        OR: [
          { creadorId: usuario.id },
          { profesores: { some: { profesorId: usuario.id } } },
        ],
      },
      include: {
        categoria: true,
        _count: { select: { inscripciones: true, modulos: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: { cursos } });
  } catch (err) {
    console.error('GET /courses/my/teaching error', err);
    res.status(500).json({ success: false, message: 'Error obteniendo cursos enseñados' });
  }
});

// ---- GET /:id  — detalle del curso con módulos y lecciones ----
router.get('/:id', async (req, res) => {
  try {
    const curso = await prisma.curso.findUnique({
      where: { id: req.params.id },
      include: {
        categoria: true,
        creador: { select: { id: true, username: true } },
        profesores: {
          include: { profesor: { select: { id: true, username: true } } },
        },
        modulos: {
          orderBy: { orden: 'asc' },
          include: {
            lecciones: {
              orderBy: { orden: 'asc' },
              select: { id: true, titulo: true, orden: true, videoUrl: true },
            },
            evaluacion: {
              select: { id: true, titulo: true, esFinal: true, notaMinima: true },
            },
          },
        },
        _count: { select: { inscripciones: true } },
      },
    });

    if (!curso) {
      return res.status(404).json({ success: false, message: 'Curso no encontrado' });
    }

    res.json({ success: true, data: { curso } });
  } catch (err) {
    console.error('GET /courses/:id error', err);
    res.status(500).json({ success: false, message: 'Error obteniendo curso' });
  }
});

// ---- POST /  — crear curso (PROFESOR verificado) ----
router.post('/', requireAuth, requireRole('PROFESOR'), async (req, res) => {
  try {
    if (!req.dbUser.verificado) {
      return res.status(403).json({
        success: false,
        message: 'Tu cuenta de profesor aún no está verificada',
      });
    }

    const { titulo, descripcion, nivel, categoriaId, portadaUrl } = req.body || {};
    if (!titulo || !descripcion || !nivel || !categoriaId) {
      return res.status(400).json({
        success: false,
        message: 'titulo, descripcion, nivel y categoriaId son requeridos',
      });
    }

    const curso = await prisma.curso.create({
      data: {
        titulo: String(titulo).trim(),
        descripcion: String(descripcion).trim(),
        nivel: String(nivel).trim(),
        portadaUrl: portadaUrl ? String(portadaUrl).trim() : null,
        categoriaId: String(categoriaId),
        creadorId: req.dbUser.id,
      },
      include: {
        categoria: true,
        creador: { select: { id: true, username: true } },
      },
    });

    res.status(201).json({ success: true, data: { curso } });
  } catch (err) {
    console.error('POST /courses error', err);
    if (err.code === 'P2003' || err.code === 'P2025') {
      return res.status(400).json({ success: false, message: 'Categoría no encontrada' });
    }
    res.status(500).json({ success: false, message: 'Error creando curso' });
  }
});

// ---- PUT /:id  — editar curso (solo autor verificado) ----
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const usuario = await loadCurrentUser(req, res);
    if (!usuario) return;

    const existente = await prisma.curso.findUnique({
      where: { id: req.params.id },
      select: { creadorId: true },
    });
    if (!existente) {
      return res.status(404).json({ success: false, message: 'Curso no encontrado' });
    }
    if (existente.creadorId !== usuario.id) {
      return res.status(403).json({
        success: false,
        message: 'Solo el autor puede editar el curso',
      });
    }
    if (usuario.rol === 'PROFESOR' && !usuario.verificado) {
      return res.status(403).json({
        success: false,
        message: 'Tu cuenta de profesor aún no está verificada',
      });
    }

    const { titulo, descripcion, nivel, categoriaId, portadaUrl } = req.body || {};
    const data = {};
    if (titulo !== undefined) data.titulo = String(titulo).trim();
    if (descripcion !== undefined) data.descripcion = String(descripcion).trim();
    if (nivel !== undefined) data.nivel = String(nivel).trim();
    if (categoriaId !== undefined) data.categoriaId = String(categoriaId);
    if (portadaUrl !== undefined) {
      data.portadaUrl = portadaUrl ? String(portadaUrl).trim() : null;
    }

    const curso = await prisma.curso.update({
      where: { id: req.params.id },
      data,
      include: {
        categoria: true,
        creador: { select: { id: true, username: true } },
      },
    });

    res.json({ success: true, data: { curso } });
  } catch (err) {
    console.error('PUT /courses/:id error', err);
    if (err.code === 'P2003' || err.code === 'P2025') {
      return res.status(400).json({ success: false, message: 'Categoría no encontrada' });
    }
    res.status(500).json({ success: false, message: 'Error editando curso' });
  }
});

// ---- POST /:id/publish  — publicar curso (solo autor) ----
router.post('/:id/publish', requireAuth, async (req, res) => {
  try {
    const usuario = await loadCurrentUser(req, res);
    if (!usuario) return;

    const existente = await prisma.curso.findUnique({
      where: { id: req.params.id },
      select: { creadorId: true, publicado: true },
    });
    if (!existente) {
      return res.status(404).json({ success: false, message: 'Curso no encontrado' });
    }
    if (existente.creadorId !== usuario.id) {
      return res.status(403).json({
        success: false,
        message: 'Solo el autor puede publicar el curso',
      });
    }

    if (existente.publicado) {
      return res.json({
        success: true,
        data: { curso: { id: req.params.id, publicado: true } },
      });
    }

    const curso = await prisma.curso.update({
      where: { id: req.params.id },
      data: { publicado: true },
    });

    res.json({ success: true, data: { curso } });
  } catch (err) {
    console.error('POST /courses/:id/publish error', err);
    res.status(500).json({ success: false, message: 'Error publicando curso' });
  }
});

// ---- POST /:id/unpublish  — despublicar curso (solo autor) ----
router.post('/:id/unpublish', requireAuth, async (req, res) => {
  try {
    const usuario = await loadCurrentUser(req, res);
    if (!usuario) return;

    const existente = await prisma.curso.findUnique({
      where: { id: req.params.id },
      select: { creadorId: true, publicado: true },
    });
    if (!existente) {
      return res.status(404).json({ success: false, message: 'Curso no encontrado' });
    }
    if (existente.creadorId !== usuario.id) {
      return res.status(403).json({
        success: false,
        message: 'Solo el autor puede despublicar el curso',
      });
    }

    if (!existente.publicado) {
      return res.json({
        success: true,
        data: { curso: { id: req.params.id, publicado: false } },
      });
    }

    const curso = await prisma.curso.update({
      where: { id: req.params.id },
      data: { publicado: false },
    });
    res.json({ success: true, data: { curso } });
  } catch (err) {
    console.error('POST /courses/:id/unpublish error', err);
    res.status(500).json({ success: false, message: 'Error despublicando curso' });
  }
});

// ---- DELETE /:id  — borrar curso (autor o ADMIN) ----
// Rechaza con 409 si tiene inscripciones. Cascada manual a módulos/lecciones/materiales/comentarios.
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const usuario = await loadCurrentUser(req, res);
    if (!usuario) return;

    const curso = await prisma.curso.findUnique({
      where: { id: req.params.id },
      include: {
        _count: { select: { inscripciones: true } },
        modulos: {
          select: {
            id: true,
            lecciones: { select: { id: true } },
          },
        },
      },
    });
    if (!curso) {
      return res.status(404).json({ success: false, message: 'Curso no encontrado' });
    }
    if (curso.creadorId !== usuario.id && usuario.rol !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Solo el autor o un admin puede borrar el curso',
      });
    }
    if (curso._count.inscripciones > 0) {
      return res.status(409).json({
        success: false,
        message: 'No puedes borrar un curso con estudiantes inscritos. Despublícalo primero.',
      });
    }

    const moduloIds = curso.modulos.map((m) => m.id);
    const leccionIds = curso.modulos.flatMap((m) => m.lecciones.map((l) => l.id));

    await prisma.$transaction(async (tx) => {
      if (leccionIds.length) {
        await tx.material.deleteMany({ where: { leccionId: { in: leccionIds } } });
        await tx.progreso.deleteMany({ where: { leccionId: { in: leccionIds } } });
        await tx.comentarioLeccion.deleteMany({ where: { leccionId: { in: leccionIds } } });
        await tx.leccion.deleteMany({ where: { id: { in: leccionIds } } });
      }
      if (moduloIds.length) {
        await tx.evaluacion.deleteMany({ where: { moduloId: { in: moduloIds } } });
        await tx.modulo.deleteMany({ where: { id: { in: moduloIds } } });
      }
      await tx.cursoProfesor.deleteMany({ where: { cursoId: curso.id } });
      await tx.curso.delete({ where: { id: curso.id } });
    });

    res.json({ success: true, data: { deleted: curso.id } });
  } catch (err) {
    console.error('DELETE /courses/:id error', err);
    res.status(500).json({ success: false, message: 'Error borrando curso' });
  }
});

// ---- POST /:id/enroll  — inscribirse (ESTUDIANTE) ----
router.post('/:id/enroll', requireAuth, requireRole('ESTUDIANTE'), async (req, res) => {
  try {
    const curso = await prisma.curso.findUnique({
      where: { id: req.params.id },
      select: { id: true, publicado: true },
    });
    if (!curso) {
      return res.status(404).json({ success: false, message: 'Curso no encontrado' });
    }
    if (!curso.publicado) {
      return res.status(400).json({
        success: false,
        message: 'El curso aún no está publicado',
      });
    }

    try {
      const inscripcion = await prisma.inscripcion.create({
        data: { usuarioId: req.dbUser.id, cursoId: curso.id },
      });
      res.status(201).json({ success: true, data: { inscripcion } });
    } catch (err) {
      if (err.code === 'P2002') {
        return res.status(409).json({
          success: false,
          message: 'Ya estás inscrito en este curso',
        });
      }
      throw err;
    }
  } catch (err) {
    console.error('POST /courses/:id/enroll error', err);
    res.status(500).json({ success: false, message: 'Error inscribiéndose en el curso' });
  }
});

// ---- GET /:id/progress  — mi progreso ----
router.get('/:id/progress', requireAuth, async (req, res) => {
  try {
    const usuario = await loadCurrentUser(req, res);
    if (!usuario) return;

    const curso = await prisma.curso.findUnique({
      where: { id: req.params.id },
      include: {
        modulos: {
          orderBy: { orden: 'asc' },
          include: {
            lecciones: {
              orderBy: { orden: 'asc' },
              select: { id: true, titulo: true, orden: true },
            },
          },
        },
      },
    });
    if (!curso) {
      return res.status(404).json({ success: false, message: 'Curso no encontrado' });
    }

    const leccionIds = curso.modulos.flatMap((m) => m.lecciones.map((l) => l.id));

    const progresos = leccionIds.length
      ? await prisma.progreso.findMany({
          where: { usuarioId: usuario.id, leccionId: { in: leccionIds } },
        })
      : [];
    const completadas = new Set(
      progresos.filter((p) => p.completada).map((p) => p.leccionId),
    );

    const modulos = curso.modulos.map((m) => {
      const total = m.lecciones.length;
      const done = m.lecciones.filter((l) => completadas.has(l.id)).length;
      return {
        id: m.id,
        titulo: m.titulo,
        orden: m.orden,
        total,
        completadas: done,
        lecciones: m.lecciones.map((l) => ({
          ...l,
          completada: completadas.has(l.id),
        })),
      };
    });

    const total = leccionIds.length;
    const done = completadas.size;
    const porcentaje = total === 0 ? 0 : Math.round((done / total) * 100);

    res.json({
      success: true,
      data: {
        cursoId: curso.id,
        total,
        completadas: done,
        porcentaje,
        modulos,
      },
    });
  } catch (err) {
    console.error('GET /courses/:id/progress error', err);
    res.status(500).json({ success: false, message: 'Error obteniendo progreso' });
  }
});

export default router;
