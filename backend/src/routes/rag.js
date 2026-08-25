import { Router } from 'express';
import prisma from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { ensureCourseContentAccess, loadCurrentUser } from '../middleware/permissions.js';
import {
  RagError,
  chatWithCourseContext,
  indexCourse,
  ragEnabledForCourse,
  ragStatusForLesson,
  ragUserAllowed,
} from '../services/rag.service.js';

const router = Router();

function handleRagError(res, error, fallback) {
  if (error instanceof RagError) return res.status(error.status).json({ success: false, message: error.message });
  console.error(fallback, error);
  return res.status(500).json({ success: false, message: 'Error procesando el tutor IA' });
}

async function loadLessonAccess(req, res) {
  const lesson = await prisma.leccion.findUnique({
    where: { id: req.params.id },
    select: { id: true, moduloId: true, modulo: { select: { cursoId: true, estado: true } }, estado: true },
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
    res.json({
      success: true,
      data: {
        enabled: Boolean(status?.enabled),
        indexed: Boolean(status?.indexed),
        status: status?.status || null,
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
    const loaded = await loadLessonAccess(req, res);
    if (!loaded) return;
    if (!requirePilotUser(res, loaded.access.usuario)) return;
    if (!ragEnabledForCourse(loaded.lesson.modulo.cursoId)) {
      return res.status(404).json({ success: false, message: 'El tutor todavía no está habilitado para este curso' });
    }
    const result = await chatWithCourseContext({
      courseId: loaded.lesson.modulo.cursoId,
      lessonId: loaded.lesson.id,
      principalId: loaded.access.usuario.id,
      message,
    });
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
    const result = await indexCourse(course.id);
    return res.json({ success: true, data: result });
  } catch (error) {
    return handleRagError(res, error, 'POST /api/admin/rag/courses/:courseId/reindex error');
  }
});

export default router;
