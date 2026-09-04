import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

vi.mock('../../src/db.js', () => ({ runQuery: vi.fn(), toNumber: (v) => Number(v ?? 0), default: {} }));
vi.mock('../../src/services/progress.service.js', () => ({ actualizarRacha: vi.fn(), checkCursoCompletado: vi.fn() }));
vi.mock('../../src/services/achievement.service.js', () => ({ checkLogrosLeccion: vi.fn() }));
vi.mock('../../src/services/gotas.service.js', () => ({ otorgarGotas: vi.fn() }));
vi.mock('../../src/services/mision.service.js', () => ({ avanzarMisiones: vi.fn() }));
vi.mock('../../src/prisma.js', () => {
  const client = {
    usuario: { findUnique: vi.fn(), findMany: vi.fn() },
    leccion: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
    modulo: { findUnique: vi.fn() },
    curso: { findUnique: vi.fn() },
    inscripcion: { findUnique: vi.fn() },
    intentoHtmlLeccion: { count: vi.fn(), create: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    resultadoHtmlLeccion: { findUnique: vi.fn(), upsert: vi.fn() },
    progreso: { findUnique: vi.fn(), upsert: vi.fn() },
    comentarioLeccion: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
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
    prisma.intentoHtmlLeccion.count.mockResolvedValue(0);
  }

  it('returns authenticated HTML source without a public URL', async () => {
    allowStudent();
    const response = await request(app).get('/api/lessons/l-html/html').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      html: htmlLesson.recursoHtml.html,
      evaluable: true,
      intentosMax: 2,
      bestScore: null,
      remainingAttempts: 2,
      attemptsExhausted: false,
    });
    expect(response.body.data.attemptToken).toEqual(expect.any(String));
    expect(JSON.stringify(response.body)).not.toContain('url');

    prisma.resultadoHtmlLeccion.findUnique.mockResolvedValue({ mejorPuntaje: 73 });
    const scored = await request(app).get('/api/lessons/l-html/html').set('Authorization', `Bearer ${token}`);
    expect(scored.status).toBe(200);
    expect(scored.body.data.bestScore).toBe(73);
  });

  it('issues a temporary token without consuming an attempt and rejects exhausted limits', async () => {
    allowStudent();
    prisma.intentoHtmlLeccion.count.mockResolvedValue(1);
    const started = await request(app).post('/api/lessons/l-html/html-attempts').set('Authorization', `Bearer ${token}`);
    expect(started.status).toBe(200);
    expect(started.body.data).toMatchObject({ remaining: 1 });
    expect(started.body.data.attemptToken).toEqual(expect.any(String));
    expect(prisma.intentoHtmlLeccion.create).not.toHaveBeenCalled();
    expect(prisma.intentoHtmlLeccion.count).toHaveBeenCalledWith({
      where: { usuarioId: 'u1', recursoHtmlId: 'rh-1', puntaje: { not: null } },
    });

    prisma.intentoHtmlLeccion.count.mockResolvedValue(2);
    const exhausted = await request(app).post('/api/lessons/l-html/html-attempts').set('Authorization', `Bearer ${token}`);
    expect(exhausted.status).toBe(409);
  });

  it('creates the persisted attempt only when a temporary token submits a score', async () => {
    allowStudent();
    prisma.intentoHtmlLeccion.count.mockResolvedValue(1);
    const started = await request(app).post('/api/lessons/l-html/html-attempts').set('Authorization', `Bearer ${token}`);
    const attemptToken = started.body.data.attemptToken;
    prisma.intentoHtmlLeccion.findUnique.mockResolvedValue(null);
    prisma.intentoHtmlLeccion.findFirst.mockResolvedValue({ numero: 4 });
    prisma.intentoHtmlLeccion.create.mockImplementation(({ data }) => Promise.resolve({ ...data, id: 'a5', puntaje: null }));
    prisma.intentoHtmlLeccion.update.mockResolvedValue({ id: 'a5', puntaje: 77 });
    prisma.resultadoHtmlLeccion.findUnique.mockResolvedValue(null);
    prisma.progreso.upsert.mockResolvedValue({ id: 'p1', completada: true });
    prisma.resultadoHtmlLeccion.upsert.mockResolvedValue({ mejorPuntaje: 77 });

    const response = await request(app).post('/api/lessons/l-html/html-results')
      .set('Authorization', `Bearer ${token}`).send({ attemptToken, score: 77 });

    expect(response.status).toBe(200);
    expect(prisma.intentoHtmlLeccion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ token: attemptToken, numero: 5, usuarioId: 'u1', recursoHtmlId: 'rh-1' }),
    });
    expect(response.body.data.remaining).toBe(0);
  });

  it('stores best practice score and returns an idempotent result', async () => {
    allowStudent();
    checkCursoCompletado.mockResolvedValueOnce({
      completado: true,
      nuevo: true,
      certificado: { id: 'cert-1', codigoVerif: 'ABC123' },
    });
    prisma.intentoHtmlLeccion.findUnique.mockResolvedValue({ id: 'a1', token: 'attempt-1', usuarioId: 'u1', recursoHtmlId: 'rh-1', puntaje: null });
    prisma.resultadoHtmlLeccion.findUnique.mockResolvedValue(null);
    prisma.intentoHtmlLeccion.update.mockResolvedValue({ id: 'a1', puntaje: 84 });
    prisma.progreso.upsert.mockResolvedValue({ id: 'p1', usuarioId: 'u1', leccionId: 'l-html', completada: true });
    prisma.resultadoHtmlLeccion.upsert.mockResolvedValue({ mejorPuntaje: 84 });
    const first = await request(app).post('/api/lessons/l-html/html-results')
      .set('Authorization', `Bearer ${token}`).send({ attemptToken: 'attempt-1', score: 84 });
    expect(first.status).toBe(200);
    expect(first.body.data).toEqual({
      score: 84, bestScore: 84, remaining: 1, replayed: false, practice: true,
      progreso: { id: 'p1', usuarioId: 'u1', leccionId: 'l-html', completada: true },
      cursoCompletado: { nuevo: true, certificado: { id: 'cert-1', codigoVerif: 'ABC123' } },
    });
    expect(prisma.progreso.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { usuarioId_leccionId: { usuarioId: 'u1', leccionId: 'l-html' } },
      create: expect.objectContaining({ completada: true }),
    }));
    expect(checkCursoCompletado).toHaveBeenCalledWith('u1', 'c1');

    prisma.intentoHtmlLeccion.findUnique.mockResolvedValue({ id: 'a1', token: 'attempt-1', usuarioId: 'u1', recursoHtmlId: 'rh-1', puntaje: 84 });
    prisma.resultadoHtmlLeccion.findUnique.mockResolvedValue({ mejorPuntaje: 84 });
    prisma.intentoHtmlLeccion.count.mockResolvedValue(1);
    const replay = await request(app).post('/api/lessons/l-html/html-results')
      .set('Authorization', `Bearer ${token}`).send({ attemptToken: 'attempt-1', score: 12 });
    expect(replay.status).toBe(200);
    expect(replay.body.data).toEqual({
      score: 84,
      bestScore: 84,
      remaining: 1,
      replayed: true,
      practice: true,
      progreso: null,
      cursoCompletado: null,
    });
    expect(prisma.intentoHtmlLeccion.update).toHaveBeenCalledTimes(1);
    expect(prisma.progreso.upsert).toHaveBeenCalledTimes(1);
    expect(checkCursoCompletado).toHaveBeenCalledTimes(1);
  });

  it('rejects expired HTML submissions before any write', async () => {
    allowStudent();
    const expiredLesson = {
      ...htmlLesson,
      recursoHtml: { ...htmlLesson.recursoHtml, fechaLimite: new Date(Date.now() - 1) },
    };
    prisma.leccion.findUnique.mockResolvedValue(expiredLesson);

    const readable = await request(app).get('/api/lessons/l-html/html').set('Authorization', `Bearer ${token}`);
    expect(readable.status).toBe(200);
    expect(readable.body.data).toMatchObject({ html: htmlLesson.recursoHtml.html, fechaLimiteExpirada: true, attemptToken: null });

    const started = await request(app).post('/api/lessons/l-html/html-attempts').set('Authorization', `Bearer ${token}`);
    expect(started.status).toBe(409);

    const response = await request(app).post('/api/lessons/l-html/html-results')
      .set('Authorization', `Bearer ${token}`).send({ attemptToken: 'expired-token', score: 80 });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ success: false, message: 'El plazo para entregar esta actividad ya venció' });
    expect(prisma.intentoHtmlLeccion.create).not.toHaveBeenCalled();
    expect(prisma.intentoHtmlLeccion.update).not.toHaveBeenCalled();
    expect(prisma.resultadoHtmlLeccion.upsert).not.toHaveBeenCalled();
    expect(prisma.progreso.upsert).not.toHaveBeenCalled();
  });
});

import app from '../../src/app.js';
import prisma from '../../src/prisma.js';
import { actualizarRacha, checkCursoCompletado } from '../../src/services/progress.service.js';
import { checkLogrosLeccion } from '../../src/services/achievement.service.js';
import { otorgarGotas } from '../../src/services/gotas.service.js';
import { avanzarMisiones } from '../../src/services/mision.service.js';
import { runQuery } from '../../src/db.js';

const token = jwt.sign({ id: 'neo-1' }, process.env.JWT_SECRET, { expiresIn: '1h' });

beforeEach(() => {
  vi.clearAllMocks();
  checkCursoCompletado.mockResolvedValue({ completado: false, logros: [] });
});

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

  it('rechaza completar manualmente una actividad HTML evaluable', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'u1', rol: 'ESTUDIANTE' });
    prisma.leccion.findUnique.mockResolvedValue({
      id: 'l-html',
      recursoHtml: { evaluable: true },
      modulo: { cursoId: 'c1', estado: 'PUBLICADO' },
    });
    prisma.curso.findUnique.mockResolvedValue({ creadorId: 'other', publicado: true, profesores: [] });
    prisma.inscripcion.findUnique.mockResolvedValue({ id: 'i1' });

    const res = await request(app).post('/api/lessons/l-html/complete').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('HTML evaluables');
    expect(prisma.progreso.upsert).not.toHaveBeenCalled();
  });

  it('mantiene el completado manual para una lección normal', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'u1', rol: 'ESTUDIANTE', racha: 0, ultimaActividad: null });
    prisma.leccion.findUnique.mockResolvedValue({
      id: 'l-normal',
      recursoHtml: null,
      modulo: { cursoId: 'c1', estado: 'PUBLICADO' },
    });
    prisma.curso.findUnique.mockResolvedValue({ creadorId: 'other', publicado: true, profesores: [] });
    prisma.inscripcion.findUnique.mockResolvedValue({ id: 'i1' });
    prisma.progreso.findUnique.mockResolvedValue(null);
    prisma.progreso.upsert.mockResolvedValue({ id: 'p1', completada: true });
    actualizarRacha.mockResolvedValue({ racha: 1, subio: true, rota: false });
    checkLogrosLeccion.mockResolvedValue([]);
    otorgarGotas.mockResolvedValue({ otorgadas: 0 });
    avanzarMisiones.mockResolvedValue(undefined);

    const res = await request(app).post('/api/lessons/l-normal/complete').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(prisma.progreso.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { usuarioId_leccionId: { usuarioId: 'u1', leccionId: 'l-normal' } },
    }));
  });
});

describe('Lesson comments and replies', () => {
  const lessonData = {
    id: 'l-comm',
    titulo: 'Introducción a Grafos',
    estado: 'PUBLICADA',
    modulo: { cursoId: 'c1', estado: 'PUBLICADO', curso: { id: 'c1', titulo: 'Bases de Datos' } },
  };

  function allowStudent() {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'u1', username: 'estudiante1', rol: 'ESTUDIANTE' });
    prisma.curso.findUnique.mockResolvedValue({ creadorId: 'prof1', publicado: true, profesores: [] });
    prisma.inscripcion.findUnique.mockResolvedValue({ id: 'i1' });
    prisma.leccion.findUnique.mockResolvedValue(lessonData);
  }

  it('GET /api/lessons/:id/comments devuelve comentarios ordenados con parentId y replyToUsername', async () => {
    allowStudent();
    prisma.comentarioLeccion.findMany.mockResolvedValue([
      { id: 'c1', texto: 'Comentario raíz', usuarioId: 'u1', leccionId: 'l-comm', parentId: null, createdAt: new Date() },
      { id: 'c2', texto: 'Respuesta al raíz', usuarioId: 'u2', leccionId: 'l-comm', parentId: 'c1', createdAt: new Date() },
    ]);
    prisma.usuario.findMany.mockResolvedValue([
      { id: 'u1', username: 'estudiante1' },
      { id: 'u2', username: 'profesor1' },
    ]);

    const res = await request(app).get('/api/lessons/l-comm/comments').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.comentarios).toHaveLength(2);
    expect(res.body.data.comentarios[0].replyToUsername).toBeNull();
    expect(res.body.data.comentarios[1].replyToUsername).toBe('estudiante1');
  });

  it('POST /api/lessons/:id/comments crea comentario raíz', async () => {
    allowStudent();
    prisma.comentarioLeccion.create.mockResolvedValue({
      id: 'c-new',
      texto: 'Nueva duda',
      usuarioId: 'u1',
      leccionId: 'l-comm',
      parentId: null,
      createdAt: new Date(),
    });

    const res = await request(app)
      .post('/api/lessons/l-comm/comments')
      .set('Authorization', `Bearer ${token}`)
      .send({ texto: 'Nueva duda' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.comentario.texto).toBe('Nueva duda');
    expect(res.body.data.comentario.parentId).toBeNull();
  });

  it('POST /api/lessons/:id/comments crea respuesta y dispara notificación a autor padre', async () => {
    allowStudent();
    // El comentario padre pertenece a u2 (otro usuario)
    prisma.comentarioLeccion.findUnique.mockResolvedValue({
      id: 'c1',
      leccionId: 'l-comm',
      usuarioId: 'u2',
      parentId: null,
    });
    prisma.comentarioLeccion.create.mockResolvedValue({
      id: 'c-reply',
      texto: 'Esta es mi respuesta',
      usuarioId: 'u1',
      leccionId: 'l-comm',
      parentId: 'c1',
      createdAt: new Date(),
    });
    // u2 tiene neoId
    prisma.usuario.findUnique.mockImplementation(async ({ where }) => {
      if (where.id === 'u2') return { id: 'u2', neoId: 'neo-u2' };
      return { id: 'u1', username: 'estudiante1', rol: 'ESTUDIANTE' };
    });

    const res = await request(app)
      .post('/api/lessons/l-comm/comments')
      .set('Authorization', `Bearer ${token}`)
      .send({ texto: 'Esta es mi respuesta', parentId: 'c1' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.comentario.parentId).toBe('c1');
    expect(runQuery).toHaveBeenCalledWith(
      expect.stringContaining("type: 'lesson_comment_reply'"),
      expect.objectContaining({
        targetNeoId: 'neo-u2',
        cursoId: 'c1',
        leccionId: 'l-comm',
      })
    );
  });

  it('POST /api/lessons/:id/comments rechaza parentId de otra lección', async () => {
    allowStudent();
    prisma.comentarioLeccion.findUnique.mockResolvedValue({
      id: 'c-other',
      leccionId: 'different-lesson',
      usuarioId: 'u2',
      parentId: null,
    });

    const res = await request(app)
      .post('/api/lessons/l-comm/comments')
      .set('Authorization', `Bearer ${token}`)
      .send({ texto: 'Respuesta inválida', parentId: 'c-other' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Comentario padre inválido');
  });
});
