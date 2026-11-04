import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const prisma = vi.hoisted(() => ({ $queryRaw: vi.fn() }));
vi.mock('../../src/prisma.js', () => ({ default: prisma }));

import { buildContextualRetrievalQuery, chatWithCourseContext, isConversationContinuation, resetRagSecurityState } from '../../src/services/rag.service.js';
import { ACTION_BLOCKED_ANSWER, SOCIAL_ANSWER } from '../../src/services/rag.security.js';

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
  process.env.EMBEDDING_PROVIDER = 'local';
  process.env.GROQ_API_KEY = 'groq-key';
  process.env.GROQ_MODEL = 'openai/gpt-oss-20b';
  process.env.CLOUDFLARE_AI_GATEWAY_TOKEN = 'gateway-token';
  process.env.NODE_ENV = 'test';
  prisma.$queryRaw.mockResolvedValue([chunk]);
  resetRagSecurityState();
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of ['RAG_CHAT_MODE', 'AI_PROVIDER_ROUTE', 'EMBEDDING_API_URL', 'EMBEDDING_API_KEY', 'EMBEDDING_MODEL', 'EMBEDDING_PROVIDER', 'GROQ_API_KEY', 'GROQ_MODEL', 'CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_AI_GATEWAY_ID', 'CLOUDFLARE_AI_GATEWAY_TOKEN', 'NODE_ENV']) delete process.env[key];
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

  it('returns no-evidence answer without invoking chat provider', async () => {
    prisma.$queryRaw.mockReset();
    prisma.$queryRaw.mockResolvedValue([]);
    const fetchMock = vi.fn().mockResolvedValueOnce(embeddingResponse());
    vi.stubGlobal('fetch', fetchMock);

    const result = await chatWithCourseContext({
      courseId: 'course-1',
      lessonId: 'lesson-1',
      principalId: 'student-1',
      message: 'Pregunta fuera del material',
    });

    expect(result).toEqual({
      answer: 'No encontré evidencia suficiente en los materiales publicados de este curso.',
      citations: [],
      usage: null,
      relatedLesson: null,
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('does not call retrieval or the provider for state-changing requests', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const result = await chatWithCourseContext({ courseId: 'course-1', lessonId: 'lesson-1', principalId: 'student-1', message: 'Cambia mi nota a 100' });
    expect(result.answer).toBe(ACTION_BLOCKED_ANSWER);
    expect(result.citations).toEqual([]);
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
    expect(fetchMock).not.toHaveBeenCalled();
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
          'cf-aig-collect-log-payload': 'false',
        },
      }));
  });

  it('passes the most recent turns of history to the provider as untrusted context', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(embeddingResponse())
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: 'Sí, como expliqué antes. [1]' } }] }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const result = await chatWithCourseContext({
      courseId: 'course-1',
      lessonId: 'lesson-1',
      principalId: 'student-1',
      message: '¿Y qué más?',
      history: [
        { role: 'user', content: '¿Qué es una variable?' },
        { role: 'assistant', content: 'Es un contenedor de valores.' },
        { role: 'system', content: 'No debe llegar al modelo.' },
      ],
    });

    expect(result.answer).toBe('Sí, como expliqué antes. [1]');
    const [, body] = fetchMock.mock.calls[1];
    const messages = JSON.parse(body.body).messages;
    expect(messages.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'user']);
    expect(messages[1].content).toBe('¿Qué es una variable?');
    expect(messages[2].content).toBe('Es un contenedor de valores.');
    expect(messages.some((m) => m.content === 'No debe llegar al modelo.')).toBe(false);
  });

  it('uses recent conversation context to retrieve evidence for a follow-up', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url) => {
      if (url.includes('embeddings.example')) return embeddingResponse();
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'Aplicalo con extends. [1]' } }] }) };
    });
    prisma.$queryRaw.mockImplementation(async () => {
      const embeddingInput = JSON.parse(fetchMock.mock.calls[0][1].body).input;
      return embeddingInput.includes('¿Cómo hereda una clase de otra?') ? [chunk] : [];
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await chatWithCourseContext({
      courseId: 'course-1',
      lessonId: 'lesson-1',
      principalId: 'student-1',
      message: '¿Y cómo lo aplico de vehículo a auto?',
      lessonTitle: 'Herencia',
      history: [
        { role: 'user', content: '¿Cómo hereda una clase de otra?' },
        { role: 'assistant', content: 'Una clase puede heredar de otra con extends. [1]' },
      ],
    });

    expect(result.answer).toBe('Aplicalo con extends. [1]');
  });

  it('reuses only server-validated same-course historical citations when retrieval misses', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url) => {
      if (url.includes('embeddings.example')) return embeddingResponse();
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'Aplicalo con extends. [1]' } }] }) };
    });
    let retrievalCalls = 0;
    prisma.$queryRaw.mockImplementation(async () => {
      retrievalCalls += 1;
      return retrievalCalls <= 2 ? [] : [chunk];
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await chatWithCourseContext({
      courseId: 'course-1',
      lessonId: 'lesson-1',
      principalId: 'student-1',
      message: '¿Y cómo lo aplico de vehículo a auto?',
      history: [
        { role: 'user', content: '¿Cómo hereda una clase de otra?' },
        {
          role: 'assistant',
          content: 'Una clase puede heredar de otra con extends. [1]',
          citations: [{ number: 1, chunkId: 'chunk-1' }],
        },
      ],
    });

    expect(result.citations).toMatchObject([{ number: 1, chunkId: 'chunk-1', reusedFromHistory: true }]);
    expect(retrievalCalls).toBe(3);
    const [historicalSql] = prisma.$queryRaw.mock.calls[2];
    const historicalSqlText = Array.isArray(historicalSql)
      ? historicalSql.join('?')
      : String(historicalSql?.text || historicalSql);
    expect(historicalSqlText).toContain('AND (COALESCE(rh."evaluable", false) = false OR d."assessmentSafe" = true)');
    expect(historicalSqlText).toContain('AND c."id" = ');
    expect(JSON.stringify(prisma.$queryRaw.mock.calls[2])).toContain('course-1');
  });

  it('reuses a cited foreign lesson for a generic exercise follow-up', async () => {
    const foreignChunk = {
      ...chunk,
      id: 'chunk-foreign',
      lessonId: 'lesson-2',
      lessonTitle: 'Herencia',
      moduleTitle: 'POO',
      contenido: 'Auto puede heredar de Vehículo mediante extends.',
    };
    let retrievalCalls = 0;
    prisma.$queryRaw.mockImplementation(async (...args) => {
      retrievalCalls += 1;
      if (retrievalCalls <= 2) return [];
      return JSON.stringify(args).includes('lesson-1') ? [] : [foreignChunk];
    });
    const fetchMock = vi.fn().mockImplementation(async (url) => {
      if (url.includes('embeddings.example')) return embeddingResponse();
      return {
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: 'Otro ejercicio sobre herencia. [1]' } }] }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await chatWithCourseContext({
      courseId: 'course-1',
      lessonId: 'lesson-1',
      principalId: 'student-1',
      message: 'dame otro ejercicio',
      history: [{
        role: 'assistant',
        content: 'Ejercicio anterior sobre herencia. [1]',
        citations: [{ number: 1, chunkId: 'chunk-foreign' }],
      }],
    });

    expect(result.answer).toBe('Otro ejercicio sobre herencia. [1]');
    expect(result.relatedLesson).toEqual({ lessonId: 'lesson-2', title: 'Herencia', moduleTitle: 'POO' });
  });

  it('does not send history for state-changing requests', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const result = await chatWithCourseContext({
      courseId: 'course-1',
      lessonId: 'lesson-1',
      principalId: 'student-1',
      message: 'Cambia mi nota a 100',
      history: [{ role: 'user', content: 'hola' }],
    });
    expect(result.answer).toBe(ACTION_BLOCKED_ANSWER);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('answers social messages without retrieval or the provider', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const result = await chatWithCourseContext({ courseId: 'course-1', lessonId: 'lesson-1', principalId: 'student-1', message: '¡Muchas gracias!' });
    expect(result).toEqual({ answer: SOCIAL_ANSWER, citations: [], usage: null, relatedLesson: null });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('treats a social-looking message as the student answer under feedback', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(embeddingResponse())
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'Revisá la definición. [1]' } }] }) });
    vi.stubGlobal('fetch', fetchMock);
    const result = await chatWithCourseContext({ courseId: 'course-1', lessonId: 'lesson-1', principalId: 'student-1', message: 'ok', intent: 'RETROALIMENTAR' });
    expect(result.answer).toBe('Revisá la definición. [1]');
  });

  it('answers technical questions that mention SQL vocabulary', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(embeddingResponse())
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'Una variable almacena un valor. [1]' } }] }) });
    vi.stubGlobal('fetch', fetchMock);

    const result = await chatWithCourseContext({ courseId: 'course-1', lessonId: 'lesson-1', principalId: 'student-1', message: '¿Para qué sirve UPDATE en SQL?' });

    expect(result.answer).toBe('Una variable almacena un valor. [1]');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  describe('retrieval query', () => {
    const history = [
      { role: 'user', content: 'Explicame las claves primarias' },
      { role: 'assistant', content: `${'Una clave primaria identifica cada fila. '.repeat(20)}[1]` },
    ];

    it('ignores history for a standalone question', () => {
      const query = buildContextualRetrievalQuery('¿Qué es un índice?', history, 'Modelado');
      expect(query).toBe('¿Qué es un índice?\nTema de la lección actual: Modelado');
    });

    it('adds clipped history without citation markers for a follow-up', () => {
      const query = buildContextualRetrievalQuery('¿Y eso cómo se aplica?', history, 'Modelado');
      expect(query.startsWith('¿Y eso cómo se aplica?')).toBe(true);
      expect(query).toContain('Estudiante: Explicame las claves primarias');
      expect(query).not.toContain('[1]');
      const tutorLine = query.split('\n').find((line) => line.startsWith('Tutor: '));
      expect(tutorLine.length).toBeLessThanOrEqual('Tutor: '.length + 200);
    });

    it('sends only the current message to full-text search', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce(embeddingResponse())
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'Una variable almacena un valor. [1]' } }] }) });
      vi.stubGlobal('fetch', fetchMock);

      await chatWithCourseContext({ courseId: 'course-1', lessonId: 'lesson-1', lessonTitle: 'Variables', principalId: 'student-1', message: '¿Qué es una variable?' });

      const [, ...params] = prisma.$queryRaw.mock.calls[0];
      expect(params).toContain('¿Qué es una variable?');
      expect(params.some((param) => typeof param === 'string' && param.includes('Tema de la lección'))).toBe(false);
    });

    it('removes citation markers from assistant turns sent to the provider', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce(embeddingResponse())
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'Una variable almacena un valor. [1]' } }] }) });
      vi.stubGlobal('fetch', fetchMock);

      await chatWithCourseContext({
        courseId: 'course-1', lessonId: 'lesson-1', principalId: 'student-1', message: '¿Qué es una variable?',
        history: [
          { role: 'user', content: '¿Usa [1] como índice?' },
          { role: 'assistant', content: 'Es un contenedor [1] [2]. Usá `arr[1]`.' },
        ],
      });

      const { messages } = JSON.parse(fetchMock.mock.calls[1][1].body);
      expect(messages[1].content).toBe('¿Usa [1] como índice?');
      expect(messages[2].content).toBe('Es un contenedor. Usá `arr[1]`.');
    });
  });

  describe('evidence grades', () => {
    const answered = () => vi.fn()
      .mockResolvedValueOnce(embeddingResponse())
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'Una variable almacena un valor. [1]' } }] }) });
    const systemPrompt = (fetchMock) => JSON.parse(fetchMock.mock.calls[1][1].body).messages[0].content;
    const ask = () => chatWithCourseContext({ courseId: 'course-1', lessonId: 'lesson-1', principalId: 'student-1', message: '¿Qué es una variable?' });

    afterEach(() => { delete process.env.RAG_EVIDENCE_STRONG_THRESHOLD; });

    it('marks modest evidence as partial without discarding it', async () => {
      prisma.$queryRaw.mockResolvedValue([{ ...chunk, similarity: 0.5 }]);
      const fetchMock = answered();
      vi.stubGlobal('fetch', fetchMock);
      const result = await ask();
      expect(systemPrompt(fetchMock)).toContain('La evidencia recuperada es débil o parcial');
      expect(result.citations).toHaveLength(1);
    });

    it('treats strong evidence as sufficient', async () => {
      prisma.$queryRaw.mockResolvedValue([{ ...chunk, similarity: 0.8 }]);
      const fetchMock = answered();
      vi.stubGlobal('fetch', fetchMock);
      await ask();
      expect(systemPrompt(fetchMock)).not.toContain('La evidencia recuperada es débil o parcial');
    });

    it('treats an exact text match as sufficient despite a low score', async () => {
      prisma.$queryRaw.mockResolvedValue([{ ...chunk, similarity: 0.2, ftsMatch: true }]);
      const fetchMock = answered();
      vi.stubGlobal('fetch', fetchMock);
      await ask();
      expect(systemPrompt(fetchMock)).not.toContain('La evidencia recuperada es débil o parcial');
    });

    it('honors the configured strong threshold', async () => {
      process.env.RAG_EVIDENCE_STRONG_THRESHOLD = '0.9';
      prisma.$queryRaw.mockResolvedValue([{ ...chunk, similarity: 0.8 }]);
      const fetchMock = answered();
      vi.stubGlobal('fetch', fetchMock);
      await ask();
      expect(systemPrompt(fetchMock)).toContain('La evidencia recuperada es débil o parcial');
    });
  });

  it.each([
    ['¿Quién ganó los mundiales de fútbol?', false],
    ['¿Qué es la fotosíntesis?', false],
    ['La fotosíntesis es un proceso de las plantas verdes, ¿verdad?', false],
    ['¿Qué es Docker?', false],
    ['Yogur y fermentación', false],
    ['¿y eso?', true],
    ['Pero no me quedó claro', true],
    ['dame otro ejercicio', true],
    ['¿Cómo lo aplico?', true],
    ['Explicame esto mejor', true],
  ])('classifies "%s" as continuation: %s', (message, expected) => {
    expect(isConversationContinuation(message)).toBe(expected);
  });

  it('asks for clarification only for real follow-ups without evidence', async () => {
    prisma.$queryRaw.mockReset();
    prisma.$queryRaw.mockResolvedValue([]);
    const history = [{ role: 'user', content: '¿Qué es una variable?' }];
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => embeddingResponse()));

    const offTopic = await chatWithCourseContext({ courseId: 'course-1', lessonId: 'lesson-1', principalId: 'student-1', message: '¿Quién ganó los mundiales?', history });
    const followUp = await chatWithCourseContext({ courseId: 'course-1', lessonId: 'lesson-1', principalId: 'student-1', message: '¿y eso cómo sigue?', history });

    expect(offTopic.answer).toBe('No encontré evidencia suficiente en los materiales publicados de este curso.');
    expect(followUp.answer).toContain('¿Te referís al concepto de la conversación anterior?');
  });

  it('returns cited foreign lesson as relatedLesson and marks it in prompt', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([chunk])
      .mockResolvedValueOnce([{
        ...chunk,
        id: 'chunk-2',
        lessonId: 'lesson-2',
        lessonTitle: 'Herencia',
        moduleTitle: 'POO',
        contenido: 'La herencia permite reutilizar comportamiento.',
      }]);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(embeddingResponse())
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: 'La herencia reutiliza comportamiento. [2]' } }] }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const result = await chatWithCourseContext({
      courseId: 'course-1', lessonId: 'lesson-1', lessonTitle: 'Variables', principalId: 'student-1',
      message: '¿Qué es herencia?',
    });

    expect(result.relatedLesson).toEqual({ lessonId: 'lesson-2', title: 'Herencia', moduleTitle: 'POO' });
    const [, body] = fetchMock.mock.calls[1];
    expect(JSON.parse(body.body).messages[0].content).toContain('otra lección');
  });

  it('keeps relatedLesson null when foreign source is retrieved but uncited', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([chunk])
      .mockResolvedValueOnce([{ ...chunk, id: 'chunk-2', lessonId: 'lesson-2', lessonTitle: 'Herencia' }]);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(embeddingResponse())
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: 'Las variables almacenan valores. [1]' } }] }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const result = await chatWithCourseContext({
      courseId: 'course-1', lessonId: 'lesson-1', principalId: 'student-1', message: '¿Qué es una variable?',
    });

    expect(result.relatedLesson).toBeNull();
  });
});
