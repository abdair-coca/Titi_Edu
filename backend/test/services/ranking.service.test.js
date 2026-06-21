import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/prisma.js', () => ({
  default: {
    usuario: { findMany: vi.fn() },
    movimientoGota: { groupBy: vi.fn() },
    insigniaSemanal: { findUnique: vi.fn(), create: vi.fn() },
  },
}));
const runQuery = vi.fn();
vi.mock('../../src/db.js', () => ({ runQuery: (...a) => runQuery(...a) }));
const otorgarGotas = vi.fn();
vi.mock('../../src/services/gotas.service.js', () => ({ otorgarGotas: (...a) => otorgarGotas(...a) }));

import prisma from '../../src/prisma.js';
import { rankingAmigos, cerrarSemanaYPremiar } from '../../src/services/ranking.service.js';

const yo = { id: 'u1', neoId: 'n1', username: 'yo' };
const neoRec = (neoId) => ({ get: () => neoId });

beforeEach(() => {
  vi.clearAllMocks();
  otorgarGotas.mockResolvedValue({ otorgadas: 50 });
});

describe('rankingAmigos', () => {
  it('ordena por gotas DESC e incluye al usuario con su posición', async () => {
    runQuery.mockResolvedValue([neoRec('n2'), neoRec('n3')]); // sigo a 2
    prisma.usuario.findMany.mockResolvedValue([
      { id: 'u2', username: 'ana' },
      { id: 'u3', username: 'beto' },
    ]);
    prisma.movimientoGota.groupBy.mockResolvedValue([
      { usuarioId: 'u1', _sum: { cantidad: 30 } },
      { usuarioId: 'u2', _sum: { cantidad: 80 } },
      { usuarioId: 'u3', _sum: { cantidad: 10 } },
    ]);
    const { tabla, miPosicion } = await rankingAmigos(yo);
    expect(tabla.map((t) => t.username)).toEqual(['ana', 'yo', 'beto']);
    expect(tabla[0].gotasSemana).toBe(80);
    expect(miPosicion).toBe(2);
    expect(tabla.find((t) => t.esYo).username).toBe('yo');
  });

  it('sin amigos, el usuario queda solo en la tabla', async () => {
    runQuery.mockResolvedValue([]);
    prisma.movimientoGota.groupBy.mockResolvedValue([{ usuarioId: 'u1', _sum: { cantidad: 5 } }]);
    const { tabla, miPosicion } = await rankingAmigos(yo);
    expect(tabla).toHaveLength(1);
    expect(miPosicion).toBe(1);
  });
});

describe('cerrarSemanaYPremiar', () => {
  it('no premia si ya hay insignia de esa semana (idempotente)', async () => {
    prisma.insigniaSemanal.findUnique.mockResolvedValue({ id: 'ya' });
    const r = await cerrarSemanaYPremiar(yo);
    expect(r).toBeNull();
    expect(prisma.insigniaSemanal.create).not.toHaveBeenCalled();
    expect(otorgarGotas).not.toHaveBeenCalled();
  });

  it('premia al #1 con gotas > 0: crea insignia y otorga gotas', async () => {
    prisma.insigniaSemanal.findUnique.mockResolvedValue(null);
    runQuery.mockResolvedValue([]); // sin amigos → yo solo
    prisma.movimientoGota.groupBy.mockResolvedValue([{ usuarioId: 'u1', _sum: { cantidad: 40 } }]);
    prisma.insigniaSemanal.create.mockResolvedValue({});
    const r = await cerrarSemanaYPremiar(yo);
    expect(r).toMatchObject({ gotasSemana: 40 });
    expect(prisma.insigniaSemanal.create).toHaveBeenCalled();
    expect(otorgarGotas).toHaveBeenCalledWith('u1', 'ranking_semanal', expect.objectContaining({ cantidad: 50 }));
  });

  it('no premia si el usuario no fue #1', async () => {
    prisma.insigniaSemanal.findUnique.mockResolvedValue(null);
    runQuery.mockResolvedValue([neoRec('n2')]);
    prisma.usuario.findMany.mockResolvedValue([{ id: 'u2', username: 'ana' }]);
    prisma.movimientoGota.groupBy.mockResolvedValue([
      { usuarioId: 'u1', _sum: { cantidad: 10 } },
      { usuarioId: 'u2', _sum: { cantidad: 90 } },
    ]);
    const r = await cerrarSemanaYPremiar(yo);
    expect(r).toBeNull();
    expect(prisma.insigniaSemanal.create).not.toHaveBeenCalled();
  });

  it('no premia al #1 si tiene 0 gotas (inactivo)', async () => {
    prisma.insigniaSemanal.findUnique.mockResolvedValue(null);
    runQuery.mockResolvedValue([]);
    prisma.movimientoGota.groupBy.mockResolvedValue([]); // nadie sumó
    const r = await cerrarSemanaYPremiar(yo);
    expect(r).toBeNull();
    expect(prisma.insigniaSemanal.create).not.toHaveBeenCalled();
  });
});
