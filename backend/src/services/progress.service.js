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
    const inscripcion = await prisma.inscripcion.findUnique({
      where: { usuarioId_cursoId: { usuarioId, cursoId } },
    });
    if (!inscripcion) return { completado: false };

    if (inscripcion.completado) {
      const certificado = await prisma.certificado.findFirst({
        where: { usuarioId, cursoId },
      });
      return { completado: true, nuevo: false, certificado, logros: [] };
    }

    const modulos = await prisma.modulo.findMany({
      where: { cursoId },
      select: {
        lecciones: { select: { id: true } },
        evaluacion: { select: { id: true } },
      },
    });
    const leccionIds = modulos.flatMap((m) => m.lecciones.map((l) => l.id));
    // Un curso sin lecciones no se puede "completar"
    if (leccionIds.length === 0) return { completado: false };

    const completadas = await prisma.progreso.count({
      where: { usuarioId, leccionId: { in: leccionIds }, completada: true },
    });
    if (completadas < leccionIds.length) return { completado: false };

    const evalIds = modulos.map((m) => m.evaluacion?.id).filter(Boolean);
    const finales = await prisma.evaluacion.findMany({
      where: { cursoId, esFinal: true },
      select: { id: true },
    });
    evalIds.push(...finales.map((e) => e.id));

    if (evalIds.length > 0) {
      const aprobadas = await prisma.intento.groupBy({
        by: ['evaluacionId'],
        where: { usuarioId, evaluacionId: { in: evalIds }, aprobado: true },
      });
      if (aprobadas.length < evalIds.length) return { completado: false };
    }

    // Recién completado: marcar inscripción + emitir certificado + logro
    await prisma.inscripcion.update({
      where: { id: inscripcion.id },
      data: { completado: true, fechaCompletado: new Date() },
    });

    let certificado = await prisma.certificado.findFirst({
      where: { usuarioId, cursoId },
    });
    if (!certificado) {
      // Snapshot del título: si el curso se borra luego, el certificado lo conserva.
      const curso = await prisma.curso.findUnique({
        where: { id: cursoId },
        select: { titulo: true },
      });
      certificado = await prisma.certificado.create({
        data: { usuarioId, cursoId, cursoTitulo: curso?.titulo ?? '' },
      });
    }

    const logro = await otorgarLogro(usuarioId, 'Primer curso');

    // Propagar a Neo4j para recomendaciones / feed académico (no bloquea)
    await syncCursoCompletado(usuarioId, cursoId);

    return { completado: true, nuevo: true, certificado, logros: logro ? [logro] : [] };
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
