import prisma from '../prisma.js';
import { runQuery } from '../db.js';
import { otorgarGotas } from './gotas.service.js';

// Etapa 6 — ranking de amigos semanal. Cruza el follow-graph de Neo4j con las
// gotas de Postgres. Solo amigos (gente que sigo) + yo. El premio al top se
// otorga lazy al cerrar la semana, una sola vez (idempotente por semana).

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
// Lunes 00:00 local.
export function startOfWeek(d = new Date()) {
  const x = startOfDay(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  return x;
}
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
// Clave de semana = fecha del lunes 'YYYY-MM-DD'.
function weekKey(d) {
  const w = startOfWeek(d);
  return `${w.getFullYear()}-${String(w.getMonth() + 1).padStart(2, '0')}-${String(w.getDate()).padStart(2, '0')}`;
}

// Amigos (ids de Postgres) que el usuario sigue, vía Neo4j → mapeo por neoId.
async function amigosDe(usuario) {
  const recs = await runQuery(
    'MATCH (me:Usuario {id: $neoId})-[:SIGUIO]->(a:Usuario) RETURN a.id AS neoId',
    { neoId: usuario.neoId },
  );
  const neoIds = recs.map((r) => r.get('neoId'));
  if (neoIds.length === 0) return [];
  return prisma.usuario.findMany({
    where: { neoId: { in: neoIds } },
    select: { id: true, username: true },
  });
}

/**
 * Leaderboard de gotas de una semana entre el usuario y sus amigos.
 * @returns {{ tabla: Array<{usuarioId,username,gotasSemana,esYo}>, miPosicion: number }}
 */
export async function rankingAmigos(usuario, desde = startOfWeek(), hasta = addDays(startOfWeek(), 7)) {
  const amigos = await amigosDe(usuario);
  const grupo = [{ id: usuario.id, username: usuario.username }, ...amigos];
  const ids = grupo.map((u) => u.id);

  const sums = await prisma.movimientoGota.groupBy({
    by: ['usuarioId'],
    where: { usuarioId: { in: ids }, createdAt: { gte: desde, lt: hasta } },
    _sum: { cantidad: true },
  });
  const byId = new Map(sums.map((s) => [s.usuarioId, s._sum.cantidad ?? 0]));

  const tabla = grupo
    .map((u) => ({
      usuarioId: u.id,
      username: u.username,
      gotasSemana: byId.get(u.id) ?? 0,
      esYo: u.id === usuario.id,
    }))
    .sort((a, b) => b.gotasSemana - a.gotasSemana || a.username.localeCompare(b.username));

  const miPosicion = tabla.findIndex((t) => t.esYo) + 1;
  return { tabla, miPosicion };
}

/**
 * Lazy: al entrar en una semana nueva, si el usuario fue #1 de su grupo la
 * semana pasada (con gotas > 0), le otorga la insignia + bonus de gotas, una
 * sola vez. No rompe el flujo que lo llama.
 * @returns {Promise<null | { semana: string, gotasSemana: number }>}
 */
export async function cerrarSemanaYPremiar(usuario) {
  try {
    const prevStart = addDays(startOfWeek(), -7);
    const prevEnd = startOfWeek();
    const semana = weekKey(prevStart);

    const ya = await prisma.insigniaSemanal.findUnique({
      where: { usuarioId_semana: { usuarioId: usuario.id, semana } },
    });
    if (ya) return null; // ya se procesó esta semana

    const { tabla, miPosicion } = await rankingAmigos(usuario, prevStart, prevEnd);
    const yo = tabla.find((t) => t.esYo);
    if (miPosicion === 1 && yo && yo.gotasSemana > 0) {
      await prisma.insigniaSemanal.create({
        data: { usuarioId: usuario.id, semana, puesto: 1, gotasSemana: yo.gotasSemana },
      });
      await otorgarGotas(usuario.id, 'ranking_semanal', { cantidad: 50, refId: semana });
      return { semana, gotasSemana: yo.gotasSemana };
    }
    return null;
  } catch (err) {
    console.error('cerrarSemanaYPremiar error', err);
    return null;
  }
}
