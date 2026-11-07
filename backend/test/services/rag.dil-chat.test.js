import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const prisma = vi.hoisted(() => ({ $queryRaw: vi.fn(), evaluacion: { findMany: vi.fn() } }));
vi.mock('../../src/prisma.js', () => ({ default: prisma }));

import { chatWithCourseContext, resetRagSecurityState } from '../../src/services/rag.service.js';
import { ASSESSMENT_GUIDANCE_ANSWER } from '../../src/services/rag.assessment.js';
import { NO_EVIDENCE_ANSWER } from '../../src/services/rag.security.js';

const chunk = {
  id: 'chunk-1',
  contenido: 'Una variable almacena un valor que el programa puede reasignar.',
  lessonId: 'lesson-1',
  lessonTitle: 'Variables',
  moduleTitle: 'Fundamentos',
  similarity: 0.8,
};
const ENV_KEYS = ['RAG_CHAT_MODE', 'AI_PROVIDER_ROUTE', 'EMBEDDING_API_URL', 'EMBEDDING_API_KEY', 'EMBEDDING_MODEL', 'EMBEDDING_PROVIDER', 'GROQ_API_KEY', 'GROQ_MODEL', 'NODE_ENV', 'RAG_DIL_ENABLED'];
const input = { courseId: 'course-1', lessonId: 'lesson-1', principalId: 'student-1', message: '¿Qué es una variable?' };

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(process.env, {
    RAG_CHAT_MODE: 'direct',
    AI_PROVIDER_ROUTE: 'legacy',
    EMBEDDING_API_URL: 'https://embeddings.example',
    EMBEDDING_API_KEY: 'embedding-key',
    EMBEDDING_MODEL: 'google/embeddinggemma-300M',
    EMBEDDING_PROVIDER: 'local',
    GROQ_API_KEY: 'groq-key',
    GROQ_MODEL: 'openai/gpt-oss-20b',
    NODE_ENV: 'test',
  });
  prisma.$queryRaw.mockResolvedValue([chunk]);
  prisma.evaluacion.findMany.mockResolvedValue([]);
  resetRagSecurityState();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  for (const key of ENV_KEYS) delete process.env[key];
});

function stubProvider(content) {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: [{ embedding: Array.from({ length: 768 }, () => 0.01) }] }) })
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }) });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function chatBody(fetchMock) {
  return JSON.parse(fetchMock.mock.calls[1][1].body);
}

function tree(...nodes) {
  return JSON.stringify({ version: 1, nodes });
}

const textNode = { c: 'Text', text: 'Una variable almacena un valor que se puede reasignar [1].' };

describe('tutor answers with DIL', () => {
  it('keeps the Markdown request and answer when the flag is off', async () => {
    const fetchMock = stubProvider('Una variable almacena un valor [1].');
    const result = await chatWithCourseContext(input);
    const body = chatBody(fetchMock);
    expect(body).not.toHaveProperty('response_format');
    expect(body.max_completion_tokens).toBe(3200);
    expect(body.messages[0].content).toContain('Escribí todo el código entre backticks.');
    expect(result).not.toHaveProperty('dil');
    expect(result.answer).toBe('Una variable almacena un valor [1].');
  });

  it('asks for the strict schema and returns the tree with its canonical text', async () => {
    process.env.RAG_DIL_ENABLED = 'true';
    const steps = { c: 'Steps', title: null, items: ['Declarás la variable [1]', 'Le asignás un valor [1]'] };
    const fetchMock = stubProvider(tree(textNode, steps));
    const result = await chatWithCourseContext({ ...input, intent: 'EXPLICAR' });
    const body = chatBody(fetchMock);
    expect(body.response_format).toMatchObject({ type: 'json_schema', json_schema: { name: 'tutor_dil', strict: true } });
    expect(body.messages[0].content).toContain('FORMATO DE RESPUESTA (DIL v1)');
    expect(result.dil).toEqual({ version: 1, nodes: [textNode, steps] });
    expect(result.answer).toBe(`${textNode.text}\n\n1. Declarás la variable [1]\n2. Le asignás un valor [1]`);
    expect(result.citations.map((citation) => citation.number)).toEqual([1]);
  });

  it('drops a quiz outside practice and reports it without content', async () => {
    process.env.RAG_DIL_ENABLED = 'true';
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    stubProvider(tree(textNode, { c: 'Quiz', question: '¿Qué guarda? [1]', options: ['Un valor', 'Nada'] }));
    const result = await chatWithCourseContext(input);
    expect(result.dil.nodes).toEqual([textNode]);
    expect(warn).toHaveBeenCalledWith('RAG security event', expect.objectContaining({ type: 'dil_nodes_dropped', count: '1', reason: 'quiz_not_allowed' }));
    expect(JSON.stringify(warn.mock.calls)).not.toContain('Un valor');
  });

  it('rejects a tree that cites a source outside the context', async () => {
    process.env.RAG_DIL_ENABLED = 'true';
    stubProvider(tree({ c: 'Text', text: 'Dato inventado [9].' }));
    const result = await chatWithCourseContext(input);
    expect(result).toEqual({ answer: NO_EVIDENCE_ANSWER, citations: [], usage: null, relatedLesson: null });
  });

  it.each([
    ['a tree cut by the token limit', '{"version":1,"nodes":[{"c":"Text","text":"Una var'],
    ['a tree without valid nodes', tree({ c: 'Video', url: 'https://x' })],
  ])('treats %s as an empty answer', async (_, content) => {
    process.env.RAG_DIL_ENABLED = 'true';
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    stubProvider(content);
    await expect(chatWithCourseContext(input)).rejects.toMatchObject({ status: 502 });
  });

  describe('with a pending assessment question', () => {
    const question = '¿Qué almacena una variable dentro de un programa?';

    beforeEach(() => {
      process.env.RAG_DIL_ENABLED = 'true';
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      prisma.evaluacion.findMany.mockResolvedValue([
        { intentos: [], preguntas: [{ texto: question, opciones: [{ texto: 'Un valor reasignable' }] }] },
      ]);
    });

    it('withholds a tree whose text reveals the correct option', async () => {
      stubProvider(tree({ c: 'Text', text: 'Almacena un valor reasignable, como dice el material [1].' }));
      const result = await chatWithCourseContext({ ...input, message: question });
      expect(result.answer).toBe(ASSESSMENT_GUIDANCE_ANSWER);
      expect(result).not.toHaveProperty('dil');
    });

    it('never offers the correct option as a quiz choice', async () => {
      stubProvider(tree({ c: 'Quiz', question: '¿Qué almacena? [1]', options: ['Un valor reasignable', 'Una pantalla'] }));
      const result = await chatWithCourseContext({ ...input, message: question, intent: 'PRACTICA' });
      expect(result.answer).toBe(ASSESSMENT_GUIDANCE_ANSWER);
      expect(result).not.toHaveProperty('dil');
    });
  });
});
