import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const prisma = vi.hoisted(() => ({ $queryRaw: vi.fn() }));
vi.mock('../../src/prisma.js', () => ({ default: prisma }));

import { rerankContext, retrieveLessonContext, searchCourseContext } from '../../src/services/rag.service.js';

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
  for (const key of ['EMBEDDING_API_URL', 'EMBEDDING_API_KEY', 'EMBEDDING_MODEL', 'EMBEDDING_PROVIDER', 'RAG_LESSON_PRIORITY_LIMIT', 'RAG_EVIDENCE_THRESHOLD', 'CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_AI_API_TOKEN', 'RAG_RERANK_ENABLED']) {
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
    expect(hybridSqlText).toContain('WHERE "similarity" >= ? OR "ftsMatch"');
  });

  it('sends only the student words to full-text and the enriched query to the embedding', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([row({ id: 'f-1' })]);

    await searchCourseContext('course-1', '¿Qué es NAT?\nTema de la lección actual: Redes', 5, { ftsQuery: '¿Qué es NAT?' });

    expect(JSON.parse(fetch.mock.calls[0][1].body).input).toContain('Tema de la lección actual: Redes');
    const [, ...params] = prisma.$queryRaw.mock.calls[0];
    expect(params).toContain('¿Qué es NAT?');
    expect(params).not.toContain('¿Qué es NAT?\nTema de la lección actual: Redes');
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

  it('returns source, section, and exact excerpt metadata in retrieval results', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([row({
      id: 'f-author', contenido: 'Una variable almacena valores.', origen: 'AUTOR', seccion: 'Variables',
    })]);

    const result = await searchCourseContext('course-1', '¿Qué almacena una variable?');

    expect(result[0]).toMatchObject({ origen: 'AUTOR', seccion: 'Variables', content: 'Una variable almacena valores.' });
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

  it('reuses one query embedding and includes equally relevant foreign lesson evidence', async () => {
    prisma.$queryRaw.mockReset();
    prisma.$queryRaw
      .mockResolvedValueOnce([row({ id: 'f-current', lessonId: 'lesson-1', similarity: 0.8 })])
      .mockResolvedValueOnce([row({
        id: 'f-foreign', lessonId: 'lesson-2', lessonTitle: 'Herencia', similarity: 0.8,
      })]);

    const result = await searchCourseContext('course-1', '¿Qué es herencia?', 5, { lessonId: 'lesson-1' });

    expect(fetch).toHaveBeenCalledOnce();
    expect(result.map((item) => item.lessonId)).toEqual(['lesson-1', 'lesson-2']);
    const [courseSql] = prisma.$queryRaw.mock.calls[1];
    const sqlText = Array.isArray(courseSql) ? courseSql.join('?') : String(courseSql?.text || courseSql);
    expect(sqlText).toContain('c."publicado" = true');
    expect(sqlText).toContain('m."estado" = \'PUBLICADO\'');
    expect(sqlText).toContain('l."estado" = \'PUBLICADA\'');
    expect(sqlText).toContain('d."version" = l."version"');
    expect(sqlText).toContain('d."activo" = true');
    expect(sqlText).toContain('d."assessmentSafe"');
  });
});

describe('RAG reranking', () => {
  const chunk = (id, seccion = 'Conceptos clave') => ({ index: 0, chunkId: id, lessonId: 'lesson-1', seccion, content: `Contenido ${id}`, similarity: 0.7 });
  const rerankResponse = (response) => ({ ok: true, status: 200, json: async () => ({ result: { response } }) });
  const rerankCalls = () => fetch.mock.calls.filter(([url]) => String(url).includes('bge-reranker-base'));

  beforeEach(() => {
    process.env.CLOUDFLARE_ACCOUNT_ID = 'account-1';
    process.env.CLOUDFLARE_AI_API_TOKEN = 'cf-token';
  });

  it('orders candidates by reranker score, keeps the limit and renumbers', async () => {
    fetch.mockResolvedValueOnce(rerankResponse([{ id: 0, score: 0.1 }, { id: 1, score: 0.9 }, { id: 2, score: 0.5 }]));

    const result = await rerankContext('¿Qué es LIFO?', [chunk('a'), chunk('b'), chunk('c')], 2);

    expect(result.map((item) => [item.chunkId, item.index])).toEqual([['b', 1], ['c', 2]]);
    expect(JSON.parse(rerankCalls()[0][1].body)).toEqual({
      query: '¿Qué es LIFO?',
      contexts: [{ text: 'Contenido a' }, { text: 'Contenido b' }, { text: 'Contenido c' }],
    });
  });

  it('lowers Presentación and hints so the answering section comes first', async () => {
    fetch.mockResolvedValueOnce(rerankResponse([{ id: 0, score: 0.9 }, { id: 1, score: 0.8 }, { id: 2, score: 0.5 }]));

    const result = await rerankContext('q', [chunk('intro', 'Presentación'), chunk('hint', 'Pista 1'), chunk('answer')], 3);

    expect(result.map((item) => item.chunkId)).toEqual(['answer', 'intro', 'hint']);
  });

  it('drops sources below 5 % of the best score, but always keeps the best one', async () => {
    fetch.mockResolvedValueOnce(rerankResponse([{ id: 0, score: 0.004 }, { id: 1, score: 0.2 }, { id: 2, score: 0.02 }, { id: 3, score: 0.009 }]));

    const result = await rerankContext('q', [chunk('a'), chunk('b'), chunk('c'), chunk('d')], 5);

    expect(result.map((item) => [item.chunkId, item.index])).toEqual([['b', 1], ['c', 2]]);
  });

  it('keeps one source when every score is tiny', async () => {
    fetch.mockResolvedValueOnce(rerankResponse([{ id: 0, score: 0.0001 }, { id: 1, score: 0.000001 }]));

    const result = await rerankContext('q', [chunk('a'), chunk('b')], 5);

    expect(result.map((item) => item.chunkId)).toEqual(['a']);
  });

  it('keeps the hybrid order when the reranker fails', async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await rerankContext('q', [chunk('a'), chunk('b'), chunk('c')], 2);

    expect(result.map((item) => [item.chunkId, item.index])).toEqual([['a', 1], ['b', 2]]);
  });

  it('reranks 15 candidates with the student question, without the lesson title', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce(Array.from({ length: 8 }, (_, index) => row({ id: `f-${index}`, similarity: 0.9 - index / 100 })))
      .mockResolvedValueOnce([]);
    fetch.mockResolvedValueOnce(embeddingResponse())
      .mockResolvedValueOnce(rerankResponse(Array.from({ length: 8 }, (_, id) => ({ id, score: id / 10 }))));

    const result = await retrieveLessonContext('course-1', { message: '¿Qué es LIFO?', lessonId: 'lesson-1', lessonTitle: 'Pilas' });

    expect(result.map((item) => item.chunkId)).toEqual(['f-7', 'f-6', 'f-5', 'f-4', 'f-3']);
    expect(JSON.parse(fetch.mock.calls[0][1].body).input).toContain('Tema de la lección actual: Pilas');
    expect(JSON.parse(rerankCalls()[0][1].body).query).toBe('¿Qué es LIFO?');
    // The current-lesson query asks for 15 candidates, not the 5 final sources.
    expect(prisma.$queryRaw.mock.calls[0].at(-1)).toBe(15);
  });

  it('searches only the final sources when the reranker is off', async () => {
    process.env.RAG_RERANK_ENABLED = 'false';
    prisma.$queryRaw.mockResolvedValueOnce([row({ id: 'f-1' })]).mockResolvedValueOnce([]);

    const result = await retrieveLessonContext('course-1', { message: '¿Qué es LIFO?', lessonId: 'lesson-1', lessonTitle: 'Pilas' });

    expect(result.map((item) => item.chunkId)).toEqual(['f-1']);
    expect(fetch).toHaveBeenCalledOnce();
    expect(rerankCalls()).toHaveLength(0);
  });
});
