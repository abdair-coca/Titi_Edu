import { Router } from 'express';
import prisma from '../prisma.js';
import { runQuery, toNumber } from '../db.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { ensureCourseContentAccess, loadCurrentUser, loadOptionalUser, requireRole, isOwnerOrAdmin } from '../middleware/permissions.js';
import { syncInscripcion } from '../services/neo4j-sync.service.js';
import { isDeadlineExpired } from '../services/deadline.service.js';

const router = Router();

const authoringMoved = (req, res) => res.status(410).json({
  success: false,
  message: 'Esta operaciÃ³n docente requiere /api/authoring con control de concurrencia e idempotencia',
});

router.post('/', requireAuth, authoringMoved);
router.put('/:id', requireAuth, authoringMoved);
router.post('/:id/publish', requireAuth, authoringMoved);
router.post('/:id/unpublish', requireAuth, authoringMoved);
router.delete('/:id', requireAuth, authoringMoved);

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
        _count: { select: { inscripciones: true, modulos: { where: { estado: 'PUBLICADO' } } } },
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
            _count: { select: { modulos: { where: { estado: 'PUBLICADO' } } } },
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
        _count: { select: { inscripciones: true, modulos: { where: { estado: 'PUBLICADO' } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: { cursos } });
  } catch (err) {
    console.error('GET /courses/my/teaching error', err);
    res.status(500).json({ success: false, message: 'Error obteniendo cursos enseñados' });
  }
});

// ---- GET /recommended  — cursos que toman mis amigos y yo no (auth) ----
// Debe ir ANTES de /:id para no ser capturada como id="recommended".
router.get('/recommended', requireAuth, async (req, res) => {
  try {
    const records = await runQuery(
      `MATCH (yo:Usuario {id: $neoId})-[:SIGUIO]->(amigo:Usuario)-[:INSCRITO_EN]->(ref:CursoRef)
       WHERE NOT EXISTS { (yo)-[:INSCRITO_EN]->(ref) }
       RETURN ref.cursoId AS cursoId,
              count(DISTINCT amigo) AS friendCount,
              collect(DISTINCT amigo.username)[0..3] AS sampleFriends
       ORDER BY friendCount DESC
       LIMIT 12`,
      { neoId: req.user.id }
    );

    const rows = records.map((r) => ({
      cursoId: r.get('cursoId'),
      friendCount: toNumber(r.get('friendCount')),
      sampleFriends: r.get('sampleFriends') || [],
    }));
    if (rows.length === 0) {
      return res.json({ success: true, data: { recommended: [] } });
    }

    // Hidratar contra Postgres — solo cursos publicados que aún existen
    const cursos = await prisma.curso.findMany({
      where: { id: { in: rows.map((r) => r.cursoId) }, publicado: true },
      include: {
        categoria: true,
        creador: { select: { id: true, username: true } },
        _count: { select: { inscripciones: true, modulos: { where: { estado: 'PUBLICADO' } } } },
      },
    });
    const byId = new Map(cursos.map((c) => [c.id, c]));

    const recommended = rows
      .filter((r) => byId.has(r.cursoId))
      .map((r) => ({
        curso: byId.get(r.cursoId),
        friendCount: r.friendCount,
        sampleFriends: r.sampleFriends,
      }));

    res.json({ success: true, data: { recommended } });
  } catch (err) {
    console.error('GET /courses/recommended error', err);
    res.status(500).json({ success: false, message: 'Error obteniendo recomendaciones' });
  }
});

// ---- GET /:id  — detalle del curso con módulos y lecciones ----
// Guest/no-inscripto: solo temario (sin videoUrl). Borrador: solo dueño/co-profesor/ADMIN.
router.get('/:id', optionalAuth, async (req, res) => {
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
              select: { id: true, titulo: true, orden: true, videoUrl: true, publishedAt: true, estado: true },
            },
            evaluacion: {
              select: { id: true, titulo: true, esFinal: true, notaMinima: true, fechaLimite: true },
            },
          },
        },
        _count: { select: { inscripciones: true } },
      },
    });

    if (!curso) {
      return res.status(404).json({ success: false, message: 'Curso no encontrado' });
    }

    const usuario = await loadOptionalUser(req);
    const isAdmin = usuario?.rol === 'ADMIN';
    const isOwner = Boolean(
      usuario &&
        (curso.creadorId === usuario.id ||
          curso.profesores.some((p) => p.profesorId === usuario.id)),
    );

    // Borrador: no filtrar existencia — 404 en vez de 403 para quien no es dueño/admin.
    if (!curso.publicado && !isOwner && !isAdmin) {
      return res.status(404).json({ success: false, message: 'Curso no encontrado' });
    }

    let enrolled = false;
    if (usuario && !isOwner && !isAdmin) {
      const inscripcion = await prisma.inscripcion.findUnique({
        where: { usuarioId_cursoId: { usuarioId: usuario.id, cursoId: curso.id } },
      });
      enrolled = Boolean(inscripcion);
    }

    // Evaluación final: Evaluacion.cursoId no tiene relación en el schema,
    // así que se resuelve con una query aparte.
    const evaluacionFinal = await prisma.evaluacion.findFirst({
      where: { cursoId: curso.id, esFinal: true },
      select: { id: true, titulo: true, esFinal: true, notaMinima: true, intentosMax: true, fechaLimite: true },
    });
    const evaluacionFinalOut = evaluacionFinal
      ? { ...evaluacionFinal, fechaLimiteExpirada: isDeadlineExpired(evaluacionFinal.fechaLimite) }
      : null;

    // Sin acceso al contenido: se oculta el video de cada lección (solo queda el temario).
    const visibleCourse = isOwner || isAdmin
      ? curso
      : {
          ...curso,
          modulos: curso.modulos
            .filter((module) => (module.estado === 'PUBLICADO' || module.estado === undefined))
            .map((module) => ({
              ...module,
              lecciones: module.lecciones.filter((lesson) => (lesson.estado === 'PUBLICADA' || lesson.estado === undefined)),
            })),
        };

    // Sin acceso al contenido: se oculta el video de cada leccion (solo queda el temario).
    const cursoOut = enrolled || isOwner || isAdmin
      ? visibleCourse
      : {
          ...visibleCourse,
          modulos: visibleCourse.modulos.map((module) => ({
            ...module,
            lecciones: module.lecciones.map(({ id, titulo, orden, publishedAt }) => ({ id, titulo, orden, publishedAt })),
          })),
        };
    res.json({
      success: true,
      data: {
        curso: { ...cursoOut, evaluacionFinal: evaluacionFinalOut },
        viewer: { enrolled, isOwner: isOwner || isAdmin },
      },
    });
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
    if (!isOwnerOrAdmin(usuario, curso.creadorId)) {
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
      // Propagar a Neo4j para recomendaciones / feed académico (no bloquea la respuesta)
      await syncInscripcion(req.user.id, curso.id);
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
          where: { estado: 'PUBLICADO' },
          orderBy: { orden: 'asc' },
          include: {
            lecciones: {
              where: { estado: 'PUBLICADA' },
              orderBy: { orden: 'asc' },
              select: { id: true, titulo: true, orden: true, publishedAt: true },
            },
          },
        },
      },
    });
    if (!curso) {
      return res.status(404).json({ success: false, message: 'Curso no encontrado' });
    }

    const access = await ensureCourseContentAccess(req, res, curso.id);
    if (!access) return;

    const leccionIds = curso.modulos.flatMap((m) => m.lecciones.map((l) => l.id));

    const progresos = leccionIds.length
      ? await prisma.progreso.findMany({
          where: { usuarioId: usuario.id, leccionId: { in: leccionIds } },
        })
      : [];
    const completadas = new Set(
      progresos.filter((p) => p.completada).map((p) => p.leccionId),
    );

    const enrolledAt = access.inscripcion?.fechaInscripcion || new Date(0);
    const isBaseLesson = (lesson) => !lesson.publishedAt || new Date(lesson.publishedAt) <= new Date(enrolledAt);
    const modulos = curso.modulos.map((m) => {
      const baseLessons = m.lecciones.filter(isBaseLesson);
      const newLessons = m.lecciones.filter((lesson) => !isBaseLesson(lesson));
      const total = baseLessons.length;
      const done = baseLessons.filter((l) => completadas.has(l.id)).length;
      return {
        id: m.id,
        titulo: m.titulo,
        orden: m.orden,
        total,
        completadas: done,
        nuevasPendientes: newLessons.filter((lesson) => !completadas.has(lesson.id)).length,
        lecciones: m.lecciones.map((l) => ({
          ...l,
          completada: completadas.has(l.id),
          esNueva: !isBaseLesson(l),
        })),
      };
    });

    const baseLessons = curso.modulos.flatMap((module) => module.lecciones).filter(isBaseLesson);
    const newLessons = curso.modulos.flatMap((module) => module.lecciones).filter((lesson) => !isBaseLesson(lesson));
    const total = baseLessons.length;
    const done = baseLessons.filter((lesson) => completadas.has(lesson.id)).length;
    const porcentaje = total === 0 ? 0 : Math.round((done / total) * 100);

    res.json({
      success: true,
      data: {
        cursoId: curso.id,
        total,
        completadas: done,
        porcentaje,
        nuevasPendientes: newLessons.filter((lesson) => !completadas.has(lesson.id)).length,
        nuevasTotal: newLessons.length,
        modulos,
      },
    });
  } catch (err) {
    console.error('GET /courses/:id/progress error', err);
    res.status(500).json({ success: false, message: 'Error obteniendo progreso' });
  }
});

export default router;
