import assert from 'node:assert/strict';
import test from 'node:test';
import { createToolDefinitions } from '../src/tools.js';

const fingerprint = 'b'.repeat(64);
const confirmation = {
  fingerprint,
  confirmationToken: 'signed-publication-confirmation-token',
  phrase: 'PUBLICAR MODULO resource-1',
};

test('every non-multipart tool maps to the real /api/authoring endpoint', async () => {
  const calls = [];
  const client = {
    request: async (request) => {
      calls.push(request);
      return { data: request.path.endsWith('/preview-publication') ? confirmation : { ok: true } };
    },
  };
  const tools = new Map(createToolDefinitions(client).map((entry) => [entry.name, entry]));
  const cases = [
    ['list_categories', {}, 'GET', '/api/authoring/categories'],
    ['list_courses', {}, 'GET', '/api/authoring/courses'],
    ['get_course', { courseId: 'course-1' }, 'GET', '/api/authoring/courses/course-1'],
    ['create_course_draft', { titulo: 'Course', descripcion: 'Description', nivel: 'basic', categoriaId: 'cat-1' }, 'POST', '/api/authoring/courses'],
    ['update_course_draft', { courseId: 'course-1', expectedFingerprint: fingerprint, titulo: 'Changed' }, 'PUT', '/api/authoring/courses/course-1'],
    ['create_module_draft', { courseId: 'course-1', titulo: 'Module', orden: 1 }, 'POST', '/api/authoring/courses/course-1/modules'],
    ['update_module_draft', { moduleId: 'module-1', expectedFingerprint: fingerprint, titulo: 'Changed' }, 'PUT', '/api/authoring/modules/module-1'],
    ['create_lesson_draft', { moduleId: 'module-1', titulo: 'Lesson', contenido: 'Body', orden: 1 }, 'POST', '/api/authoring/modules/module-1/lessons'],
    ['update_lesson_draft', { lessonId: 'lesson-1', expectedFingerprint: fingerprint, contenido: 'Changed' }, 'PUT', '/api/authoring/lessons/lesson-1'],
    ['upsert_quiz_draft', { moduleId: 'module-1', expectedFingerprint: fingerprint, titulo: 'Quiz', questions: [{ texto: 'Q', tipo: 'OPCION_MULTIPLE', options: [{ texto: 'A', esCorrecta: true }] }] }, 'PUT', '/api/authoring/modules/module-1/quiz'],
    ['delete_draft_resource', { resourceType: 'material', resourceId: 'material-1', expectedFingerprint: fingerprint }, 'DELETE', '/api/authoring/materials/material-1'],
    ['preview_course_publication', { courseId: 'course-1' }, 'POST', '/api/authoring/courses/course-1/preview-publication'],
    ['publish_course', { resourceId: 'course-1', expectedFingerprint: fingerprint, confirmationToken: confirmation.confirmationToken, phrase: confirmation.phrase }, 'POST', '/api/authoring/courses/course-1/publish'],
    ['preview_module_publication', { moduleId: 'module-1' }, 'POST', '/api/authoring/modules/module-1/preview-publication'],
    ['publish_module', { resourceId: 'module-1', expectedFingerprint: fingerprint, confirmationToken: confirmation.confirmationToken, phrase: confirmation.phrase }, 'POST', '/api/authoring/modules/module-1/publish'],
    ['preview_module_unpublish', { moduleId: 'module-1' }, 'GET', '/api/authoring/modules/module-1'],
    ['unpublish_module', { moduleId: 'module-1', expectedFingerprint: fingerprint }, 'POST', '/api/authoring/modules/module-1/unpublish'],
    ['get_quiz_analytics', { evaluationId: 'evaluation-1' }, 'GET', '/api/authoring/evaluations/evaluation-1/analytics'],
  ];

  for (const [name, args, method, path] of cases) {
    const before = calls.length;
    const result = await tools.get(name).run(args);
    assert.equal(result.isError, undefined, name);
    assert.equal(calls.length, before + 1, name);
    assert.equal(calls.at(-1).method, method, name);
    assert.equal(calls.at(-1).path, path, name);
  }
  assert.match(calls.find((call) => call.method === 'DELETE').idempotencyKey, /^[0-9a-f-]{36}$/i);
});
