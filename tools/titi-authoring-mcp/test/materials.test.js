import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createHttpClient } from '../src/http-client.js';
import { loadMaterialFile, MAX_MATERIAL_BYTES } from '../src/files.js';
import { createToolDefinitions } from '../src/tools.js';
import { readRequestBody, startFakeApi } from '../test-support/helpers.js';

async function tempDirectory(context) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'titi-mcp-test-'));
  context.after(() => fs.rm(directory, { recursive: true, force: true }));
  return directory;
}

test('rejects missing, directory, unsupported extension, and oversized material paths before reading', async (context) => {
  const directory = await tempDirectory(context);
  await assert.rejects(loadMaterialFile(path.join(directory, 'missing.pdf')), { code: 'INVALID_MATERIAL_PATH' });
  await assert.rejects(loadMaterialFile(directory), { code: 'INVALID_MATERIAL_PATH' });
  const executable = path.join(directory, 'payload.exe');
  await fs.writeFile(executable, 'not executable by MCP');
  await assert.rejects(loadMaterialFile(executable), { code: 'INVALID_MATERIAL_EXTENSION' });
  const large = path.join(directory, 'large.pdf');
  const handle = await fs.open(large, 'w');
  await handle.truncate(MAX_MATERIAL_BYTES + 1);
  await handle.close();
  await assert.rejects(loadMaterialFile(large), { code: 'MATERIAL_TOO_LARGE' });
});

test('attach_material sends native multipart with file and display name', async (context) => {
  const directory = await tempDirectory(context);
  const filePath = path.join(directory, 'notes.md');
  await fs.writeFile(filePath, '# Safe material\n', 'utf8');
  let contentType;
  let rawBody;
  const api = await startFakeApi(async (request, response) => {
    contentType = request.headers['content-type'];
    rawBody = await readRequestBody(request);
    response.writeHead(201, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ success: true, data: { material: { id: 'material-1' } } }));
  });
  context.after(api.close);
  const client = createHttpClient({ baseUrl: api.baseUrl, tokenProvider: () => 'test-token' });
  const definition = createToolDefinitions(client).find((entry) => entry.name === 'attach_material');
  const result = await definition.run({
    lessonId: 'lesson-1', filePath, nombre: 'Lecture notes',
    idempotencyKey: 'c0a8012e-0000-4000-8000-000000000002',
  });
  assert.equal(result.isError, undefined);
  assert.match(contentType, /^multipart\/form-data; boundary=/);
  assert.match(rawBody.toString('utf8'), /name="file"; filename="notes.md"/);
  assert.match(rawBody.toString('utf8'), /# Safe material/);
  assert.match(rawBody.toString('utf8'), /Lecture notes/);
});
