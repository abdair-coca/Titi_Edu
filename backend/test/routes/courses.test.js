import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

vi.mock('../../src/db.js', () => ({ runQuery: vi.fn(), toNumber: (v) => Number(v ?? 0), default: {} }));
vi.mock('../../src/prisma.js', () => ({
  default: {
    curso: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    usuario: { findUnique: vi.fn() },
    evaluacion: { findFirst: vi.fn() },
    inscripcion: { findUnique: vi.fn() },
  },
}));
vi.mock('../../src/services/neo4j-sync.service.js', () => ({ syncInscripcion: vi.fn() }));

import app from '../../src/app.js';
import prisma from '../../src/prisma.js';

const token = jwt.sign({ id: 'neo-1' }, process.env.JWT_SECRET, { expiresIn: '1h' });

beforeEach(() => vi.clearAllMocks());

describe('GET /api/courses', () => {
  it('200 lista el catálogo público (con filtros)', async () => {
    prisma.curso.findMany.mockResolvedValue([{ id: 'c1', titulo: 'Curso' }]);
    const res = await request(app).get('/api/courses?categoria=cat1&nivel=basico&search=js');
    expect(res.status).toBe(200);
    expect(res.body.data.cursos).toHaveLength(1);
    // El filtro de búsqueda arma un OR sobre titulo/descripcion
    expect(prisma.curso.findMany.mock.calls[0][0].where.OR).toBeTruthy();
  });
});

describe('GET /api/courses/:id', () => {
  it('404 si el curso no existe', async () => {
    prisma.curso.findUnique.mockResolvedValue(null);
    const res = await request(app).get('/api/courses/nope');
    expect(res.status).toBe(404);
  });

  it('200 con el curso y su evaluación final', async () => {
    prisma.curso.findUnique.mockResolvedValue({
      id: 'c1', titulo: 'Curso', publicado: true, creadorId: 'creador-1', profesores: [], modulos: [],
    });
    prisma.evaluacion.findFirst.mockResolvedValue(null);
    const res = await request(app).get('/api/courses/c1');
    expect(res.status).toBe(200);
    expect(res.body.data.curso.id).toBe('c1');
  });

  it('404 en un borrador para un guest (no filtra existencia)', async () => {
    prisma.curso.findUnique.mockResolvedValue({
      id: 'c1', titulo: 'Curso', publicado: false, creadorId: 'creador-1', profesores: [], modulos: [],
    });
    const res = await request(app).get('/api/courses/c1');
    expect(res.status).toBe(404);
  });

  it('200 pero sin videoUrl en el temario para un guest', async () => {
    prisma.curso.findUnique.mockResolvedValue({
      id: 'c1', titulo: 'Curso', publicado: true, creadorId: 'creador-1', profesores: [],
      modulos: [{ id: 'm1', lecciones: [{ id: 'l1', titulo: 'L1', orden: 1, videoUrl: 'http://video' }] }],
    });
    prisma.evaluacion.findFirst.mockResolvedValue(null);
    const res = await request(app).get('/api/courses/c1');
    expect(res.status).toBe(200);
    expect(res.body.data.curso.modulos[0].lecciones[0].videoUrl).toBeUndefined();
    expect(res.body.data.viewer).toEqual({ enrolled: false, isOwner: false });
  });

  it('200 con videoUrl para el autor, incluso en borrador', async () => {
    prisma.curso.findUnique.mockResolvedValue({
      id: 'c1', titulo: 'Curso', publicado: false, creadorId: 'u1', profesores: [],
      modulos: [{ id: 'm1', lecciones: [{ id: 'l1', titulo: 'L1', orden: 1, videoUrl: 'http://video' }] }],
    });
    prisma.usuario.findUnique.mockResolvedValue({ id: 'u1', rol: 'PROFESOR' });
    prisma.evaluacion.findFirst.mockResolvedValue(null);
    const res = await request(app).get('/api/courses/c1').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.curso.modulos[0].lecciones[0].videoUrl).toBe('http://video');
    expect(res.body.data.viewer).toEqual({ enrolled: false, isOwner: true });
  });
});

describe('POST /api/courses (guard de rol)', () => {
  it('401 sin token', async () => {
    const res = await request(app).post('/api/courses').send({});
    expect(res.status).toBe(401);
  });

  it('403 si no es PROFESOR', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'u1', rol: 'ESTUDIANTE', verificado: false });
    const res = await request(app).post('/api/courses')
      .set('Authorization', `Bearer ${token}`)
      .send({ titulo: 'x', descripcion: 'y', nivel: 'basico', categoriaId: 'c' });
    expect(res.status).toBe(403);
  });

  it('403 si es PROFESOR no verificado', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'u1', rol: 'PROFESOR', verificado: false });
    const res = await request(app).post('/api/courses')
      .set('Authorization', `Bearer ${token}`)
      .send({ titulo: 'x', descripcion: 'y', nivel: 'basico', categoriaId: 'c' });
    expect(res.status).toBe(403);
  });

  it('400 si faltan campos (PROFESOR verificado)', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'u1', rol: 'PROFESOR', verificado: true });
    const res = await request(app).post('/api/courses')
      .set('Authorization', `Bearer ${token}`)
      .send({ titulo: 'solo titulo' });
    expect(res.status).toBe(400);
  });

  it('201 al crear con datos válidos', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'u1', rol: 'PROFESOR', verificado: true });
    prisma.curso.create.mockResolvedValue({ id: 'c1', titulo: 'Nuevo' });
    const res = await request(app).post('/api/courses')
      .set('Authorization', `Bearer ${token}`)
      .send({ titulo: 'Nuevo', descripcion: 'desc', nivel: 'basico', categoriaId: 'cat1' });
    expect(res.status).toBe(201);
    expect(res.body.data.curso.id).toBe('c1');
  });
});
