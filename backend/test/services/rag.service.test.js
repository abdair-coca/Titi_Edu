import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  chunkText,
  createEmbedding,
  formatVector,
  htmlToText,
  lessonRagText,
  normalizeText,
  prepareEmbeddingText,
  ragEnabledForCourse,
  ragUserAllowed,
} from '../../src/services/rag.service.js';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.EMBEDDING_API_URL;
  delete process.env.EMBEDDING_API_KEY;
  delete process.env.EMBEDDING_MODEL;
  delete process.env.EMBEDDING_PROVIDER;
  delete process.env.EMBEDDING_DIMENSIONS;
  delete process.env.CLOUDFLARE_ACCOUNT_ID;
  delete process.env.CLOUDFLARE_AI_API_TOKEN;
  delete process.env.RAG_ENABLED;
  delete process.env.RAG_COURSE_IDS;
  delete process.env.RAG_ALLOWED_USER_EMAIL;
});

describe('RAG text preparation', () => {
  it('allows explicit wildcard course scope without enabling empty scope', () => {
    process.env.RAG_ENABLED = 'true';
    process.env.RAG_COURSE_IDS = '*';
    expect(ragEnabledForCourse('course-any')).toBe(true);
    process.env.RAG_COURSE_IDS = '';
    expect(ragEnabledForCourse('course-any')).toBe(false);
  });

  it('allows only configured pilot email', () => {
    process.env.RAG_ALLOWED_USER_EMAIL = 'student@gmail.com';
    expect(ragUserAllowed({ email: 'student@gmail.com' })).toBe(true);
    expect(ragUserAllowed({ email: 'other@gmail.com' })).toBe(false);
    expect(ragUserAllowed({ email: null })).toBe(false);
  });

  it('removes executable HTML and keeps visible text', () => {
    expect(htmlToText('<h1>Variables</h1><script>alert(1)</script><p>x &amp; y</p>'))
      .toBe('Variables x & y');
  });

  it('normalizes whitespace and creates overlapping chunks', () => {
    const text = normalizeText('  uno\n\n dos   tres ');
    expect(text).toBe('uno dos tres');
    const chunks = chunkText('abcdefghijklmnopqrstuvwxyz', 10, 3);
    expect(chunks).toEqual(['abcdefghij', 'hijklmnopq', 'opqrstuvwx', 'vwxyz']);
  });

  it('combines lesson text with HTML visible content', () => {
    expect(lessonRagText({ titulo: 'Título', contenido: 'Contenido', recursoHtml: { html: '<p>Actividad</p>' } }))
      .toBe('Título Contenido Actividad');
  });

  it('uses one retrieval preprocessing contract for queries and documents', () => {
    expect(prepareEmbeddingText('¿Qué es una variable?')).toBe('task: search result | query: ¿Qué es una variable?');
    expect(prepareEmbeddingText('Una variable almacena un valor.', { kind: 'document', title: 'Variables' }))
      .toBe('title: Variables | text: Una variable almacena un valor.');
  });

  it('uses the EmbeddingGemma 768-dimensional local provider contract', async () => {
    process.env.EMBEDDING_API_URL = 'https://embeddings.example';
    process.env.EMBEDDING_API_KEY = 'test-key';
    process.env.EMBEDDING_MODEL = 'google/embeddinggemma-300M';
    process.env.EMBEDDING_PROVIDER = 'local';
    const embedding = Array.from({ length: 768 }, () => 0.01);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ embedding }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(createEmbedding('Una variable almacena un valor.', { kind: 'document', title: 'Variables' }))
      .resolves.toEqual(embedding);
    expect(fetchMock).toHaveBeenCalledWith('https://embeddings.example/embeddings', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        model: 'google/embeddinggemma-300M',
        input: 'title: Variables | text: Una variable almacena un valor.',
      }),
    }));
    expect(formatVector(embedding)).toContain('0.01');
    expect(() => formatVector(Array.from({ length: 1536 }, () => 0.01)))
      .toThrow('El embedding debe tener 768 dimensiones');
  });

  it('sends retrieval queries with the query kind', async () => {
    process.env.EMBEDDING_API_URL = 'https://embeddings.example';
    process.env.EMBEDDING_API_KEY = 'test-key';
    process.env.EMBEDDING_MODEL = 'google/embeddinggemma-300M';
    process.env.EMBEDDING_PROVIDER = 'local';
    const embedding = Array.from({ length: 768 }, () => 0.02);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ embedding }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(createEmbedding('¿Qué es una variable?')).resolves.toEqual(embedding);
    expect(fetchMock).toHaveBeenCalledWith('https://embeddings.example/embeddings', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        model: 'google/embeddinggemma-300M',
        input: 'task: search result | query: ¿Qué es una variable?',
      }),
    }));
  });

  it('calls Cloudflare Workers AI with the official model and validates 768 finite values', async () => {
    process.env.EMBEDDING_PROVIDER = 'cloudflare';
    process.env.EMBEDDING_MODEL = '@cf/google/embeddinggemma-300m';
    process.env.CLOUDFLARE_ACCOUNT_ID = 'account-123';
    process.env.CLOUDFLARE_AI_API_TOKEN = 'cloudflare-token';
    const embedding = Array.from({ length: 768 }, () => 0.03);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, result: { shape: [1, 768], data: [embedding] } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(createEmbedding('¿Qué es una variable?')).resolves.toEqual(embedding);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.cloudflare.com/client/v4/accounts/account-123/ai/run/@cf/google/embeddinggemma-300m',
      expect.objectContaining({
        method: 'POST',
        headers: { Authorization: 'Bearer cloudflare-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: ['task: search result | query: ¿Qué es una variable?'] }),
      }),
    );
  });

  it('rejects non-finite or incorrectly sized Cloudflare vectors', async () => {
    process.env.EMBEDDING_PROVIDER = 'cloudflare';
    process.env.EMBEDDING_MODEL = '@cf/google/embeddinggemma-300m';
    process.env.CLOUDFLARE_ACCOUNT_ID = 'account-123';
    process.env.CLOUDFLARE_AI_API_TOKEN = 'cloudflare-token';
    const invalid = Array.from({ length: 768 }, () => 0.03);
    invalid[10] = Number.NaN;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ result: { data: [invalid] } }),
    }));

    await expect(createEmbedding('consulta')).rejects.toMatchObject({
      status: 502,
      message: 'El embedding contiene valores no numéricos o no finitos',
    });
  });
});
