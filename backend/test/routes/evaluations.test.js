import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

vi.mock('../../src/db.js', () => ({ runQuery: vi.fn(), toNumber: (v) => Number(v ?? 0), default: {} }));
vi.mock('../../src/prisma.js', () => ({
  default: {
    usuario: { findUnique: vi.fn() },
    evaluacion: { findUnique: vi.fn(), findFirst: vi.fn() },
    modulo: { findUnique: vi.fn() },
    curso: { findUnique: vi.fn() },
    inscripcion: { findUnique: vi.fn() },
    intento: { findMany: vi.fn(), create: vi.fn() },
  },
}));
vi.mock('../../src/services/progress.service.js', () => ({
  actualizarRacha: vi.fn().mockResolvedValue({ racha: 1, subio: true }),
  checkCursoCompletado: vi.fn().mockResolvedValue({ completado: false }),
}));
vi.mock('../../src/services/achievement.service.js', () => ({
  checkLogrosEvaluacion: vi.fn().mockResolvedValue([]),
}));

import app from '../../src/app.js';
import prisma from '../../src/prisma.js';

const token = jwt.sign({ id: 'neo-1' }, process.env.JWT_SECRET, { expiresIn: '1h' });

// Evaluación de 1 pregunta OPCION_MULTIPLE; la opción op-ok es la correcta.
const evalConUnaPregunta = {
  id: 'ev1',
  intentosMax: 3,
  notaMinima: 70,
  modulo: { id: 'm1', cursoId: 'c1', estado: 'PUBLICADO' },
  cursoId: null,
  preguntas: [
    { id: 'q1', tipo: 'OPCION_MULTIPLE', opciones: [
      { id: 'op-ok', esCorrecta: true, texto: 'Sí' },
      { id: 'op-no', esCorrecta: false, texto: 'No' },
    ] },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  prisma.usuario.findUnique.mockResolvedValue({ id: 'u1', rol: 'ESTUDIANTE' });
});

describe('POST /api/evaluations/:id/attempt', () => {
  it('401 sin token', async () => {
    const res = await request(app).post('/api/evaluations/ev1/attempt').send({ respuestas: [] });
    expect(res.status).toBe(401);
  });

  it('404 si la evaluación no existe', async () => {
    prisma.evaluacion.findUnique.mockResolvedValue(null);
    const res = await request(app).post('/api/evaluations/ev1/attempt')
      .set('Authorization', `Bearer ${token}`).send({ respuestas: [] });
    expect(res.status).toBe(404);
  });

  it('403 si el usuario no está inscrito', async () => {
    prisma.evaluacion.findUnique.mockResolvedValue(evalConUnaPregunta);
    prisma.curso.findUnique.mockResolvedValue({ id: 'c1', titulo: 'Curso', creadorId: 'otro', publicado: true, profesores: [] });
    prisma.inscripcion.findUnique.mockResolvedValue(null);
    const res = await request(app).post('/api/evaluations/ev1/attempt')
      .set('Authorization', `Bearer ${token}`).send({ respuestas: [] });
    expect(res.status).toBe(403);
  });

  it('201 califica server-side y aprueba con respuesta correcta', async () => {
    prisma.evaluacion.findUnique.mockResolvedValue(evalConUnaPregunta);
    prisma.curso.findUnique.mockResolvedValue({ id: 'c1', titulo: 'Curso', creadorId: 'otro', publicado: true, profesores: [] });
    prisma.inscripcion.findUnique.mockResolvedValue({ id: 'i1' });
    prisma.intento.findMany.mockResolvedValue([]);
    prisma.intento.create.mockResolvedValue({ id: 'at1', numero: 1, nota: 100, aprobado: true });

    const res = await request(app).post('/api/evaluations/ev1/attempt')
      .set('Authorization', `Bearer ${token}`)
      .send({ respuestas: [{ preguntaId: 'q1', opcionId: 'op-ok' }] });

    expect(res.status).toBe(201);
    expect(res.body.data.intento.nota).toBe(100);
    expect(res.body.data.intento.aprobado).toBe(true);
    expect(res.body.data.correctas).toBe(1);
  });

  it('409 si ya aprobó la evaluación', async () => {
    prisma.evaluacion.findUnique.mockResolvedValue(evalConUnaPregunta);
    prisma.curso.findUnique.mockResolvedValue({ id: 'c1', titulo: 'Curso', creadorId: 'otro', publicado: true, profesores: [] });
    prisma.inscripcion.findUnique.mockResolvedValue({ id: 'i1' });
    prisma.intento.findMany.mockResolvedValue([{ id: 'prev', aprobado: true }]);
    const res = await request(app).post('/api/evaluations/ev1/attempt')
      .set('Authorization', `Bearer ${token}`)
      .send({ respuestas: [{ preguntaId: 'q1', opcionId: 'op-ok' }] });
    expect(res.status).toBe(409);
  });
  it('404 y no crea intento cuando el curso o modulo estan en borrador', async () => {
    prisma.evaluacion.findUnique.mockResolvedValue({
      ...evalConUnaPregunta,
      modulo: { ...evalConUnaPregunta.modulo, estado: 'BORRADOR' },
    });
    prisma.curso.findUnique.mockResolvedValue({
      id: 'c1', titulo: 'Curso', creadorId: 'otro', publicado: true, profesores: [],
    });
    prisma.inscripcion.findUnique.mockResolvedValue({ id: 'i1' });

    const moduleDraft = await request(app).post('/api/evaluations/ev1/attempt')
      .set('Authorization', `Bearer ${token}`).send({ respuestas: [] });
    expect(moduleDraft.status).toBe(404);

    prisma.evaluacion.findUnique.mockResolvedValue(evalConUnaPregunta);
    prisma.curso.findUnique.mockResolvedValue({
      id: 'c1', titulo: 'Curso', creadorId: 'otro', publicado: false, profesores: [],
    });
    const courseDraft = await request(app).post('/api/evaluations/ev1/attempt')
      .set('Authorization', `Bearer ${token}`).send({ respuestas: [] });
    expect(courseDraft.status).toBe(404);
    expect(prisma.intento.create).not.toHaveBeenCalled();
  });
});

// Una pregunta con opciones (incluye esCorrecta) — sirve para chequear el recorte de publicEvaluacion.
const evaluacionConOpciones = {
  id: 'ev1',
  preguntas: [{
    id: 'q1', tipo: 'OPCION_MULTIPLE',
    opciones: [{ id: 'o1', esCorrecta: true, texto: 'Sí' }],
  }],
};

describe('GET /api/modules/:id/evaluation', () => {
  it('401 sin token', async () => {
    const res = await request(app).get('/api/modules/m1/evaluation');
    expect(res.status).toBe(401);
  });

  it('403 si no está inscripto ni es el autor', async () => {
    prisma.modulo.findUnique.mockResolvedValue({ id: 'm1', cursoId: 'c1', estado: 'PUBLICADO', evaluacion: evaluacionConOpciones });
    prisma.curso.findUnique.mockResolvedValue({ id: 'c1', creadorId: 'otro', publicado: true, profesores: [] });
    prisma.inscripcion.findUnique.mockResolvedValue(null);
    const res = await request(app).get('/api/modules/m1/evaluation')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('200 con versión completa para el autor del curso', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'u1', rol: 'PROFESOR' });
    prisma.modulo.findUnique.mockResolvedValue({ id: 'm1', cursoId: 'c1', estado: 'PUBLICADO', evaluacion: evaluacionConOpciones });
    prisma.curso.findUnique.mockResolvedValue({ id: 'c1', creadorId: 'u1', publicado: false, profesores: [] });
    const res = await request(app).get('/api/modules/m1/evaluation')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.evaluacion.preguntas[0].opciones[0]).toHaveProperty('esCorrecta');
  });

  it('200 con versión pública (sin esCorrecta) para un inscripto', async () => {
    prisma.modulo.findUnique.mockResolvedValue({ id: 'm1', cursoId: 'c1', estado: 'PUBLICADO', evaluacion: evaluacionConOpciones });
    prisma.curso.findUnique.mockResolvedValue({ id: 'c1', creadorId: 'otro', publicado: true, profesores: [] });
    prisma.inscripcion.findUnique.mockResolvedValue({ id: 'i1' });
    const res = await request(app).get('/api/modules/m1/evaluation')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.evaluacion.preguntas[0].opciones[0]).not.toHaveProperty('esCorrecta');
  });
  it('oculta modulo borrador al estudiante y lo muestra al dueño', async () => {
    prisma.modulo.findUnique.mockResolvedValue({
      id: 'm1', cursoId: 'c1', estado: 'BORRADOR', evaluacion: evaluacionConOpciones,
    });
    prisma.curso.findUnique.mockResolvedValue({ id: 'c1', creadorId: 'otro', publicado: true, profesores: [] });
    prisma.inscripcion.findUnique.mockResolvedValue({ id: 'i1' });
    const student = await request(app).get('/api/modules/m1/evaluation')
      .set('Authorization', `Bearer ${token}`);
    expect(student.status).toBe(404);

    prisma.usuario.findUnique.mockResolvedValue({ id: 'u1', rol: 'PROFESOR' });
    prisma.curso.findUnique.mockResolvedValue({ id: 'c1', creadorId: 'u1', publicado: false, profesores: [] });
    const owner = await request(app).get('/api/modules/m1/evaluation')
      .set('Authorization', `Bearer ${token}`);
    expect(owner.status).toBe(200);
    expect(owner.body.data.evaluacion.preguntas[0].opciones[0]).toHaveProperty('esCorrecta');
  });
});

describe('GET /api/courses/:id/final-evaluation', () => {
  it('401 sin token', async () => {
    const res = await request(app).get('/api/courses/c1/final-evaluation');
    expect(res.status).toBe(401);
  });

  it('404 si el curso no existe', async () => {
    prisma.curso.findUnique.mockResolvedValue(null);
    const res = await request(app).get('/api/courses/c1/final-evaluation')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('403 si no está inscripto ni es el autor', async () => {
    prisma.curso.findUnique.mockResolvedValue({ id: 'c1', creadorId: 'otro', publicado: true, profesores: [] });
    prisma.evaluacion.findFirst.mockResolvedValue(evaluacionConOpciones);
    prisma.inscripcion.findUnique.mockResolvedValue(null);
    const res = await request(app).get('/api/courses/c1/final-evaluation')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('200 con versión pública para un inscripto', async () => {
    prisma.curso.findUnique.mockResolvedValue({ id: 'c1', creadorId: 'otro', publicado: true, profesores: [] });
    prisma.evaluacion.findFirst.mockResolvedValue(evaluacionConOpciones);
    prisma.inscripcion.findUnique.mockResolvedValue({ id: 'i1' });
    const res = await request(app).get('/api/courses/c1/final-evaluation')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.evaluacion.preguntas[0].opciones[0]).not.toHaveProperty('esCorrecta');
  });

  it('oculta evaluacion final de curso borrador al estudiante y permite al dueño', async () => {
    prisma.curso.findUnique.mockResolvedValue({ id: 'c1', creadorId: 'otro', publicado: false, profesores: [] });
    prisma.evaluacion.findFirst.mockResolvedValue(evaluacionConOpciones);
    prisma.inscripcion.findUnique.mockResolvedValue({ id: 'i1' });
    const student = await request(app).get('/api/courses/c1/final-evaluation')
      .set('Authorization', `Bearer ${token}`);
    expect(student.status).toBe(404);

    prisma.usuario.findUnique.mockResolvedValue({ id: 'u1', rol: 'PROFESOR' });
    prisma.curso.findUnique.mockResolvedValue({ id: 'c1', creadorId: 'u1', publicado: false, profesores: [] });
    const owner = await request(app).get('/api/courses/c1/final-evaluation')
      .set('Authorization', `Bearer ${token}`);
    expect(owner.status).toBe(200);
  });
});

describe('GET /api/evaluations/:id', () => {
  it('401 sin token', async () => {
    const res = await request(app).get('/api/evaluations/ev1');
    expect(res.status).toBe(401);
  });

  it('404 si la evaluación no existe', async () => {
    prisma.evaluacion.findUnique.mockResolvedValue(null);
    const res = await request(app).get('/api/evaluations/ev1')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('403 si no está inscripto ni es el autor', async () => {
    prisma.evaluacion.findUnique.mockResolvedValue(evalConUnaPregunta);
    prisma.curso.findUnique.mockResolvedValue({ id: 'c1', titulo: 'Curso', creadorId: 'otro', publicado: true, profesores: [] });
    prisma.inscripcion.findUnique.mockResolvedValue(null);
    const res = await request(app).get('/api/evaluations/ev1')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('200 con versión completa para el autor', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'u1', rol: 'PROFESOR' });
    prisma.evaluacion.findUnique.mockResolvedValue(evalConUnaPregunta);
    prisma.curso.findUnique.mockResolvedValue({ id: 'c1', titulo: 'Curso', creadorId: 'u1', publicado: false, profesores: [] });
    const res = await request(app).get('/api/evaluations/ev1')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.evaluacion.preguntas[0].opciones[0]).toHaveProperty('esCorrecta');
  });
});

describe('GET /api/evaluations/:id/my-attempts visibility', () => {
  it('oculta intentos de evaluacion borrador al estudiante y permite preview docente', async () => {
    const draftEvaluation = {
      ...evalConUnaPregunta,
      modulo: { ...evalConUnaPregunta.modulo, estado: 'BORRADOR' },
    };
    prisma.evaluacion.findUnique.mockResolvedValue(draftEvaluation);
    prisma.curso.findUnique.mockResolvedValue({
      id: 'c1', titulo: 'Curso', creadorId: 'otro', publicado: true, profesores: [],
    });
    prisma.inscripcion.findUnique.mockResolvedValue({ id: 'i1' });

    const student = await request(app).get('/api/evaluations/ev1/my-attempts')
      .set('Authorization', `Bearer ${token}`);
    expect(student.status).toBe(404);
    expect(prisma.intento.findMany).not.toHaveBeenCalled();

    prisma.usuario.findUnique.mockResolvedValue({ id: 'u1', rol: 'PROFESOR' });
    prisma.curso.findUnique.mockResolvedValue({
      id: 'c1', titulo: 'Curso', creadorId: 'u1', publicado: false, profesores: [],
    });
    prisma.intento.findMany.mockResolvedValue([]);
    const owner = await request(app).get('/api/evaluations/ev1/my-attempts')
      .set('Authorization', `Bearer ${token}`);
    expect(owner.status).toBe(200);
  });
});
