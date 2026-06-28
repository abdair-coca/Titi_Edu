import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

vi.mock('../../src/db.js', () => ({ runQuery: vi.fn(), toNumber: (v) => Number(v ?? 0), default: {} }));
vi.mock('../../src/prisma.js', () => ({
  default: { usuario: { findUnique: vi.fn() } },
}));
vi.mock('../../src/services/ranking.service.js', () => ({
  rankingAmigos: vi.fn(),
  cerrarSemanaYPremiar: vi.fn(),
}));

import app from '../../src/app.js';
import prisma from '../../src/prisma.js';
import { rankingAmigos, cerrarSemanaYPremiar } from '../../src/services/ranking.service.js';

const tokenFor = (neoId) => jwt.sign({ id: neoId }, process.env.JWT_SECRET, { expiresIn: '1h' });

beforeEach(() => vi.clearAllMocks());

describe('GET /api/ranking/friends', () => {
  it('401 sin token', async () => {
    const res = await request(app).get('/api/ranking/friends');
    expect(res.status).toBe(401);
  });

  it('200 devuelve tabla, miPosicion y premio', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'u1', username: 'yo' });
    cerrarSemanaYPremiar.mockResolvedValue(null);
    rankingAmigos.mockResolvedValue({
      tabla: [
        { usuarioId: 'u2', username: 'ana', gotasSemana: 80, esYo: false },
        { usuarioId: 'u1', username: 'yo', gotasSemana: 40, esYo: true },
      ],
      miPosicion: 2,
    });
    const res = await request(app).get('/api/ranking/friends')
      .set('Authorization', `Bearer ${tokenFor('neo-1')}`);
    expect(res.status).toBe(200);
    expect(res.body.data.miPosicion).toBe(2);
    expect(res.body.data.tabla).toHaveLength(2);
    expect(res.body.data.premio).toBeNull();
  });

  it('200 incluye el premio cuando fui top de la semana', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'u1', username: 'yo' });
    cerrarSemanaYPremiar.mockResolvedValue({ semana: '2026-W25', gotasSemana: 90 });
    rankingAmigos.mockResolvedValue({ tabla: [{ usuarioId: 'u1', username: 'yo', gotasSemana: 0, esYo: true }], miPosicion: 1 });
    const res = await request(app).get('/api/ranking/friends')
      .set('Authorization', `Bearer ${tokenFor('neo-1')}`);
    expect(res.status).toBe(200);
    expect(res.body.data.premio).toEqual({ semana: '2026-W25', gotasSemana: 90 });
  });
});
