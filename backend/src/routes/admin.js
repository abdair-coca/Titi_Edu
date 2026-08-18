import { Router } from 'express';
import prisma from '../prisma.js';
import { runQuery } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/permissions.js';
import { createPublicationConfirmation, fingerprint, verifyPublicationConfirmation } from '../services/authoring.service.js';
import { executeIdempotent } from '../services/authoring-idempotency.service.js';
import {
  cleanupDeletedCourseInNeo4j,
  collectDeletionDependencies,
  deletionFingerprint,
  deleteDeletionDependencies,
} from '../services/content-deletion.service.js';

const router = Router();

const ROLES_VALIDOS = ['ESTUDIANTE', 'PROFESOR', 'ADMIN'];

class AdminDeletionError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function courseDeletionFingerprint(course, impact) {
  const resource = Object.fromEntries([
    'titulo', 'descripcion', 'nivel', 'categoriaId', 'portadaUrl', 'emiteCertificado', 'publicado', 'version',
  ].map((field) => [field, course[field]]));
  return deletionFingerprint('course', fingerprint(resource), impact);
}

function adminPrincipal(req) {
  req.authoringPrincipal = {
    kind: 'jwt',
    actorKey: `admin:${req.dbUser.id}`,
    usuario: req.dbUser,
    tokenServicio: null,
  };
}

// Todas las rutas exigen ADMIN.
router.use(requireAuth, requireRole('ADMIN'));

// ---- GET /users  — lista paginada ----
router.get('/users', async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));

    const [usuarios, total] = await Promise.all([
      prisma.usuario.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          username: true,
          email: true,
          rol: true,
          verificado: true,
          racha: true,
          ultimaActividad: true,
          createdAt: true,
          _count: { select: { cursosCreados: true } },
        },
      }),
      prisma.usuario.count(),
    ]);

    res.json({ success: true, data: { usuarios, page, pageSize, total } });
  } catch (err) {
    console.error('GET /admin/users error', err);
    res.status(500).json({ success: false, message: 'Error obteniendo usuarios' });
  }
});

// ---- PUT /users/:id/verify  — verificar profesor ----
router.put('/users/:id/verify', async (req, res) => {
  try {
    const usuario = await prisma.usuario.findUnique({ where: { id: req.params.id } });
    if (!usuario) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }
    if (usuario.rol !== 'PROFESOR') {
      return res.status(400).json({ success: false, message: 'Solo se puede verificar a un profesor' });
    }
    const actualizado = await prisma.usuario.update({
      where: { id: usuario.id },
      data: { verificado: true },
      select: { id: true, username: true, rol: true, verificado: true },
    });
    res.json({ success: true, data: { usuario: actualizado } });
  } catch (err) {
    console.error('PUT /admin/users/:id/verify error', err);
    res.status(500).json({ success: false, message: 'Error verificando al profesor' });
  }
});

// ---- PUT /users/:id/role  — cambiar rol ----
router.put('/users/:id/role', async (req, res) => {
  try {
    const { rol } = req.body || {};
    if (!ROLES_VALIDOS.includes(rol)) {
      return res.status(400).json({ success: false, message: `rol debe ser uno de: ${ROLES_VALIDOS.join(', ')}` });
    }
    // No permitir que un admin se quite a sí mismo el rol (evita auto-lockout).
    if (req.dbUser.id === req.params.id && rol !== 'ADMIN') {
      return res.status(400).json({ success: false, message: 'No puedes cambiar tu propio rol de admin' });
    }

    const usuario = await prisma.usuario.findUnique({ where: { id: req.params.id } });
    if (!usuario) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    // `verificado` solo aplica a PROFESOR — al salir de ese rol se limpia.
    const data = { rol };
    if (rol !== 'PROFESOR') data.verificado = false;

    const actualizado = await prisma.usuario.update({
      where: { id: usuario.id },
      data,
      select: { id: true, username: true, rol: true, verificado: true },
    });
    res.json({ success: true, data: { usuario: actualizado } });
  } catch (err) {
    console.error('PUT /admin/users/:id/role error', err);
    res.status(500).json({ success: false, message: 'Error cambiando el rol' });
  }
});

// ---- GET /courses  — todos los cursos, incl. borradores ----
router.get('/courses', async (req, res) => {
  try {
    const where = {};
    if (req.query.publicado === 'true') where.publicado = true;
    if (req.query.publicado === 'false') where.publicado = false;

    const cursos = await prisma.curso.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        categoria: true,
        creador: { select: { id: true, username: true } },
        _count: { select: { inscripciones: true, modulos: true } },
      },
    });
    res.json({ success: true, data: { cursos } });
  } catch (err) {
    console.error('GET /admin/courses error', err);
    res.status(500).json({ success: false, message: 'Error obteniendo cursos' });
  }
});

// ---- PUT /courses/:id/approve  — publicar (acción de admin) ----
router.put('/courses/:id/approve', async (req, res) => {
  try {
    const actualizado = await prisma.curso.update({
      where: { id: req.params.id },
      data: { publicado: true },
      select: { id: true, titulo: true, publicado: true },
    });
    res.json({ success: true, data: { curso: actualizado } });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Curso no encontrado' });
    }
    console.error('PUT /admin/courses/:id/approve error', err);
    res.status(500).json({ success: false, message: 'Error aprobando el curso' });
  }
});

// ---- POST /courses/:id/preview-deletion — impacto firmado para moderación ----
router.post('/courses/:id/preview-deletion', async (req, res) => {
  try {
    const curso = await prisma.curso.findUnique({ where: { id: req.params.id } });
    if (!curso) return res.status(404).json({ success: false, message: 'Curso no encontrado' });
    const dependencies = await collectDeletionDependencies(prisma, { kind: 'course', resourceId: curso.id });
    const currentFingerprint = courseDeletionFingerprint(curso, dependencies.impact);
    const confirmation = createPublicationConfirmation({
      resourceType: 'course', resourceId: curso.id, expectedFingerprint: currentFingerprint, action: 'delete',
    });
    if (!confirmation) return res.status(503).json({ success: false, message: 'AUTHORING_CONFIRMATION_SECRET no está configurado' });
    res.json({ success: true, data: { impact: dependencies.impact, fingerprint: currentFingerprint, ...confirmation } });
  } catch (err) {
    console.error('POST /admin/courses/:id/preview-deletion error', err);
    res.status(500).json({ success: false, message: 'Error preparando el borrado del curso' });
  }
});

// ---- DELETE /courses/:id — borrado físico confirmado, idempotente y FK-safe ----
router.delete('/courses/:id', async (req, res) => {
  try {
    adminPrincipal(req);
    await executeIdempotent(req, res, {
      accion: 'admin.course.delete',
      transactionOptions: { timeout: 20_000, maxWait: 10_000 },
    }, async (tx) => {
      const curso = await tx.curso.findUnique({ where: { id: req.params.id } });
      if (!curso) throw new AdminDeletionError(404, 'Curso no encontrado');
      const dependencies = await collectDeletionDependencies(tx, { kind: 'course', resourceId: curso.id });
      const currentFingerprint = courseDeletionFingerprint(curso, dependencies.impact);
      const expectedFingerprint = req.body?.expectedFingerprint || req.get('If-Match');
      if (!expectedFingerprint) throw new AdminDeletionError(428, 'expectedFingerprint es requerido');
      if (expectedFingerprint !== currentFingerprint) throw new AdminDeletionError(412, 'La vista previa quedó obsoleta');
      const confirmation = verifyPublicationConfirmation({
        confirmationToken: req.body?.confirmationToken,
        phrase: req.body?.phrase,
        resourceType: 'course',
        resourceId: curso.id,
        expectedFingerprint: currentFingerprint,
        action: 'delete',
      });
      if (!confirmation.ok) {
        throw new AdminDeletionError(422, confirmation.reason === 'expired' ? 'La confirmación expiró' : 'Confirmación de eliminación inválida');
      }
      const claimed = await tx.curso.updateMany({
        where: { id: curso.id, version: curso.version },
        data: { version: { increment: 1 } },
      });
      if (claimed.count !== 1) throw new AdminDeletionError(412, 'El curso cambió durante la operación');
      await deleteDeletionDependencies(tx, dependencies);
      return {
        data: {
          deleted: curso.id,
          impact: dependencies.impact,
          residualRisk: 'Los archivos de materiales en Cloudinary y disco quedan retenidos hasta una limpieza reconciliada.',
        },
      };
    });
    if (res.statusCode < 300) await cleanupDeletedCourseInNeo4j(runQuery, req.params.id);
  } catch (err) {
    if (err instanceof AdminDeletionError) return res.status(err.status).json({ success: false, message: err.message });
    console.error('DELETE /admin/courses/:id error', err);
    res.status(500).json({ success: false, message: 'Error borrando el curso' });
  }
});

// ---- GET /stats  — totales del sistema ----
router.get('/stats', async (req, res) => {
  try {
    const [usuarios, profesoresVerificados, cursosPublicados, inscripciones, certificados] = await Promise.all([
      prisma.usuario.count(),
      prisma.usuario.count({ where: { rol: 'PROFESOR', verificado: true } }),
      prisma.curso.count({ where: { publicado: true } }),
      prisma.inscripcion.count(),
      prisma.certificado.count(),
    ]);
    res.json({
      success: true,
      data: { stats: { usuarios, profesoresVerificados, cursosPublicados, inscripciones, certificados } },
    });
  } catch (err) {
    console.error('GET /admin/stats error', err);
    res.status(500).json({ success: false, message: 'Error obteniendo estadísticas' });
  }
});

// ---- Categorías (CRUD movido aquí desde categories.js) ----

router.post('/categories', async (req, res) => {
  try {
    const { nombre, icono } = req.body || {};
    if (!nombre || !icono) {
      return res.status(400).json({ success: false, message: 'nombre e icono son requeridos' });
    }
    try {
      const categoria = await prisma.categoria.create({
        data: { nombre: String(nombre).trim(), icono: String(icono).trim() },
      });
      res.status(201).json({ success: true, data: { categoria } });
    } catch (err) {
      if (err.code === 'P2002') {
        return res.status(409).json({ success: false, message: 'Ya existe una categoría con ese nombre' });
      }
      throw err;
    }
  } catch (err) {
    console.error('POST /admin/categories error', err);
    res.status(500).json({ success: false, message: 'Error creando categoría' });
  }
});

router.put('/categories/:id', async (req, res) => {
  try {
    const { nombre, icono } = req.body || {};
    const data = {};
    if (nombre !== undefined) data.nombre = String(nombre).trim();
    if (icono !== undefined) data.icono = String(icono).trim();
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ success: false, message: 'Nada que actualizar (nombre o icono)' });
    }
    try {
      const categoria = await prisma.categoria.update({ where: { id: req.params.id }, data });
      res.json({ success: true, data: { categoria } });
    } catch (err) {
      if (err.code === 'P2025') {
        return res.status(404).json({ success: false, message: 'Categoría no encontrada' });
      }
      if (err.code === 'P2002') {
        return res.status(409).json({ success: false, message: 'Ya existe una categoría con ese nombre' });
      }
      throw err;
    }
  } catch (err) {
    console.error('PUT /admin/categories/:id error', err);
    res.status(500).json({ success: false, message: 'Error actualizando categoría' });
  }
});

router.delete('/categories/:id', async (req, res) => {
  try {
    const categoria = await prisma.categoria.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { cursos: true } } },
    });
    if (!categoria) {
      return res.status(404).json({ success: false, message: 'Categoría no encontrada' });
    }
    if (categoria._count.cursos > 0) {
      return res.status(409).json({ success: false, message: 'No puedes borrar una categoría con cursos asociados' });
    }
    await prisma.categoria.delete({ where: { id: categoria.id } });
    res.json({ success: true, data: { deleted: categoria.id } });
  } catch (err) {
    console.error('DELETE /admin/categories/:id error', err);
    res.status(500).json({ success: false, message: 'Error borrando categoría' });
  }
});

export default router;
