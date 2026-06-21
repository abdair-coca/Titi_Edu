import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/prisma.js', () => ({
  default: {
    logro: { findUnique: vi.fn(), upsert: vi.fn() },
    logroUsuario: { create: vi.fn() },
    progreso: { count: vi.fn() },
    intento: { count: vi.fn() },
  },
}));
vi.mock('../../src/services/neo4j-sync.service.js', () => ({ syncLogroNotificacion: vi.fn() }));

import prisma from '../../src/prisma.js';
import {
  otorgarLogro,
  checkLogrosLeccion,
  checkLogrosEvaluacion,
  checkLogroSocial,
} from '../../src/services/achievement.service.js';

beforeEach(() => vi.clearAllMocks());

describe('otorgarLogro', () => {
  it('otorga un logro nuevo del catálogo', async () => {
    prisma.logro.findUnique.mockResolvedValue({ id: 'l1', nombre: 'Primera lección' });
    prisma.logroUsuario.create.mockResolvedValue({});
    const l = await otorgarLogro('u1', 'Primera lección');
    expect(l).toEqual({ id: 'l1', nombre: 'Primera lección' });
    expect(prisma.logroUsuario.create).toHaveBeenCalled();
  });

  it('nombre fuera del catálogo → null, no crea', async () => {
    prisma.logro.findUnique.mockResolvedValue(null);
    expect(await otorgarLogro('u1', 'Inexistente')).toBeNull();
    expect(prisma.logroUsuario.create).not.toHaveBeenCalled();
  });

  it('logro duplicado (P2002) → null sin romper', async () => {
    prisma.logro.findUnique.mockResolvedValue({ id: 'l1', nombre: 'Social' });
    prisma.logroUsuario.create.mockRejectedValue({ code: 'P2002' });
    expect(await otorgarLogro('u1', 'Social')).toBeNull();
  });
});

describe('checkLogrosLeccion', () => {
  it('primera lección + racha de 7 → dos logros', async () => {
    prisma.progreso.count.mockResolvedValue(1);
    prisma.logro.findUnique.mockImplementation(({ where }) => Promise.resolve({ id: where.nombre, nombre: where.nombre }));
    prisma.logroUsuario.create.mockResolvedValue({});
    const nuevos = await checkLogrosLeccion('u1', { racha: 7 });
    const nombres = nuevos.map((l) => l.nombre);
    expect(nombres).toContain('Primera lección');
    expect(nombres).toContain('Racha de 7 días');
  });
});

describe('checkLogrosEvaluacion', () => {
  it('nota perfecta → incluye logro "Perfecto"', async () => {
    prisma.intento.count.mockResolvedValue(1);
    prisma.logro.findUnique.mockImplementation(({ where }) => Promise.resolve({ id: where.nombre, nombre: where.nombre }));
    prisma.logroUsuario.create.mockResolvedValue({});
    const nuevos = await checkLogrosEvaluacion('u1', { nota: 100, racha: 1 });
    const nombres = nuevos.map((l) => l.nombre);
    expect(nombres).toContain('Primera evaluación');
    expect(nombres).toContain('Perfecto');
  });
});

describe('checkLogroSocial', () => {
  it('seguir < 10 → sin logro', async () => {
    expect(await checkLogroSocial('u1', 9)).toEqual([]);
  });
  it('seguir >= 10 → logro Social', async () => {
    prisma.logro.findUnique.mockResolvedValue({ id: 'social', nombre: 'Social' });
    prisma.logroUsuario.create.mockResolvedValue({});
    const r = await checkLogroSocial('u1', 10);
    expect(r.map((l) => l.nombre)).toContain('Social');
  });
});
