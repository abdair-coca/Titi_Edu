import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const prisma = vi.hoisted(() => ({ $queryRaw: vi.fn() }));
vi.mock('../../src/prisma.js', () => ({ default: prisma }));

import { searchCourseContext } from '../../src/services/rag.service.js';

const embeddingResponse = () => ({
  ok: true,
  status: 200,
  json: async () => ({ data: [{ embedding: Array.from({ length: 768 }, () => 0.01) }] }),
});

function row(overrides) {
  return {
    id: 'f-1',
    contenido: 'Contenido',
    lessonId: 'lesson-1',
    lessonTitle: 'Lección 1',
    moduleTitle: 'Módulo',
    similarity: 0.8,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.EMBEDDING_API_URL = 'https://embeddings.example';
  process.env.EMBEDDING_API_KEY = 'test-key';
  process.env.EMBEDDING_MODEL = 'google/embeddinggemma-300M';
  process.env.EMBEDDING_PROVIDER = 'local';
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(embeddingResponse()));
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of ['EMBEDDING_API_URL', 'EMBEDDING_API_KEY', 'EMBEDDING_MODEL', 'EMBEDDING_PROVIDER', 'RAG_LESSON_PRIORITY_LIMIT']) {
    delete process.env[key];
  }
});

describe('RAG lesson-prioritized retrieval', () => {
  it('prioritizes the current lesson and fills from the rest of the course', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        row({ id: 'f-l1', lessonId: 'lesson-1', similarity: 0.9 }),
        row({ id: 'f-l2', lessonId: 'lesson-1', similarity: 0.8 }),
      ])
      .mockResolvedValueOnce([row({ id: 'f-c1', lessonId: 'lesson-2', similarity: 0.7 })]);

    const result = await searchCourseContext('course-1', '¿Qué es una variable?', 5, { lessonId: 'lesson-1' });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    expect(result.map((c) => c.lessonId)).toEqual(['lesson-1', 'lesson-1', 'lesson-2']);
    // Renumeración secuencial para que las citas [N] queden consistentes.
    expect(result.map((c) => c.index)).toEqual([1, 2, 3]);
    expect(result[0]).toMatchObject({ chunkId: 'f-l1', lessonTitle: 'Lección 1', similarity: 0.9 });
  });

  it('queries the whole course when no lessonId is provided', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([row({ id: 'f-c1', lessonId: 'lesson-2' })]);

    const result = await searchCourseContext('course-1', '¿Qué es una variable?');

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
    expect(result[0].lessonId).toBe('lesson-2');
  });

  it('caps the lesson share with RAG_LESSON_PRIORITY_LIMIT and still fills', async () => {
    process.env.RAG_LESSON_PRIORITY_LIMIT = '2';
    prisma.$queryRaw
      .mockResolvedValueOnce([row({ id: 'f-l1', lessonId: 'lesson-1', similarity: 0.9 })])
      .mockResolvedValueOnce([
        row({ id: 'f-c1', lessonId: 'lesson-2', similarity: 0.8 }),
        row({ id: 'f-c2', lessonId: 'lesson-2', similarity: 0.7 }),
      ]);

    const result = await searchCourseContext('course-1', '¿Qué es una variable?', 5, { lessonId: 'lesson-1' });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(3);
    expect(result[0].lessonId).toBe('lesson-1');
    expect(result[1].lessonId).toBe('lesson-2');
    expect(result[2].lessonId).toBe('lesson-2');
  });

  it('falls back fully to the course when the lesson has no fragments', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([row({ id: 'f-c1', lessonId: 'lesson-2', similarity: 0.7 })]);

    const result = await searchCourseContext('course-1', '¿Qué es una variable?', 5, { lessonId: 'lesson-1' });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(1);
    expect(result[0].lessonId).toBe('lesson-2');
  });
});