import prisma from '../prisma.js';

// Etapa 6 — economía de gotas (XP de Titi).
// Las gotas viven en Postgres. Este servicio concentra el otorgamiento con
// idempotencia (aprendizaje) y topes diarios (social), y la suma semanal
// (para el ranking de amigos). Patrón espejo de los servicios externos:
// try/catch que loguea pero NUNCA rompe la operación principal que lo llama.

// Tabla de balance canónica (AGENTS.md §4.1).
export const GOTAS = {
  leccion: 10,
  evaluacion: 20,
  curso: 50,
  social_post: 5,
  social_like: 1,
  social_comment: 2,
  social_follow: 3,
  ranking_semanal: 50,
};

// Tope diario (cantidad de otorgamientos por día) para los motivos sociales.
const TOPE_DIARIO = {
  social_post: 2,
  social_like: 10,
  social_comment: 5,
  social_follow: 3,
};

// El aprendizaje es idempotente por refId (una lección no paga dos veces).
const MOTIVOS_APRENDIZAJE = new Set(['leccion', 'evaluacion', 'curso']);

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// Lunes 00:00 como inicio de semana (ISO).
export function startOfWeek(d = new Date()) {
  const x = startOfDay(d);
  const day = (x.getDay() + 6) % 7; // 0 = lunes
  x.setDate(x.getDate() - day);
  return x;
}

/** ¿El usuario ya alcanzó el tope diario para este motivo social? */
export async function topeAlcanzado(usuarioId, motivo, desde = startOfDay()) {
  const tope = TOPE_DIARIO[motivo];
  if (!tope) return false; // motivos sin tope (aprendizaje, misión, ranking)
  const count = await prisma.movimientoGota.count({
    where: { usuarioId, motivo, createdAt: { gte: desde } },
  });
  return count >= tope;
}

/**
 * Otorga gotas a un usuario. No rompe nunca el flujo que lo llama.
 * @param {string} usuarioId
 * @param {string} motivo  clave de GOTAS
 * @param {{ refId?: string, cantidad?: number }} opts  refId para idempotencia; cantidad para misión/ranking
 * @returns {Promise<{ otorgadas: number, saldo?: number, total?: number }>}
 */
export async function otorgarGotas(usuarioId, motivo, { refId = null, cantidad = null } = {}) {
  try {
    let monto = cantidad ?? GOTAS[motivo];
    if (!monto || monto <= 0) return { otorgadas: 0 };

    // Idempotencia de aprendizaje: un mismo (usuario, motivo, refId) paga una vez.
    if (MOTIVOS_APRENDIZAJE.has(motivo) && refId) {
      const ya = await prisma.movimientoGota.findFirst({ where: { usuarioId, motivo, refId } });
      if (ya) return { otorgadas: 0 };
    }

    // Tope diario anti-farmeo para los motivos sociales.
    if (await topeAlcanzado(usuarioId, motivo)) return { otorgadas: 0 };

    // Etapa 7 — multiplicador x2 si está activo (no aplica al premio del ranking).
    if (motivo !== 'ranking_semanal') {
      const u = await prisma.usuario.findUnique({
        where: { id: usuarioId },
        select: { gotasMultiplicadorHasta: true },
      });
      if (u?.gotasMultiplicadorHasta && new Date(u.gotasMultiplicadorHasta) > new Date()) {
        monto *= 2;
      }
    }

    const [, usuario] = await prisma.$transaction([
      prisma.movimientoGota.create({ data: { usuarioId, motivo, refId, cantidad: monto } }),
      prisma.usuario.update({
        where: { id: usuarioId },
        data: { gotasSaldo: { increment: monto }, gotasTotal: { increment: monto } },
      }),
    ]);

    return { otorgadas: monto, saldo: usuario.gotasSaldo, total: usuario.gotasTotal };
  } catch (err) {
    console.error('otorgarGotas error', err);
    return { otorgadas: 0 };
  }
}

/**
 * Igual que otorgarGotas pero recibe el id de Neo4j (lo que llevan las rutas
 * sociales en req.user.id) y resuelve el Usuario de Postgres por neoId.
 * No rompe nunca el flujo que lo llama.
 */
export async function otorgarGotasPorNeoId(neoId, motivo, opts = {}) {
  try {
    const u = await prisma.usuario.findUnique({ where: { neoId }, select: { id: true } });
    if (!u) return { otorgadas: 0 };
    return otorgarGotas(u.id, motivo, opts);
  } catch (err) {
    console.error('otorgarGotasPorNeoId error', err);
    return { otorgadas: 0 };
  }
}

/**
 * Suma de gotas **ganadas** por el usuario en la semana en curso (desde el lunes).
 * Solo cuenta movimientos positivos: los gastos de la tienda (cantidad < 0) no
 * bajan el ranking semanal, que mide actividad/ganancia, no saldo neto.
 */
export async function gotasDeLaSemana(usuarioId, desde = startOfWeek()) {
  const r = await prisma.movimientoGota.aggregate({
    _sum: { cantidad: true },
    where: { usuarioId, createdAt: { gte: desde }, cantidad: { gt: 0 } },
  });
  return r._sum.cantidad ?? 0;
}

/**
 * Gasta gotas del saldo (no del total — el total es lifetime ganado). Escribe un
 * MovimientoGota negativo. Valida saldo suficiente. Devuelve { ok, saldo }.
 * No rompe el flujo; ante saldo insuficiente devuelve { ok: false }.
 * @param {string} usuarioId
 * @param {number} cantidad  monto positivo a descontar
 * @param {{ motivo?: string, refId?: string }} opts
 */
export async function gastarGotas(usuarioId, cantidad, { motivo = 'compra_tienda', refId = null } = {}) {
  try {
    const monto = Number(cantidad) || 0;
    if (monto <= 0) return { ok: false, saldo: null };
    const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId }, select: { gotasSaldo: true } });
    if (!usuario || usuario.gotasSaldo < monto) return { ok: false, saldo: usuario?.gotasSaldo ?? 0 };

    const [, actualizado] = await prisma.$transaction([
      prisma.movimientoGota.create({ data: { usuarioId, motivo, refId, cantidad: -monto } }),
      prisma.usuario.update({ where: { id: usuarioId }, data: { gotasSaldo: { decrement: monto } } }),
    ]);
    return { ok: true, saldo: actualizado.gotasSaldo };
  } catch (err) {
    console.error('gastarGotas error', err);
    return { ok: false, saldo: null };
  }
}
