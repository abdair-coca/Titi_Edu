import prisma from '../prisma.js';
import { syncLogroNotificacion } from './neo4j-sync.service.js';

/**
 * Catálogo base de logros (docs/architecture.md — Lógica de negocio › Logros).
 * Se siembra con ensureLogrosCatalog() — upsert por nombre, idempotente.
 */
export const LOGROS_CATALOGO = [
  {
    nombre: 'Primera lección',
    tipo: 'curso',
    condicion: 'Completar tu primera lección',
    descripcion: 'Completaste tu primera lección en Titi. ¡El primer paso de un gran viaje!',
    icono: '📚',
  },
  {
    nombre: 'Primer curso',
    tipo: 'curso',
    condicion: 'Completar tu primer curso',
    descripcion: 'Terminaste un curso completo, con todas sus lecciones y evaluaciones.',
    icono: '🎓',
  },
  {
    nombre: 'Racha de 7 días',
    tipo: 'racha',
    condicion: '7 días consecutivos de actividad',
    descripcion: 'Estudiaste 7 días seguidos sin fallar ni uno.',
    icono: '🔥',
  },
  {
    nombre: 'Racha de 30 días',
    tipo: 'racha',
    condicion: '30 días consecutivos de actividad',
    descripcion: 'Un mes entero de constancia. Nivel imparable.',
    icono: '⚡',
  },
  {
    nombre: 'Primera evaluación',
    tipo: 'evaluacion',
    condicion: 'Aprobar tu primera evaluación',
    descripcion: 'Aprobaste tu primera evaluación en Titi.',
    icono: '✅',
  },
  {
    nombre: 'Perfecto',
    tipo: 'evaluacion',
    condicion: 'Obtener 100% en una evaluación',
    descripcion: 'Sacaste la nota perfecta en una evaluación. Ni un solo error.',
    icono: '💯',
  },
  {
    nombre: 'Social',
    tipo: 'social',
    condicion: 'Seguir a 10 personas',
    descripcion: 'Seguís a 10 personas de la comunidad Titi.',
    icono: '🤝',
  },
];

/** Siembra/actualiza el catálogo de logros. Idempotente. */
export async function ensureLogrosCatalog() {
  for (const l of LOGROS_CATALOGO) {
    await prisma.logro.upsert({
      where: { nombre: l.nombre },
      update: { descripcion: l.descripcion, icono: l.icono, tipo: l.tipo, condicion: l.condicion },
      create: l,
    });
  }
}

/**
 * Otorga un logro por nombre si el usuario aún no lo tiene.
 * @returns el Logro recién desbloqueado, o null si ya lo tenía / no existe en catálogo.
 */
export async function otorgarLogro(usuarioId, nombre) {
  try {
    const logro = await prisma.logro.findUnique({ where: { nombre } });
    if (!logro) return null;
    await prisma.logroUsuario.create({ data: { usuarioId, logroId: logro.id } });

    // Logro recién desbloqueado → notificar a los seguidores vía Neo4j (no bloquea)
    await syncLogroNotificacion(usuarioId, logro.nombre);

    return logro;
  } catch (err) {
    // P2002 → ya lo tenía (el @@id([usuarioId, logroId]) previene duplicados)
    if (err.code === 'P2002') return null;
    console.error('otorgarLogro error', err);
    return null;
  }
}

/** Logros de racha — llamar con el valor de racha ya actualizado. */
async function checkLogrosRacha(usuarioId, racha) {
  const nuevos = [];
  if (racha >= 7) {
    const l = await otorgarLogro(usuarioId, 'Racha de 7 días');
    if (l) nuevos.push(l);
  }
  if (racha >= 30) {
    const l = await otorgarLogro(usuarioId, 'Racha de 30 días');
    if (l) nuevos.push(l);
  }
  return nuevos;
}

/**
 * Checker al completar una lección (primera vez).
 * @returns array de logros recién desbloqueados.
 */
export async function checkLogrosLeccion(usuarioId, { racha = 0 } = {}) {
  const nuevos = [];
  try {
    const completadas = await prisma.progreso.count({
      where: { usuarioId, completada: true },
    });
    if (completadas >= 1) {
      const l = await otorgarLogro(usuarioId, 'Primera lección');
      if (l) nuevos.push(l);
    }
    nuevos.push(...(await checkLogrosRacha(usuarioId, racha)));
  } catch (err) {
    console.error('checkLogrosLeccion error', err);
  }
  return nuevos;
}

/**
 * Checker al aprobar una evaluación.
 * @returns array de logros recién desbloqueados.
 */
export async function checkLogrosEvaluacion(usuarioId, { nota = 0, racha = 0 } = {}) {
  const nuevos = [];
  try {
    const aprobadas = await prisma.intento.count({
      where: { usuarioId, aprobado: true },
    });
    if (aprobadas >= 1) {
      const l = await otorgarLogro(usuarioId, 'Primera evaluación');
      if (l) nuevos.push(l);
    }
    if (nota >= 100) {
      const l = await otorgarLogro(usuarioId, 'Perfecto');
      if (l) nuevos.push(l);
    }
    nuevos.push(...(await checkLogrosRacha(usuarioId, racha)));
  } catch (err) {
    console.error('checkLogrosEvaluacion error', err);
  }
  return nuevos;
}

/**
 * Checker social — llamar después de un follow con el total de seguidos.
 * @returns array de logros recién desbloqueados.
 */
export async function checkLogroSocial(usuarioId, followingCount) {
  try {
    if (followingCount >= 10) {
      const l = await otorgarLogro(usuarioId, 'Social');
      return l ? [l] : [];
    }
  } catch (err) {
    console.error('checkLogroSocial error', err);
  }
  return [];
}
