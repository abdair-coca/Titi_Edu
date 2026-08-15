import assert from 'node:assert/strict';
import test from 'node:test';
import { TOOL_NAMES, createToolDefinitions, DESTRUCTIVE_WRITE_ANNOTATIONS, DRAFT_WRITE_ANNOTATIONS, READ_ANNOTATIONS } from '../src/tools.js';
import { SERVER_INSTRUCTIONS } from '../src/server.js';

const EXPECTED_NAMES = [
  'list_categories', 'list_courses', 'get_course', 'create_course_draft',
  'update_course_draft', 'create_module_draft', 'update_module_draft',
  'create_lesson_draft', 'update_lesson_draft', 'upsert_quiz_draft',
  'attach_material', 'delete_draft_resource', 'preview_course_publication',
  'publish_course', 'preview_module_publication', 'publish_module',
  'preview_module_unpublish', 'unpublish_module', 'get_quiz_analytics',
];

test('registry exposes exactly the requested tools with exact annotations', () => {
  assert.deepEqual(TOOL_NAMES, EXPECTED_NAMES);
  const definitions = createToolDefinitions({ request: async () => ({ data: {} }) });
  for (const definition of definitions) {
    const expected = ['list_categories', 'list_courses', 'get_course', 'preview_course_publication',
      'preview_module_publication', 'preview_module_unpublish', 'get_quiz_analytics'].includes(definition.name)
      ? READ_ANNOTATIONS
      : ['delete_draft_resource', 'unpublish_module'].includes(definition.name)
        ? DESTRUCTIVE_WRITE_ANNOTATIONS
        : DRAFT_WRITE_ANNOTATIONS;
    assert.deepEqual(definition.annotations, expected, definition.name);
  }
});

test('all input schemas reject unknown keys', () => {
  const definitions = createToolDefinitions({ request: async () => ({ data: {} }) });
  for (const definition of definitions) {
    const result = definition.inputSchema.safeParse({ unexpected: true });
    assert.equal(result.success, false, definition.name);
  }
});

test('server safety instructions are present in first 512 characters', () => {
  const first = SERVER_INSTRUCTIONS.slice(0, 512);
  assert.match(first, /Never publish without a recent separate preview/);
  assert.match(first, /explicit human approval/);
  assert.match(first, /Reuse the same idempotency key/);
  assert.match(first, /Never execute uploaded files/);
  assert.match(first, /Never reveal TITI_SERVICE_TOKEN/);
});
