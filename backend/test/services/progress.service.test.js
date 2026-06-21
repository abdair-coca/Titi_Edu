import { describe, it, expect, vi, beforeEach } from 'vitest';

// Postgres y Neo4j stubbeados: la lógica de racha es pura, solo lee/escribe
// el Usuario y no necesita una DB real.
vi.mock('../../src/prisma.js', () => ({
  default: {
    usuario: { findUnique: vi.fn(), update: vi.fn() },
  },
}));
vi.mock('../../src/services/achievement.service.js', () => ({ otorgarLogro: vi.fn() }));
vi.mock('../../src/services/neo4j-sync.service.js', () => ({ syncCursoCompletado: vi.fn() }));

import prisma from '../../src/prisma.js';
import { actualizarRacha } from '../../src/services/progress.service.js';

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const DAY = 86_400_000;

beforeEach(() => {
  vi.clearAllMocks();
  // update devuelve lo que le pasaron en data (con createdAt simulada)
  prisma.usuario.update.mockImplementation(({ data }) => Promise.resolve({ ...data }));
});

describe('actualizarRacha', () => {
  it('usuario inexistente → null', async () => {
    prisma.usuario.findUnique.mockResolvedValue(null);
    expect(await actualizarRacha('x')).toBeNull();
  });

  it('primera actividad → racha = 1 y subio', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'u1', racha: 0, ultimaActividad: null });
    const r = await actualizarRacha('u1');
    expect(r.racha).toBe(1);
    expect(r.subio).toBe(true);
    expect(r.rota).toBe(false);
  });

  it('ya estudió hoy → racha intacta, no sube', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'u1', racha: 5, ultimaActividad: startOfDay(new Date()) });
    const r = await actualizarRacha('u1');
    expect(r.racha).toBe(5);
    expect(r.subio).toBe(false);
    expect(prisma.usuario.update).not.toHaveBeenCalled();
  });

  it('estudió ayer → racha + 1', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'u1', racha: 5, ultimaActividad: startOfDay(new Date(Date.now() - DAY)) });
    const r = await actualizarRacha('u1');
    expect(r.racha).toBe(6);
    expect(r.subio).toBe(true);
    expect(r.rota).toBe(false);
  });

  it('hueco de varios días → racha rota, reinicia a 1', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'u1', racha: 9, ultimaActividad: startOfDay(new Date(Date.now() - 3 * DAY)) });
    const r = await actualizarRacha('u1');
    expect(r.racha).toBe(1);
    expect(r.rota).toBe(true);
  });
});
