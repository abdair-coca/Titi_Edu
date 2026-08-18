import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const mocks = vi.hoisted(() => {
  const client = {
    usuario: { findUnique: vi.fn() },
    curso: { findUnique: vi.fn() },
    evaluacion: { findFirst: vi.fn() },
    inscripcion: { findMany: vi.fn() },
    intento: { findMany: vi.fn() },
    progreso: { findMany: vi.fn() },
    resultadoHtmlLeccion: { findMany: vi.fn() },
  };
  return { client };
});

vi.mock('../../src/prisma.js', () => ({ default: mocks.client }));
vi.mock('../../src/db.js', () => ({ runQuery: vi.fn(), toNumber: (value) => Number(value || 0), default: {} }));

import app from '../../src/app.js';

const teacherToken = jwt.sign({ id: 'neo-teacher' }, process.env.JWT_SECRET, { expiresIn: '1h' });
const adminToken = jwt.sign({ id: 'neo-admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
const studentToken = jwt.sign({ id: 'neo-student' }, process.env.JWT_SECRET, { expiresIn: '1h' });
const authTeacher = { Authorization: `Bearer ${teacherToken}` };
const authAdmin = { Authorization: `Bearer ${adminToken}` };
const authStudent = { Authorization: `Bearer ${studentToken}` };

const teacher = { id: 'u-teacher', neoId: 'neo-teacher', rol: 'PROFESOR' };
const admin = { id: 'u-admin', neoId: 'neo-admin', rol: 'ADMIN' };
const student = { id: 'u-student', neoId: 'neo-student', rol: 'ESTUDIANTE' };

const curso = {
  id: 'c-1',
  titulo: 'Curso Notas',
  creadorId: 'u-teacher',
  profesores: [],
  modulos: [
    {
      id: 'm-1',
      titulo: 'Modulo 1',
      lecciones: [
        {
          id: 'l-1',
          titulo: 'Leccion 1',
          recursoHtml: { id: 'r-1', evaluable: true },
        },
        { id: 'l-2', titulo: 'Leccion 2', recursoHtml: null },
      ],
      evaluacion: { id: 'e-1', titulo: 'Quiz M1', notaMinima: 70, esFinal: false },
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.client.usuario.findUnique.mockImplementation(({ where }) => {
    const map = {
      'neo-teacher': teacher,
      'neo-admin': admin,
      'neo-student': student,
    };
    return Promise.resolve(map[where.neoId] || null);
  });
  mocks.client.curso.findUnique.mockResolvedValue(curso);
  mocks.client.evaluacion.findFirst.mockResolvedValue(null);
  mocks.client.inscripcion.findMany.mockResolvedValue([
    { completado: false, usuario: { id: 'u-s1', username: 'alumno1', email: 'a1@test.com' } },
    { completado: true, usuario: { id: 'u-s2', username: 'alumno2', email: 'a2@test.com' } },
  ]);
  mocks.client.intento.findMany.mockResolvedValue([
    { usuarioId: 'u-s1', evaluacionId: 'e-1', nota: 92, aprobado: true, numero: 2 },
  ]);
  mocks.client.progreso.findMany.mockResolvedValue([
    { usuarioId: 'u-s1', leccionId: 'l-1', completada: true },
    { usuarioId: 'u-s1', leccionId: 'l-2', completada: false },
    { usuarioId: 'u-s2', leccionId: 'l-1', completada: true },
    { usuarioId: 'u-s2', leccionId: 'l-2', completada: true },
  ]);
  mocks.client.resultadoHtmlLeccion.findMany.mockResolvedValue([
    { usuarioId: 'u-s1', recursoHtmlId: 'r-1', mejorPuntaje: 85 },
  ]);
});

describe('GET /api/courses/:courseId/grades', () => {
  it('devuelve notas por estudiante al profesor owner', async () => {
    const res = await request(app).get('/api/courses/c-1/grades').set(authTeacher);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.estudiantes).toHaveLength(2);
    const alumno1 = res.body.data.estudiantes.find((e) => e.usuario.id === 'u-s1');
    expect(alumno1.evaluaciones[0].mejorNota).toBe(92);
    expect(alumno1.evaluaciones[0].aprobado).toBe(true);
    expect(alumno1.html[0].mejorPuntaje).toBe(85);
    expect(alumno1.progreso).toBe(50);
    expect(res.body.data.estudiantes.find((e) => e.usuario.id === 'u-s2').progreso).toBe(100);
  });

  it('permite admin ver notas de cualquier curso', async () => {
    const res = await request(app).get('/api/courses/c-1/grades').set(authAdmin);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('rechaza estudiante no owner con 403', async () => {
    const res = await request(app).get('/api/courses/c-1/grades').set(authStudent);
    expect(res.status).toBe(403);
  });

  it('devuelve 403 si el curso no es del profesor', async () => {
    const cursoAjeno = { ...curso, creadorId: 'u-otro', profesores: [] };
    mocks.client.curso.findUnique.mockResolvedValue(cursoAjeno);
    const res = await request(app).get('/api/courses/c-1/grades').set(authTeacher);
    expect(res.status).toBe(403);
  });

  it('devuelve 404 si el curso no existe', async () => {
    mocks.client.curso.findUnique.mockResolvedValue(null);
    const res = await request(app).get('/api/courses/c-1/grades').set(authTeacher);
    expect(res.status).toBe(404);
  });

  it('devuelve lista vacia de estudiantes sin inscripciones', async () => {
    mocks.client.inscripcion.findMany.mockResolvedValue([]);
    const res = await request(app).get('/api/courses/c-1/grades').set(authTeacher);
    expect(res.status).toBe(200);
    expect(res.body.data.estudiantes).toEqual([]);
  });

  it('requiere auth', async () => {
    const res = await request(app).get('/api/courses/c-1/grades');
    expect(res.status).toBe(401);
  });
});
