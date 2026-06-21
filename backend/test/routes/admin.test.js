import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

vi.mock('../../src/db.js', () => ({ runQuery: vi.fn(), toNumber: (v) => Number(v ?? 0), default: {} }));
vi.mock('../../src/prisma.js', () => ({
  default: {
    usuario: { findUnique: vi.fn(), count: vi.fn() },
    curso: { count: vi.fn() },
    inscripcion: { count: vi.fn() },
    certificado: { count: vi.fn() },
  },
}));

import app from '../../src/app.js';
import prisma from '../../src/prisma.js';

const tokenFor = (neoId) => jwt.sign({ id: neoId }, process.env.JWT_SECRET, { expiresIn: '1h' });

beforeEach(() => vi.clearAllMocks());

describe('guard de /api/admin', () => {
  it('401 sin token', async () => {
    const res = await request(app).get('/api/admin/stats');
    expect(res.status).toBe(401);
  });

  it('403 si el usuario no es ADMIN', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'u1', rol: 'ESTUDIANTE' });
    const res = await request(app).get('/api/admin/stats')
      .set('Authorization', `Bearer ${tokenFor('neo-1')}`);
    expect(res.status).toBe(403);
  });

  it('200 con stats si es ADMIN', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'admin1', rol: 'ADMIN' });
    prisma.usuario.count.mockResolvedValue(10);
    prisma.curso.count.mockResolvedValue(4);
    prisma.inscripcion.count.mockResolvedValue(20);
    prisma.certificado.count.mockResolvedValue(2);
    const res = await request(app).get('/api/admin/stats')
      .set('Authorization', `Bearer ${tokenFor('neo-admin')}`);
    expect(res.status).toBe(200);
    expect(res.body.data.stats.usuarios).toBe(10);
  });

  it('400 al cambiar rol a un valor inválido', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'admin1', rol: 'ADMIN' });
    const res = await request(app).put('/api/admin/users/x/role')
      .set('Authorization', `Bearer ${tokenFor('neo-admin')}`)
      .send({ rol: 'SUPERMAN' });
    expect(res.status).toBe(400);
  });
});
