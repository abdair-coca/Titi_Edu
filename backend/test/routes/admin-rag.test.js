import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const mockPrisma = vi.hoisted(() => ({
  usuario: { findUnique: vi.fn(), count: vi.fn() },
  curso: { findMany: vi.fn(), count: vi.fn() },
  leccion: { findMany: vi.fn(), findUnique: vi.fn(), count: vi.fn() },
  documentoRag: { count: vi.fn(), findUnique: vi.fn() },
}));

const mockRagService = vi.hoisted(() => ({
  indexLesson: vi.fn(),
  searchCourseContext: vi.fn(),
  RagError: class RagError extends Error {
    constructor(status, message) {
      super(message);
      this.status = status;
    }
  },
}));

vi.mock('../../src/db.js', () => ({ runQuery: vi.fn(), toNumber: (v) => Number(v ?? 0), default: {} }));
vi.mock('../../src/prisma.js', () => ({ default: mockPrisma }));
vi.mock('../../src/services/rag.service.js', () => mockRagService);

import app from '../../src/app.js';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
const tokenFor = (neoId) => jwt.sign({ id: neoId }, JWT_SECRET, { expiresIn: '1h' });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.JWT_SECRET = JWT_SECRET;
});

describe('RAG Admin Routes (/api/admin/rag)', () => {
  it('401 without auth token', async () => {
    const res = await request(app).get('/api/admin/rag/lessons');
    expect(res.status).toBe(401);
  });

  it('403 for non-admin users', async () => {
    mockPrisma.usuario.findUnique.mockResolvedValue({ id: 'u1', rol: 'ESTUDIANTE' });
    const res = await request(app)
      .get('/api/admin/rag/lessons')
      .set('Authorization', `Bearer ${tokenFor('neo-1')}`);
    expect(res.status).toBe(403);
  });

  it('GET /courses returns published courses list for filter dropdown', async () => {
    mockPrisma.usuario.findUnique.mockResolvedValue({ id: 'admin1', rol: 'ADMIN' });
    mockPrisma.curso.findMany.mockResolvedValue([
      { id: 'c1', titulo: 'Curso de Física' },
      { id: 'c2', titulo: 'Curso de Matemáticas' },
    ]);

    const res = await request(app)
      .get('/api/admin/rag/courses')
      .set('Authorization', `Bearer ${tokenFor('neo-admin')}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.courses).toHaveLength(2);
    expect(res.body.data.courses[0].titulo).toBe('Curso de Física');
  });

  it('GET /lessons returns paginated lessons and summary metrics for ADMIN', async () => {
    mockPrisma.usuario.findUnique.mockResolvedValue({ id: 'admin1', rol: 'ADMIN' });
    mockPrisma.leccion.findMany.mockResolvedValue([
      {
        id: 'l1',
        titulo: 'Cinemática',
        orden: 1,
        estado: 'PUBLICADA',
        recursoHtml: null,
        modulo: {
          id: 'm1',
          titulo: 'Módulo 1',
          curso: { id: 'c1', titulo: 'Física', publicado: true },
        },
        documentosRag: [
          {
            id: 'doc1',
            version: 1,
            estado: 'LISTO',
            activo: true,
            modelo: 'google/embeddinggemma-300M',
            error: null,
            indexadoAt: new Date().toISOString(),
            hashContenido: 'hash123',
            _count: { fragmentos: 3 },
          },
        ],
      },
    ]);
    mockPrisma.leccion.count.mockResolvedValueOnce(1); // total filtered
    mockPrisma.leccion.count.mockResolvedValueOnce(10); // total published
    mockPrisma.documentoRag.count.mockResolvedValueOnce(8); // ready
    mockPrisma.documentoRag.count.mockResolvedValueOnce(1); // failed
    mockPrisma.documentoRag.count.mockResolvedValueOnce(0); // pending

    const res = await request(app)
      .get('/api/admin/rag/lessons?page=1&pageSize=10')
      .set('Authorization', `Bearer ${tokenFor('neo-admin')}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.lessons).toHaveLength(1);
    expect(res.body.data.lessons[0].documentoRag.estado).toBe('LISTO');
    expect(res.body.data.lessons[0].documentoRag.fragmentosCount).toBe(3);
    expect(res.body.data.summary).toEqual({
      totalLessons: 10,
      ready: 8,
      failed: 1,
      pending: 0,
      unindexed: 1,
    });
  });

  it('GET /lessons/:lessonId/fragments returns 404 when lesson does not exist', async () => {
    mockPrisma.usuario.findUnique.mockResolvedValue({ id: 'admin1', rol: 'ADMIN' });
    mockPrisma.leccion.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/admin/rag/lessons/missing/fragments')
      .set('Authorization', `Bearer ${tokenFor('neo-admin')}`);

    expect(res.status).toBe(404);
  });

  it('GET /lessons/:lessonId/fragments returns active document and ordered chunks', async () => {
    mockPrisma.usuario.findUnique.mockResolvedValue({ id: 'admin1', rol: 'ADMIN' });
    mockPrisma.leccion.findUnique.mockResolvedValue({
      id: 'l1',
      titulo: 'Dinámica',
      modulo: {
        id: 'm1',
        titulo: 'Leyes de Newton',
        curso: { id: 'c1', titulo: 'Física I' },
      },
      documentosRag: [
        {
          id: 'doc1',
          version: 1,
          estado: 'LISTO',
          modelo: 'google/embeddinggemma-300M',
          indexadoAt: '2026-09-05T12:00:00.000Z',
          hashContenido: 'hash789',
          error: null,
          fragmentos: [
            { id: 'f0', orden: 0, contenido: 'Primera ley de Newton: Inercia.' },
            { id: 'f1', orden: 1, contenido: 'Segunda ley: F = m * a.' },
          ],
        },
      ],
    });

    const res = await request(app)
      .get('/api/admin/rag/lessons/l1/fragments')
      .set('Authorization', `Bearer ${tokenFor('neo-admin')}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.lesson.titulo).toBe('Dinámica');
    expect(res.body.data.fragments).toHaveLength(2);
    expect(res.body.data.fragments[0].contenido).toBe('Primera ley de Newton: Inercia.');
    expect(res.body.data.fragments[1].orden).toBe(1);
  });

  it('POST /lessons/:lessonId/test-query returns semantic search similarity scores', async () => {
    mockPrisma.usuario.findUnique.mockResolvedValue({ id: 'admin1', rol: 'ADMIN' });
    mockPrisma.leccion.findUnique.mockResolvedValue({
      id: 'l1',
      titulo: 'Cinemática',
      modulo: { cursoId: 'c1' },
    });
    mockRagService.searchCourseContext.mockResolvedValue([
      {
        chunkId: 'chunk-1',
        index: 1,
        lessonId: 'l1',
        lessonTitle: 'Cinemática',
        moduleTitle: 'Módulo 1',
        content: 'La aceleración mide el cambio de velocidad.',
        similarity: 0.8842,
      },
    ]);

    const res = await request(app)
      .post('/api/admin/rag/lessons/l1/test-query')
      .set('Authorization', `Bearer ${tokenFor('neo-admin')}`)
      .send({ query: '¿Qué es la aceleración?' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.results).toHaveLength(1);
    expect(res.body.data.results[0].similarity).toBe(0.8842);
    expect(mockRagService.searchCourseContext).toHaveBeenCalledWith('c1', '¿Qué es la aceleración?', 5, { lessonId: 'l1' });
  });

  it('POST /lessons/:lessonId/reindex triggers indexLesson with force: true and returns result', async () => {
    mockPrisma.usuario.findUnique.mockResolvedValue({ id: 'admin1', rol: 'ADMIN' });
    mockPrisma.leccion.findUnique.mockResolvedValue({
      id: 'l1',
      estado: 'PUBLICADA',
      modulo: { estado: 'PUBLICADO', curso: { publicado: true } },
    });
    mockRagService.indexLesson.mockResolvedValue({
      status: 'INDEXED',
      documentId: 'doc1',
      lessonId: 'l1',
      chunks: 3,
    });

    const res = await request(app)
      .post('/api/admin/rag/lessons/l1/reindex')
      .set('Authorization', `Bearer ${tokenFor('neo-admin')}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('INDEXED');
    expect(mockRagService.indexLesson).toHaveBeenCalledWith('l1', { force: true });
  });

  it('POST /lessons/:lessonId/reindex rejects non-published lessons with 400', async () => {
    mockPrisma.usuario.findUnique.mockResolvedValue({ id: 'admin1', rol: 'ADMIN' });
    mockPrisma.leccion.findUnique.mockResolvedValue({
      id: 'l1',
      estado: 'BORRADOR',
      modulo: { estado: 'BORRADOR', curso: { publicado: false } },
    });

    const res = await request(app)
      .post('/api/admin/rag/lessons/l1/reindex')
      .set('Authorization', `Bearer ${tokenFor('neo-admin')}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(mockRagService.indexLesson).not.toHaveBeenCalled();
  });
});
