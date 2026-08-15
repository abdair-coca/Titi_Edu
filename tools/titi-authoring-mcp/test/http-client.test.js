import assert from 'node:assert/strict';
import test from 'node:test';
import { createHttpClient } from '../src/http-client.js';
import { TitiApiError } from '../src/errors.js';
import { startFakeApi } from '../test-support/helpers.js';

test('sends Authorization but redacts token-bearing backend error data', async (context) => {
  const secret = 'titi_svc_deadbeef_SUPER_SECRET';
  let receivedAuthorization;
  const api = await startFakeApi((request, response) => {
    receivedAuthorization = request.headers.authorization;
    response.writeHead(403, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ success: false, message: 'No autorizado', data: { token: secret, reason: 'scope' } }));
  });
  context.after(api.close);
  const client = createHttpClient({ baseUrl: api.baseUrl, tokenProvider: () => secret });
  await assert.rejects(
    client.request({ path: '/api/authoring/categories' }),
    (error) => {
      assert.equal(receivedAuthorization, `Bearer ${secret}`);
      assert.equal(error.status, 403);
      assert.equal(error.data.token, '[redacted]');
      assert.doesNotMatch(JSON.stringify(error.toSafeObject()), new RegExp(secret));
      return true;
    },
  );
});

test('maps backend status, message, and safe data', async (context) => {
  const api = await startFakeApi((_request, response) => {
    response.writeHead(412, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ success: false, message: 'La vista previa quedó obsoleta', data: { currentFingerprint: 'abc' } }));
  });
  context.after(api.close);
  const client = createHttpClient({ baseUrl: api.baseUrl, tokenProvider: () => 'test-token' });
  await assert.rejects(client.request({ method: 'POST', path: '/publish', body: {} }), (error) => {
    assert.equal(error.status, 412);
    assert.equal(error.message, 'La vista previa quedó obsoleta');
    assert.deepEqual(error.data, { currentFingerprint: 'abc' });
    return true;
  });
});

test('write timeout does not retry and preserves idempotency key', async () => {
  let calls = 0;
  const fetchImpl = async (_url, options) => {
    calls += 1;
    await new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))));
  };
  const key = 'c0a8012e-0000-4000-8000-000000000001';
  const client = createHttpClient({ baseUrl: 'http://example.test', tokenProvider: () => 'test-token', timeoutMs: 10, fetchImpl });
  await assert.rejects(
    client.request({ method: 'POST', path: '/write', body: {}, idempotencyKey: key, safeRead: false }),
    (error) => {
      assert.equal(error.code, 'TIMEOUT');
      assert.equal(error.idempotencyKey, key);
      assert.equal(error.toSafeObject().idempotencyKey, key);
      return true;
    },
  );
  assert.equal(calls, 1);
});

test('invalid success envelopes fail closed', async (context) => {
  const api = await startFakeApi((_request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ data: { categories: [] } }));
  });
  context.after(api.close);
  const client = createHttpClient({ baseUrl: api.baseUrl, tokenProvider: () => 'test-token' });
  await assert.rejects(client.request({ path: '/bad' }), (error) => error instanceof TitiApiError && error.code === 'INVALID_API_RESPONSE');
});
