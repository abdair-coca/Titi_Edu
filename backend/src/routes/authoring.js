import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import prisma from '../prisma.js';
import { requireAuthoringJwt, requireAuthoringPrincipal } from '../middleware/authoring-auth.js';
import {
  AUTHORING_SCOPES,
  coursePublicationSummary,
  createPublicationConfirmation,
  fingerprint,
  generateServiceToken,
  inspectAuthoringFile,
  modulePublicationSummary,
  privateAnalytics,
  sanitizeFilename,
  verifyPublicationConfirmation,
} from '../services/authoring.service.js';
import { executeIdempotent } from '../services/authoring-idempotency.service.js';
import { cloudinaryEnabled, destroyAsset, uploadBuffer } from '../services/upload.service.js';

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const materialsDir = path.join(__dirname, '..', 'uploads', 'materials');
if (!fs.existsSync(materialsDir)) fs.mkdirSync(materialsDir, { recursive: true });

class AuthoringError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const handle = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (err) {
    if (err instanceof AuthoringError) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    console.error(`Authoring ${req.method} ${req.path} error`, err);
    res.status(500).json({ success: false, message: 'Error procesando la operación de autoría' });
  }
};

const MODULE_SNAPSHOT_INCLUDE = {
  curso: { select: { id: true, creadorId: true, publicado: true } },
  lecciones: {
    orderBy: { orden: 'asc' },
    include: { materiales: { orderBy: { nombre: 'asc' } } },
  },
  evaluacion: {
    include: {
      preguntas: { orderBy: { orden: 'asc' }, include: { opciones: true } },
    },
  },
};

const COURSE_SNAPSHOT_INCLUDE = {
  categoria: true,
  creador: { select: { id: true, username: true } },
  modulos: {
    orderBy: { orden: 'asc' },
    include: {
      lecciones: {
        orderBy: { orden: 'asc' },
        include: { materiales: { orderBy: { nombre: 'asc' } } },
      },
      evaluacion: {
        include: {
          preguntas: { orderBy: { orden: 'asc' }, include: { opciones: true } },
        },
      },
    },
  },
};

function canAccessCourse(principal, course) {
  if (!course) return false;
  if (principal.kind === 'jwt' && principal.usuario.rol === 'ADMIN') return true;
  return course.creadorId === principal.usuario.id;
}

function assertCourseAccess(principal, course) {
  if (!course) throw new AuthoringError(404, 'Curso no encontrado');
  if (!canAccessCourse(principal, course)) {
    throw new AuthoringError(403, 'Solo el creador del curso o un administrador puede realizar esta acción');
  }
}

function assertDraftModule(module) {
  if (module.estado === 'PUBLICADO') {
    throw new AuthoringError(409, 'El módulo publicado es inmutable. Despublicalo antes de editarlo');
  }
}

function resourceFingerprint(resource, fields) {
  return fingerprint(Object.fromEntries(fields.map((field) => [field, resource[field]])));
}

function moduleResourceFingerprints(module) {
  return {
    module: resourceFingerprint(module, ['titulo', 'descripcion', 'orden', 'estado']),
    lessons: Object.fromEntries((module.lecciones || []).map((lesson) => [
      lesson.id,
      resourceFingerprint(lesson, ['titulo', 'contenido', 'formatoContenido', 'videoUrl', 'orden']),
    ])),
    materials: Object.fromEntries((module.lecciones || []).flatMap((lesson) =>
      (lesson.materiales || []).map((material) => [
        material.id,
        resourceFingerprint(material, ['nombre', 'tipo', 'url', 'publicId', 'sha256']),
      ]))),
  };
}

function assertExpected(req, actual) {
  const expected = req.body?.expectedFingerprint || req.get('If-Match');
  if (!expected) throw new AuthoringError(428, 'expectedFingerprint es requerido');
  if (expected !== actual) throw new AuthoringError(412, 'El recurso cambió desde la última lectura');
}

function parseCourseData(body, partial = false) {
  const data = {};
  for (const field of ['titulo', 'descripcion', 'nivel']) {
    if (body?.[field] !== undefined) {
      data[field] = String(body[field]).trim();
      if (!data[field]) throw new AuthoringError(400, `${field} no puede estar vacío`);
    }
  }
  if (body?.categoriaId !== undefined) data.categoriaId = String(body.categoriaId);
  if (body?.portadaUrl !== undefined) data.portadaUrl = body.portadaUrl ? String(body.portadaUrl).trim() : null;
  if (body?.emiteCertificado !== undefined) {
    if (typeof body.emiteCertificado !== 'boolean') throw new AuthoringError(400, 'emiteCertificado debe ser booleano');
    data.emiteCertificado = body.emiteCertificado;
  }
  if (!partial && (!data.titulo || !data.descripcion || !data.nivel || !data.categoriaId)) {
    throw new AuthoringError(400, 'titulo, descripcion, nivel y categoriaId son requeridos');
  }
  if (partial && Object.keys(data).length === 0) throw new AuthoringError(400, 'No hay campos para actualizar');
  return data;
}

function parseOrder(value) {
  const number = Number(value);
  if (!Number.isInteger(number)) throw new AuthoringError(400, 'orden debe ser un número entero');
  return number;
}

router.get('/categories', requireAuthoringPrincipal('course:read'), handle(async (req, res) => {
  const categories = await prisma.categoria.findMany({ orderBy: { nombre: 'asc' } });
  res.json({ success: true, data: { categories } });
}));

router.get('/courses', requireAuthoringPrincipal('course:read'), handle(async (req, res) => {
  const where = req.authoringPrincipal.kind === 'jwt' && req.dbUser.rol === 'ADMIN'
    ? {}
    : { creadorId: req.dbUser.id };
  const courses = await prisma.curso.findMany({
    where,
    include: { categoria: true, _count: { select: { modulos: true, inscripciones: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: { courses } });
}));

router.get('/courses/:id', requireAuthoringPrincipal('course:read'), handle(async (req, res) => {
  const course = await prisma.curso.findUnique({ where: { id: req.params.id }, include: COURSE_SNAPSHOT_INCLUDE });
  assertCourseAccess(req.authoringPrincipal, course);
  res.json({
    success: true,
    data: {
      course,
      fingerprint: resourceFingerprint(course, ['titulo', 'descripcion', 'nivel', 'categoriaId', 'portadaUrl', 'emiteCertificado', 'publicado']),
      publicationFingerprint: fingerprint(coursePublicationSummary(course)),
      resources: Object.fromEntries(course.modulos.map((module) => [module.id, moduleResourceFingerprints(module)])),
    },
  });
}));

router.get('/modules/:id', requireAuthoringPrincipal('course:read'), handle(async (req, res) => {
  const module = await prisma.modulo.findUnique({ where: { id: req.params.id }, include: MODULE_SNAPSHOT_INCLUDE });
  if (!module) throw new AuthoringError(404, 'Módulo no encontrado');
  assertCourseAccess(req.authoringPrincipal, module.curso);
  const resources = moduleResourceFingerprints(module);
  res.json({
    success: true,
    data: {
      module,
      fingerprint: resources.module,
      publicationFingerprint: fingerprint(modulePublicationSummary(module)),
      resources,
    },
  });
}));

router.post('/courses', requireAuthoringPrincipal('course:create'), handle(async (req, res) => {
  await executeIdempotent(req, res, { accion: 'course.create' }, async (tx) => {
    const course = await tx.curso.create({
      data: { ...parseCourseData(req.body), publicado: false, creadorId: req.dbUser.id },
      include: { categoria: true },
    });
    return { status: 201, data: { course } };
  });
}));

router.put('/courses/:id', requireAuthoringPrincipal('content:write'), handle(async (req, res) => {
  await executeIdempotent(req, res, { accion: 'course.update', cursoId: req.params.id }, async (tx) => {
    const course = await tx.curso.findUnique({ where: { id: req.params.id } });
    assertCourseAccess(req.authoringPrincipal, course);
    if (course.publicado) throw new AuthoringError(409, 'Solo se puede editar un curso en borrador');
    assertExpected(req, resourceFingerprint(course, ['titulo', 'descripcion', 'nivel', 'categoriaId', 'portadaUrl', 'emiteCertificado', 'publicado']));
    const updated = await tx.curso.update({ where: { id: course.id }, data: parseCourseData(req.body, true) });
    return { data: { course: updated } };
  });
}));

router.post('/courses/:courseId/modules', requireAuthoringPrincipal('content:write'), handle(async (req, res) => {
  await executeIdempotent(req, res, { accion: 'module.create', cursoId: req.params.courseId }, async (tx) => {
    const course = await tx.curso.findUnique({ where: { id: req.params.courseId } });
    assertCourseAccess(req.authoringPrincipal, course);
    if (!req.body?.titulo || req.body?.orden === undefined) throw new AuthoringError(400, 'titulo y orden son requeridos');
    const module = await tx.modulo.create({
      data: {
        titulo: String(req.body.titulo).trim(),
        descripcion: req.body.descripcion ? String(req.body.descripcion).trim() : null,
        orden: parseOrder(req.body.orden),
        cursoId: course.id,
        estado: 'BORRADOR',
      },
    });
    return { status: 201, data: { module } };
  });
}));

router.put('/modules/:id', requireAuthoringPrincipal('content:write'), handle(async (req, res) => {
  await executeIdempotent(req, res, { accion: 'module.update' }, async (tx) => {
    const module = await tx.modulo.findUnique({ where: { id: req.params.id }, include: { curso: true } });
    if (!module) throw new AuthoringError(404, 'Módulo no encontrado');
    assertCourseAccess(req.authoringPrincipal, module.curso);
    assertDraftModule(module);
    assertExpected(req, resourceFingerprint(module, ['titulo', 'descripcion', 'orden', 'estado']));
    const data = {};
    if (req.body?.titulo !== undefined) data.titulo = String(req.body.titulo).trim();
    if (req.body?.descripcion !== undefined) data.descripcion = req.body.descripcion ? String(req.body.descripcion).trim() : null;
    if (req.body?.orden !== undefined) data.orden = parseOrder(req.body.orden);
    if (!Object.keys(data).length) throw new AuthoringError(400, 'No hay campos para actualizar');
    const updated = await tx.modulo.update({ where: { id: module.id }, data });
    return { data: { module: updated } };
  });
}));

router.post('/modules/:moduleId/lessons', requireAuthoringPrincipal('content:write'), handle(async (req, res) => {
  await executeIdempotent(req, res, { accion: 'lesson.create' }, async (tx) => {
    const module = await tx.modulo.findUnique({ where: { id: req.params.moduleId }, include: { curso: true } });
    if (!module) throw new AuthoringError(404, 'Módulo no encontrado');
    assertCourseAccess(req.authoringPrincipal, module.curso);
    assertDraftModule(module);
    if (!req.body?.titulo || req.body?.contenido === undefined || req.body?.orden === undefined) {
      throw new AuthoringError(400, 'titulo, contenido y orden son requeridos');
    }
    const lesson = await tx.leccion.create({
      data: {
        titulo: String(req.body.titulo).trim(),
        contenido: String(req.body.contenido),
        formatoContenido: 'MARKDOWN',
        videoUrl: req.body.videoUrl ? String(req.body.videoUrl).trim() : null,
        orden: parseOrder(req.body.orden),
        moduloId: module.id,
      },
    });
    return { status: 201, data: { lesson } };
  });
}));

router.put('/lessons/:id', requireAuthoringPrincipal('content:write'), handle(async (req, res) => {
  await executeIdempotent(req, res, { accion: 'lesson.update' }, async (tx) => {
    const lesson = await tx.leccion.findUnique({
      where: { id: req.params.id },
      include: { modulo: { include: { curso: true } } },
    });
    if (!lesson) throw new AuthoringError(404, 'Lección no encontrada');
    assertCourseAccess(req.authoringPrincipal, lesson.modulo.curso);
    assertDraftModule(lesson.modulo);
    assertExpected(req, resourceFingerprint(lesson, ['titulo', 'contenido', 'formatoContenido', 'videoUrl', 'orden']));
    const data = { formatoContenido: 'MARKDOWN' };
    if (req.body?.titulo !== undefined) data.titulo = String(req.body.titulo).trim();
    if (req.body?.contenido !== undefined) data.contenido = String(req.body.contenido);
    if (req.body?.videoUrl !== undefined) data.videoUrl = req.body.videoUrl ? String(req.body.videoUrl).trim() : null;
    if (req.body?.orden !== undefined) data.orden = parseOrder(req.body.orden);
    const updated = await tx.leccion.update({ where: { id: lesson.id }, data });
    return { data: { lesson: updated } };
  });
}));

function validateQuiz(body) {
  const questions = body?.questions;
  if (!String(body?.titulo || '').trim() || !Array.isArray(questions) || questions.length === 0) {
    throw new AuthoringError(400, 'titulo y questions son requeridos');
  }
  return questions.map((question, index) => {
    if (!String(question.texto || '').trim() || !['OPCION_MULTIPLE', 'VERDADERO_FALSO', 'RESPUESTA_CORTA'].includes(question.tipo)) {
      throw new AuthoringError(400, 'Cada pregunta necesita texto y tipo válido');
    }
    const options = Array.isArray(question.options) ? question.options : [];
    if (!options.some((option) => option.esCorrecta)) throw new AuthoringError(400, 'Cada pregunta necesita al menos una respuesta correcta');
    return { ...question, orden: Number.isInteger(question.orden) ? question.orden : index + 1, options };
  });
}

function quizConfig(body) {
  const intentosMax = Number(body?.intentosMax ?? 3);
  const notaMinima = Number(body?.notaMinima ?? 70);
  if (!Number.isInteger(intentosMax) || intentosMax < 1 || intentosMax > 10) {
    throw new AuthoringError(400, 'intentosMax debe ser un entero entre 1 y 10');
  }
  if (!Number.isFinite(notaMinima) || notaMinima < 0 || notaMinima > 100) {
    throw new AuthoringError(400, 'notaMinima debe estar entre 0 y 100');
  }
  return { intentosMax, notaMinima };
}

router.put('/modules/:id/quiz', requireAuthoringPrincipal('content:write'), handle(async (req, res) => {
  await executeIdempotent(req, res, { accion: 'quiz.upsert' }, async (tx) => {
    const module = await tx.modulo.findUnique({
      where: { id: req.params.id },
      include: { curso: true, evaluacion: true },
    });
    if (!module) throw new AuthoringError(404, 'Módulo no encontrado');
    assertCourseAccess(req.authoringPrincipal, module.curso);
    assertDraftModule(module);
    assertExpected(req, resourceFingerprint(module, ['titulo', 'descripcion', 'orden', 'estado']));
    if (module.evaluacion) {
      const attempts = await tx.intento.count({ where: { evaluacionId: module.evaluacion.id } });
      if (attempts > 0) throw new AuthoringError(409, 'No se puede modificar una evaluación con intentos');
    }
    const questions = validateQuiz(req.body);
    const config = quizConfig(req.body);
    let evaluation;
    if (module.evaluacion) {
      const questionRows = await tx.pregunta.findMany({ where: { evaluacionId: module.evaluacion.id }, select: { id: true } });
      const questionIds = questionRows.map((question) => question.id);
      if (questionIds.length) await tx.opcion.deleteMany({ where: { preguntaId: { in: questionIds } } });
      await tx.pregunta.deleteMany({ where: { evaluacionId: module.evaluacion.id } });
      evaluation = await tx.evaluacion.update({
        where: { id: module.evaluacion.id },
        data: { titulo: String(req.body.titulo).trim(), ...config },
      });
    } else {
      evaluation = await tx.evaluacion.create({
        data: { titulo: String(req.body.titulo).trim(), moduloId: module.id, esFinal: false, ...config },
      });
    }
    for (const question of questions) {
      await tx.pregunta.create({
        data: {
          texto: String(question.texto).trim(),
          tipo: question.tipo,
          orden: question.orden,
          evaluacionId: evaluation.id,
          opciones: { create: question.options.map((option) => ({ texto: String(option.texto).trim(), esCorrecta: Boolean(option.esCorrecta) })) },
        },
      });
    }
    return { data: { evaluation } };
  });
}));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/lessons/:lessonId/materials', requireAuthoringPrincipal('material:write'), upload.single('file'), handle(async (req, res) => {
  if (!req.file) throw new AuthoringError(400, 'Archivo requerido (campo "file")');
  const inspection = inspectAuthoringFile(req.file);
  if (!inspection.ok) throw new AuthoringError(400, inspection.message);
  const productionUpload = process.env.NODE_ENV === 'production';
  if (productionUpload && !cloudinaryEnabled) {
    throw new AuthoringError(503, 'Cloudinary no está configurado para uploads de autoría');
  }
  const requestedName = sanitizeFilename(req.body?.nombre || req.file.originalname);
  const safeName = `${path.basename(requestedName, path.extname(requestedName))}${inspection.extension}`;
  const idempotencyKey = req.get('Idempotency-Key') || '';
  const publicId = `authoring-${fingerprint({ actor: req.authoringPrincipal.actorKey, idempotencyKey, sha256: inspection.sha256 }).slice(0, 32)}`;
  let stored = null;
  try {
    await executeIdempotent(req, res, {
      accion: 'material.attach',
      fingerprintExtra: { fileSha256: inspection.sha256, safeName },
    }, async (tx) => {
      const lesson = await tx.leccion.findUnique({
        where: { id: req.params.lessonId },
        include: { modulo: { include: { curso: true } } },
      });
      if (!lesson) throw new AuthoringError(404, 'Lección no encontrada');
      assertCourseAccess(req.authoringPrincipal, lesson.modulo.curso);
      assertDraftModule(lesson.modulo);
      if (productionUpload) {
        stored = await uploadBuffer(req.file.buffer, 'titi/materials', inspection.resourceType, { public_id: publicId, overwrite: true });
      } else {
        const filename = `${inspection.sha256.slice(0, 24)}-${safeName}`;
        await fs.promises.writeFile(path.join(materialsDir, filename), req.file.buffer);
        stored = { url: `/uploads/materials/${filename}`, publicId: null, localPath: path.join(materialsDir, filename) };
      }
      const material = await tx.material.create({
        data: { nombre: safeName, tipo: inspection.tipo, url: stored.url, publicId: stored.publicId, sha256: inspection.sha256, leccionId: lesson.id },
      });
      return { status: 201, data: { material } };
    });
  } catch (err) {
    if (stored?.publicId) await destroyAsset(stored.publicId, inspection.resourceType);
    if (stored?.localPath) await fs.promises.unlink(stored.localPath).catch(() => {});
    throw err;
  }
}));

async function deleteResource(req, res, kind) {
  const assetsToDelete = [];
  await executeIdempotent(req, res, { accion: `${kind}.delete` }, async (tx) => {
    if (kind === 'course') {
      const course = await tx.curso.findUnique({
        where: { id: req.params.id },
        include: {
          _count: { select: { inscripciones: true } },
          modulos: { include: { lecciones: { select: { id: true, materiales: { select: { publicId: true, url: true, tipo: true } } } }, evaluacion: { select: { id: true } } } },
        },
      });
      assertCourseAccess(req.authoringPrincipal, course);
      if (course.publicado || course._count.inscripciones > 0) throw new AuthoringError(409, 'Solo se puede borrar un curso borrador sin inscripciones');
      assertExpected(req, resourceFingerprint(course, ['titulo', 'descripcion', 'nivel', 'categoriaId', 'portadaUrl', 'emiteCertificado', 'publicado']));
      const lessonIds = course.modulos.flatMap((module) => module.lecciones.map((lesson) => lesson.id));
      assetsToDelete.push(...course.modulos.flatMap((module) => module.lecciones.flatMap((lesson) => lesson.materiales)));
      const moduleEvaluationIds = course.modulos.map((module) => module.evaluacion?.id).filter(Boolean);
      const finalEvaluations = await tx.evaluacion.findMany({ where: { cursoId: course.id }, select: { id: true } });
      const evaluationIds = [...moduleEvaluationIds, ...finalEvaluations.map((evaluation) => evaluation.id)];
      const [progress, notes, comments, attempts] = await Promise.all([
        lessonIds.length ? tx.progreso.count({ where: { leccionId: { in: lessonIds } } }) : 0,
        lessonIds.length ? tx.notaLeccion.count({ where: { leccionId: { in: lessonIds } } }) : 0,
        lessonIds.length ? tx.comentarioLeccion.count({ where: { leccionId: { in: lessonIds } } }) : 0,
        evaluationIds.length ? tx.intento.count({ where: { evaluacionId: { in: evaluationIds } } }) : 0,
      ]);
      if (progress || notes || comments || attempts) throw new AuthoringError(409, 'El curso tiene historial de aprendizaje y no puede borrarse');
      if (lessonIds.length) {
        await tx.material.deleteMany({ where: { leccionId: { in: lessonIds } } });
        await tx.leccion.deleteMany({ where: { id: { in: lessonIds } } });
      }
      if (evaluationIds.length) {
        const questions = await tx.pregunta.findMany({ where: { evaluacionId: { in: evaluationIds } }, select: { id: true } });
        const questionIds = questions.map((question) => question.id);
        if (questionIds.length) await tx.opcion.deleteMany({ where: { preguntaId: { in: questionIds } } });
        await tx.pregunta.deleteMany({ where: { evaluacionId: { in: evaluationIds } } });
        await tx.evaluacion.deleteMany({ where: { id: { in: evaluationIds } } });
      }
      await tx.modulo.deleteMany({ where: { cursoId: course.id } });
      await tx.cursoProfesor.deleteMany({ where: { cursoId: course.id } });
      await tx.curso.delete({ where: { id: course.id } });
      return { data: { deleted: course.id } };
    }
    if (kind === 'module') {
      const module = await tx.modulo.findUnique({ where: { id: req.params.id }, include: { curso: true, lecciones: { select: { id: true, materiales: { select: { publicId: true, url: true, tipo: true } } } }, evaluacion: { select: { id: true } } } });
      if (!module) throw new AuthoringError(404, 'Módulo no encontrado');
      assertCourseAccess(req.authoringPrincipal, module.curso);
      assertDraftModule(module);
      assertExpected(req, resourceFingerprint(module, ['titulo', 'descripcion', 'orden', 'estado']));
      const lessonIds = module.lecciones.map((lesson) => lesson.id);
      assetsToDelete.push(...module.lecciones.flatMap((lesson) => lesson.materiales));
      const [progress, attempts] = await Promise.all([
        lessonIds.length ? tx.progreso.count({ where: { leccionId: { in: lessonIds } } }) : 0,
        module.evaluacion ? tx.intento.count({ where: { evaluacionId: module.evaluacion.id } }) : 0,
      ]);
      if (progress || attempts) throw new AuthoringError(409, 'El módulo tiene historial de aprendizaje y no puede borrarse');
      if (lessonIds.length) {
        const [notes, comments] = await Promise.all([
          tx.notaLeccion.count({ where: { leccionId: { in: lessonIds } } }),
          tx.comentarioLeccion.count({ where: { leccionId: { in: lessonIds } } }),
        ]);
        if (notes || comments) throw new AuthoringError(409, 'El módulo tiene historial y no puede borrarse');
        await tx.material.deleteMany({ where: { leccionId: { in: lessonIds } } });
        await tx.leccion.deleteMany({ where: { id: { in: lessonIds } } });
      }
      if (module.evaluacion) {
        const questions = await tx.pregunta.findMany({ where: { evaluacionId: module.evaluacion.id }, select: { id: true } });
        const questionIds = questions.map((question) => question.id);
        if (questionIds.length) await tx.opcion.deleteMany({ where: { preguntaId: { in: questionIds } } });
        await tx.pregunta.deleteMany({ where: { evaluacionId: module.evaluacion.id } });
        await tx.evaluacion.delete({ where: { id: module.evaluacion.id } });
      }
      await tx.modulo.delete({ where: { id: module.id } });
      return { data: { deleted: module.id } };
    }
    if (kind === 'lesson') {
      const lesson = await tx.leccion.findUnique({ where: { id: req.params.id }, include: { modulo: { include: { curso: true } }, materiales: { select: { publicId: true, url: true, tipo: true } } } });
      if (!lesson) throw new AuthoringError(404, 'Lección no encontrada');
      assertCourseAccess(req.authoringPrincipal, lesson.modulo.curso);
      assertDraftModule(lesson.modulo);
      assetsToDelete.push(...lesson.materiales);
      assertExpected(req, resourceFingerprint(lesson, ['titulo', 'contenido', 'formatoContenido', 'videoUrl', 'orden']));
      const [progress, notes, comments] = await Promise.all([
        tx.progreso.count({ where: { leccionId: lesson.id } }),
        tx.notaLeccion.count({ where: { leccionId: lesson.id } }),
        tx.comentarioLeccion.count({ where: { leccionId: lesson.id } }),
      ]);
      if (progress || notes || comments) throw new AuthoringError(409, 'La lección tiene historial y no puede borrarse');
      await tx.material.deleteMany({ where: { leccionId: lesson.id } });
      await tx.leccion.delete({ where: { id: lesson.id } });
      return { data: { deleted: lesson.id } };
    }
    const material = await tx.material.findUnique({ where: { id: req.params.id }, include: { leccion: { include: { modulo: { include: { curso: true } } } } } });
    if (!material) throw new AuthoringError(404, 'Material no encontrado');
    assertCourseAccess(req.authoringPrincipal, material.leccion.modulo.curso);
    assertDraftModule(material.leccion.modulo);
    assertExpected(req, resourceFingerprint(material, ['nombre', 'tipo', 'url', 'publicId', 'sha256']));
    assetsToDelete.push({ publicId: material.publicId, url: material.url, tipo: material.tipo });
    await tx.material.delete({ where: { id: material.id } });
    return { data: { deleted: material.id } };
  });
  for (const asset of assetsToDelete) {
    if (asset.publicId) {
      await destroyAsset(asset.publicId, asset.tipo === 'imagen' ? 'image' : 'raw');
    } else if (asset.url?.startsWith('/uploads/materials/')) {
      await fs.promises.unlink(path.join(materialsDir, path.basename(asset.url))).catch(() => {});
    }
  }
}

for (const [route, kind, scope] of [
  ['/courses/:id', 'course', 'content:write'],
  ['/modules/:id', 'module', 'content:write'],
  ['/lessons/:id', 'lesson', 'content:write'],
  ['/materials/:id', 'material', 'material:write'],
]) router.delete(route, requireAuthoringPrincipal(scope), handle((req, res) => deleteResource(req, res, kind)));

async function previewPublication(req, res, resourceType) {
  const isCourse = resourceType === 'course';
  const resource = isCourse
    ? await prisma.curso.findUnique({ where: { id: req.params.id }, include: COURSE_SNAPSHOT_INCLUDE })
    : await prisma.modulo.findUnique({ where: { id: req.params.id }, include: MODULE_SNAPSHOT_INCLUDE });
  if (!resource) throw new AuthoringError(404, isCourse ? 'Curso no encontrado' : 'Módulo no encontrado');
  assertCourseAccess(req.authoringPrincipal, isCourse ? resource : resource.curso);
  const summary = isCourse ? coursePublicationSummary(resource) : modulePublicationSummary(resource);
  const currentFingerprint = fingerprint(summary);
  const confirmation = createPublicationConfirmation({ resourceType, resourceId: resource.id, expectedFingerprint: currentFingerprint });
  if (!confirmation) throw new AuthoringError(503, 'AUTHORING_CONFIRMATION_SECRET no está configurado');
  res.json({ success: true, data: { summary, fingerprint: currentFingerprint, ...confirmation } });
}

router.post('/courses/:id/preview-publication', requireAuthoringPrincipal('publish'), handle((req, res) => previewPublication(req, res, 'course')));
router.post('/modules/:id/preview-publication', requireAuthoringPrincipal('publish'), handle((req, res) => previewPublication(req, res, 'module')));

async function publish(req, res, resourceType) {
  await executeIdempotent(req, res, { accion: `${resourceType}.publish` }, async (tx) => {
    const isCourse = resourceType === 'course';
    const resource = isCourse
      ? await tx.curso.findUnique({ where: { id: req.params.id }, include: COURSE_SNAPSHOT_INCLUDE })
      : await tx.modulo.findUnique({ where: { id: req.params.id }, include: MODULE_SNAPSHOT_INCLUDE });
    if (!resource) throw new AuthoringError(404, isCourse ? 'Curso no encontrado' : 'Módulo no encontrado');
    assertCourseAccess(req.authoringPrincipal, isCourse ? resource : resource.curso);
    const currentFingerprint = fingerprint(isCourse ? coursePublicationSummary(resource) : modulePublicationSummary(resource));
    const expectedFingerprint = req.body?.expectedFingerprint;
    if (!expectedFingerprint || currentFingerprint !== expectedFingerprint) throw new AuthoringError(412, 'La vista previa quedó obsoleta');
    const confirmation = verifyPublicationConfirmation({
      confirmationToken: req.body?.confirmationToken,
      phrase: req.body?.phrase,
      resourceType,
      resourceId: resource.id,
      expectedFingerprint,
    });
    if (!confirmation.ok) throw new AuthoringError(422, confirmation.reason === 'expired' ? 'La confirmación expiró' : 'Confirmación de publicación inválida');
    if (isCourse) {
      if (!resource.modulos.some((module) => module.estado === 'PUBLICADO')) throw new AuthoringError(422, 'El curso necesita al menos un módulo publicado');
      const course = await tx.curso.update({ where: { id: resource.id }, data: { publicado: true } });
      return { data: { course } };
    }
    const module = await tx.modulo.update({ where: { id: resource.id }, data: { estado: 'PUBLICADO' } });
    return { data: { module } };
  });
}

router.post('/courses/:id/publish', requireAuthoringPrincipal('publish'), handle((req, res) => publish(req, res, 'course')));
router.post('/modules/:id/publish', requireAuthoringPrincipal('publish'), handle((req, res) => publish(req, res, 'module')));

router.post('/modules/:id/unpublish', requireAuthoringPrincipal('publish'), handle(async (req, res) => {
  await executeIdempotent(req, res, { accion: 'module.unpublish' }, async (tx) => {
    const module = await tx.modulo.findUnique({ where: { id: req.params.id }, include: { curso: true } });
    if (!module) throw new AuthoringError(404, 'Módulo no encontrado');
    assertCourseAccess(req.authoringPrincipal, module.curso);
    assertExpected(req, resourceFingerprint(module, ['titulo', 'descripcion', 'orden', 'estado']));
    const updated = await tx.modulo.update({ where: { id: module.id }, data: { estado: 'BORRADOR' } });
    return { data: { module: updated } };
  });
}));

router.get('/evaluations/:id/analytics', requireAuthoringPrincipal('analytics:read'), handle(async (req, res) => {
  const evaluation = await prisma.evaluacion.findUnique({
    where: { id: req.params.id },
    include: { modulo: { include: { curso: true } } },
  });
  if (!evaluation) throw new AuthoringError(404, 'Evaluación no encontrada');
  const course = evaluation.modulo?.curso || (evaluation.cursoId
    ? await prisma.curso.findUnique({ where: { id: evaluation.cursoId } })
    : null);
  if (!course) throw new AuthoringError(404, 'Curso de la evaluación no encontrado');
  assertCourseAccess(req.authoringPrincipal, course);
  const intents = await prisma.intento.findMany({
    where: { evaluacionId: evaluation.id },
    select: { usuarioId: true, nota: true, aprobado: true },
  });
  res.json({ success: true, data: { evaluationId: evaluation.id, analytics: privateAnalytics(intents) } });
}));

router.post('/service-tokens', requireAuthoringPrincipal(), requireAuthoringJwt, handle(async (req, res) => {
  const nombre = String(req.body?.nombre || '').trim();
  const scopes = Array.isArray(req.body?.scopes) ? [...new Set(req.body.scopes.map(String))] : [];
  if (!nombre || scopes.length === 0 || scopes.some((scope) => !AUTHORING_SCOPES.includes(scope))) {
    throw new AuthoringError(400, 'nombre y scopes válidos son requeridos');
  }
  const expiresInHours = Number(req.body?.expiresInHours ?? 24 * 30);
  if (!Number.isFinite(expiresInHours) || expiresInHours < 1 || expiresInHours > 24 * 90) {
    throw new AuthoringError(400, 'expiresInHours debe estar entre 1 y 2160');
  }
  await executeIdempotent(req, res, { accion: 'service-token.create' }, async (tx) => {
    const generated = generateServiceToken();
    const tokenService = await tx.tokenServicio.create({
      data: {
        nombre,
        prefijo: generated.prefijo,
        tokenHash: generated.tokenHash,
        scopes,
        expiresAt: new Date(Date.now() + expiresInHours * 3_600_000),
        usuarioId: req.dbUser.id,
      },
      select: { id: true, nombre: true, prefijo: true, scopes: true, expiresAt: true, createdAt: true },
    });
    return {
      status: 201,
      data: { tokenService, token: generated.token },
      persistedData: { tokenService, token: null },
    };
  });
}));

router.get('/service-tokens', requireAuthoringPrincipal(), requireAuthoringJwt, handle(async (req, res) => {
  const tokens = await prisma.tokenServicio.findMany({
    where: { usuarioId: req.dbUser.id },
    select: { id: true, nombre: true, prefijo: true, scopes: true, expiresAt: true, revokedAt: true, lastUsedAt: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: { tokens } });
}));

router.post('/service-tokens/:id/revoke', requireAuthoringPrincipal(), requireAuthoringJwt, handle(async (req, res) => {
  await executeIdempotent(req, res, { accion: 'service-token.revoke' }, async (tx) => {
    const tokenService = await tx.tokenServicio.findUnique({ where: { id: req.params.id } });
    if (!tokenService || tokenService.usuarioId !== req.dbUser.id) throw new AuthoringError(404, 'Token de servicio no encontrado');
    const revoked = tokenService.revokedAt
      ? tokenService
      : await tx.tokenServicio.update({ where: { id: tokenService.id }, data: { revokedAt: new Date() } });
    return { data: { tokenService: { id: revoked.id, revokedAt: revoked.revokedAt } } };
  });
}));

router.use((err, req, res, next) => {
  if (!(err instanceof multer.MulterError)) return next(err);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, message: 'El archivo supera el límite de 10 MiB' });
  }
  return res.status(400).json({ success: false, message: 'Upload multipart inválido' });
});

export default router;
