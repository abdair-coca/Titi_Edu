import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const prisma = vi.hoisted(() => ({ $queryRaw: vi.fn() }));
vi.mock('../../src/prisma.js', () => ({ default: prisma }));

import { searchCourseContext } from '../../src/services/rag.service.js';

const embeddingResponse = () => ({
  ok: true,
  status: 200,
  json: async () => ({ data: [{ embedding: Array.from({ length: 768 }, () => 0.01) }] }),
});

function row(overrides = {}) {
  return {
    id: 'f-1',
    contenido: `Contenido ${overrides.id || 'f-1'}`,
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
  for (const key of ['EMBEDDING_API_URL', 'EMBEDDING_API_KEY', 'EMBEDDING_MODEL', 'EMBEDDING_PROVIDER', 'RAG_LESSON_PRIORITY_LIMIT', 'RAG_EVIDENCE_THRESHOLD']) {
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

  it('uses hybrid retrieval with full-text query terms', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([row({ id: 'f-hybrid', lessonId: 'lesson-1', similarity: 0.6 })]);

    await searchCourseContext('course-1', '¿Qué es una variable?', 5);

    const [sql] = prisma.$queryRaw.mock.calls[0];
    const sqlText = Array.isArray(sql) ? sql.join('?') : String(sql?.text || sql);
    expect(sqlText).toContain('plainto_tsquery(\'spanish\',');
    expect(sqlText).toContain('ts_rank_cd');
    expect(sqlText).toContain('"tsv"');
    expect(sqlText).toContain('"assessmentSafe"');
    expect(sqlText).toContain('"RecursoHtmlLeccion"');
  });

  it('falls back to pure vector retrieval when the hybrid query fails', async () => {
    prisma.$queryRaw
      .mockRejectedValueOnce(new Error('column "tsv" does not exist'))
      .mockResolvedValueOnce([row({ id: 'f-vector', lessonId: 'lesson-1', similarity: 0.8 })]);

    const result = await searchCourseContext('course-1', '¿Qué es una variable?', 5);

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(1);
    expect(result[0].chunkId).toBe('f-vector');
    const [vectorSql] = prisma.$queryRaw.mock.calls[1];
    const vectorSqlText = Array.isArray(vectorSql) ? vectorSql.join('?') : String(vectorSql?.text || vectorSql);
    expect(vectorSqlText).toContain('WHERE "similarity" >= ?');
    expect(vectorSqlText).toContain('"assessmentSafe"');
  });

  it('qualifies hybrid evidence in SQL before applying retrieval limit', async () => {
    process.env.RAG_EVIDENCE_THRESHOLD = '0.75';
    prisma.$queryRaw.mockResolvedValueOnce([row({ id: 'f-qualified', similarity: 0.8 })]);

    await searchCourseContext('course-1', '¿Qué es una variable?', 2);

    const [hybridSql] = prisma.$queryRaw.mock.calls[0];
    const hybridSqlText = Array.isArray(hybridSql) ? hybridSql.join('?') : String(hybridSql?.text || hybridSql);
    expect(hybridSqlText).toContain('WHERE "similarity" >= ? OR "ftsRank" > 0');
  });

  it('does not use vector results below the evidence threshold', async () => {
    process.env.RAG_EVIDENCE_THRESHOLD = '0.75';
    prisma.$queryRaw.mockResolvedValueOnce([row({ id: 'f-weak', similarity: 0.7 })]);

    const result = await searchCourseContext('course-1', 'Pregunta fuera del material', 5);

    expect(result).toEqual([]);
  });

  it('keeps low-similarity exact matches and removes duplicate content', async () => {
    process.env.RAG_EVIDENCE_THRESHOLD = '0.75';
    prisma.$queryRaw.mockResolvedValueOnce([
      row({ id: 'f-exact', contenido: 'Nombre exacto del concepto', similarity: 0.2, ftsMatch: true }),
      row({ id: 'f-duplicate', contenido: '  Nombre exacto del concepto  ', similarity: 0.9 }),
    ]);

    const result = await searchCourseContext('course-1', 'Nombre exacto', 5);

    expect(result).toHaveLength(1);
    expect(result[0].chunkId).toBe('f-exact');
    expect(result[0].ftsMatch).toBe(true);
  });

  it('fills requested evidence after removing duplicates across lesson priority and course fallback', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([row({ id: 'f-l1', lessonId: 'lesson-1', contenido: 'Contenido compartido', similarity: 0.9 })])
      .mockResolvedValueOnce([
        row({ id: 'f-duplicate', lessonId: 'lesson-2', contenido: ' Contenido compartido ', similarity: 0.85 }),
        row({ id: 'f-c1', lessonId: 'lesson-3', contenido: 'Contenido complementario uno', similarity: 0.8 }),
        row({ id: 'f-c2', lessonId: 'lesson-4', contenido: 'Contenido complementario dos', similarity: 0.7 }),
        row({ id: 'f-c3', lessonId: 'lesson-5', contenido: 'Contenido complementario tres', similarity: 0.6 }),
      ])
      .mockResolvedValueOnce([
        row({ id: 'f-duplicate', lessonId: 'lesson-2', contenido: ' Contenido compartido ', similarity: 0.85 }),
        row({ id: 'f-c1', lessonId: 'lesson-3', contenido: 'Contenido complementario uno', similarity: 0.8 }),
        row({ id: 'f-c2', lessonId: 'lesson-4', contenido: 'Contenido complementario dos', similarity: 0.7 }),
        row({ id: 'f-c3', lessonId: 'lesson-5', contenido: 'Contenido complementario tres', similarity: 0.6 }),
        row({ id: 'f-c4', lessonId: 'lesson-6', contenido: 'Contenido complementario cuatro', similarity: 0.5 }),
      ]);

    const result = await searchCourseContext('course-1', '¿Qué es una variable?', 4, { lessonId: 'lesson-1' });

    expect(result).toHaveLength(4);
    expect(result.map((item) => item.chunkId)).toEqual(['f-l1', 'f-c1', 'f-c2', 'f-c3']);
    const [fallbackTemplate] = prisma.$queryRaw.mock.calls[1];
    const sqlText = Array.isArray(fallbackTemplate)
      ? fallbackTemplate.join('?')
      : String(fallbackTemplate?.text || fallbackTemplate);
    expect(sqlText).toContain('LIMIT ?');
  });
});
