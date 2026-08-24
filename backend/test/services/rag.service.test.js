import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  chunkText,
  createEmbedding,
  formatVector,
  htmlToText,
  lessonRagText,
  normalizeText,
} from '../../src/services/rag.service.js';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.EMBEDDING_API_URL;
  delete process.env.EMBEDDING_API_KEY;
  delete process.env.EMBEDDING_MODEL;
  delete process.env.EMBEDDING_PROVIDER;
});

describe('RAG text preparation', () => {
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

  it('uses the BGE-M3 1024-dimensional provider contract', async () => {
    process.env.EMBEDDING_API_URL = 'https://embeddings.example';
    process.env.EMBEDDING_API_KEY = 'test-key';
    process.env.EMBEDDING_MODEL = 'BAAI/bge-m3';
    const embedding = Array.from({ length: 1024 }, () => 0.01);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ embedding }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(createEmbedding('¿Qué es una variable?')).resolves.toEqual(embedding);
    expect(fetchMock).toHaveBeenCalledWith('https://embeddings.example/embeddings', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ model: 'BAAI/bge-m3', input: '¿Qué es una variable?' }),
    }));
    expect(formatVector(embedding)).toContain('0.01');
    expect(() => formatVector(Array.from({ length: 1536 }, () => 0.01)))
      .toThrow('El embedding debe tener 1024 dimensiones');
  });

  it('consumes the Gradio queue API and unwraps its completed vector', async () => {
    process.env.EMBEDDING_API_URL = 'https://embeddings.example';
    process.env.EMBEDDING_API_KEY = 'test-key';
    process.env.EMBEDDING_MODEL = 'BAAI/bge-m3';
    process.env.EMBEDDING_PROVIDER = 'gradio';
    const embedding = Array.from({ length: 1024 }, () => 0.02);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ event_id: 'event-123' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => `event: complete\ndata: ${JSON.stringify([embedding])}\n\n`,
      });
    vi.stubGlobal('fetch', fetchMock);

    await expect(createEmbedding('Texto para Gradio')).resolves.toEqual(embedding);
    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://embeddings.example/gradio_api/call/embed', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ data: ['Texto para Gradio'] }),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://embeddings.example/gradio_api/call/embed/event-123', expect.objectContaining({
      headers: expect.objectContaining({ Accept: 'text/event-stream' }),
    }));
  });
});
