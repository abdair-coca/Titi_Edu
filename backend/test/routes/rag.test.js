import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const mocks = vi.hoisted(() => ({
  client: {
    usuario: { findUnique: vi.fn() },
    leccion: { findUnique: vi.fn() },
    curso: { findUnique: vi.fn() },
    inscripcion: { findUnique: vi.fn() },
  },
  ragEnabledForCourse: vi.fn(),
  ragStatusForLesson: vi.fn(),
  chatWithCourseContext: vi.fn(),
  indexCourse: vi.fn(),
}));

vi.mock('../../src/prisma.js', () => ({ default: mocks.client }));
vi.mock('../../src/db.js', () => ({ runQuery: vi.fn(), toNumber: (value) => Number(value || 0), default: {} }));
vi.mock('../../src/services/rag.service.js', () => ({
  RagError: class RagError extends Error { constructor(status, message) { super(message); this.status = status; } },
  ragEnabledForCourse: mocks.ragEnabledForCourse,
  ragStatusForLesson: mocks.ragStatusForLesson,
  chatWithCourseContext: mocks.chatWithCourseContext,
  indexCourse: mocks.indexCourse,
}));

import app from '../../src/app.js';

const studentToken = jwt.sign({ id: 'neo-student' }, process.env.JWT_SECRET, { expiresIn: '1h' });
const teacherToken = jwt.sign({ id: 'neo-teacher' }, process.env.JWT_SECRET, { expiresIn: '1h' });

function allowStudent() {
  mocks.client.usuario.findUnique.mockResolvedValue({ id: 'u-student', rol: 'ESTUDIANTE' });
  mocks.client.leccion.findUnique.mockResolvedValue({
    id: 'l-1', estado: 'PUBLICADA', modulo: { cursoId: 'c-1', estado: 'PUBLICADO' },
  });
  mocks.client.curso.findUnique.mockResolvedValue({ creadorId: 'u-teacher', publicado: true, profesores: [] });
  mocks.client.inscripcion.findUnique.mockResolvedValue({ id: 'i-1' });
}

describe('RAG lesson routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ragEnabledForCourse.mockReturnValue(true);
    mocks.ragStatusForLesson.mockResolvedValue({ enabled: true, indexed: true, status: 'LISTO' });
    mocks.chatWithCourseContext.mockResolvedValue({
      answer: 'Las variables guardan valores. [1]',
      citations: [{ number: 1, lessonId: 'l-1', title: 'Variables', excerpt: '...' }],
      usage: null,
    });
    mocks.indexCourse.mockResolvedValue({ courseId: 'c-1', total: 1, results: [{ status: 'INDEXED' }] });
  });

  it('requires authentication', async () => {
    const response = await request(app).post('/api/lessons/l-1/chat').send({ message: '¿Qué es una variable?' });
    expect(response.status).toBe(401);
  });

  it('blocks students without course enrollment', async () => {
    allowStudent();
    mocks.client.inscripcion.findUnique.mockResolvedValue(null);
    const response = await request(app).post('/api/lessons/l-1/chat')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ message: '¿Qué es una variable?' });
    expect(response.status).toBe(403);
    expect(mocks.chatWithCourseContext).not.toHaveBeenCalled();
  });

  it('returns grounded answer and citations for enrolled student', async () => {
    allowStudent();
    const response = await request(app).post('/api/lessons/l-1/chat')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ message: '¿Qué es una variable?' });
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ answer: 'Las variables guardan valores. [1]' });
    expect(response.body.data.citations[0]).toMatchObject({ number: 1, lessonId: 'l-1' });
    expect(mocks.chatWithCourseContext).toHaveBeenCalledWith({
      courseId: 'c-1',
      lessonId: 'l-1',
      principalId: 'u-student',
      message: '¿Qué es una variable?',
    });
  });

  it('rejects oversized questions', async () => {
    allowStudent();
    const response = await request(app).post('/api/lessons/l-1/chat')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ message: 'x'.repeat(1001) });
    expect(response.status).toBe(400);
  });

  it('allows course owner to reindex a pilot course', async () => {
    mocks.client.usuario.findUnique.mockResolvedValue({ id: 'u-teacher', rol: 'PROFESOR' });
    mocks.client.curso.findUnique.mockResolvedValue({ id: 'c-1', creadorId: 'u-teacher', profesores: [] });
    const response = await request(app).post('/api/admin/rag/courses/c-1/reindex')
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(response.status).toBe(200);
    expect(response.body.data.total).toBe(1);
    expect(mocks.indexCourse).toHaveBeenCalledWith('c-1');
  });
});
