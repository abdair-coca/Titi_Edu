import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/prisma.js', () => ({
  default: {
    movimientoGota: { findFirst: vi.fn(), count: vi.fn(), create: vi.fn(), aggregate: vi.fn() },
    usuario: { update: vi.fn() },
    // $transaction recibe un array de promesas (las del create/update mockeados)
    $transaction: (arr) => Promise.all(arr),
  },
}));

import prisma from '../../src/prisma.js';
import { otorgarGotas, gotasDeLaSemana, topeAlcanzado } from '../../src/services/gotas.service.js';

beforeEach(() => {
  vi.clearAllMocks();
  prisma.movimientoGota.create.mockResolvedValue({ id: 'mov1' });
  prisma.movimientoGota.count.mockResolvedValue(0);
  prisma.movimientoGota.findFirst.mockResolvedValue(null);
});

describe('otorgarGotas — aprendizaje', () => {
  it('otorga la cantidad de la tabla y actualiza el saldo', async () => {
    prisma.usuario.update.mockResolvedValue({ gotasSaldo: 10, gotasTotal: 10 });
    const r = await otorgarGotas('u1', 'leccion', { refId: 'lec1' });
    expect(r.otorgadas).toBe(10);
    expect(r.saldo).toBe(10);
    expect(prisma.movimientoGota.create).toHaveBeenCalled();
  });

  it('es idempotente: la misma lección no paga dos veces', async () => {
    prisma.movimientoGota.findFirst.mockResolvedValue({ id: 'ya' }); // ya existe
    const r = await otorgarGotas('u1', 'leccion', { refId: 'lec1' });
    expect(r.otorgadas).toBe(0);
    expect(prisma.movimientoGota.create).not.toHaveBeenCalled();
  });
});

describe('otorgarGotas — social con tope diario', () => {
  it('otorga si está bajo el tope', async () => {
    prisma.movimientoGota.count.mockResolvedValue(1); // 1 post hoy, tope es 2
    prisma.usuario.update.mockResolvedValue({ gotasSaldo: 5, gotasTotal: 5 });
    const r = await otorgarGotas('u1', 'social_post');
    expect(r.otorgadas).toBe(5);
  });

  it('no otorga si alcanzó el tope diario', async () => {
    prisma.movimientoGota.count.mockResolvedValue(2); // tope social_post = 2
    const r = await otorgarGotas('u1', 'social_post');
    expect(r.otorgadas).toBe(0);
    expect(prisma.movimientoGota.create).not.toHaveBeenCalled();
  });
});

describe('otorgarGotas — cantidad custom (misión)', () => {
  it('usa la cantidad pasada en vez de la tabla', async () => {
    prisma.usuario.update.mockResolvedValue({ gotasSaldo: 15, gotasTotal: 15 });
    const r = await otorgarGotas('u1', 'mision', { cantidad: 15 });
    expect(r.otorgadas).toBe(15);
  });
});

describe('topeAlcanzado', () => {
  it('motivos sin tope nunca lo alcanzan', async () => {
    expect(await topeAlcanzado('u1', 'leccion')).toBe(false);
    expect(prisma.movimientoGota.count).not.toHaveBeenCalled();
  });
});

describe('gotasDeLaSemana', () => {
  it('devuelve la suma del ledger', async () => {
    prisma.movimientoGota.aggregate.mockResolvedValue({ _sum: { cantidad: 42 } });
    expect(await gotasDeLaSemana('u1')).toBe(42);
  });

  it('devuelve 0 si no hay movimientos', async () => {
    prisma.movimientoGota.aggregate.mockResolvedValue({ _sum: { cantidad: null } });
    expect(await gotasDeLaSemana('u1')).toBe(0);
  });
});
