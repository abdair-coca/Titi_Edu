import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

vi.mock('../../src/db.js', () => ({ runQuery: vi.fn(), toNumber: (v) => Number(v ?? 0), default: {} }));
vi.mock('../../src/prisma.js', () => ({
  default: {
    usuario: { findUnique: vi.fn() },
    leccion: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
    modulo: { findUnique: vi.fn() },
    curso: { findUnique: vi.fn() },
    inscripcion: { findUnique: vi.fn() },
  },
}));

import app from '../../src/app.js';
import prisma from '../../src/prisma.js';

const token = jwt.sign({ id: 'neo-1' }, process.env.JWT_SECRET, { expiresIn: '1h' });

beforeEach(() => vi.clearAllMocks());

describe('PUT /api/lessons/:id (propiedad)', () => {
  it('403 si el profesor no es dueño del curso', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'prof-ajeno', rol: 'PROFESOR' });
    prisma.leccion.findUnique.mockResolvedValue({
      id: 'l1',
      modulo: { curso: { creadorId: 'otro-profesor' } },
    });
    const res = await request(app)
      .put('/api/lessons/l1')
      .set('Authorization', `Bearer ${token}`)
      .send({ titulo: 'hack' });
    expect(res.status).toBe(403);
    expect(prisma.leccion.update).not.toHaveBeenCalled();
  });

  it('200 si el profesor es dueño del curso', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'prof-dueno', rol: 'PROFESOR' });
    prisma.leccion.findUnique.mockResolvedValue({
      id: 'l1',
      modulo: { curso: { creadorId: 'prof-dueno' } },
    });
    prisma.leccion.update.mockResolvedValue({ id: 'l1', titulo: 'nuevo' });
    const res = await request(app)
      .put('/api/lessons/l1')
      .set('Authorization', `Bearer ${token}`)
      .send({ titulo: 'nuevo' });
    expect(res.status).toBe(200);
  });

  it('200 si es ADMIN aunque no sea el dueño', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'admin-1', rol: 'ADMIN' });
    prisma.leccion.findUnique.mockResolvedValue({
      id: 'l1',
      modulo: { curso: { creadorId: 'otro-profesor' } },
    });
    prisma.leccion.update.mockResolvedValue({ id: 'l1', titulo: 'nuevo' });
    const res = await request(app)
      .put('/api/lessons/l1')
      .set('Authorization', `Bearer ${token}`)
      .send({ titulo: 'nuevo' });
    expect(res.status).toBe(200);
  });

  it('404 si la lección no existe', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'prof-1', rol: 'PROFESOR' });
    prisma.leccion.findUnique.mockResolvedValue(null);
    const res = await request(app)
      .put('/api/lessons/nope')
      .set('Authorization', `Bearer ${token}`)
      .send({ titulo: 'x' });
    expect(res.status).toBe(404);
  });

  it('401 sin token', async () => {
    const res = await request(app).put('/api/lessons/l1').send({ titulo: 'x' });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/modules/:moduleId/lessons (propiedad)', () => {
  it('403 si el profesor no es dueño del curso del módulo', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'prof-ajeno', rol: 'PROFESOR' });
    prisma.modulo.findUnique.mockResolvedValue({
      id: 'm1',
      curso: { creadorId: 'otro-profesor' },
    });
    const res = await request(app)
      .post('/api/modules/m1/lessons')
      .set('Authorization', `Bearer ${token}`)
      .send({ titulo: 'x', contenido: 'y', orden: 1 });
    expect(res.status).toBe(403);
    expect(prisma.leccion.create).not.toHaveBeenCalled();
  });

  it('201 si el profesor es dueño del curso del módulo', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'prof-dueno', rol: 'PROFESOR' });
    prisma.modulo.findUnique.mockResolvedValue({
      id: 'm1',
      curso: { creadorId: 'prof-dueno' },
    });
    prisma.leccion.create.mockResolvedValue({ id: 'l1', titulo: 'x' });
    const res = await request(app)
      .post('/api/modules/m1/lessons')
      .set('Authorization', `Bearer ${token}`)
      .send({ titulo: 'x', contenido: 'y', orden: 1 });
    expect(res.status).toBe(201);
  });

  it('201 si es ADMIN aunque no sea el dueño', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'admin-1', rol: 'ADMIN' });
    prisma.modulo.findUnique.mockResolvedValue({
      id: 'm1',
      curso: { creadorId: 'otro-profesor' },
    });
    prisma.leccion.create.mockResolvedValue({ id: 'l1', titulo: 'x' });
    const res = await request(app)
      .post('/api/modules/m1/lessons')
      .set('Authorization', `Bearer ${token}`)
      .send({ titulo: 'x', contenido: 'y', orden: 1 });
    expect(res.status).toBe(201);
  });

  it('404 si el módulo no existe', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'prof-1', rol: 'PROFESOR' });
    prisma.modulo.findUnique.mockResolvedValue(null);
    const res = await request(app)
      .post('/api/modules/nope/lessons')
      .set('Authorization', `Bearer ${token}`)
      .send({ titulo: 'x', contenido: 'y', orden: 1 });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/lessons/:id (login + inscripción)', () => {
  it('401 sin token', async () => {
    const res = await request(app).get('/api/lessons/l1');
    expect(res.status).toBe(401);
  });

  it('404 si la lección no existe', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'u1', rol: 'ESTUDIANTE' });
    prisma.leccion.findUnique.mockResolvedValue(null);
    const res = await request(app).get('/api/lessons/l1').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('403 si no está inscripto ni es dueño', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'u1', rol: 'ESTUDIANTE' });
    prisma.leccion.findUnique.mockResolvedValue({
      id: 'l1', materiales: [], modulo: { id: 'm1', titulo: 'M1', cursoId: 'c1' },
    });
    prisma.curso.findUnique.mockResolvedValue({ creadorId: 'otro', profesores: [] });
    prisma.inscripcion.findUnique.mockResolvedValue(null);
    const res = await request(app).get('/api/lessons/l1').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('200 si está inscripto', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'u1', rol: 'ESTUDIANTE' });
    prisma.leccion.findUnique.mockResolvedValue({
      id: 'l1', materiales: [], modulo: { id: 'm1', titulo: 'M1', cursoId: 'c1' },
    });
    prisma.curso.findUnique.mockResolvedValue({ creadorId: 'otro', profesores: [] });
    prisma.inscripcion.findUnique.mockResolvedValue({ id: 'i1' });
    const res = await request(app).get('/api/lessons/l1').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.leccion.id).toBe('l1');
  });

  it('200 si es el dueño del curso, sin necesitar inscripción', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'prof-1', rol: 'PROFESOR' });
    prisma.leccion.findUnique.mockResolvedValue({
      id: 'l1', materiales: [], modulo: { id: 'm1', titulo: 'M1', cursoId: 'c1' },
    });
    prisma.curso.findUnique.mockResolvedValue({ creadorId: 'prof-1', profesores: [] });
    const res = await request(app).get('/api/lessons/l1').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('200 si es ADMIN', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'admin-1', rol: 'ADMIN' });
    prisma.leccion.findUnique.mockResolvedValue({
      id: 'l1', materiales: [], modulo: { id: 'm1', titulo: 'M1', cursoId: 'c1' },
    });
    const res = await request(app).get('/api/lessons/l1').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

describe('POST /api/lessons/:id/complete (inscripción)', () => {
  it('403 si no está inscripto ni es dueño', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'u1', rol: 'ESTUDIANTE' });
    prisma.leccion.findUnique.mockResolvedValue({ id: 'l1', modulo: { cursoId: 'c1' } });
    prisma.curso.findUnique.mockResolvedValue({ creadorId: 'otro', profesores: [] });
    prisma.inscripcion.findUnique.mockResolvedValue(null);
    const res = await request(app)
      .post('/api/lessons/l1/complete')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
