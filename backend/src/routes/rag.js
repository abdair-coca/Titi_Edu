import { Router } from 'express';
import prisma from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { ensureCourseContentAccess, loadCurrentUser } from '../middleware/permissions.js';
import {
  RagError,
  chatWithCourseContext,
  ragEnabledForCourse,
  ragStatusForLesson,
  ragUserAllowed,
  resolveChatIntent,
} from '../services/rag.service.js';
import { enqueueCourseIndex } from '../services/rag.queue.js';
import { userCredentialRequired, groqCredentialMetadata } from '../services/ai-credentials.js';

const router = Router();

function handleRagError(res, error, fallback) {
  if (error instanceof RagError) return res.status(error.status).json({ success: false, message: error.message });
  console.error(fallback, error);
  return res.status(500).json({ success: false, message: 'Error procesando el tutor IA' });
}

async function loadLessonAccess(req, res) {
  const lesson = await prisma.leccion.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      titulo: true,
      moduloId: true,
      modulo: { select: { titulo: true, cursoId: true, estado: true } },
      estado: true,
    },
  });
  if (!lesson) {
    res.status(404).json({ success: false, message: 'Lección no encontrada' });
    return null;
  }
  const access = await ensureCourseContentAccess(req, res, lesson.modulo.cursoId, {
    moduleState: lesson.modulo.estado,
    lessonState: lesson.estado,
  });
  return access ? { lesson, access } : null;
}

function requirePilotUser(res, usuario) {
  if (ragUserAllowed(usuario)) return true;
  res.status(403).json({ success: false, message: 'El tutor IA está habilitado solo para usuario piloto' });
  return false;
}

router.get('/lessons/:id/chat/status', requireAuth, async (req, res) => {
  try {
    const loaded = await loadLessonAccess(req, res);
    if (!loaded) return;
    if (!requirePilotUser(res, loaded.access.usuario)) return;
    const status = await ragStatusForLesson(req.params.id);
    const saved = userCredentialRequired() ? await groqCredentialMetadata(loaded.access.usuario.id) : null;
    res.json({
      success: true,
      data: {
        enabled: Boolean(status?.enabled) && process.env.RAG_CHAT_ENABLED !== 'false',
        indexed: Boolean(status?.indexed),
        status: status?.status || null,
        credential: { required: userCredentialRequired(), configured: Boolean(saved?.configured), status: saved?.status || null, last4: saved?.last4 || null },
      },
    });
  } catch (error) {
    return handleRagError(res, error, 'GET /api/lessons/:id/chat/status error');
  }
});

router.post('/lessons/:id/chat', requireAuth, async (req, res) => {
  try {
    const message = String(req.body?.message || '').trim();
    if (!message || message.length > 1000) {
      return res.status(400).json({ success: false, message: 'message es requerido y debe tener hasta 1000 caracteres' });
    }
    const requestedIntent = req.body?.intent;
    const intent = resolveChatIntent(requestedIntent);
    if (!intent) {
      return res.status(400).json({ success: false, message: 'intent no es válido' });
    }
    const history = req.body?.history;
    if (history !== undefined && !Array.isArray(history)) {
      return res.status(400).json({ success: false, message: 'history debe ser una lista de turnos' });
    }
    const loaded = await loadLessonAccess(req, res);
    if (!loaded) return;
    if (!requirePilotUser(res, loaded.access.usuario)) return;
    if (!ragEnabledForCourse(loaded.lesson.modulo.cursoId) || process.env.RAG_CHAT_ENABLED === 'false') {
      return res.status(404).json({ success: false, message: 'El tutor todavía no está habilitado para este curso' });
    }
    const chatInput = {
      courseId: loaded.lesson.modulo.cursoId,
      lessonId: loaded.lesson.id,
      lessonTitle: loaded.lesson.titulo,
      principalId: loaded.access.usuario.id,
      message,
      history,
    };
    if (requestedIntent !== undefined) chatInput.intent = intent;
    // Teachers and administrators can preview content, but must never provide
    // a student's private learning metadata to the provider.
    if (!loaded.access.enrolled || loaded.access.usuario.rol !== 'ESTUDIANTE') {
      chatInput.learningContext = {
        lessonState: 'NO_INICIADA',
        courseProgress: { completedLessons: 0, totalLessons: 0 },
        moduleProgress: { completedLessons: 0, totalLessons: 0 },
        performance: 'SIN_INTENTO',
      };
    }
    const result = await chatWithCourseContext(chatInput);
    return res.json({ success: true, data: result });
  } catch (error) {
    return handleRagError(res, error, 'POST /api/lessons/:id/chat error');
  }
});

router.post('/admin/rag/courses/:courseId/reindex', requireAuth, async (req, res) => {
  try {
    const usuario = await loadCurrentUser(req, res);
    if (!usuario) return;
    const course = await prisma.curso.findUnique({
      where: { id: req.params.courseId },
      select: { id: true, creadorId: true, profesores: { where: { profesorId: usuario.id }, select: { profesorId: true } } },
    });
    if (!course) return res.status(404).json({ success: false, message: 'Curso no encontrado' });
    const canManage = usuario.rol === 'ADMIN' || course.creadorId === usuario.id || course.profesores.length > 0;
    if (!canManage) return res.status(403).json({ success: false, message: 'No tienes permiso para reindexar este curso' });
    if (!ragEnabledForCourse(course.id)) return res.status(409).json({ success: false, message: 'El tutor no está habilitado para este curso' });
    const result = await enqueueCourseIndex(course.id);
    return res.status(202).json({ success: true, data: result });
  } catch (error) {
    return handleRagError(res, error, 'POST /api/admin/rag/courses/:courseId/reindex error');
  }
});

export default router;
