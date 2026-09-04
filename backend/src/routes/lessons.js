import { Router } from 'express';
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { runQuery } from '../db.js';
import prisma from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { loadCurrentUser, requireRole, isOwnerOrAdmin, ensureCourseContentAccess } from '../middleware/permissions.js';
import { actualizarRacha, checkCursoCompletado } from '../services/progress.service.js';
import { checkLogrosLeccion } from '../services/achievement.service.js';
import { otorgarGotas } from '../services/gotas.service.js';
import { avanzarMisiones } from '../services/mision.service.js';
import { normalizeLessonOrder } from '../services/content-deletion.service.js';
import { isDeadlineExpired } from '../services/deadline.service.js';

const router = Router();

class HtmlLessonError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const HTML_ATTEMPT_TOKEN_TYPE = 'html-lesson-attempt';

function issueHtmlAttemptToken({ userId, lessonId, resourceId }) {
  return jwt.sign(
    { type: HTML_ATTEMPT_TOKEN_TYPE, userId, lessonId, resourceId },
    process.env.JWT_SECRET,
    { expiresIn: '2h' },
  );
}

function verifyHtmlAttemptToken(token) {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return payload?.type === HTML_ATTEMPT_TOKEN_TYPE ? payload : null;
  } catch {
    return null;
  }
}

async function runSerializable(mutation) {
  let lastError;
  for (let retry = 0; retry < 3; retry += 1) {
    try {
      return await prisma.$transaction(mutation, { isolationLevel: 'Serializable' });
    } catch (error) {
      lastError = error;
      if (!['P2002', 'P2034'].includes(error?.code)) throw error;
    }
  }
  throw lastError;
}

async function loadHtmlLesson(req, res) {
  const leccion = await prisma.leccion.findUnique({
    where: { id: req.params.id },
    include: { recursoHtml: true, modulo: { select: { cursoId: true, estado: true } } },
  });
  if (!leccion || leccion.formatoContenido !== 'HTML' || !leccion.recursoHtml) {
    res.status(404).json({ success: false, message: 'Contenido HTML no encontrado' });
    return null;
  }
  const access = await ensureCourseContentAccess(req, res, leccion.modulo.cursoId, {
    moduleState: leccion.modulo.estado,
      lessonState: leccion.estado,
  });
  return access ? { leccion, access } : null;
}

const authoringMoved = (req, res) => res.status(410).json({
  success: false,
  message: 'Esta operaciÃ³n docente requiere /api/authoring con control de concurrencia e idempotencia',
});

router.post('/modules/:moduleId/lessons', requireAuth, authoringMoved);
router.put('/lessons/:id', requireAuth, authoringMoved);
router.delete('/lessons/:id', requireAuth, authoringMoved);

// ---- POST /api/modules/:moduleId/lessons  — crear lección (autor del curso o ADMIN) ----
router.post(
  '/modules/:moduleId/lessons',
  requireAuth,
  requireRole('PROFESOR', 'ADMIN'),
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
        include: { curso: { select: { creadorId: true } } },
      });
      if (!modulo) {
        return res.status(404).json({ success: false, message: 'Módulo no encontrado' });
      }
      if (!isOwnerOrAdmin(req.dbUser, modulo.curso.creadorId)) {
        return res.status(403).json({
          success: false,
          message: 'Solo el autor del curso puede agregar lecciones',
        });
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

// ---- GET /api/lessons/:id  — lección con materiales (login + inscripción) ----
router.get('/lessons/:id', requireAuth, async (req, res) => {
  try {
    const leccion = await prisma.leccion.findUnique({
      where: { id: req.params.id },
      include: {
        materiales: { orderBy: { nombre: 'asc' } },
        modulo: { select: { id: true, titulo: true, cursoId: true, estado: true } },
      },
    });
    if (!leccion) {
      return res.status(404).json({ success: false, message: 'Lección no encontrada' });
    }
    const access = await ensureCourseContentAccess(req, res, leccion.modulo.cursoId, {
      moduleState: leccion.modulo.estado,
      lessonState: leccion.estado,
    });
    if (!access) return;

    res.json({ success: true, data: { leccion } });
  } catch (err) {
    console.error('GET /api/lessons/:id error', err);
    res.status(500).json({ success: false, message: 'Error obteniendo lección' });
  }
});

// ---- DELETE /api/lessons/:id  — borrar lección + cascada (autor del curso o ADMIN) ----
// ---- GET /api/lessons/:id/html — HTML autenticado para iframe srcDoc, nunca URL pública ----
router.get('/lessons/:id/html', requireAuth, async (req, res) => {
  try {
    const loaded = await loadHtmlLesson(req, res);
    if (!loaded) return;
    const { recursoHtml } = loaded.leccion;
    const attemptsWhere = { usuarioId: loaded.access.usuario.id, recursoHtmlId: recursoHtml.id };
    const [resultado, usedAttempts] = recursoHtml.evaluable
      ? await Promise.all([
          prisma.resultadoHtmlLeccion.findUnique({
            where: { usuarioId_recursoHtmlId: { usuarioId: loaded.access.usuario.id, recursoHtmlId: recursoHtml.id } },
            select: { mejorPuntaje: true },
          }),
          prisma.intentoHtmlLeccion.count({ where: { ...attemptsWhere, puntaje: { not: null } } }),
        ])
      : [null, 0];
    const remainingAttempts = recursoHtml.evaluable
      ? Math.max(0, recursoHtml.intentosMax - usedAttempts)
      : null;
    const deadlineExpired = isDeadlineExpired(recursoHtml.fechaLimite);
    res.json({
      success: true,
      data: {
        html: recursoHtml.html,
        evaluable: recursoHtml.evaluable,
        intentosMax: recursoHtml.intentosMax,
        fechaLimite: recursoHtml.fechaLimite ?? null,
        fechaLimiteExpirada: deadlineExpired,
        bestScore: resultado?.mejorPuntaje ?? null,
        remainingAttempts,
        attemptsExhausted: recursoHtml.evaluable ? remainingAttempts === 0 : false,
        attemptToken: recursoHtml.evaluable && remainingAttempts > 0 && !deadlineExpired
          ? issueHtmlAttemptToken({
              userId: loaded.access.usuario.id,
              lessonId: loaded.leccion.id,
              resourceId: recursoHtml.id,
            })
          : null,
      },
    });
  } catch (err) {
    console.error('GET /api/lessons/:id/html error', err);
    res.status(500).json({ success: false, message: 'Error obteniendo contenido HTML' });
  }
});

// ---- POST /api/lessons/:id/html-attempts — token temporal, no consume intento ----
router.post('/lessons/:id/html-attempts', requireAuth, async (req, res) => {
  try {
    const loaded = await loadHtmlLesson(req, res);
    if (!loaded) return;
    const { recursoHtml: resource } = loaded.leccion;
    if (!resource.evaluable) return res.status(409).json({ success: false, message: 'Este contenido HTML no es evaluable' });
    if (isDeadlineExpired(resource.fechaLimite)) {
      return res.status(409).json({ success: false, message: 'El plazo para entregar esta actividad ya venció' });
    }
    const used = await prisma.intentoHtmlLeccion.count({
      where: { usuarioId: loaded.access.usuario.id, recursoHtmlId: resource.id, puntaje: { not: null } },
    });
    if (used >= resource.intentosMax) {
      return res.status(409).json({ success: false, message: 'Ya alcanzaste el máximo de intentos para este contenido HTML' });
    }
    const attemptToken = issueHtmlAttemptToken({
      userId: loaded.access.usuario.id,
      lessonId: loaded.leccion.id,
      resourceId: resource.id,
    });
    res.json({ success: true, data: { attemptToken, remaining: resource.intentosMax - used } });
  } catch (err) {
    if (err instanceof HtmlLessonError) return res.status(err.status).json({ success: false, message: err.message });
    console.error('POST /api/lessons/:id/html-attempts error', err);
    res.status(500).json({ success: false, message: 'Error iniciando intento HTML' });
  }
});

// ---- POST /api/lessons/:id/html-results — puntaje práctico/autodeclarado e idempotente ----
router.post('/lessons/:id/html-results', requireAuth, async (req, res) => {
  try {
    const score = Number(req.body?.score);
    const attemptToken = String(req.body?.attemptToken || '');
    if (!Number.isFinite(score) || score < 0 || score > 100 || !attemptToken || attemptToken.length > 512) {
      return res.status(400).json({ success: false, message: 'score debe estar entre 0 y 100 y attemptToken es requerido' });
    }
    const loaded = await loadHtmlLesson(req, res);
    if (!loaded) return;
    const { recursoHtml: resource } = loaded.leccion;
    if (!resource.evaluable) return res.status(409).json({ success: false, message: 'Este contenido HTML no es evaluable' });
    if (isDeadlineExpired(resource.fechaLimite)) {
      return res.status(409).json({ success: false, message: 'El plazo para entregar esta actividad ya venció' });
    }
    const result = await runSerializable(async (tx) => {
      if (isDeadlineExpired(resource.fechaLimite)) {
        throw new HtmlLessonError(409, 'El plazo para entregar esta actividad ya venció');
      }
      let attempt = await tx.intentoHtmlLeccion.findUnique({ where: { token: attemptToken } });
      if (attempt && (attempt.usuarioId !== loaded.access.usuario.id || attempt.recursoHtmlId !== resource.id)) {
        throw new HtmlLessonError(404, 'Intento HTML no encontrado');
      }
      const used = await tx.intentoHtmlLeccion.count({
        where: { usuarioId: loaded.access.usuario.id, recursoHtmlId: resource.id, puntaje: { not: null } },
      });
      if (!attempt) {
        const tokenPayload = verifyHtmlAttemptToken(attemptToken);
        if (!tokenPayload
          || tokenPayload.userId !== loaded.access.usuario.id
          || tokenPayload.lessonId !== loaded.leccion.id
          || tokenPayload.resourceId !== resource.id) {
          throw new HtmlLessonError(404, 'Intento HTML no encontrado');
        }
        if (used >= resource.intentosMax) {
          throw new HtmlLessonError(409, 'Ya alcanzaste el máximo de intentos para este contenido HTML');
        }
        const lastAttempt = await tx.intentoHtmlLeccion.findFirst({
          where: { usuarioId: loaded.access.usuario.id, recursoHtmlId: resource.id },
          orderBy: { numero: 'desc' },
          select: { numero: true },
        });
        attempt = await tx.intentoHtmlLeccion.create({
          data: {
            token: attemptToken,
            numero: (lastAttempt?.numero ?? 0) + 1,
            usuarioId: loaded.access.usuario.id,
            recursoHtmlId: resource.id,
          },
        });
      }
      const current = await tx.resultadoHtmlLeccion.findUnique({
        where: { usuarioId_recursoHtmlId: { usuarioId: loaded.access.usuario.id, recursoHtmlId: resource.id } },
      });
      if (attempt.puntaje !== null && attempt.puntaje !== undefined) {
        return { attempt, bestScore: current?.mejorPuntaje ?? attempt.puntaje, remaining: Math.max(0, resource.intentosMax - used), replayed: true };
      }
      const completedAttempt = await tx.intentoHtmlLeccion.update({ where: { id: attempt.id }, data: { puntaje: score, resultadoAt: new Date() } });
      const progreso = await tx.progreso.upsert({
        where: { usuarioId_leccionId: { usuarioId: loaded.access.usuario.id, leccionId: loaded.leccion.id } },
        update: { completada: true, fechaCompletado: new Date() },
        create: {
          usuarioId: loaded.access.usuario.id,
          leccionId: loaded.leccion.id,
          completada: true,
          fechaCompletado: new Date(),
        },
      });
      const best = !current || score > current.mejorPuntaje
        ? await tx.resultadoHtmlLeccion.upsert({
            where: { usuarioId_recursoHtmlId: { usuarioId: loaded.access.usuario.id, recursoHtmlId: resource.id } },
            update: { mejorPuntaje: score, intentoId: attempt.id },
            create: { usuarioId: loaded.access.usuario.id, recursoHtmlId: resource.id, mejorPuntaje: score, intentoId: attempt.id },
          })
        : current;
      return { attempt: completedAttempt, progreso, bestScore: best.mejorPuntaje, remaining: Math.max(0, resource.intentosMax - used - 1), replayed: false };
    });
    const cursoCompletado = result.replayed
      ? null
      : await checkCursoCompletado(loaded.access.usuario.id, loaded.leccion.modulo.cursoId);
    res.json({
      success: true,
      data: {
        score: result.attempt.puntaje,
        bestScore: result.bestScore,
        remaining: result.remaining,
        replayed: result.replayed,
        practice: true,
        progreso: result.progreso || null,
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
    if (err instanceof HtmlLessonError) return res.status(err.status).json({ success: false, message: err.message });
    console.error('POST /api/lessons/:id/html-results error', err);
    res.status(500).json({ success: false, message: 'Error guardando resultado HTML' });
  }
});

router.delete('/lessons/:id', requireAuth, requireRole('PROFESOR', 'ADMIN'), async (req, res) => {
  try {
    const leccion = await prisma.leccion.findUnique({
      where: { id: req.params.id },
      include: { modulo: { include: { curso: { select: { creadorId: true } } } } },
    });
    if (!leccion) {
      return res.status(404).json({ success: false, message: 'Lección no encontrada' });
    }
    if (!isOwnerOrAdmin(req.dbUser, leccion.modulo.curso.creadorId)) {
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
      await normalizeLessonOrder(tx, leccion.modulo.id);
    });

    res.json({ success: true, data: { deleted: leccion.id } });
  } catch (err) {
    console.error('DELETE /api/lessons/:id error', err);
    res.status(500).json({ success: false, message: 'Error borrando lección' });
  }
});

// ---- PUT /api/lessons/:id  — editar lección (autor del curso o ADMIN) ----
router.put('/lessons/:id', requireAuth, requireRole('PROFESOR', 'ADMIN'), async (req, res) => {
  try {
    const existente = await prisma.leccion.findUnique({
      where: { id: req.params.id },
      include: { modulo: { include: { curso: { select: { creadorId: true } } } } },
    });
    if (!existente) {
      return res.status(404).json({ success: false, message: 'Lección no encontrada' });
    }
    if (!isOwnerOrAdmin(req.dbUser, existente.modulo.curso.creadorId)) {
      return res.status(403).json({
        success: false,
        message: 'Solo el autor del curso puede editar la lección',
      });
    }

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

    const leccion = await prisma.leccion.update({
      where: { id: req.params.id },
      data,
    });
    res.json({ success: true, data: { leccion } });
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
      select: { id: true, estado: true, recursoHtml: { select: { evaluable: true } }, modulo: { select: { cursoId: true, estado: true } } },
    });
    if (!leccion) {
      return res.status(404).json({ success: false, message: 'Lección no encontrada' });
    }
    const access = await ensureCourseContentAccess(req, res, leccion.modulo.cursoId, {
      moduleState: leccion.modulo.estado,
      lessonState: leccion.estado,
    });
    if (!access) return;
    if (leccion.recursoHtml?.evaluable) {
      return res.status(409).json({
        success: false,
        message: 'Las actividades HTML evaluables se completan al registrar su puntaje',
      });
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

    const leccion = await prisma.leccion.findUnique({
      where: { id: req.params.id },
      select: { id: true, estado: true, modulo: { select: { cursoId: true, estado: true } } },
    });
    if (!leccion) {
      return res.status(404).json({ success: false, message: 'Lección no encontrada' });
    }
    const access = await ensureCourseContentAccess(req, res, leccion.modulo.cursoId, {
      moduleState: leccion.modulo.estado,
      lessonState: leccion.estado,
    });
    if (!access) return;

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
      select: { id: true, estado: true, modulo: { select: { cursoId: true, estado: true } } },
    });
    if (!leccion) {
      return res.status(404).json({ success: false, message: 'Lección no encontrada' });
    }
    const access = await ensureCourseContentAccess(req, res, leccion.modulo.cursoId, {
      moduleState: leccion.modulo.estado,
      lessonState: leccion.estado,
    });
    if (!access) return;

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

// ---- GET /api/lessons/:id/comments  — login + inscripción ----
router.get('/lessons/:id/comments', requireAuth, async (req, res) => {
  try {
    const leccion = await prisma.leccion.findUnique({
      where: { id: req.params.id },
      select: { id: true, estado: true, modulo: { select: { cursoId: true, estado: true } } },
    });
    if (!leccion) {
      return res.status(404).json({ success: false, message: 'Lección no encontrada' });
    }
    const access = await ensureCourseContentAccess(req, res, leccion.modulo.cursoId, {
      moduleState: leccion.modulo.estado,
      lessonState: leccion.estado,
    });
    if (!access) return;

    const comentarios = await prisma.comentarioLeccion.findMany({
      where: { leccionId: req.params.id },
      orderBy: { createdAt: 'asc' },
    });

    // Resolver usernames de autores y de comentarios padre
    const usuarioIds = [...new Set(comentarios.map((c) => c.usuarioId))];
    const usuarios = usuarioIds.length
      ? await prisma.usuario.findMany({
          where: { id: { in: usuarioIds } },
          select: { id: true, username: true },
        })
      : [];
    const usernameById = new Map(usuarios.map((u) => [u.id, u.username]));
    const commentUserById = new Map(comentarios.map((c) => [c.id, usernameById.get(c.usuarioId)]));

    const enriched = comentarios.map((c) => ({
      ...c,
      username: usernameById.get(c.usuarioId) || null,
      replyToUsername: c.parentId ? commentUserById.get(c.parentId) || null : null,
    }));

    res.json({ success: true, data: { comentarios: enriched } });
  } catch (err) {
    console.error('GET /api/lessons/:id/comments error', err);
    res.status(500).json({ success: false, message: 'Error obteniendo comentarios' });
  }
});

// ---- POST /api/lessons/:id/comments  — crear comentario (root o reply) ----
router.post('/lessons/:id/comments', requireAuth, async (req, res) => {
  try {
    const usuario = await loadCurrentUser(req, res);
    if (!usuario) return;

    const texto = (req.body?.texto ?? '').toString().trim();
    const parentId = req.body?.parentId ? String(req.body.parentId).trim() : null;
    if (!texto) {
      return res.status(400).json({
        success: false,
        message: 'El texto del comentario no puede estar vacío',
      });
    }

    const leccion = await prisma.leccion.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        titulo: true,
        estado: true,
        modulo: { select: { cursoId: true, estado: true, curso: { select: { id: true, titulo: true } } } },
      },
    });
    if (!leccion) {
      return res.status(404).json({ success: false, message: 'Lección no encontrada' });
    }
    const access = await ensureCourseContentAccess(req, res, leccion.modulo.cursoId, {
      moduleState: leccion.modulo.estado,
      lessonState: leccion.estado,
    });
    if (!access) return;

    let finalParentId = null;
    let parentComment = null;
    if (parentId) {
      parentComment = await prisma.comentarioLeccion.findUnique({
        where: { id: parentId },
        select: { id: true, leccionId: true, usuarioId: true, parentId: true },
      });
      if (!parentComment || parentComment.leccionId !== leccion.id) {
        return res.status(400).json({ success: false, message: 'Comentario padre inválido' });
      }
      // Regla de 1 solo nivel: si el padre ya es respuesta, anclar a la raíz
      finalParentId = parentComment.parentId || parentComment.id;
    }

    const comentario = await prisma.comentarioLeccion.create({
      data: {
        texto,
        usuarioId: usuario.id,
        leccionId: leccion.id,
        parentId: finalParentId,
      },
    });

    // Notificación en Neo4j al autor respondido (Regla de oro 2: no bloquea)
    if (parentComment && parentComment.usuarioId !== usuario.id) {
      try {
        const targetUser = await prisma.usuario.findUnique({
          where: { id: parentComment.usuarioId },
          select: { neoId: true },
        });
        if (targetUser?.neoId) {
          const notifId = randomUUID();
          await runQuery(
            `MATCH (target:Usuario {id: $targetNeoId}), (actor:Usuario {id: $actorNeoId})
             CREATE (target)<-[:RECIBIO]-(n:Notificacion {
               id: $notifId,
               type: 'lesson_comment_reply',
               read: false,
               createdAt: datetime(),
               actorId: $actorNeoId,
               cursoId: $cursoId,
               leccionId: $leccionId,
               cursoTitulo: $cursoTitulo,
               leccionTitulo: $leccionTitulo,
               commentId: $commentId
             })`,
            {
              targetNeoId: targetUser.neoId,
              actorNeoId: req.user.id,
              notifId,
              cursoId: leccion.modulo.curso?.id || '',
              leccionId: leccion.id,
              cursoTitulo: leccion.modulo.curso?.titulo || '',
              leccionTitulo: leccion.titulo || '',
              commentId: comentario.id,
            }
          );
        }
      } catch (notifErr) {
        console.error('Error enviando notificacion de respuesta en leccion:', notifErr);
      }
    }

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
