import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const prisma = vi.hoisted(() => ({
  curso: { findUnique: vi.fn() },
  progreso: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), upsert: vi.fn() },
  intento: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  $queryRaw: vi.fn(),
}));
vi.mock('../../src/prisma.js', () => ({ default: prisma }));

import {
  buildLearningContext, CHAT_INTENTS, chatWithCourseContext, DEFAULT_CHAT_INTENT,
  neutralLearningContext, resetRagSecurityState, resolveChatIntent,
} from '../../src/services/rag.service.js';

const course = { modulos: [
  { id: 'module-current', lecciones: [{ id: 'lesson-current' }, { id: 'lesson-next' }], evaluacion: { id: 'evaluation-current' } },
  { id: 'module-other', lecciones: [{ id: 'lesson-other' }], evaluacion: { id: 'evaluation-other' } },
] };

beforeEach(() => {
  vi.clearAllMocks();
  resetRagSecurityState();
  prisma.curso.findUnique.mockResolvedValue(course);
  prisma.progreso.findMany.mockResolvedValue([]);
  prisma.intento.findMany.mockResolvedValue([]);
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of ['RAG_CHAT_MODE', 'AI_PROVIDER_ROUTE', 'EMBEDDING_API_URL', 'EMBEDDING_API_KEY', 'EMBEDDING_MODEL', 'EMBEDDING_PROVIDER', 'GROQ_API_KEY', 'GROQ_MODEL', 'NODE_ENV']) delete process.env[key];
});

function configureChat(content = 'Respuesta respaldada. [1]') {
  Object.assign(process.env, {
    RAG_CHAT_MODE: 'direct', AI_PROVIDER_ROUTE: 'legacy', EMBEDDING_API_URL: 'https://embeddings.example',
    EMBEDDING_API_KEY: 'embedding-key', EMBEDDING_MODEL: 'google/embeddinggemma-300M', EMBEDDING_PROVIDER: 'local',
    GROQ_API_KEY: 'groq-key', GROQ_MODEL: 'test-chat', NODE_ENV: 'test',
  });
  prisma.$queryRaw.mockResolvedValue([{
    id: 'chunk-1', contenido: 'Las variables almacenan valores.', lessonId: 'lesson-current',
    lessonTitle: 'Variables', moduleTitle: 'Fundamentos', similarity: 0.8,
  }]);
  const fetchMock = vi.fn()
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: [{ embedding: Array.from({ length: 768 }, () => 0.01) }] }) })
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }) });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('RAG learning contract', () => {
  it('resolves supported intents and defaults omitted input to DUDA', () => {
    expect(DEFAULT_CHAT_INTENT).toBe('DUDA');
    expect(resolveChatIntent()).toBe('DUDA');
    expect(CHAT_INTENTS).toEqual(['DUDA', 'EXPLICAR', 'EJEMPLO', 'RESUMEN', 'PRACTICA', 'PISTA', 'RETROALIMENTAR']);
    expect(resolveChatIntent('desconocido')).toBeNull();
  });

  it('builds minimized states from current course, lesson and module attempt only', async () => {
    prisma.progreso.findMany.mockResolvedValue([
      { leccionId: 'lesson-current', completada: true }, { leccionId: 'lesson-next', completada: false }, { leccionId: 'lesson-other', completada: true },
    ]);
    prisma.intento.findMany.mockResolvedValue([{ aprobado: false }]);
    await expect(buildLearningContext({ courseId: 'course-1', lessonId: 'lesson-current', usuarioId: 'postgres-user-1' })).resolves.toEqual({
      lessonState: 'COMPLETADA', courseProgress: { completedLessons: 2, totalLessons: 3 },
      moduleProgress: { completedLessons: 1, totalLessons: 2 }, performance: 'NECESITA_REFUERZO',
    });
    expect(prisma.progreso.findMany).toHaveBeenCalledWith({
      where: { usuarioId: 'postgres-user-1', leccionId: { in: ['lesson-current', 'lesson-next', 'lesson-other'] } },
      select: { leccionId: true, completada: true },
    });
    expect(prisma.intento.findMany).toHaveBeenCalledWith({
      where: { usuarioId: 'postgres-user-1', evaluacionId: { in: ['evaluation-current'] } }, select: { aprobado: true },
    });
  });

  it('uses neutral context after optional context failure and logs no chat text', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const chatText = 'respuesta privada que no debe aparecer en logs';
    prisma.progreso.findMany.mockRejectedValue(new Error(chatText));
    await expect(buildLearningContext({ courseId: 'course-1', lessonId: 'lesson-current', usuarioId: 'postgres-user-1' }))
      .resolves.toEqual(neutralLearningContext());
    expect(warning).toHaveBeenCalledWith('RAG security event', expect.objectContaining({ type: 'learning_context_load_failed' }));
    expect(warning.mock.calls.flat().join(' ')).not.toContain(chatText);
  });

  it('adapts prompt by intent and sends only aggregate learning metadata', async () => {
    const fetchMock = configureChat('Pensá en un contenedor. [1]');
    await chatWithCourseContext({
      courseId: 'course-1', lessonId: 'lesson-current', principalId: 'postgres-user-1', message: 'Dame una pista', intent: 'PISTA',
      learningContext: { lessonState: 'EN_CURSO', courseProgress: { completedLessons: 1, totalLessons: 3 }, moduleProgress: { completedLessons: 1, totalLessons: 2 }, performance: 'NECESITA_REFUERZO', nombre: 'Nombre privado', email: 'private@example.com', neoId: 'neo-private', notas: 'nota privada' },
    });
    const systemPrompt = JSON.parse(fetchMock.mock.calls[1][1].body).messages[0].content;
    expect(systemPrompt).toContain('INTENCIÓN PEDAGÓGICA: PISTA');
    expect(systemPrompt).toContain('No entregues solución completa');
    expect(systemPrompt).toContain('"lessonState":"EN_CURSO"');
    expect(systemPrompt).toContain('"performance":"NECESITA_REFUERZO"');
    for (const privateValue of ['Nombre privado', 'private@example.com', 'neo-private', 'nota privada']) expect(systemPrompt).not.toContain(privateValue);
  });

  it.each([
    ['NECESITA_REFUERZO', 'Priorizá pasos pequeños'],
    ['LOGRADO', 'Podés aumentar moderadamente la dificultad'],
  ])('adds explicit adaptation guidance for %s', async (performance, expectedRule) => {
    const fetchMock = configureChat();
    await chatWithCourseContext({
      courseId: 'course-1', lessonId: 'lesson-current', principalId: 'postgres-user-1', message: 'Ayudame con variables', intent: 'EXPLICAR',
      learningContext: { ...neutralLearningContext(), performance },
    });
    const systemPrompt = JSON.parse(fetchMock.mock.calls[1][1].body).messages[0].content;
    expect(systemPrompt).toContain(`ADAPTACIÓN SEGÚN DESEMPEÑO: ${expectedRule}`);
  });

  it.each([
    ['DUDA', 'Respondé la pregunta concreta'], ['EXPLICAR', 'Explicá en pasos breves'],
    ['PRACTICA', 'No muestres solución, clave'], ['RETROALIMENTAR', 'No asignes nota ni crees intento'],
  ])('includes formative contract for %s', async (intent, expectedRule) => {
    const fetchMock = configureChat();
    await chatWithCourseContext({ courseId: 'course-1', lessonId: 'lesson-current', principalId: 'postgres-user-1', message: 'Ayudame con variables', intent, learningContext: neutralLearningContext() });
    const systemPrompt = JSON.parse(fetchMock.mock.calls[1][1].body).messages[0].content;
    expect(systemPrompt).toContain(`INTENCIÓN PEDAGÓGICA: ${intent}`);
    expect(systemPrompt).toContain(expectedRule);
    expect(prisma.progreso.findMany).not.toHaveBeenCalled();
    expect(prisma.intento.findMany).not.toHaveBeenCalled();
    expect(prisma.progreso.create).not.toHaveBeenCalled();
    expect(prisma.progreso.update).not.toHaveBeenCalled();
    expect(prisma.progreso.upsert).not.toHaveBeenCalled();
    expect(prisma.intento.create).not.toHaveBeenCalled();
    expect(prisma.intento.update).not.toHaveBeenCalled();
  });
});
