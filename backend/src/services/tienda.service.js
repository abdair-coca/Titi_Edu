import prisma from '../prisma.js';

// Etapa 7 — tienda de gotas. Ítems consumibles que se compran con gotas
// (gotasSaldo) y se acumulan en un inventario por usuario. Los efectos
// (congelar racha, intento extra, multiplicador) se aplican en sus triggers
// (subfase 7.2); este servicio solo maneja catálogo, compra y consumo.

/** Catálogo de ítems activos + la cantidad que el usuario ya tiene de cada uno. */
export async function catalogoConInventario(usuarioId) {
  const [items, inv] = await Promise.all([
    prisma.itemTienda.findMany({ where: { activo: true }, orderBy: { precio: 'asc' } }),
    prisma.inventarioItem.findMany({ where: { usuarioId } }),
  ]);
  const cantPorItem = new Map(inv.map((i) => [i.itemId, i.cantidad]));
  return items.map((it) => ({
    codigo: it.codigo,
    nombre: it.nombre,
    descripcion: it.descripcion,
    precio: it.precio,
    efecto: it.efecto,
    icono: it.icono,
    limiteStack: it.limiteStack,
    cantidad: cantPorItem.get(it.id) ?? 0,
  }));
}

/** Inventario del usuario (solo lo que posee, cantidad > 0). */
export async function inventarioDe(usuarioId) {
  const inv = await prisma.inventarioItem.findMany({
    where: { usuarioId, cantidad: { gt: 0 } },
    include: { item: true },
  });
  return inv.map((i) => ({
    codigo: i.item.codigo,
    nombre: i.item.nombre,
    efecto: i.item.efecto,
    icono: i.item.icono,
    cantidad: i.cantidad,
  }));
}

/**
 * Compra un ítem: valida activo, saldo y limiteStack; en una transacción debita
 * gotas (MovimientoGota negativo + decrement de gotasSaldo), escribe la compra y
 * suma 1 al inventario. Atómico a propósito (no usa gastarGotas para no partir la
 * transacción).
 * @returns {Promise<{ ok: boolean, error?: string, saldo?: number, cantidad?: number }>}
 *   error ∈ 'no_encontrado' | 'saldo' | 'stack'
 */
export async function comprarItem(usuarioId, codigo) {
  const item = await prisma.itemTienda.findUnique({ where: { codigo } });
  if (!item || !item.activo) return { ok: false, error: 'no_encontrado' };

  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId }, select: { gotasSaldo: true } });
  if (!usuario || usuario.gotasSaldo < item.precio) return { ok: false, error: 'saldo' };

  const actual = await prisma.inventarioItem.findUnique({
    where: { usuarioId_itemId: { usuarioId, itemId: item.id } },
  });
  const tiene = actual?.cantidad ?? 0;
  if (item.limiteStack != null && tiene + 1 > item.limiteStack) {
    return { ok: false, error: 'stack' };
  }

  const [, usuarioAct, , invAct] = await prisma.$transaction([
    prisma.movimientoGota.create({
      data: { usuarioId, motivo: 'compra_tienda', refId: item.id, cantidad: -item.precio },
    }),
    prisma.usuario.update({
      where: { id: usuarioId },
      data: { gotasSaldo: { decrement: item.precio } },
    }),
    prisma.compraItem.create({ data: { usuarioId, itemId: item.id, precio: item.precio } }),
    prisma.inventarioItem.upsert({
      where: { usuarioId_itemId: { usuarioId, itemId: item.id } },
      create: { usuarioId, itemId: item.id, cantidad: 1 },
      update: { cantidad: { increment: 1 } },
    }),
  ]);

  return { ok: true, saldo: usuarioAct.gotasSaldo, cantidad: invAct.cantidad };
}

// Ventana del multiplicador de gotas: 1 hora desde que se activa.
const MULTIPLICADOR_MS = 60 * 60 * 1000;

/**
 * Activa el multiplicador x2: consume 1 'multiplicador_gotas' y abre la ventana
 * (gotasMultiplicadorHasta = now + 1 h). Si ya hay una ventana activa, la extiende
 * desde ahora. Devuelve { ok, error?, hasta? }. error ∈ 'sin_stock'.
 */
export async function activarMultiplicador(usuarioId) {
  const consumo = await consumirItem(usuarioId, 'multiplicador_gotas');
  if (!consumo.ok) return { ok: false, error: 'sin_stock' };
  const hasta = new Date(Date.now() + MULTIPLICADOR_MS);
  await prisma.usuario.update({ where: { id: usuarioId }, data: { gotasMultiplicadorHasta: hasta } });
  return { ok: true, hasta };
}

/**
 * Consume 1 unidad de un consumible del inventario, si hay. Lo usan los efectos
 * (7.2) y el endpoint /use. No rompe nunca el flujo que lo llama.
 * @returns {Promise<{ ok: boolean, cantidad?: number }>}
 */
export async function consumirItem(usuarioId, codigo) {
  try {
    const item = await prisma.itemTienda.findUnique({ where: { codigo }, select: { id: true } });
    if (!item) return { ok: false };
    const inv = await prisma.inventarioItem.findUnique({
      where: { usuarioId_itemId: { usuarioId, itemId: item.id } },
    });
    if (!inv || inv.cantidad <= 0) return { ok: false };
    const actualizado = await prisma.inventarioItem.update({
      where: { usuarioId_itemId: { usuarioId, itemId: item.id } },
      data: { cantidad: { decrement: 1 } },
    });
    return { ok: true, cantidad: actualizado.cantidad };
  } catch (err) {
    console.error('consumirItem error', err);
    return { ok: false };
  }
}
