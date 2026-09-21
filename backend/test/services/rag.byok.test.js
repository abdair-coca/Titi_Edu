import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({
  credencialIa: { findUnique: vi.fn(), upsert: vi.fn(), updateMany: vi.fn() },
  $queryRaw: vi.fn(), $transaction: vi.fn(), ragQuotaWindow: { deleteMany: vi.fn() },
}));
vi.mock('../../src/prisma.js', () => ({ default: db }));
import { saveValidatedGroqCredential } from '../../src/services/ai-credentials.js';
import { chatWithCourseContext, ragUserAllowed } from '../../src/services/rag.service.js';
const input = { courseId: 'course', lessonId: 'lesson', principalId: 'pg-user', message: '¿Qué es una variable?' };
const fetchMock = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  for (const [key, value] of Object.entries({
    RAG_CREDENTIAL_MODE: 'user_required', AI_CREDENTIAL_KEY_CURRENT: 'V1',
    AI_CREDENTIAL_KEY_V1: Buffer.alloc(32, 4).toString('base64'),
    RAG_CHAT_MODEL: 'openai/gpt-oss-20b', AI_PROVIDER_ROUTE: 'cloudflare_gateway',
    CLOUDFLARE_ACCOUNT_ID: 'account', CLOUDFLARE_AI_GATEWAY_ID: 'gateway', CLOUDFLARE_AI_GATEWAY_TOKEN: 'gateway-token',
    GROQ_API_KEY: 'institutional-must-not-be-used', EMBEDDING_PROVIDER: 'local',
    EMBEDDING_API_URL: 'https://embedding.example', EMBEDDING_API_KEY: 'embed', RAG_CHAT_ENABLED: 'true',
  })) vi.stubEnv(key, value);
  db.credencialIa.findUnique.mockResolvedValue(null);
  db.credencialIa.upsert.mockImplementation(async ({ create }) => { db.credencialIa.findUnique.mockResolvedValue(create); return create; });
  db.credencialIa.updateMany.mockResolvedValue({ count: 1 });
  db.ragQuotaWindow.deleteMany.mockResolvedValue({ count: 0 });
  db.$transaction.mockImplementation((callback) => callback({ $queryRaw: vi.fn().mockResolvedValue([{ count: 1 }]) }));
  db.$queryRaw.mockResolvedValue([{ id: 'chunk', contenido: 'Una variable almacena un valor.', lessonId: 'lesson', lessonTitle: 'Variables', moduleTitle: 'Fundamentos', similarity: 0.9 }]);
  fetchMock.mockReset().mockImplementation(async (url) => {
    if (url.endsWith('/models')) return { ok: true, json: async () => ({ data: [{ id: 'openai/gpt-oss-20b' }] }) };
    if (url.includes('embedding.example')) return { ok: true, json: async () => ({ data: [{ embedding: Array(768).fill(0.1) }] }) };
    return { ok: true, json: async () => ({ choices: [{ message: { content: 'Una variable almacena un valor. [1]' } }] }) };
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('chat with personal Groq key', () => {
  it('requires saved credential before embeddings and never falls back', async () => {
    await expect(chatWithCourseContext(input)).rejects.toMatchObject({ status: 409 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });
  it('uses personal key, fixed budget and disables payload logging at gateway', async () => {
    await saveValidatedGroqCredential('pg-user', 'gsk_personal');
    fetchMock.mockClear();
    const result = await chatWithCourseContext(input);
    expect(result.answer).toContain('[1]');
    const [url, request] = fetchMock.mock.calls.find(([url]) => url.includes('gateway.ai.cloudflare.com'));
    expect(url).toBe('https://gateway.ai.cloudflare.com/v1/account/gateway/groq/chat/completions');
    expect(request.headers).toMatchObject({ Authorization: 'Bearer gsk_personal', 'cf-aig-authorization': 'Bearer gateway-token', 'cf-aig-collect-log-payload': 'false' });
    expect(JSON.parse(request.body)).toMatchObject({ model: 'openai/gpt-oss-20b', max_completion_tokens: 800, temperature: 0.2 });
    expect(JSON.parse(request.body)).not.toHaveProperty('tools');
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain('institutional-must-not-be-used');
  });
  it.each([401, 403])('does not invalidate a key on ambiguous gateway %s', async (status) => {
    await saveValidatedGroqCredential('pg-user', 'gsk_personal');
    const original = fetchMock.getMockImplementation();
    fetchMock.mockClear().mockImplementation((url) => url.includes('gateway.ai.cloudflare.com') ? { ok: false, status } : original(url));
    await expect(chatWithCourseContext(input)).rejects.toMatchObject({ status: 502 });
    expect(db.credencialIa.updateMany).not.toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'INVALID', invalidatedAt: expect.any(Date) } }));
    expect(fetchMock.mock.calls.filter(([url]) => url.includes('gateway.ai.cloudflare.com'))).toHaveLength(1);
  });
  it('invalidates only after Groq validation confirms revocation', async () => {
    await saveValidatedGroqCredential('pg-user', 'gsk_personal');
    fetchMock.mockClear().mockImplementation((url) => {
      if (url.includes('gateway.ai.cloudflare.com')) return { ok: false, status: 401 };
      if (url.endsWith('/models')) return { ok: false, status: 401 };
      if (url.includes('embedding.example')) return { ok: true, json: async () => ({ data: [{ embedding: Array(768).fill(0.1) }] }) };
      return { ok: true, json: async () => ({ choices: [{ message: { content: 'unused' } }] }) };
    });
    await expect(chatWithCourseContext(input)).rejects.toMatchObject({ status: 422 });
    expect(db.credencialIa.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'INVALID', invalidatedAt: expect.any(Date) } }));
  });
  it('durable quota denial prevents embedding and generation', async () => {
    await saveValidatedGroqCredential('pg-user', 'gsk_personal');
    fetchMock.mockClear();
    db.$transaction.mockImplementation((callback) => callback({ $queryRaw: vi.fn().mockResolvedValue([]) }));
    await expect(chatWithCourseContext(input)).rejects.toMatchObject({ status: 429 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('chat exposure gate blocks requests independently of indexing', async () => {
    vi.stubEnv('RAG_ENABLED', 'true'); vi.stubEnv('RAG_CHAT_ENABLED', 'false');
    await expect(chatWithCourseContext(input)).rejects.toMatchObject({ status: 503 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('fails closed in production when credential mode is missing or misspelled', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('RAG_CREDENTIAL_MODE', 'user_requred');
    await expect(chatWithCourseContext(input)).rejects.toMatchObject({ status: 503 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('rejects a configurable model that is not the fixed tutor model', async () => {
    vi.stubEnv('RAG_CHAT_MODEL', 'another-model');
    await expect(saveValidatedGroqCredential('pg-user', 'gsk_personal')).rejects.toMatchObject({ status: 503 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('course_access audience accepts already authorized Postgres users', () => {
    vi.stubEnv('RAG_AUDIENCE_MODE', 'course_access');
    expect(ragUserAllowed({ id: 'user', email: 'any@example.com' })).toBe(true);
    expect(ragUserAllowed(null)).toBe(false);
  });
});
