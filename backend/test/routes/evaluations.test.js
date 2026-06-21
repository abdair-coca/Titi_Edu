import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

vi.mock('../../src/db.js', () => ({ runQuery: vi.fn(), toNumber: (v) => Number(v ?? 0), default: {} }));
vi.mock('../../src/prisma.js', () => ({
  default: {
    usuario: { findUnique: vi.fn() },
    evaluacion: { findUnique: vi.fn() },
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
  modulo: { id: 'm1', cursoId: 'c1' },
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
    prisma.curso.findUnique.mockResolvedValue({ id: 'c1', titulo: 'Curso' });
    prisma.inscripcion.findUnique.mockResolvedValue(null);
    const res = await request(app).post('/api/evaluations/ev1/attempt')
      .set('Authorization', `Bearer ${token}`).send({ respuestas: [] });
    expect(res.status).toBe(403);
  });

  it('201 califica server-side y aprueba con respuesta correcta', async () => {
    prisma.evaluacion.findUnique.mockResolvedValue(evalConUnaPregunta);
    prisma.curso.findUnique.mockResolvedValue({ id: 'c1', titulo: 'Curso' });
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
    prisma.curso.findUnique.mockResolvedValue({ id: 'c1', titulo: 'Curso' });
    prisma.inscripcion.findUnique.mockResolvedValue({ id: 'i1' });
    prisma.intento.findMany.mockResolvedValue([{ id: 'prev', aprobado: true }]);
    const res = await request(app).post('/api/evaluations/ev1/attempt')
      .set('Authorization', `Bearer ${token}`)
      .send({ respuestas: [{ preguntaId: 'q1', opcionId: 'op-ok' }] });
    expect(res.status).toBe(409);
  });
});
