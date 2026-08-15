import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

vi.mock('../../src/db.js', () => ({ runQuery: vi.fn(), toNumber: (v) => Number(v ?? 0), default: {} }));
vi.mock('../../src/prisma.js', () => {
  const client = {
    usuario: { findUnique: vi.fn() },
    leccion: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
    modulo: { findUnique: vi.fn() },
    curso: { findUnique: vi.fn() },
    inscripcion: { findUnique: vi.fn() },
    intentoHtmlLeccion: { count: vi.fn(), create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    resultadoHtmlLeccion: { findUnique: vi.fn(), upsert: vi.fn() },
    progreso: { upsert: vi.fn() },
  };
  client.$transaction = vi.fn(async (callback) => callback(client));
  return { default: client };
});

describe('HTML lesson access and attempts', () => {
  const htmlLesson = {
    id: 'l-html', formatoContenido: 'HTML', recursoHtml: { id: 'rh-1', html: '<html><head></head><body>ok</body></html>', evaluable: true, intentosMax: 2 },
    modulo: { cursoId: 'c1', estado: 'PUBLICADO' },
  };

  function allowStudent() {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'u1', rol: 'ESTUDIANTE' });
    prisma.curso.findUnique.mockResolvedValue({ creadorId: 'other', publicado: true, profesores: [] });
    prisma.inscripcion.findUnique.mockResolvedValue({ id: 'i1' });
    prisma.leccion.findUnique.mockResolvedValue(htmlLesson);
  }

  it('returns authenticated HTML source without a public URL', async () => {
    allowStudent();
    const response = await request(app).get('/api/lessons/l-html/html').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ html: htmlLesson.recursoHtml.html, evaluable: true, intentosMax: 2 });
    expect(JSON.stringify(response.body)).not.toContain('url');
  });

  it('reserves an attempt transactionally and rejects exhausted limits', async () => {
    allowStudent();
    prisma.intentoHtmlLeccion.count.mockResolvedValue(1);
    prisma.intentoHtmlLeccion.create.mockImplementation(({ data }) => Promise.resolve({ ...data, id: 'a2' }));
    const started = await request(app).post('/api/lessons/l-html/html-attempts').set('Authorization', `Bearer ${token}`);
    expect(started.status).toBe(201);
    expect(started.body.data).toMatchObject({ numero: 2, remaining: 0 });
    expect(started.body.data.attemptToken).toMatch(/^[A-Za-z0-9_-]{32}$/);

    prisma.intentoHtmlLeccion.count.mockResolvedValue(2);
    const exhausted = await request(app).post('/api/lessons/l-html/html-attempts').set('Authorization', `Bearer ${token}`);
    expect(exhausted.status).toBe(409);
  });

  it('stores best practice score and returns an idempotent result', async () => {
    allowStudent();
    prisma.intentoHtmlLeccion.findUnique.mockResolvedValue({ id: 'a1', token: 'attempt-1', usuarioId: 'u1', recursoHtmlId: 'rh-1', puntaje: null });
    prisma.resultadoHtmlLeccion.findUnique.mockResolvedValue(null);
    prisma.intentoHtmlLeccion.update.mockResolvedValue({ id: 'a1', puntaje: 84 });
    prisma.progreso.upsert.mockResolvedValue({ id: 'p1', usuarioId: 'u1', leccionId: 'l-html', completada: true });
    prisma.resultadoHtmlLeccion.upsert.mockResolvedValue({ mejorPuntaje: 84 });
    const first = await request(app).post('/api/lessons/l-html/html-results')
      .set('Authorization', `Bearer ${token}`).send({ attemptToken: 'attempt-1', score: 84 });
    expect(first.status).toBe(200);
    expect(first.body.data).toEqual({
      score: 84, bestScore: 84, replayed: false, practice: true,
      progreso: { id: 'p1', usuarioId: 'u1', leccionId: 'l-html', completada: true },
    });
    expect(prisma.progreso.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { usuarioId_leccionId: { usuarioId: 'u1', leccionId: 'l-html' } },
      create: expect.objectContaining({ completada: true }),
    }));

    prisma.intentoHtmlLeccion.findUnique.mockResolvedValue({ id: 'a1', token: 'attempt-1', usuarioId: 'u1', recursoHtmlId: 'rh-1', puntaje: 84 });
    prisma.resultadoHtmlLeccion.findUnique.mockResolvedValue({ mejorPuntaje: 84 });
    const replay = await request(app).post('/api/lessons/l-html/html-results')
      .set('Authorization', `Bearer ${token}`).send({ attemptToken: 'attempt-1', score: 12 });
    expect(replay.status).toBe(200);
    expect(replay.body.data).toEqual({ score: 84, bestScore: 84, replayed: true, practice: true, progreso: null });
    expect(prisma.intentoHtmlLeccion.update).toHaveBeenCalledTimes(1);
    expect(prisma.progreso.upsert).toHaveBeenCalledTimes(1);
  });
});

import app from '../../src/app.js';
import prisma from '../../src/prisma.js';

const token = jwt.sign({ id: 'neo-1' }, process.env.JWT_SECRET, { expiresIn: '1h' });

beforeEach(() => vi.clearAllMocks());

describe('legacy lesson authoring mutations', () => {
  it('requires auth and blocks update/create outside /api/authoring', async () => {
    expect((await request(app).put('/api/lessons/l1').send({ titulo: 'x' })).status).toBe(401);
    prisma.usuario.findUnique.mockResolvedValue({ id: 'prof-1', rol: 'PROFESOR' });
    const update = await request(app).put('/api/lessons/l1')
      .set('Authorization', `Bearer ${token}`).send({ titulo: 'nuevo' });
    const create = await request(app).post('/api/modules/m1/lessons')
      .set('Authorization', `Bearer ${token}`).send({ titulo: 'x', contenido: 'y', orden: 1 });
    expect(update.status).toBe(410);
    expect(create.status).toBe(410);
    expect(update.body.message).toContain('/api/authoring');
    expect(prisma.leccion.update).not.toHaveBeenCalled();
    expect(prisma.leccion.create).not.toHaveBeenCalled();
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
      id: 'l1', materiales: [], modulo: { id: 'm1', titulo: 'M1', cursoId: 'c1', estado: 'PUBLICADO' },
    });
    prisma.curso.findUnique.mockResolvedValue({ creadorId: 'otro', publicado: true, profesores: [] });
    prisma.inscripcion.findUnique.mockResolvedValue(null);
    const res = await request(app).get('/api/lessons/l1').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('200 si está inscripto', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'u1', rol: 'ESTUDIANTE' });
    prisma.leccion.findUnique.mockResolvedValue({
      id: 'l1', materiales: [], modulo: { id: 'm1', titulo: 'M1', cursoId: 'c1', estado: 'PUBLICADO' },
    });
    prisma.curso.findUnique.mockResolvedValue({ creadorId: 'otro', publicado: true, profesores: [] });
    prisma.inscripcion.findUnique.mockResolvedValue({ id: 'i1' });
    const res = await request(app).get('/api/lessons/l1').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.leccion.id).toBe('l1');
  });

  it('200 si es el dueño del curso, sin necesitar inscripción', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'prof-1', rol: 'PROFESOR' });
    prisma.leccion.findUnique.mockResolvedValue({
      id: 'l1', materiales: [], modulo: { id: 'm1', titulo: 'M1', cursoId: 'c1', estado: 'PUBLICADO' },
    });
    prisma.curso.findUnique.mockResolvedValue({ creadorId: 'prof-1', publicado: false, profesores: [] });
    const res = await request(app).get('/api/lessons/l1').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('200 si es ADMIN', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'admin-1', rol: 'ADMIN' });
    prisma.leccion.findUnique.mockResolvedValue({
      id: 'l1', materiales: [], modulo: { id: 'm1', titulo: 'M1', cursoId: 'c1', estado: 'PUBLICADO' },
    });
    prisma.curso.findUnique.mockResolvedValue({ creadorId: 'otro', publicado: false, profesores: [] });
    const res = await request(app).get('/api/lessons/l1').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('404 para estudiante inscrito si el curso está en borrador', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'u1', rol: 'ESTUDIANTE' });
    prisma.leccion.findUnique.mockResolvedValue({
      id: 'l1', materiales: [], modulo: { id: 'm1', titulo: 'M1', cursoId: 'c1', estado: 'PUBLICADO' },
    });
    prisma.curso.findUnique.mockResolvedValue({ creadorId: 'otro', publicado: false, profesores: [] });
    prisma.inscripcion.findUnique.mockResolvedValue({ id: 'i1' });

    const res = await request(app).get('/api/lessons/l1').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('404 para estudiante inscrito si el módulo está en borrador, pero permite al dueño', async () => {
    const lesson = {
      id: 'l1', materiales: [], modulo: { id: 'm1', titulo: 'M1', cursoId: 'c1', estado: 'BORRADOR' },
    };
    prisma.leccion.findUnique.mockResolvedValue(lesson);
    prisma.curso.findUnique.mockResolvedValue({ creadorId: 'otro', publicado: true, profesores: [] });
    prisma.inscripcion.findUnique.mockResolvedValue({ id: 'i1' });
    const student = await request(app).get('/api/lessons/l1').set('Authorization', `Bearer ${token}`);
    expect(student.status).toBe(404);

    prisma.usuario.findUnique.mockResolvedValue({ id: 'prof-1', rol: 'PROFESOR' });
    prisma.curso.findUnique.mockResolvedValue({ creadorId: 'prof-1', publicado: false, profesores: [] });
    const owner = await request(app).get('/api/lessons/l1').set('Authorization', `Bearer ${token}`);
    expect(owner.status).toBe(200);
  });
});

describe('POST /api/lessons/:id/complete (inscripción)', () => {
  it('403 si no está inscripto ni es dueño', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'u1', rol: 'ESTUDIANTE' });
    prisma.leccion.findUnique.mockResolvedValue({ id: 'l1', modulo: { cursoId: 'c1', estado: 'PUBLICADO' } });
    prisma.curso.findUnique.mockResolvedValue({ creadorId: 'otro', publicado: true, profesores: [] });
    prisma.inscripcion.findUnique.mockResolvedValue(null);
    const res = await request(app)
      .post('/api/lessons/l1/complete')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
