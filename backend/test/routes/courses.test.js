import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

vi.mock('../../src/db.js', () => ({ runQuery: vi.fn(), toNumber: (v) => Number(v ?? 0), default: {} }));
vi.mock('../../src/prisma.js', () => ({
  default: {
    curso: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    modulo: { findMany: vi.fn(), findUnique: vi.fn() },
    usuario: { findUnique: vi.fn() },
    evaluacion: { findFirst: vi.fn() },
    inscripcion: { findUnique: vi.fn() },
    progreso: { findMany: vi.fn() },
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
    expect(prisma.curso.findMany.mock.calls[0][0].include._count.select.modulos.where).toEqual({ estado: 'PUBLICADO' });
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
    expect(prisma.curso.findUnique.mock.calls[0][0].include.modulos.where).toEqual({ estado: 'PUBLICADO' });
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

describe('GET /api/courses/:id/modules', () => {
  it('filters by published course and published modules', async () => {
    prisma.modulo.findMany.mockResolvedValue([]);
    const res = await request(app).get('/api/courses/c1/modules');
    expect(res.status).toBe(200);
    expect(prisma.modulo.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { cursoId: 'c1', estado: 'PUBLICADO', curso: { publicado: true } },
    }));
  });
});

describe('GET /api/modules/:id/lessons visibility', () => {
  it('exige curso y modulo publicados al estudiante', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'u1', rol: 'ESTUDIANTE' });
    prisma.modulo.findUnique.mockResolvedValue({
      id: 'm1', cursoId: 'c1', estado: 'BORRADOR', lecciones: [{ id: 'l1' }],
    });
    prisma.curso.findUnique.mockResolvedValue({ creadorId: 'otro', publicado: true, profesores: [] });
    prisma.inscripcion.findUnique.mockResolvedValue({ id: 'i1' });

    const draftModule = await request(app).get('/api/modules/m1/lessons')
      .set('Authorization', `Bearer ${token}`);
    expect(draftModule.status).toBe(404);

    prisma.modulo.findUnique.mockResolvedValue({
      id: 'm1', cursoId: 'c1', estado: 'PUBLICADO', lecciones: [{ id: 'l1' }],
    });
    prisma.curso.findUnique.mockResolvedValue({ creadorId: 'otro', publicado: false, profesores: [] });
    const draftCourse = await request(app).get('/api/modules/m1/lessons')
      .set('Authorization', `Bearer ${token}`);
    expect(draftCourse.status).toBe(404);
  });

  it('permite al dueño previsualizar un modulo borrador', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'u1', rol: 'PROFESOR' });
    prisma.modulo.findUnique.mockResolvedValue({
      id: 'm1', cursoId: 'c1', estado: 'BORRADOR', lecciones: [{ id: 'l1' }],
    });
    prisma.curso.findUnique.mockResolvedValue({ creadorId: 'u1', publicado: false, profesores: [] });

    const response = await request(app).get('/api/modules/m1/lessons')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
  });
});

describe('GET /api/courses/:id/progress visibility', () => {
  const course = {
    id: 'c1', creadorId: 'otro', publicado: true, profesores: [],
    modulos: [{ id: 'm1', titulo: 'M1', orden: 1, lecciones: [{ id: 'l1', titulo: 'L1', orden: 1 }] }],
  };

  it('404 para estudiante inscrito si el curso no esta publicado', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'u1', rol: 'ESTUDIANTE' });
    prisma.curso.findUnique.mockResolvedValue({ ...course, publicado: false });
    prisma.inscripcion.findUnique.mockResolvedValue({ id: 'i1' });

    const response = await request(app).get('/api/courses/c1/progress')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(prisma.progreso.findMany).not.toHaveBeenCalled();
  });

  it('200 para estudiante inscrito en curso publicado y dueño en borrador', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'u1', rol: 'ESTUDIANTE' });
    prisma.curso.findUnique.mockResolvedValue(course);
    prisma.inscripcion.findUnique.mockResolvedValue({ id: 'i1' });
    prisma.progreso.findMany.mockResolvedValue([]);
    const student = await request(app).get('/api/courses/c1/progress')
      .set('Authorization', `Bearer ${token}`);
    expect(student.status).toBe(200);

    prisma.usuario.findUnique.mockResolvedValue({ id: 'u1', rol: 'PROFESOR' });
    prisma.curso.findUnique.mockResolvedValue({ ...course, creadorId: 'u1', publicado: false });
    const owner = await request(app).get('/api/courses/c1/progress')
      .set('Authorization', `Bearer ${token}`);
    expect(owner.status).toBe(200);
  });
});

describe('legacy course authoring mutations', () => {
  it('requires auth and directs authenticated callers to /api/authoring', async () => {
    expect((await request(app).post('/api/courses').send({})).status).toBe(401);
    prisma.usuario.findUnique.mockResolvedValue({ id: 'u1', rol: 'PROFESOR', verificado: true });
    const res = await request(app).post('/api/courses')
      .set('Authorization', `Bearer ${token}`)
      .send({ titulo: 'Nuevo', descripcion: 'desc', nivel: 'basico', categoriaId: 'cat1' });
    expect(res.status).toBe(410);
    expect(res.body).toMatchObject({ success: false });
    expect(res.body.message).toContain('/api/authoring');
    expect(prisma.curso.create).not.toHaveBeenCalled();
  });
});
