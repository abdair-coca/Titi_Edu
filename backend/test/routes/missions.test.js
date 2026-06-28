import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

vi.mock('../../src/db.js', () => ({ runQuery: vi.fn(), toNumber: (v) => Number(v ?? 0), default: {} }));
vi.mock('../../src/prisma.js', () => ({
  default: { usuario: { findUnique: vi.fn() } },
}));
vi.mock('../../src/services/mision.service.js', () => ({
  asignarMisionesDelDia: vi.fn(),
  avanzarMisiones: vi.fn(),
  misionesDeHoy: vi.fn(),
}));

import app from '../../src/app.js';
import prisma from '../../src/prisma.js';
import { misionesDeHoy } from '../../src/services/mision.service.js';

const tokenFor = (neoId) => jwt.sign({ id: neoId }, process.env.JWT_SECRET, { expiresIn: '1h' });

beforeEach(() => vi.clearAllMocks());

describe('GET /api/missions/today', () => {
  it('401 sin token', async () => {
    const res = await request(app).get('/api/missions/today');
    expect(res.status).toBe(401);
  });

  it('200 devuelve las misiones del día con su progreso', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'u1' });
    misionesDeHoy.mockResolvedValue([
      {
        id: 'mu1',
        progreso: 1,
        completada: false,
        mision: {
          codigo: 'completar_2_lecciones',
          titulo: 'Completá 2 lecciones',
          descripcion: 'Seguí aprendiendo',
          meta: 2,
          recompensa: 15,
        },
      },
    ]);
    const res = await request(app).get('/api/missions/today')
      .set('Authorization', `Bearer ${tokenFor('neo-1')}`);
    expect(res.status).toBe(200);
    expect(res.body.data.misiones).toHaveLength(1);
    expect(res.body.data.misiones[0]).toMatchObject({
      id: 'mu1',
      codigo: 'completar_2_lecciones',
      meta: 2,
      recompensa: 15,
      progreso: 1,
      completada: false,
    });
  });
});
