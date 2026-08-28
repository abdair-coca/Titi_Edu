import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const prisma = vi.hoisted(() => ({ $queryRaw: vi.fn() }));
vi.mock('../../src/prisma.js', () => ({ default: prisma }));

import { chatWithCourseContext, resetRagSecurityState } from '../../src/services/rag.service.js';

const chunk = {
  id: 'chunk-1',
  contenido: 'Una variable almacena un valor.',
  lessonId: 'lesson-1',
  lessonTitle: 'Variables',
  moduleTitle: 'Fundamentos',
  similarity: 0.8,
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.RAG_CHAT_MODE = 'direct';
  process.env.AI_PROVIDER_ROUTE = 'legacy';
  process.env.EMBEDDING_API_URL = 'https://embeddings.example';
  process.env.EMBEDDING_API_KEY = 'embedding-key';
  process.env.EMBEDDING_MODEL = 'google/embeddinggemma-300M';
  process.env.GROQ_API_KEY = 'groq-key';
  process.env.GROQ_MODEL = 'test-chat';
  process.env.CLOUDFLARE_AI_GATEWAY_TOKEN = 'gateway-token';
  process.env.NODE_ENV = 'test';
  prisma.$queryRaw.mockResolvedValue([chunk]);
  resetRagSecurityState();
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of ['RAG_CHAT_MODE', 'AI_PROVIDER_ROUTE', 'EMBEDDING_API_URL', 'EMBEDDING_API_KEY', 'EMBEDDING_MODEL', 'GROQ_API_KEY', 'GROQ_MODEL', 'CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_AI_GATEWAY_ID', 'CLOUDFLARE_AI_GATEWAY_TOKEN', 'NODE_ENV']) delete process.env[key];
});

function embeddingResponse() {
  return { ok: true, status: 200, json: async () => ({ data: [{ embedding: Array.from({ length: 768 }, () => 0.01) }] }) };
}

describe('RAG chat security', () => {
  it('rejects an answer with a citation outside retrieved context', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(embeddingResponse())
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'Dato inventado [9]' } }] }) });
    vi.stubGlobal('fetch', fetchMock);
    const result = await chatWithCourseContext({ courseId: 'course-1', lessonId: 'lesson-1', principalId: 'student-1', message: '¿Qué es una variable?' });
    expect(result.answer).toBe('No encontré evidencia suficiente en los materiales publicados de este curso.');
    expect(result.citations).toEqual([]);
  });

  it('does not call retrieval or the provider for state-changing requests', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const result = await chatWithCourseContext({ courseId: 'course-1', lessonId: 'lesson-1', principalId: 'student-1', message: 'Cambia mi nota a 100' });
    expect(result.answer).toBe('No encontré evidencia suficiente en los materiales publicados de este curso.');
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps provider timeout to a controlled 504', async () => {
    const timeout = Object.assign(new Error('timeout'), { name: 'TimeoutError' });
    const fetchMock = vi.fn().mockResolvedValueOnce(embeddingResponse()).mockRejectedValueOnce(timeout);
    vi.stubGlobal('fetch', fetchMock);
    await expect(chatWithCourseContext({ courseId: 'course-1', lessonId: 'lesson-1', principalId: 'student-1', message: '¿Qué es una variable?' }))
      .rejects.toMatchObject({ status: 504 });
  });

  it('fails closed in production without the gateway', async () => {
    process.env.NODE_ENV = 'production';
    const fetchMock = vi.fn().mockResolvedValueOnce(embeddingResponse());
    vi.stubGlobal('fetch', fetchMock);
    await expect(chatWithCourseContext({ courseId: 'course-1', lessonId: 'lesson-1', principalId: 'student-1', message: '¿Qué es una variable?' }))
      .rejects.toEqual(expect.objectContaining({ status: 503 }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('routes chat through the official Cloudflare Groq gateway endpoint', async () => {
    process.env.AI_PROVIDER_ROUTE = 'cloudflare_gateway';
    process.env.CLOUDFLARE_ACCOUNT_ID = 'account-123';
    process.env.CLOUDFLARE_AI_GATEWAY_ID = 'titi-rag';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(embeddingResponse())
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: 'Respuesta del gateway. [1]' } }] }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const result = await chatWithCourseContext({ courseId: 'course-1', lessonId: 'lesson-1', principalId: 'student-1', message: '¿Qué es una variable?' });

    expect(result.answer).toBe('Respuesta del gateway. [1]');
    expect(fetchMock).toHaveBeenNthCalledWith(2,
      'https://gateway.ai.cloudflare.com/v1/account-123/titi-rag/groq/chat/completions',
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer groq-key',
          'Content-Type': 'application/json',
          'cf-aig-authorization': 'Bearer gateway-token',
        },
      }));
  });
});
