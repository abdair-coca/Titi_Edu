import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

vi.mock('../../src/db.js', () => ({
  runQuery: vi.fn(),
  toNumber: (v) => Number(v ?? 0),
  default: {},
}));
vi.mock('../../src/prisma.js', () => ({
  default: { usuario: { findUnique: vi.fn() } },
}));

import app from '../../src/app.js';
import prisma from '../../src/prisma.js';

const token = jwt.sign(
  { id: 'user-1', username: 'testuser', email: 'test@example.com', rol: 'ESTUDIANTE' },
  process.env.JWT_SECRET,
  { expiresIn: '1h' }
);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/progress/:username/streak', () => {
  it('busca el username en minúsculas aunque el enlace tenga mayúsculas', async () => {
    prisma.usuario.findUnique.mockResolvedValueOnce({ racha: 3, ultimaActividad: new Date() });
    const res = await request(app)
      .get('/api/progress/AnaQuispe/streak')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(prisma.usuario.findUnique.mock.calls[0][0].where).toEqual({ username: 'anaquispe' });
  });
});
