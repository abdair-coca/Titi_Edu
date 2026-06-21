import prisma from '../prisma.js';
import { otorgarGotas } from './gotas.service.js';

// Etapa 6 — misiones diarias. Asigna 3 misiones por día desde el pool,
// las avanza con eventos reales y otorga gotas al completarlas. Idempotente
// por día. No rompe nunca el flujo que lo llama (try/catch).

const MISIONES_POR_DIA = 3;

// 'YYYY-MM-DD' en la TZ del servidor (el reset diario es a medianoche local).
export function hoyStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Asigna las misiones del día si el usuario aún no tiene ninguna para hoy. Idempotente. */
export async function asignarMisionesDelDia(usuarioId, fecha = hoyStr()) {
  const existentes = await prisma.misionUsuario.count({ where: { usuarioId, fecha } });
  if (existentes > 0) return; // ya tiene misiones hoy → no re-asignar
  const activas = await prisma.mision.findMany({ where: { activa: true } });
  const elegidas = shuffle(activas).slice(0, MISIONES_POR_DIA);
  if (elegidas.length === 0) return;
  await prisma.misionUsuario.createMany({
    data: elegidas.map((m) => ({ usuarioId, misionId: m.id, fecha })),
    skipDuplicates: true,
  });
}

/** Devuelve las misiones de hoy (asignándolas si faltan). */
export async function misionesDeHoy(usuarioId, fecha = hoyStr()) {
  await asignarMisionesDelDia(usuarioId, fecha);
  return prisma.misionUsuario.findMany({
    where: { usuarioId, fecha },
    include: { mision: true },
    orderBy: { id: 'asc' },
  });
}

/**
 * Avanza las misiones de hoy del usuario cuyo `evento` matchea. Al llegar a la
 * meta, marca completada y otorga la recompensa en gotas. Devuelve las misiones
 * recién completadas. No rompe el flujo que lo llama.
 */
export async function avanzarMisiones(usuarioId, evento, n = 1, fecha = hoyStr()) {
  try {
    const pendientes = await prisma.misionUsuario.findMany({
      where: { usuarioId, fecha, completada: false, mision: { evento } },
      include: { mision: true },
    });
    const completadas = [];
    for (const mu of pendientes) {
      const progreso = mu.progreso + n;
      const done = progreso >= mu.mision.meta;
      await prisma.misionUsuario.update({
        where: { id: mu.id },
        data: { progreso: done ? mu.mision.meta : progreso, completada: done },
      });
      if (done) {
        // refId = id de la asignación → la recompensa se paga una sola vez
        await otorgarGotas(usuarioId, 'mision', { refId: mu.id, cantidad: mu.mision.recompensa });
        completadas.push(mu.mision);
      }
    }
    return completadas;
  } catch (err) {
    console.error('avanzarMisiones error', err);
    return [];
  }
}

/** Variante para rutas sociales (Neo4j): recibe el neoId y resuelve el Usuario de Postgres. */
export async function avanzarMisionesPorNeoId(neoId, evento, n = 1) {
  try {
    const u = await prisma.usuario.findUnique({ where: { neoId }, select: { id: true } });
    if (!u) return [];
    return avanzarMisiones(u.id, evento, n);
  } catch (err) {
    console.error('avanzarMisionesPorNeoId error', err);
    return [];
  }
}
