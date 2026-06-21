import { Router } from 'express';
import prisma from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { actualizarRacha, checkCursoCompletado } from '../services/progress.service.js';
import { checkLogrosLeccion } from '../services/achievement.service.js';
import { otorgarGotas } from '../services/gotas.service.js';
import { avanzarMisiones } from '../services/mision.service.js';

const router = Router();

// --- Helpers (mismo patrón que routes/courses.js y routes/modules.js) ---

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

// ---- POST /api/modules/:moduleId/lessons  — crear lección (PROFESOR) ----
router.post(
  '/modules/:moduleId/lessons',
  requireAuth,
  requireRole('PROFESOR'),
  async (req, res) => {
    try {
      const { moduleId } = req.params;
      const { titulo, contenido, videoUrl, orden } = req.body || {};

      if (!titulo || !contenido || orden === undefined || orden === null) {
        return res.status(400).json({
          success: false,
          message: 'titulo, contenido y orden son requeridos',
        });
      }

      const ordenNum = Number(orden);
      if (!Number.isInteger(ordenNum)) {
        return res.status(400).json({
          success: false,
          message: 'orden debe ser un número entero',
        });
      }

      const modulo = await prisma.modulo.findUnique({
        where: { id: moduleId },
        select: { id: true },
      });
      if (!modulo) {
        return res.status(404).json({ success: false, message: 'Módulo no encontrado' });
      }

      const leccion = await prisma.leccion.create({
        data: {
          titulo: String(titulo).trim(),
          contenido: String(contenido),
          videoUrl:
            videoUrl !== undefined && videoUrl !== null && videoUrl !== ''
              ? String(videoUrl).trim()
              : null,
          orden: ordenNum,
          moduloId: modulo.id,
        },
      });

      res.status(201).json({ success: true, data: { leccion } });
    } catch (err) {
      console.error('POST /api/modules/:moduleId/lessons error', err);
      res.status(500).json({ success: false, message: 'Error creando lección' });
    }
  },
);

// ---- GET /api/lessons/:id  — lección con materiales (público) ----
router.get('/lessons/:id', async (req, res) => {
  try {
    const leccion = await prisma.leccion.findUnique({
      where: { id: req.params.id },
      include: {
        materiales: { orderBy: { nombre: 'asc' } },
        modulo: { select: { id: true, titulo: true, cursoId: true } },
      },
    });
    if (!leccion) {
      return res.status(404).json({ success: false, message: 'Lección no encontrada' });
    }
    res.json({ success: true, data: { leccion } });
  } catch (err) {
    console.error('GET /api/lessons/:id error', err);
    res.status(500).json({ success: false, message: 'Error obteniendo lección' });
  }
});

// ---- DELETE /api/lessons/:id  — borrar lección + cascada (autor del curso) ----
router.delete('/lessons/:id', requireAuth, requireRole('PROFESOR'), async (req, res) => {
  try {
    const leccion = await prisma.leccion.findUnique({
      where: { id: req.params.id },
      include: { modulo: { include: { curso: { select: { creadorId: true } } } } },
    });
    if (!leccion) {
      return res.status(404).json({ success: false, message: 'Lección no encontrada' });
    }
    if (leccion.modulo.curso.creadorId !== req.dbUser.id) {
      return res.status(403).json({
        success: false,
        message: 'Solo el autor del curso puede borrar la lección',
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.material.deleteMany({ where: { leccionId: leccion.id } });
      await tx.progreso.deleteMany({ where: { leccionId: leccion.id } });
      await tx.comentarioLeccion.deleteMany({ where: { leccionId: leccion.id } });
      await tx.leccion.delete({ where: { id: leccion.id } });
    });

    res.json({ success: true, data: { deleted: leccion.id } });
  } catch (err) {
    console.error('DELETE /api/lessons/:id error', err);
    res.status(500).json({ success: false, message: 'Error borrando lección' });
  }
});

// ---- PUT /api/lessons/:id  — editar lección (PROFESOR) ----
router.put('/lessons/:id', requireAuth, requireRole('PROFESOR'), async (req, res) => {
  try {
    const { titulo, contenido, videoUrl, orden } = req.body || {};

    const data = {};
    if (titulo !== undefined) data.titulo = String(titulo).trim();
    if (contenido !== undefined) data.contenido = String(contenido);
    if (videoUrl !== undefined) {
      data.videoUrl =
        videoUrl === null || videoUrl === '' ? null : String(videoUrl).trim();
    }
    if (orden !== undefined) {
      const ordenNum = Number(orden);
      if (!Number.isInteger(ordenNum)) {
        return res.status(400).json({
          success: false,
          message: 'orden debe ser un número entero',
        });
      }
      data.orden = ordenNum;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No hay campos para actualizar',
      });
    }

    try {
      const leccion = await prisma.leccion.update({
        where: { id: req.params.id },
        data,
      });
      res.json({ success: true, data: { leccion } });
    } catch (err) {
      if (err.code === 'P2025') {
        return res.status(404).json({ success: false, message: 'Lección no encontrada' });
      }
      throw err;
    }
  } catch (err) {
    console.error('PUT /api/lessons/:id error', err);
    res.status(500).json({ success: false, message: 'Error editando lección' });
  }
});

// ---- POST /api/lessons/:id/complete  — marcar lección como completada ----
router.post('/lessons/:id/complete', requireAuth, async (req, res) => {
  try {
    const usuario = await loadCurrentUser(req, res);
    if (!usuario) return;

    const leccion = await prisma.leccion.findUnique({
      where: { id: req.params.id },
      select: { id: true, modulo: { select: { cursoId: true } } },
    });
    if (!leccion) {
      return res.status(404).json({ success: false, message: 'Lección no encontrada' });
    }

    // ¿Era la primera vez que la completa? Sólo en ese caso actualizamos la racha.
    const previo = await prisma.progreso.findUnique({
      where: { usuarioId_leccionId: { usuarioId: usuario.id, leccionId: leccion.id } },
      select: { completada: true },
    });
    const primeraVez = !previo?.completada;

    const progreso = await prisma.progreso.upsert({
      where: { usuarioId_leccionId: { usuarioId: usuario.id, leccionId: leccion.id } },
      update: { completada: true, fechaCompletado: new Date() },
      create: {
        usuarioId: usuario.id,
        leccionId: leccion.id,
        completada: true,
        fechaCompletado: new Date(),
      },
    });

    let racha = null;
    let logros = [];
    let cursoCompletado = null;
    let gotas = 0;
    if (primeraVez) {
      racha = await actualizarRacha(usuario.id);
      logros = await checkLogrosLeccion(usuario.id, { racha: racha?.racha ?? 0 });
      cursoCompletado = await checkCursoCompletado(usuario.id, leccion.modulo.cursoId);
      if (cursoCompletado?.logros?.length) {
        logros.push(...cursoCompletado.logros);
      }
      // Gotas: +10 por la lección (idempotente por leccionId) y +50 si recién completó el curso.
      gotas += (await otorgarGotas(usuario.id, 'leccion', { refId: leccion.id })).otorgadas;
      if (cursoCompletado?.nuevo) {
        gotas += (await otorgarGotas(usuario.id, 'curso', { refId: leccion.modulo.cursoId })).otorgadas;
      }
      await avanzarMisiones(usuario.id, 'leccion');
    } else {
      racha = {
        racha: usuario.racha,
        subio: false,
        ultimaActividad: usuario.ultimaActividad,
        rota: false,
      };
    }

    res.json({
      success: true,
      data: {
        progreso,
        primeraVez,
        racha,
        logros,
        gotas,
        cursoCompletado: cursoCompletado?.completado
          ? {
              nuevo: Boolean(cursoCompletado.nuevo),
              certificado: cursoCompletado.certificado
                ? {
                    id: cursoCompletado.certificado.id,
                    codigoVerif: cursoCompletado.certificado.codigoVerif,
                  }
                : null,
            }
          : null,
      },
    });
  } catch (err) {
    console.error('POST /api/lessons/:id/complete error', err);
    res.status(500).json({ success: false, message: 'Error marcando lección como completada' });
  }
});

// ---- GET /api/lessons/:id/note  — nota personal del usuario (privada) ----
router.get('/lessons/:id/note', requireAuth, async (req, res) => {
  try {
    const usuario = await loadCurrentUser(req, res);
    if (!usuario) return;

    const nota = await prisma.notaLeccion.findUnique({
      where: {
        usuarioId_leccionId: { usuarioId: usuario.id, leccionId: req.params.id },
      },
    });

    res.json({ success: true, data: { nota: nota || null } });
  } catch (err) {
    console.error('GET /api/lessons/:id/note error', err);
    res.status(500).json({ success: false, message: 'Error obteniendo la nota' });
  }
});

// ---- PUT /api/lessons/:id/note  — guardar/actualizar la nota personal ----
router.put('/lessons/:id/note', requireAuth, async (req, res) => {
  try {
    const usuario = await loadCurrentUser(req, res);
    if (!usuario) return;

    const texto = (req.body?.texto ?? '').toString();
    if (texto.length > 5000) {
      return res.status(400).json({
        success: false,
        message: 'La nota no puede superar los 5000 caracteres',
      });
    }

    const leccion = await prisma.leccion.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!leccion) {
      return res.status(404).json({ success: false, message: 'Lección no encontrada' });
    }

    const nota = await prisma.notaLeccion.upsert({
      where: {
        usuarioId_leccionId: { usuarioId: usuario.id, leccionId: leccion.id },
      },
      update: { texto },
      create: { usuarioId: usuario.id, leccionId: leccion.id, texto },
    });

    res.json({ success: true, data: { nota } });
  } catch (err) {
    console.error('PUT /api/lessons/:id/note error', err);
    res.status(500).json({ success: false, message: 'Error guardando la nota' });
  }
});

// ---- GET /api/lessons/:id/comments  — público ----
router.get('/lessons/:id/comments', async (req, res) => {
  try {
    const comentarios = await prisma.comentarioLeccion.findMany({
      where: { leccionId: req.params.id },
      orderBy: { createdAt: 'desc' },
    });

    // ComentarioLeccion no tiene relación `usuario` definida en el schema,
    // así que resolvemos los usernames en una segunda query.
    const usuarioIds = [...new Set(comentarios.map((c) => c.usuarioId))];
    const usuarios = usuarioIds.length
      ? await prisma.usuario.findMany({
          where: { id: { in: usuarioIds } },
          select: { id: true, username: true },
        })
      : [];
    const usernameById = new Map(usuarios.map((u) => [u.id, u.username]));

    const enriched = comentarios.map((c) => ({
      ...c,
      username: usernameById.get(c.usuarioId) || null,
    }));

    res.json({ success: true, data: { comentarios: enriched } });
  } catch (err) {
    console.error('GET /api/lessons/:id/comments error', err);
    res.status(500).json({ success: false, message: 'Error obteniendo comentarios' });
  }
});

// ---- POST /api/lessons/:id/comments  — crear comentario ----
router.post('/lessons/:id/comments', requireAuth, async (req, res) => {
  try {
    const usuario = await loadCurrentUser(req, res);
    if (!usuario) return;

    const texto = (req.body?.texto ?? '').toString().trim();
    if (!texto) {
      return res.status(400).json({
        success: false,
        message: 'El texto del comentario no puede estar vacío',
      });
    }

    const leccion = await prisma.leccion.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!leccion) {
      return res.status(404).json({ success: false, message: 'Lección no encontrada' });
    }

    const comentario = await prisma.comentarioLeccion.create({
      data: {
        texto,
        usuarioId: usuario.id,
        leccionId: leccion.id,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        comentario: { ...comentario, username: usuario.username },
      },
    });
  } catch (err) {
    console.error('POST /api/lessons/:id/comments error', err);
    res.status(500).json({ success: false, message: 'Error creando comentario' });
  }
});

export default router;
