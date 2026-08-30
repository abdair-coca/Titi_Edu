import { Router } from 'express';
import prisma from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { loadCurrentUser } from '../middleware/permissions.js';

const router = Router();

// Centralizador de notas docente.
// GET /api/courses/:courseId/grades
// Profesor owner del curso o ADMIN. Devuelve, por estudiante inscrito, las
// notas de quizzes (mejor intento por evaluación), puntajes de lecciones HTML
// evaluables y progreso de lecciones. Fuente de verdad: Postgres.
router.get('/courses/:courseId/grades', requireAuth, async (req, res) => {
  try {
    const usuario = await loadCurrentUser(req, res);
    if (!usuario) return;

    if (usuario.rol !== 'ADMIN') {
      const curso = await prisma.curso.findUnique({
        where: { id: req.params.courseId },
        select: {
          creadorId: true,
          profesores: { where: { profesorId: usuario.id }, select: { profesorId: true } },
        },
      });
      const isOwner = Boolean(
        curso &&
          (curso.creadorId === usuario.id || curso.profesores.some((p) => p.profesorId === usuario.id)),
      );
      if (!curso) {
        return res.status(404).json({ success: false, message: 'Curso no encontrado' });
      }
      if (!isOwner) {
        return res.status(403).json({ success: false, message: 'Solo el profesor del curso puede ver las notas' });
      }
    }

    const curso = await prisma.curso.findUnique({
      where: { id: req.params.courseId },
      select: {
        id: true,
        titulo: true,
        modulos: {
          orderBy: { orden: 'asc' },
          select: {
            id: true,
            titulo: true,
            lecciones: {
              orderBy: { orden: 'asc' },
              select: {
                id: true,
                titulo: true,
                recursoHtml: {
                  select: {
                    id: true,
                    evaluable: true,
                    fechaLimite: true,
                  },
                },
              },
            },
            evaluacion: {
              select: { id: true, titulo: true, notaMinima: true, esFinal: true, fechaLimite: true },
            },
          },
        },
      },
    });
    if (!curso) {
      return res.status(404).json({ success: false, message: 'Curso no encontrado' });
    }

    const evaluacionFinal = await prisma.evaluacion.findFirst({
      where: { cursoId: curso.id, esFinal: true },
      select: { id: true, titulo: true, notaMinima: true, esFinal: true, fechaLimite: true },
    });

    const evaluaciones = curso.modulos
      .filter((m) => m.evaluacion)
      .map((m) => ({ ...m.evaluacion, moduloId: m.id }));
    if (evaluacionFinal) evaluaciones.push(evaluacionFinal);

    const evaluacionIds = evaluaciones.map((e) => e.id);

    const inscripciones = await prisma.inscripcion.findMany({
      where: { cursoId: curso.id },
      select: {
        completado: true,
        usuario: { select: { id: true, username: true, email: true } },
      },
    });

    const [intentos, progresos, resultadosHtml] = await Promise.all([
      prisma.intento.findMany({
        where: { evaluacionId: { in: evaluacionIds } },
        orderBy: { numero: 'asc' },
        select: {
          usuarioId: true,
          evaluacionId: true,
          nota: true,
          aprobado: true,
          numero: true,
          fechaIntento: true,
        },
      }),
      prisma.progreso.findMany({
        where: { leccion: { modulo: { cursoId: curso.id } } },
        select: { usuarioId: true, leccionId: true, completada: true },
      }),
      prisma.resultadoHtmlLeccion.findMany({
        where: { recursoHtml: { leccion: { modulo: { cursoId: curso.id } } } },
        select: { usuarioId: true, recursoHtmlId: true, mejorPuntaje: true },
      }),
    ]);

    const leccionesPorModulo = curso.modulos.reduce((acc, m) => {
      m.lecciones.forEach((l) => {
        acc[l.id] = { id: l.id, moduloId: m.id, moduloTitulo: m.titulo, titulo: l.titulo, recursoHtmlId: l.recursoHtml?.id ?? null, htmlEvaluable: l.recursoHtml?.evaluable ?? false, fechaLimite: l.recursoHtml?.fechaLimite ?? null };
      });
      return acc;
    }, {});

    // mejor intento por (usuario, evaluacion)
    const mejorIntento = new Map();
    for (const i of intentos) {
      const key = `${i.usuarioId}:${i.evaluacionId}`;
      const prev = mejorIntento.get(key);
      if (!prev || i.nota > prev.nota) mejorIntento.set(key, i);
    }

    // mejores puntajes HTML por (usuario, recursoHtmlId)
    const mejorHtml = new Map();
    for (const r of resultadosHtml) {
      const key = `${r.usuarioId}:${r.recursoHtmlId}`;
      const prev = mejorHtml.get(key);
      if (!prev || r.mejorPuntaje > prev.mejorPuntaje) mejorHtml.set(key, r);
    }

    const progresoPorUser = new Map();
    for (const p of progresos) {
      if (!p.completada) continue;
      if (!progresoPorUser.has(p.usuarioId)) progresoPorUser.set(p.usuarioId, new Set());
      progresoPorUser.get(p.usuarioId).add(p.leccionId);
    }

    const estudiantes = inscripciones.map((ins) => {
      const uid = ins.usuario.id;
      const leccionesCompletadas = progresoPorUser.get(uid)?.size ?? 0;
      const totalLecciones = Object.keys(leccionesPorModulo).length;
      const evaluacionesResumen = evaluaciones.map((e) => {
        const intento = mejorIntento.get(`${uid}:${e.id}`);
        return {
          id: e.id,
          titulo: e.titulo,
          moduloId: e.moduloId ?? null,
          esFinal: Boolean(e.esFinal),
          notaMinima: e.notaMinima,
          fechaLimite: e.fechaLimite ?? null,
          mejorNota: intento?.nota ?? null,
          aprobado: intento?.aprobado ?? false,
          intentosUsados: intento?.numero ?? 0,
        };
      });
      const htmlResumen = Object.entries(leccionesPorModulo)
        .filter(([, l]) => l.htmlEvaluable)
        .map(([leccionId, l]) => ({
          leccionId,
          titulo: l.titulo,
          moduloTitulo: l.moduloTitulo,
          mejorPuntaje: mejorHtml.get(`${uid}:${l.recursoHtmlId}`)?.mejorPuntaje ?? null,
          fechaLimite: l.fechaLimite,
        }));
      return {
        usuario: { id: uid, username: ins.usuario.username, email: ins.usuario.email },
        completado: ins.completado,
        progreso: totalLecciones > 0 ? Math.round((leccionesCompletadas / totalLecciones) * 100) : 0,
        leccionesCompletadas,
        totalLecciones,
        evaluaciones: evaluacionesResumen,
        html: htmlResumen,
      };
    });

    return res.json({
      success: true,
      data: {
        curso: { id: curso.id, titulo: curso.titulo },
        modulos: curso.modulos.map((m) => ({ id: m.id, titulo: m.titulo })),
        lecciones: Object.values(leccionesPorModulo),
        evaluaciones,
        estudiantes,
      },
    });
  } catch (err) {
    console.error('grades error', err);
    res.status(500).json({ success: false, message: 'Error obteniendo notas' });
  }
});

export default router;
