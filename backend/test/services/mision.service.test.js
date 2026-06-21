import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/prisma.js', () => ({
  default: {
    mision: { findMany: vi.fn() },
    misionUsuario: { count: vi.fn(), createMany: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  },
}));
const otorgarGotas = vi.fn();
vi.mock('../../src/services/gotas.service.js', () => ({ otorgarGotas: (...a) => otorgarGotas(...a) }));

import prisma from '../../src/prisma.js';
import { asignarMisionesDelDia, avanzarMisiones } from '../../src/services/mision.service.js';

beforeEach(() => {
  vi.clearAllMocks();
  otorgarGotas.mockResolvedValue({ otorgadas: 15 });
});

describe('asignarMisionesDelDia', () => {
  it('asigna 3 misiones si el usuario no tiene ninguna hoy', async () => {
    prisma.misionUsuario.count.mockResolvedValue(0);
    prisma.mision.findMany.mockResolvedValue([
      { id: 'm1' }, { id: 'm2' }, { id: 'm3' }, { id: 'm4' }, { id: 'm5' },
    ]);
    prisma.misionUsuario.createMany.mockResolvedValue({ count: 3 });
    await asignarMisionesDelDia('u1', '2026-06-21');
    expect(prisma.misionUsuario.createMany).toHaveBeenCalledTimes(1);
    expect(prisma.misionUsuario.createMany.mock.calls[0][0].data).toHaveLength(3);
  });

  it('es idempotente: no re-asigna si ya tiene misiones hoy', async () => {
    prisma.misionUsuario.count.mockResolvedValue(3);
    await asignarMisionesDelDia('u1', '2026-06-21');
    expect(prisma.misionUsuario.createMany).not.toHaveBeenCalled();
  });
});

describe('avanzarMisiones', () => {
  it('avanza el progreso sin completar si no llega a la meta', async () => {
    prisma.misionUsuario.findMany.mockResolvedValue([
      { id: 'mu1', progreso: 0, mision: { meta: 2, recompensa: 15, evento: 'leccion' } },
    ]);
    const completadas = await avanzarMisiones('u1', 'leccion');
    expect(prisma.misionUsuario.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { progreso: 1, completada: false } }),
    );
    expect(completadas).toHaveLength(0);
    expect(otorgarGotas).not.toHaveBeenCalled();
  });

  it('completa y otorga gotas al llegar a la meta', async () => {
    prisma.misionUsuario.findMany.mockResolvedValue([
      { id: 'mu1', progreso: 1, mision: { meta: 2, recompensa: 15, evento: 'leccion' } },
    ]);
    const completadas = await avanzarMisiones('u1', 'leccion');
    expect(prisma.misionUsuario.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { progreso: 2, completada: true } }),
    );
    expect(otorgarGotas).toHaveBeenCalledWith('u1', 'mision', { refId: 'mu1', cantidad: 15 });
    expect(completadas).toHaveLength(1);
  });

  it('no toca misiones de otro evento', async () => {
    prisma.misionUsuario.findMany.mockResolvedValue([]); // ninguna matchea 'post'
    const completadas = await avanzarMisiones('u1', 'post');
    expect(completadas).toHaveLength(0);
    expect(prisma.misionUsuario.update).not.toHaveBeenCalled();
  });
});
