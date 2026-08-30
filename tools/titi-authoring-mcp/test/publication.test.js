import assert from 'node:assert/strict';
import test from 'node:test';
import { createToolDefinitions } from '../src/tools.js';

const fingerprint = 'a'.repeat(64);

test('publish schemas require preview phrase, token, and fingerprint', () => {
  const definitions = createToolDefinitions({ request: async () => ({ data: {} }) });
  for (const name of ['publish_course', 'publish_module']) {
    const definition = definitions.find((entry) => entry.name === name);
    assert.equal(definition.inputSchema.safeParse({ resourceId: 'r1' }).success, false);
    assert.equal(definition.inputSchema.safeParse({
      resourceId: 'r1', expectedFingerprint: fingerprint,
      confirmationToken: 'signed-preview-token-value', phrase: 'PUBLICAR MODULO r1',
    }).success, true);
  }
});

test('unpublish schema requires signed preview phrase, token, and fingerprint', () => {
  const definition = createToolDefinitions({ request: async () => ({ data: {} }) })
    .find((entry) => entry.name === 'unpublish_module');
  assert.equal(definition.inputSchema.safeParse({ moduleId: 'm1', expectedFingerprint: fingerprint }).success, false);
  assert.equal(definition.inputSchema.safeParse({
    moduleId: 'm1', expectedFingerprint: fingerprint,
    confirmationToken: 'signed-preview-token-value', phrase: 'DESPUBLICAR MODULO m1',
  }).success, true);
});

test('publication preview fails closed when backend omits confirmation fields', async () => {
  const definitions = createToolDefinitions({ request: async () => ({ data: { fingerprint } }) });
  const preview = definitions.find((entry) => entry.name === 'preview_module_publication');
  const result = await preview.run({ moduleId: 'm1' });
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent.error, 'INVALID_API_RESPONSE');
});

test('preview and publish remain separate HTTP tool operations', () => {
  const definitions = createToolDefinitions({ request: async () => ({ data: {} }) });
  assert.notEqual(
    definitions.find((entry) => entry.name === 'preview_course_publication').run,
    definitions.find((entry) => entry.name === 'publish_course').run,
  );
});

test('active URL schemas require HTTPS, safe media, and allowlisted video hosts', () => {
  const definitions = createToolDefinitions({ request: async () => ({ data: {} }) });
  const course = definitions.find((entry) => entry.name === 'create_course_draft').inputSchema;
  const baseCourse = { titulo: 'Course', descripcion: 'Description', nivel: 'basic', categoriaId: 'cat' };
  assert.equal(course.safeParse({ ...baseCourse, portadaUrl: 'http://example.com/cover.png' }).success, false);
  assert.equal(course.safeParse({ ...baseCourse, portadaUrl: 'https://example.com/cover.svg' }).success, false);
  assert.equal(course.safeParse({ ...baseCourse, portadaUrl: 'https://example.com/cover.png' }).success, true);

  const lesson = definitions.find((entry) => entry.name === 'create_lesson_draft').inputSchema;
  const baseLesson = { moduleId: 'm1', expectedFingerprint: fingerprint, titulo: 'Lesson', contenido: 'Body', orden: 1 };
  assert.equal(lesson.safeParse({ ...baseLesson, videoUrl: 'https://evil.example/embed/1' }).success, false);
  assert.equal(lesson.safeParse({ ...baseLesson, videoUrl: 'https://www.youtube.com/watch?v=abc' }).success, true);
});

test('upsert_lesson_html requires intentosMax when evaluable and rejects it otherwise', () => {
  const definitions = createToolDefinitions({ request: async () => ({ data: {} }) });
  const html = definitions.find((entry) => entry.name === 'upsert_lesson_html').inputSchema;
  const base = { lessonId: 'lesson-1', expectedFingerprint: fingerprint, html: '<html><body>Hola</body></html>' };
  assert.equal(html.safeParse(base).success, true);
  assert.equal(html.safeParse({ ...base, evaluable: true }).success, false);
  assert.equal(html.safeParse({ ...base, evaluable: true, intentosMax: 3 }).success, true);
  assert.equal(html.safeParse({ ...base, evaluable: true, intentosMax: 11 }).success, false);
  assert.equal(html.safeParse({ ...base, evaluable: false, intentosMax: 3 }).success, false);
});

test('deadline schemas accept UTC or null and reject invalid values', () => {
  const definitions = createToolDefinitions({ request: async () => ({ data: {} }) });
  const html = definitions.find((entry) => entry.name === 'upsert_lesson_html').inputSchema;
  const quiz = definitions.find((entry) => entry.name === 'upsert_quiz_draft').inputSchema;
  const validHtml = {
    lessonId: 'lesson-1', expectedFingerprint: fingerprint, html: '<html><body>Hola</body></html>',
    evaluable: true, intentosMax: 3,
  };
  assert.equal(html.safeParse({ ...validHtml, fechaLimite: '2030-01-01T00:00:00.000Z' }).success, true);
  assert.equal(html.safeParse({ ...validHtml, fechaLimite: null }).success, true);
  assert.equal(html.safeParse({ ...validHtml, fechaLimite: 'mañana' }).success, false);
  assert.equal(html.safeParse({ ...validHtml, evaluable: false, intentosMax: undefined, fechaLimite: '2030-01-01T00:00:00.000Z' }).success, false);
  assert.equal(quiz.safeParse({
    moduleId: 'module-1', expectedFingerprint: fingerprint, titulo: 'Quiz',
    questions: [{ texto: 'Q', tipo: 'OPCION_MULTIPLE', options: [{ texto: 'A', esCorrecta: true }] }],
    fechaLimite: null,
  }).success, true);
});
