import prisma from '../prisma.js';
import { otorgarLogro } from './achievement.service.js';
import { syncCursoCompletado } from './neo4j-sync.service.js';
import { consumirItem } from './tienda.service.js';

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function sameDay(a, b) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

/**
 * Actualiza la racha del usuario. Llamar UNA sola vez por evento de aprendizaje
 * (ej. al completar una lección por primera vez, o al aprobar una evaluación).
 *
 * Reglas:
 * - Primera actividad → racha = 1
 * - Misma fecha que la última actividad → no cambia
 * - Día siguiente al de la última actividad → racha + 1
 * - Exactamente un día perdido y tiene `congelar_racha` → consume 1 y continúa
 * - Más de un día desde la última actividad (sin freeze) → racha = 1 (rota)
 *
 * @returns {Promise<{racha:number, subio:boolean, ultimaActividad:Date, rota:boolean, congelada?:boolean}>}
 */
export async function actualizarRacha(usuarioId) {
  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
  if (!usuario) return null;

  const hoy = startOfDay(new Date());
  const ayer = startOfDay(new Date(Date.now() - 86_400_000));
  const anteayer = startOfDay(new Date(Date.now() - 2 * 86_400_000));
  const rachaPrev = usuario.racha;

  // Primera actividad de la vida del usuario
  if (!usuario.ultimaActividad) {
    const u = await prisma.usuario.update({
      where: { id: usuarioId },
      data: { racha: 1, ultimaActividad: hoy },
    });
    return { racha: u.racha, subio: true, ultimaActividad: u.ultimaActividad, rota: false };
  }

  const ultima = startOfDay(usuario.ultimaActividad);

  // Ya estudió hoy — no tocar racha
  if (sameDay(ultima, hoy)) {
    return { racha: usuario.racha, subio: false, ultimaActividad: usuario.ultimaActividad, rota: false };
  }

  // Día siguiente — continúa
  if (sameDay(ultima, ayer)) {
    const u = await prisma.usuario.update({
      where: { id: usuarioId },
      data: { racha: usuario.racha + 1, ultimaActividad: hoy },
    });
    return { racha: u.racha, subio: true, ultimaActividad: u.ultimaActividad, rota: false };
  }

  // Perdió exactamente un día (última = anteayer): si tiene 'congelar_racha',
  // se consume y la racha continúa en vez de romperse (consumo lazy).
  if (sameDay(ultima, anteayer)) {
    const freeze = await consumirItem(usuarioId, 'congelar_racha');
    if (freeze.ok) {
      const u = await prisma.usuario.update({
        where: { id: usuarioId },
        data: { racha: usuario.racha + 1, ultimaActividad: hoy },
      });
      return { racha: u.racha, subio: true, ultimaActividad: u.ultimaActividad, rota: false, congelada: true };
    }
  }

  // Racha rota — reinicia a 1
  const u = await prisma.usuario.update({
    where: { id: usuarioId },
    data: { racha: 1, ultimaActividad: hoy },
  });
  return { racha: u.racha, subio: u.racha > rachaPrev, ultimaActividad: u.ultimaActividad, rota: true };
}

/**
 * Sincroniza en la tabla Progreso cualquier lección evaluable que ya tenga
 * calificación registrada en ResultadoHtmlLeccion pero que aún no esté
 * marcada como completada.
 *
 * @param {string} usuarioId
 * @param {string} [cursoId] - Opcional. Filtra por curso.
 * @param {object} [tx=prisma] - Cliente de Prisma o transacción activa.
 * @returns {Promise<string[]>} Lista de IDs de lecciones sincronizadas.
 */
export async function syncProgresoFromHtmlResults(usuarioId, cursoId = null, tx = prisma) {
  if (!usuarioId || !tx?.resultadoHtmlLeccion?.findMany) return [];

  const whereClause = {
    usuarioId,
    recursoHtml: {
      evaluable: true,
      ...(cursoId ? { leccion: { modulo: { cursoId } } } : {}),
    },
  };

  const rawResultados = await tx.resultadoHtmlLeccion.findMany({
    where: whereClause,
    select: {
      recursoHtml: {
        select: { leccionId: true },
      },
      updatedAt: true,
    },
  });

  const resultados = Array.isArray(rawResultados) ? rawResultados : [];

  const leccionIds = resultados
    .map((r) => r.recursoHtml?.leccionId)
    .filter(Boolean);

  if (leccionIds.length === 0) return [];

  const rawProgresos = tx.progreso?.findMany
    ? await tx.progreso.findMany({
        where: {
          usuarioId,
          leccionId: { in: leccionIds },
          completada: true,
        },
        select: { leccionId: true },
      })
    : [];

  const progresos = Array.isArray(rawProgresos) ? rawProgresos : [];

  const completadasSet = new Set(progresos.map((p) => p.leccionId));
  const pendientes = resultados.filter(
    (r) => r.recursoHtml?.leccionId && !completadasSet.has(r.recursoHtml.leccionId),
  );

  if (pendientes.length === 0 || !tx.progreso?.upsert) return [];

  await Promise.all(
    pendientes.map((r) =>
      tx.progreso.upsert({
        where: {
          usuarioId_leccionId: {
            usuarioId,
            leccionId: r.recursoHtml.leccionId,
          },
        },
        update: {
          completada: true,
          fechaCompletado: r.updatedAt || new Date(),
        },
        create: {
          usuarioId,
          leccionId: r.recursoHtml.leccionId,
          completada: true,
          fechaCompletado: r.updatedAt || new Date(),
        },
      }),
    ),
  );

  return pendientes.map((r) => r.recursoHtml.leccionId);
}

/**
 * Verifica si el usuario completó el curso entero:
 *  - tiene Inscripcion activa,
 *  - todas las lecciones del curso con Progreso.completada,
 *  - todas las evaluaciones del curso (de módulo y final) con al menos un Intento aprobado.
 *
 * Si recién se completa: marca Inscripcion.completado, emite Certificado
 * (con guard manual de duplicados) y otorga el logro "Primer curso".
 *
 * @returns {Promise<{completado:boolean, nuevo?:boolean, certificado?:object, logros?:object[]}>}
 */
export async function checkCursoCompletado(usuarioId, cursoId) {
  try {
    const completion = await prisma.$transaction(async (tx) => {
      const inscripcion = await tx.inscripcion.findUnique({
        where: { usuarioId_cursoId: { usuarioId, cursoId } },
      });
      if (!inscripcion) return { completado: false };

      const curso = await tx.curso.findUnique({
        where: { id: cursoId },
        select: { titulo: true, emiteCertificado: true },
      });
      if (!curso) return { completado: false };

      const modulos = await tx.modulo.findMany({
        where: { cursoId, estado: 'PUBLICADO' },
        select: { lecciones: { where: { estado: 'PUBLICADA' }, select: { id: true } }, evaluacion: { select: { id: true } } },
      });
      const modulosBase = modulos.filter((module) => module.lecciones.length > 0);
      const leccionIds = modulosBase.flatMap((module) => module.lecciones.map((lesson) => lesson.id));
      if (leccionIds.length === 0) {
        if (inscripcion.completado) {
          await tx.inscripcion.updateMany({
            where: { id: inscripcion.id, completado: true },
            data: { completado: false, fechaCompletado: null },
          });
        }
        return { completado: false, reabierto: Boolean(inscripcion.completado) };
      }

      await syncProgresoFromHtmlResults(usuarioId, cursoId, tx);

      const completadas = await tx.progreso.count({
        where: { usuarioId, leccionId: { in: leccionIds }, completada: true },
      });
      if (completadas < leccionIds.length) {
        if (inscripcion.completado) {
          await tx.inscripcion.updateMany({
            where: { id: inscripcion.id, completado: true },
            data: { completado: false, fechaCompletado: null },
          });
        }
        return { completado: false, reabierto: Boolean(inscripcion.completado) };
      }

      const evalIds = modulosBase.map((module) => module.evaluacion?.id).filter(Boolean);
      const finales = await tx.evaluacion.findMany({ where: { cursoId, esFinal: true }, select: { id: true } });
      evalIds.push(...finales.map((evaluation) => evaluation.id));
      if (evalIds.length > 0) {
        const aprobadas = await tx.intento.groupBy({
          by: ['evaluacionId'],
          where: { usuarioId, evaluacionId: { in: evalIds }, aprobado: true },
        });
        if (aprobadas.length < evalIds.length) {
          if (inscripcion.completado) {
            await tx.inscripcion.updateMany({
              where: { id: inscripcion.id, completado: true },
              data: { completado: false, fechaCompletado: null },
            });
          }
          return { completado: false, reabierto: Boolean(inscripcion.completado) };
        }
      }

      if (inscripcion.completado) {
        const certificado = curso.emiteCertificado
          ? await tx.certificado.findUnique({ where: { usuarioId_cursoId: { usuarioId, cursoId } } })
          : null;
        return { completado: true, nuevo: false, certificado };
      }

      const won = await tx.inscripcion.updateMany({
        where: { id: inscripcion.id, completado: false },
        data: { completado: true, fechaCompletado: new Date() },
      });
      if (won.count !== 1) {
        const certificado = curso.emiteCertificado
          ? await tx.certificado.findUnique({ where: { usuarioId_cursoId: { usuarioId, cursoId } } })
          : null;
        return { completado: true, nuevo: false, certificado };
      }

      const certificado = curso.emiteCertificado
        ? await tx.certificado.upsert({
            where: { usuarioId_cursoId: { usuarioId, cursoId } },
            update: {},
            create: { usuarioId, cursoId, cursoTitulo: curso.titulo },
          })
        : null;
      return { completado: true, nuevo: true, certificado };
    });

    if (!completion.completado || !completion.nuevo) {
      return { ...completion, logros: [] };
    }

    let logro = null;
    try {
      logro = await otorgarLogro(usuarioId, 'Primer curso');
    } catch (err) {
      console.error('checkCursoCompletado logro post-completion error', err);
    }
    try {
      await syncCursoCompletado(usuarioId, cursoId);
    } catch (err) {
      console.error('checkCursoCompletado sync post-completion error', err);
    }
    return { ...completion, logros: logro ? [logro] : [] };
  } catch (err) {
    console.error('checkCursoCompletado error', err);
    return { completado: false };
  }
}

/**
 * Calcula si la racha actual sigue activa (última actividad fue hoy o ayer).
 * No modifica nada.
 */
export function rachaEstaActiva(ultimaActividad) {
  if (!ultimaActividad) return false;
  const hoy = startOfDay(new Date());
  const ayer = startOfDay(new Date(Date.now() - 86_400_000));
  const ultima = startOfDay(ultimaActividad);
  return sameDay(ultima, hoy) || sameDay(ultima, ayer);
}
