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
