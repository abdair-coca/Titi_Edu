import { Router } from 'express';
import prisma from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/permissions.js';
import {
  RagError,
  indexLesson,
  searchCourseContext,
} from '../services/rag.service.js';

const router = Router();

// Todas las rutas de administración RAG exigen autenticación y rol ADMIN
router.use(requireAuth, requireRole('ADMIN'));

function handleAdminRagError(res, error, label) {
  if (error instanceof RagError) {
    return res.status(error.status).json({ success: false, message: error.message });
  }
  console.error(label, error);
  return res.status(500).json({ success: false, message: 'Error procesando la solicitud de administración RAG' });
}

// ---- GET /courses — Cursos publicados para el selector de filtro ----
router.get('/courses', async (req, res) => {
  try {
    const courses = await prisma.curso.findMany({
      where: { publicado: true },
      select: { id: true, titulo: true },
      orderBy: { titulo: 'asc' },
    });
    res.json({ success: true, data: { courses } });
  } catch (error) {
    handleAdminRagError(res, error, 'GET /api/admin/rag/courses error');
  }
});

// ---- GET /lessons — Listado paginado de lecciones publicadas con estado RAG y KPIs ----
router.get('/lessons', async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
    const courseId = req.query.courseId ? String(req.query.courseId).trim() : null;
    const status = req.query.status ? String(req.query.status).trim().toUpperCase() : null;
    const search = req.query.search ? String(req.query.search).trim() : null;

    const baseWhere = {
      estado: 'PUBLICADA',
      modulo: {
        estado: 'PUBLICADO',
        curso: {
          publicado: true,
          ...(courseId ? { id: courseId } : {}),
        },
      },
      ...(search ? {
        OR: [
          { titulo: { contains: search, mode: 'insensitive' } },
          { modulo: { curso: { titulo: { contains: search, mode: 'insensitive' } } } },
        ],
      } : {}),
    };

    let statusCondition = {};
    if (status === 'LISTO') {
      statusCondition = { documentosRag: { some: { activo: true, estado: 'LISTO' } } };
    } else if (status === 'FALLIDO') {
      statusCondition = { documentosRag: { some: { activo: true, estado: 'FALLIDO' } } };
    } else if (status === 'PENDIENTE') {
      statusCondition = { documentosRag: { some: { activo: true, estado: 'PENDIENTE' } } };
    } else if (status === 'SIN_INDEXAR') {
      statusCondition = {
        OR: [
          { documentosRag: { none: { activo: true } } },
          { documentosRag: { none: { activo: true, estado: { in: ['LISTO', 'PENDIENTE', 'FALLIDO'] } } } },
        ],
      };
    }

    const queryWhere = { ...baseWhere, ...statusCondition };

    const [lessons, total, totalLessons, readyCount, failedCount, pendingCount] = await Promise.all([
      prisma.leccion.findMany({
        where: queryWhere,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [
          { modulo: { curso: { titulo: 'asc' } } },
          { modulo: { orden: 'asc' } },
          { orden: 'asc' },
        ],
        select: {
          id: true,
          titulo: true,
          orden: true,
          estado: true,
          recursoHtml: { select: { id: true, evaluable: true } },
          modulo: {
            select: {
              id: true,
              titulo: true,
              curso: {
                select: { id: true, titulo: true, publicado: true },
              },
            },
          },
          documentosRag: {
            where: { activo: true },
            take: 1,
            orderBy: { version: 'desc' },
            select: {
              id: true,
              version: true,
              estado: true,
              activo: true,
              modelo: true,
              error: true,
              indexadoAt: true,
              hashContenido: true,
              _count: { select: { fragmentos: true } },
            },
          },
        },
      }),
      prisma.leccion.count({ where: queryWhere }),
      prisma.leccion.count({
        where: {
          estado: 'PUBLICADA',
          modulo: { estado: 'PUBLICADO', curso: { publicado: true, ...(courseId ? { id: courseId } : {}) } },
        },
      }),
      prisma.documentoRag.count({
        where: {
          activo: true,
          estado: 'LISTO',
          leccion: {
            estado: 'PUBLICADA',
            modulo: { estado: 'PUBLICADO', curso: { publicado: true, ...(courseId ? { id: courseId } : {}) } },
          },
        },
      }),
      prisma.documentoRag.count({
        where: {
          activo: true,
          estado: 'FALLIDO',
          leccion: {
            estado: 'PUBLICADA',
            modulo: { estado: 'PUBLICADO', curso: { publicado: true, ...(courseId ? { id: courseId } : {}) } },
          },
        },
      }),
      prisma.documentoRag.count({
        where: {
          activo: true,
          estado: 'PENDIENTE',
          leccion: {
            estado: 'PUBLICADA',
            modulo: { estado: 'PUBLICADO', curso: { publicado: true, ...(courseId ? { id: courseId } : {}) } },
          },
        },
      }),
    ]);

    const formattedLessons = lessons.map((lesson) => {
      const activeDoc = lesson.documentosRag[0] || null;
      return {
        id: lesson.id,
        titulo: lesson.titulo,
        orden: lesson.orden,
        estadoLeccion: lesson.estado,
        modulo: lesson.modulo,
        recursoHtml: lesson.recursoHtml,
        documentoRag: activeDoc ? {
          id: activeDoc.id,
          version: activeDoc.version,
          estado: activeDoc.estado,
          activo: activeDoc.activo,
          modelo: activeDoc.modelo,
          error: activeDoc.error,
          indexadoAt: activeDoc.indexadoAt,
          hashContenido: activeDoc.hashContenido,
          fragmentosCount: activeDoc._count?.fragmentos ?? 0,
        } : null,
      };
    });

    const unindexedCount = Math.max(0, totalLessons - (readyCount + failedCount + pendingCount));

    res.json({
      success: true,
      data: {
        lessons: formattedLessons,
        total,
        page,
        pageSize,
        summary: {
          totalLessons,
          ready: readyCount,
          failed: failedCount,
          pending: pendingCount,
          unindexed: unindexedCount,
        },
      },
    });
  } catch (error) {
    handleAdminRagError(res, error, 'GET /api/admin/rag/lessons error');
  }
});

// ---- GET /lessons/:lessonId/fragments — Detalle de fragmentos indexados ----
router.get('/lessons/:lessonId/fragments', async (req, res) => {
  try {
    const lesson = await prisma.leccion.findUnique({
      where: { id: req.params.lessonId },
      select: {
        id: true,
        titulo: true,
        modulo: {
          select: {
            id: true,
            titulo: true,
            curso: { select: { id: true, titulo: true } },
          },
        },
        documentosRag: {
          where: { activo: true },
          take: 1,
          orderBy: { version: 'desc' },
          select: {
            id: true,
            version: true,
            estado: true,
            modelo: true,
            indexadoAt: true,
            hashContenido: true,
            error: true,
            fragmentos: {
              orderBy: { orden: 'asc' },
              select: {
                id: true,
                orden: true,
                contenido: true,
              },
            },
          },
        },
      },
    });

    if (!lesson) {
      return res.status(404).json({ success: false, message: 'Lección no encontrada' });
    }

    const document = lesson.documentosRag[0] || null;
    const fragments = document ? document.fragmentos.map((f) => ({
      id: f.id,
      orden: f.orden,
      contenido: f.contenido,
      longitud: f.contenido.length,
    })) : [];

    res.json({
      success: true,
      data: {
        lesson: {
          id: lesson.id,
          titulo: lesson.titulo,
          moduleTitle: lesson.modulo.titulo,
          courseId: lesson.modulo.curso.id,
          courseTitle: lesson.modulo.curso.titulo,
        },
        document: document ? {
          id: document.id,
          version: document.version,
          estado: document.estado,
          modelo: document.modelo,
          indexadoAt: document.indexadoAt,
          hashContenido: document.hashContenido,
          error: document.error,
        } : null,
        fragments,
      },
    });
  } catch (error) {
    handleAdminRagError(res, error, 'GET /api/admin/rag/lessons/:lessonId/fragments error');
  }
});

// ---- POST /lessons/:lessonId/test-query — Simulador semántico de recuperación ----
router.post('/lessons/:lessonId/test-query', async (req, res) => {
  try {
    const query = String(req.body?.query || '').trim();
    if (!query) {
      return res.status(400).json({ success: false, message: 'query es requerido para la búsqueda de prueba' });
    }

    const lesson = await prisma.leccion.findUnique({
      where: { id: req.params.lessonId },
      select: {
        id: true,
        titulo: true,
        modulo: { select: { cursoId: true } },
      },
    });

    if (!lesson) {
      return res.status(404).json({ success: false, message: 'Lección no encontrada' });
    }

    const chunks = await searchCourseContext(lesson.modulo.cursoId, query, 5, { lessonId: lesson.id });

    res.json({
      success: true,
      data: {
        query,
        lessonId: lesson.id,
        results: chunks.map((c) => ({
          chunkId: c.chunkId,
          orden: c.index,
          lessonId: c.lessonId,
          lessonTitle: c.lessonTitle,
          moduleTitle: c.moduleTitle,
          contenido: c.content,
          similarity: Number(c.similarity.toFixed(4)),
        })),
      },
    });
  } catch (error) {
    handleAdminRagError(res, error, 'POST /api/admin/rag/lessons/:lessonId/test-query error');
  }
});

// ---- POST /lessons/:lessonId/reindex — Reindexación sincrónica forzada ----
router.post('/lessons/:lessonId/reindex', async (req, res) => {
  try {
    const lesson = await prisma.leccion.findUnique({
      where: { id: req.params.lessonId },
      select: { id: true, estado: true, modulo: { select: { estado: true, curso: { select: { publicado: true } } } } },
    });

    if (!lesson) {
      return res.status(404).json({ success: false, message: 'Lección no encontrada' });
    }

    if (lesson.estado !== 'PUBLICADA' || lesson.modulo.estado !== 'PUBLICADO' || !lesson.modulo.curso.publicado) {
      return res.status(400).json({
        success: false,
        message: 'Solo se pueden indexar lecciones publicadas dentro de cursos publicados',
      });
    }

    const result = await indexLesson(req.params.lessonId, { force: true });
    res.json({ success: true, data: result });
  } catch (error) {
    handleAdminRagError(res, error, 'POST /api/admin/rag/lessons/:lessonId/reindex error');
  }
});

export default router;
