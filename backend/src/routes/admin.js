import { Router } from 'express';
import prisma from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// --- Helpers ---

// El JWT lleva el id de Neo4j. En Postgres ese id vive en `Usuario.neoId`.
async function loadCurrentUser(req, res) {
  if (req.dbUser) return req.dbUser;
  const usuario = await prisma.usuario.findUnique({ where: { neoId: req.user.id } });
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
        return res.status(403).json({ success: false, message: 'No tienes permiso para esta acción' });
      }
      next();
    } catch (err) {
      console.error('requireRole error', err);
      res.status(500).json({ success: false, message: 'Error verificando permisos' });
    }
  };
}

const ROLES_VALIDOS = ['ESTUDIANTE', 'PROFESOR', 'ADMIN'];

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

// ---- DELETE /courses/:id  — borrado forzado (override del 409) ----
// A diferencia del DELETE de courses.js, borra aunque tenga inscripciones.
// Cascada completa en orden FK-safe. Los certificados se PRESERVAN: se les
// pone cursoId = null (el título ya está congelado en cursoTitulo), porque un
// certificado emitido es un hecho histórico que no debe desaparecer.
router.delete('/courses/:id', async (req, res) => {
  try {
    const curso = await prisma.curso.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        modulos: { select: { id: true, evaluacion: { select: { id: true } }, lecciones: { select: { id: true } } } },
      },
    });
    if (!curso) {
      return res.status(404).json({ success: false, message: 'Curso no encontrado' });
    }

    const moduloIds = curso.modulos.map((m) => m.id);
    const leccionIds = curso.modulos.flatMap((m) => m.lecciones.map((l) => l.id));
    const finales = await prisma.evaluacion.findMany({ where: { cursoId: curso.id }, select: { id: true } });
    const evalIds = [
      ...curso.modulos.map((m) => m.evaluacion?.id).filter(Boolean),
      ...finales.map((e) => e.id),
    ];
    const preguntaIds = evalIds.length
      ? (await prisma.pregunta.findMany({ where: { evaluacionId: { in: evalIds } }, select: { id: true } })).map((p) => p.id)
      : [];

    // Timeout amplio: la cascada hace muchos deleteMany secuenciales y la DB
    // puede ser remota (Aura/Postgres administrado), superando el default de 5s.
    await prisma.$transaction(
      async (tx) => {
        if (preguntaIds.length) await tx.opcion.deleteMany({ where: { preguntaId: { in: preguntaIds } } });
        if (evalIds.length) {
          await tx.pregunta.deleteMany({ where: { evaluacionId: { in: evalIds } } });
          await tx.intento.deleteMany({ where: { evaluacionId: { in: evalIds } } });
          await tx.evaluacion.deleteMany({ where: { id: { in: evalIds } } });
        }
        if (leccionIds.length) {
          await tx.material.deleteMany({ where: { leccionId: { in: leccionIds } } });
          await tx.progreso.deleteMany({ where: { leccionId: { in: leccionIds } } });
          await tx.comentarioLeccion.deleteMany({ where: { leccionId: { in: leccionIds } } });
          await tx.leccion.deleteMany({ where: { id: { in: leccionIds } } });
        }
        if (moduloIds.length) await tx.modulo.deleteMany({ where: { id: { in: moduloIds } } });
        await tx.inscripcion.deleteMany({ where: { cursoId: curso.id } });
        // Preservar certificados: desvincular del curso (el título queda congelado).
        await tx.certificado.updateMany({ where: { cursoId: curso.id }, data: { cursoId: null } });
        await tx.cursoProfesor.deleteMany({ where: { cursoId: curso.id } });
        await tx.curso.delete({ where: { id: curso.id } });
      },
      { timeout: 20000, maxWait: 10000 },
    );

    res.json({ success: true, data: { deleted: curso.id } });
  } catch (err) {
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
