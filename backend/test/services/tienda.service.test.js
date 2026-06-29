import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/prisma.js', () => ({
  default: {
    itemTienda: { findUnique: vi.fn(), findMany: vi.fn() },
    inventarioItem: { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn(), update: vi.fn() },
    compraItem: { create: vi.fn() },
    movimientoGota: { create: vi.fn() },
    usuario: { findUnique: vi.fn(), update: vi.fn() },
    $transaction: (arr) => Promise.all(arr),
  },
}));

import prisma from '../../src/prisma.js';
import { comprarItem, consumirItem, activarMultiplicador } from '../../src/services/tienda.service.js';

beforeEach(() => vi.clearAllMocks());

const item = { id: 'it1', codigo: 'congelar_racha', precio: 50, activo: true, limiteStack: 3 };

describe('comprarItem', () => {
  it('compra: debita gotas, registra compra y suma al inventario', async () => {
    prisma.itemTienda.findUnique.mockResolvedValue(item);
    prisma.usuario.findUnique.mockResolvedValue({ gotasSaldo: 200 });
    prisma.inventarioItem.findUnique.mockResolvedValue({ cantidad: 0 });
    prisma.movimientoGota.create.mockResolvedValue({ id: 'm1' });
    prisma.usuario.update.mockResolvedValue({ gotasSaldo: 150 });
    prisma.compraItem.create.mockResolvedValue({ id: 'c1' });
    prisma.inventarioItem.upsert.mockResolvedValue({ cantidad: 1 });

    const r = await comprarItem('u1', 'congelar_racha');
    expect(r).toEqual({ ok: true, saldo: 150, cantidad: 1 });
    // debita con movimiento negativo
    expect(prisma.movimientoGota.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ cantidad: -50, motivo: 'compra_tienda' }) }),
    );
  });

  it('409 saldo: no compra si no alcanza el saldo', async () => {
    prisma.itemTienda.findUnique.mockResolvedValue(item);
    prisma.usuario.findUnique.mockResolvedValue({ gotasSaldo: 10 });
    const r = await comprarItem('u1', 'congelar_racha');
    expect(r).toEqual({ ok: false, error: 'saldo' });
    expect(prisma.compraItem.create).not.toHaveBeenCalled();
  });

  it('409 stack: no compra si ya tiene el máximo', async () => {
    prisma.itemTienda.findUnique.mockResolvedValue(item);
    prisma.usuario.findUnique.mockResolvedValue({ gotasSaldo: 200 });
    prisma.inventarioItem.findUnique.mockResolvedValue({ cantidad: 3 }); // limiteStack = 3
    const r = await comprarItem('u1', 'congelar_racha');
    expect(r).toEqual({ ok: false, error: 'stack' });
    expect(prisma.compraItem.create).not.toHaveBeenCalled();
  });

  it('404 no_encontrado: ítem inexistente o inactivo', async () => {
    prisma.itemTienda.findUnique.mockResolvedValue(null);
    const r = await comprarItem('u1', 'xxx');
    expect(r).toEqual({ ok: false, error: 'no_encontrado' });
  });
});

describe('consumirItem', () => {
  it('consume una unidad si hay stock', async () => {
    prisma.itemTienda.findUnique.mockResolvedValue({ id: 'it1' });
    prisma.inventarioItem.findUnique.mockResolvedValue({ cantidad: 2 });
    prisma.inventarioItem.update.mockResolvedValue({ cantidad: 1 });
    const r = await consumirItem('u1', 'congelar_racha');
    expect(r).toEqual({ ok: true, cantidad: 1 });
  });

  it('no consume si no hay stock', async () => {
    prisma.itemTienda.findUnique.mockResolvedValue({ id: 'it1' });
    prisma.inventarioItem.findUnique.mockResolvedValue({ cantidad: 0 });
    const r = await consumirItem('u1', 'congelar_racha');
    expect(r).toEqual({ ok: false });
    expect(prisma.inventarioItem.update).not.toHaveBeenCalled();
  });
});

describe('activarMultiplicador', () => {
  it('consume 1 y abre la ventana x2', async () => {
    prisma.itemTienda.findUnique.mockResolvedValue({ id: 'mult' });
    prisma.inventarioItem.findUnique.mockResolvedValue({ cantidad: 1 });
    prisma.inventarioItem.update.mockResolvedValue({ cantidad: 0 });
    prisma.usuario.update.mockResolvedValue({});
    const r = await activarMultiplicador('u1');
    expect(r.ok).toBe(true);
    expect(r.hasta).toBeInstanceOf(Date);
    expect(prisma.usuario.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ gotasMultiplicadorHasta: expect.any(Date) }) }),
    );
  });

  it('falla si no hay multiplicador en inventario', async () => {
    prisma.itemTienda.findUnique.mockResolvedValue({ id: 'mult' });
    prisma.inventarioItem.findUnique.mockResolvedValue({ cantidad: 0 });
    const r = await activarMultiplicador('u1');
    expect(r).toEqual({ ok: false, error: 'sin_stock' });
    expect(prisma.usuario.update).not.toHaveBeenCalled();
  });
});
