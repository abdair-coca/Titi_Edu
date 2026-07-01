import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

vi.mock('../../src/db.js', () => ({ runQuery: vi.fn(), toNumber: (v) => Number(v ?? 0), default: {} }));
vi.mock('../../src/prisma.js', () => ({
  default: {
    usuario: { findUnique: vi.fn() },
    movimientoGota: { findMany: vi.fn() },
    leccion: { findMany: vi.fn() },
    evaluacion: { findMany: vi.fn() },
    curso: { findMany: vi.fn() },
  },
}));
// El service se aísla: el route test no depende de cómo se suma la semana.
vi.mock('../../src/services/gotas.service.js', () => ({
  otorgarGotas: vi.fn(),
  gotasDeLaSemana: vi.fn(),
  topeAlcanzado: vi.fn(),
}));

import app from '../../src/app.js';
import prisma from '../../src/prisma.js';
import { gotasDeLaSemana } from '../../src/services/gotas.service.js';

const tokenFor = (neoId) => jwt.sign({ id: neoId }, process.env.JWT_SECRET, { expiresIn: '1h' });

beforeEach(() => vi.clearAllMocks());

describe('GET /api/gotas', () => {
  it('401 sin token', async () => {
    const res = await request(app).get('/api/gotas');
    expect(res.status).toBe(401);
  });

  it('401 si el espejo de usuario no existe en Postgres', async () => {
    prisma.usuario.findUnique.mockResolvedValue(null);
    const res = await request(app).get('/api/gotas')
      .set('Authorization', `Bearer ${tokenFor('neo-x')}`);
    expect(res.status).toBe(401);
  });

  it('200 devuelve saldo, total y semana', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'u1', gotasSaldo: 120, gotasTotal: 300 });
    gotasDeLaSemana.mockResolvedValue(45);
    const res = await request(app).get('/api/gotas')
      .set('Authorization', `Bearer ${tokenFor('neo-1')}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ saldo: 120, total: 300, semana: 45 });
  });
});

describe('GET /api/gotas/history', () => {
  it('401 sin token', async () => {
    const res = await request(app).get('/api/gotas/history');
    expect(res.status).toBe(401);
  });

  it('200 devuelve movimientos y nextCursor', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'u1', gotasSaldo: 10, gotasTotal: 10 });
    prisma.movimientoGota.findMany.mockResolvedValue([
      { id: 'm1', cantidad: 10, motivo: 'leccion', refId: 'l1', createdAt: new Date('2026-06-20T10:00:00Z') },
    ]);
    const res = await request(app).get('/api/gotas/history?limit=1')
      .set('Authorization', `Bearer ${tokenFor('neo-1')}`);
    expect(res.status).toBe(200);
    expect(res.body.data.movimientos).toHaveLength(1);
    // limit=1 y devolvió 1 → hay nextCursor
    expect(res.body.data.nextCursor).toBe('2026-06-20T10:00:00.000Z');
  });
});

describe('GET /api/gotas/activity', () => {
  it('401 sin token', async () => {
    const res = await request(app).get('/api/gotas/activity');
    expect(res.status).toBe(401);
  });

  it('200 arma el feed académico resolviendo títulos por tipo', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'u1', gotasSaldo: 10, gotasTotal: 10 });
    prisma.movimientoGota.findMany.mockResolvedValue([
      { cantidad: 10, motivo: 'leccion', refId: 'l1', createdAt: new Date('2026-06-20T10:00:00Z') },
      { cantidad: 50, motivo: 'curso', refId: 'c1', createdAt: new Date('2026-06-19T10:00:00Z') },
    ]);
    prisma.leccion.findMany.mockResolvedValue([{ id: 'l1', titulo: 'Variables' }]);
    prisma.evaluacion.findMany.mockResolvedValue([]);
    prisma.curso.findMany.mockResolvedValue([{ id: 'c1', titulo: 'Introducción a Python' }]);

    const res = await request(app).get('/api/gotas/activity')
      .set('Authorization', `Bearer ${tokenFor('neo-1')}`);
    expect(res.status).toBe(200);
    expect(res.body.data.actividad).toEqual([
      { tipo: 'leccion', titulo: 'Variables', cantidad: 10, createdAt: '2026-06-20T10:00:00.000Z' },
      { tipo: 'curso', titulo: 'Introducción a Python', cantidad: 50, createdAt: '2026-06-19T10:00:00.000Z' },
    ]);
  });

  it('devuelve "Contenido eliminado" si el refId ya no existe', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'u1', gotasSaldo: 10, gotasTotal: 10 });
    prisma.movimientoGota.findMany.mockResolvedValue([
      { cantidad: 20, motivo: 'evaluacion', refId: 'e-borrada', createdAt: new Date('2026-06-20T10:00:00Z') },
    ]);
    prisma.leccion.findMany.mockResolvedValue([]);
    prisma.evaluacion.findMany.mockResolvedValue([]);
    prisma.curso.findMany.mockResolvedValue([]);

    const res = await request(app).get('/api/gotas/activity')
      .set('Authorization', `Bearer ${tokenFor('neo-1')}`);
    expect(res.status).toBe(200);
    expect(res.body.data.actividad[0].titulo).toBe('Contenido eliminado');
  });
});
