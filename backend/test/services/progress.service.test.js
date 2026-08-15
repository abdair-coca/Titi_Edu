import { describe, it, expect, vi, beforeEach } from 'vitest';

// Postgres y Neo4j stubbeados: la lógica de racha es pura, solo lee/escribe
// el Usuario y no necesita una DB real.
vi.mock('../../src/prisma.js', () => ({
  default: {
    usuario: { findUnique: vi.fn(), update: vi.fn() },
    // consumirItem (tienda.service) corre con este mismo mock al evaluar el freeze.
    itemTienda: { findUnique: vi.fn() },
    inventarioItem: { findUnique: vi.fn(), update: vi.fn() },
    inscripcion: { findUnique: vi.fn(), update: vi.fn() },
    curso: { findUnique: vi.fn() },
    modulo: { findMany: vi.fn() },
    progreso: { count: vi.fn() },
    evaluacion: { findMany: vi.fn() },
    intento: { groupBy: vi.fn() },
    certificado: { findFirst: vi.fn(), create: vi.fn() },
  },
}));
vi.mock('../../src/services/achievement.service.js', () => ({ otorgarLogro: vi.fn() }));
vi.mock('../../src/services/neo4j-sync.service.js', () => ({ syncCursoCompletado: vi.fn() }));

import prisma from '../../src/prisma.js';
import { actualizarRacha, checkCursoCompletado } from '../../src/services/progress.service.js';

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

  it('perdió un día pero tiene congelar_racha → continúa (congelada)', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'u1', racha: 7, ultimaActividad: startOfDay(new Date(Date.now() - 2 * DAY)) });
    prisma.itemTienda.findUnique.mockResolvedValue({ id: 'freeze' });
    prisma.inventarioItem.findUnique.mockResolvedValue({ cantidad: 1 });
    prisma.inventarioItem.update.mockResolvedValue({ cantidad: 0 });
    const r = await actualizarRacha('u1');
    expect(r.racha).toBe(8);
    expect(r.rota).toBe(false);
    expect(r.congelada).toBe(true);
  });

  it('perdió un día y NO tiene congelar_racha → racha rota', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'u1', racha: 7, ultimaActividad: startOfDay(new Date(Date.now() - 2 * DAY)) });
    prisma.itemTienda.findUnique.mockResolvedValue({ id: 'freeze' });
    prisma.inventarioItem.findUnique.mockResolvedValue({ cantidad: 0 });
    const r = await actualizarRacha('u1');
    expect(r.racha).toBe(1);
    expect(r.rota).toBe(true);
  });
});

describe('checkCursoCompletado', () => {
  it('excluye borradores del denominador y no emite certificado cuando el curso lo desactiva', async () => {
    prisma.inscripcion.findUnique.mockResolvedValue({ id: 'i1', completado: false });
    prisma.curso.findUnique.mockResolvedValue({ titulo: 'Curso sin certificado', emiteCertificado: false });
    prisma.modulo.findMany.mockResolvedValue([
      { lecciones: [{ id: 'published-lesson' }], evaluacion: null },
    ]);
    prisma.progreso.count.mockResolvedValue(1);
    prisma.evaluacion.findMany.mockResolvedValue([]);
    prisma.inscripcion.update.mockResolvedValue({ id: 'i1', completado: true });

    const result = await checkCursoCompletado('u1', 'c1');

    expect(prisma.modulo.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { cursoId: 'c1', estado: 'PUBLICADO' },
    }));
    expect(result).toMatchObject({ completado: true, nuevo: true, certificado: null });
    expect(prisma.certificado.create).not.toHaveBeenCalled();
  });
});
