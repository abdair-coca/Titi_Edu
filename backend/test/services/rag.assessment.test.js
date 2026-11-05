import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const prisma = vi.hoisted(() => ({
  evaluacion: { findMany: vi.fn() },
  curso: { findUnique: vi.fn() },
  progreso: { findMany: vi.fn() },
  intento: { findMany: vi.fn() },
  $queryRaw: vi.fn(),
}));
vi.mock('../../src/prisma.js', () => ({ default: prisma }));

import {
  ASSESSMENT_GUIDANCE_ANSWER,
  answerRevealsOption,
  findPendingAssessmentMatch,
  messageMatchesQuestion,
} from '../../src/services/rag.assessment.js';
import { chatWithCourseContext, neutralLearningContext, resetRagSecurityState } from '../../src/services/rag.service.js';

const QUESTION = '¿Qué organelo de la célula produce la mayor parte del ATP?';
const pending = [{ intentos: [], preguntas: [{ texto: QUESTION, opciones: [{ texto: 'La mitocondria' }] }] }];
const approved = [{ intentos: [{ id: 'i1' }], preguntas: pending[0].preguntas }];

describe('messageMatchesQuestion', () => {
  it.each([
    [QUESTION],
    ['que organelo de la celula produce la mayor parte del atp'],
    [`Ayudame con esta: ${QUESTION} Opciones: mitocondria o ribosoma`],
    ['¿Qué organelo de la célula produce mayor parte de ATP?'],
  ])('matches %s', (message) => {
    expect(messageMatchesQuestion(message, QUESTION)).toBe(true);
  });

  it.each([
    ['¿Qué hace la mitocondria?'],
    ['Explicame la célula'],
    ['¿Cómo se produce energía en los organismos vivos?'],
  ])('does not match %s', (message) => {
    expect(messageMatchesQuestion(message, QUESTION)).toBe(false);
  });

  it('does not match on a question too short to compare by terms', () => {
    expect(messageMatchesQuestion('¿Qué es ATP?', '¿ATP?')).toBe(false);
  });
});

describe('answerRevealsOption', () => {
  it('finds the option regardless of accents and case', () => {
    expect(answerRevealsOption('Es la MITOCONDRIA [1].', ['La mitocondria'])).toBe(true);
    expect(answerRevealsOption('La respiración celular [1].', ['respiración  celular'])).toBe(true);
  });

  it('does not match inside another word', () => {
    expect(answerRevealsOption('Revisá la mitocondrial [1].', ['mitocondria'])).toBe(false);
  });

  it('ignores options too short to compare', () => {
    expect(answerRevealsOption('Sí, pensá en la energía [1].', ['Sí', 'A'])).toBe(false);
  });
});

describe('findPendingAssessmentMatch', () => {
  beforeEach(() => vi.clearAllMocks());

  const search = (message) => findPendingAssessmentMatch({ courseId: 'course-1', usuarioId: 'u1', candidates: [message] });

  it('queries module and final evaluations of the course for this student only', async () => {
    prisma.evaluacion.findMany.mockResolvedValue([]);
    await search(QUESTION);
    expect(prisma.evaluacion.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { OR: [{ cursoId: 'course-1' }, { modulo: { cursoId: 'course-1' } }] },
      select: expect.objectContaining({ intentos: expect.objectContaining({ where: { usuarioId: 'u1', aprobado: true } }) }),
    }));
  });

  it('returns the correct options of a pending question', async () => {
    prisma.evaluacion.findMany.mockResolvedValue(pending);
    await expect(search(QUESTION)).resolves.toEqual({ correctOptions: ['La mitocondria'] });
  });

  it('skips evaluations the student already approved', async () => {
    prisma.evaluacion.findMany.mockResolvedValue(approved);
    await expect(search(QUESTION)).resolves.toBeNull();
  });

  it('continues without protection when the query fails and logs no text', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    prisma.evaluacion.findMany.mockRejectedValue(new Error(QUESTION));
    await expect(search(QUESTION)).resolves.toBeNull();
    expect(warning).toHaveBeenCalledWith('RAG security event', expect.objectContaining({ type: 'assessment_guard_failed' }));
    expect(JSON.stringify(warning.mock.calls)).not.toContain('organelo');
    warning.mockRestore();
  });
});

describe('chat protection for pending evaluations', () => {
  const chunkRow = {
    id: 'chunk-1', contenido: 'La mitocondria produce energía celular en forma de ATP.', lessonId: 'lesson-1',
    lessonTitle: 'Célula', moduleTitle: 'Biología', similarity: 0.8,
  };

  function provider(content) {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: [{ embedding: Array.from({ length: 768 }, () => 0.01) }] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }) });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  const ask = (overrides = {}) => chatWithCourseContext({
    courseId: 'course-1', lessonId: 'lesson-1', principalId: 'u1', message: QUESTION,
    learningContext: neutralLearningContext(), ...overrides,
  });
  const prompt = (fetchMock) => JSON.parse(fetchMock.mock.calls[1][1].body).messages[0].content;

  beforeEach(() => {
    vi.clearAllMocks();
    resetRagSecurityState();
    Object.assign(process.env, {
      RAG_CHAT_MODE: 'direct', AI_PROVIDER_ROUTE: 'legacy', EMBEDDING_API_URL: 'https://embeddings.example',
      EMBEDDING_API_KEY: 'embedding-key', EMBEDDING_MODEL: 'google/embeddinggemma-300M', EMBEDDING_PROVIDER: 'local',
      GROQ_API_KEY: 'groq-key', GROQ_MODEL: 'openai/gpt-oss-20b', NODE_ENV: 'test',
    });
    prisma.$queryRaw.mockResolvedValue([chunkRow]);
    prisma.evaluacion.findMany.mockResolvedValue(pending);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    for (const key of ['RAG_CHAT_MODE', 'AI_PROVIDER_ROUTE', 'EMBEDDING_API_URL', 'EMBEDDING_API_KEY', 'EMBEDDING_MODEL', 'EMBEDDING_PROVIDER', 'GROQ_API_KEY', 'GROQ_MODEL']) delete process.env[key];
  });

  it('forces a hint whatever intent the client asks for and never sends options', async () => {
    const fetchMock = provider('Pensá en dónde se produce la energía celular. [1]');
    prisma.evaluacion.findMany.mockResolvedValue([{ intentos: [], preguntas: [{ texto: QUESTION, opciones: [{ texto: 'OPCION-SECRETA' }] }] }]);

    const result = await ask({ intent: 'DUDA' });

    expect(prompt(fetchMock)).toContain('INTENCIÓN PEDAGÓGICA: PISTA');
    expect(fetchMock.mock.calls[1][1].body).not.toContain('OPCION-SECRETA');
    expect(result.answer).toBe('Pensá en dónde se produce la energía celular. [1]');
  });

  it('replaces an answer that contains the correct option', async () => {
    provider('La mitocondria produce energía celular. [1]');
    const result = await ask();
    expect(result.answer).toBe(ASSESSMENT_GUIDANCE_ANSWER);
    expect(result.citations).toEqual([]);
  });

  it('gives the guidance instead of an error when the guarded answer comes back empty', async () => {
    provider('');
    const result = await ask();
    expect(result).toMatchObject({ answer: ASSESSMENT_GUIDANCE_ANSWER, citations: [] });
  });

  it('keeps the provider error for empty answers outside an evaluation', async () => {
    provider('');
    await expect(ask({ message: '¿Qué es una célula?' })).rejects.toMatchObject({ status: 502 });
  });

  it('does not suggest a code example that the model could copy into answers', async () => {
    const fetchMock = provider('La mitocondria produce energía celular. [1]');
    await ask({ message: '¿Qué es una célula?' });
    expect(prompt(fetchMock)).not.toContain('arr[0]');
  });

  it('checks the previous student turn for a follow-up', async () => {
    const fetchMock = provider('Pensá en la energía celular. [1]');
    await ask({ message: '¿y cuál es entonces?', history: [{ role: 'user', content: QUESTION }] });
    expect(prompt(fetchMock)).toContain('INTENCIÓN PEDAGÓGICA: PISTA');
  });

  it('explains freely once the evaluation is approved', async () => {
    prisma.evaluacion.findMany.mockResolvedValue(approved);
    const fetchMock = provider('La mitocondria produce energía celular. [1]');
    const result = await ask({ intent: 'EXPLICAR' });
    expect(prompt(fetchMock)).toContain('INTENCIÓN PEDAGÓGICA: EXPLICAR');
    expect(result.answer).toBe('La mitocondria produce energía celular. [1]');
  });

  it('exempts staff previews', async () => {
    const fetchMock = provider('La mitocondria produce energía celular. [1]');
    const result = await ask({ intent: 'DUDA', protectAssessments: false });
    expect(prisma.evaluacion.findMany).not.toHaveBeenCalled();
    expect(prompt(fetchMock)).toContain('INTENCIÓN PEDAGÓGICA: DUDA');
    expect(result.answer).toBe('La mitocondria produce energía celular. [1]');
  });

  it('keeps the requested intent for unrelated questions', async () => {
    const fetchMock = provider('La célula tiene organelos. [1]');
    await ask({ message: '¿Qué es una célula?', intent: 'RESUMEN' });
    expect(prompt(fetchMock)).toContain('INTENCIÓN PEDAGÓGICA: RESUMEN');
  });

  it('logs detection without any student or question text', async () => {
    provider('La mitocondria produce energía celular. [1]');
    await ask();
    const logged = JSON.stringify(console.warn.mock.calls);
    expect(logged).toContain('assessment_question_detected');
    expect(logged).toContain('assessment_answer_withheld');
    expect(logged).not.toContain('organelo');
    expect(logged).not.toContain('mitocondria');
  });
});
