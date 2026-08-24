import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createGatewayServer } from '../src/app.js';

const servers = [];

async function start(options = {}) {
  const gateway = createGatewayServer({
    env: {
      AI_GATEWAY_TOKEN: 'gateway-test-token',
      AI_GATEWAY_USER_SALT: 'test-salt',
      GROQ_API_KEY: 'groq-secret',
      GROQ_MODEL: 'test-model',
      AI_GATEWAY_RATE_LIMIT_PER_MINUTE: '5',
      AI_GATEWAY_DAILY_QUOTA: '30',
      AI_GATEWAY_MAX_CONCURRENCY: '2',
      ...options.env,
    },
    fetchImpl: options.fetchImpl || (async () => new Response(JSON.stringify({ choices: [{ message: { content: 'ok [1]' } }] }), { status: 200 })),
  });
  await new Promise((resolve) => gateway.server.listen(0, '127.0.0.1', resolve));
  servers.push(gateway.server);
  return { gateway, url: `http://127.0.0.1:${gateway.server.address().port}` };
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve))));
});

describe('Titi AI gateway', () => {
  it('proxies only the allowed chat payload and keeps Groq server-side', async () => {
    let providerRequest;
    const { url } = await start({
      fetchImpl: async (providerUrl, request) => {
        providerRequest = { providerUrl, request };
        return new Response(JSON.stringify({ choices: [{ message: { content: 'Respuesta [1]' } }] }), { status: 200 });
      },
    });
    const response = await fetch(`${url}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer gateway-test-token',
        'X-Titi-Course-Id': 'course-1',
        'X-Titi-Principal-Id': 'student-1',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'ignored-by-gateway', temperature: 0.2, tools: [], messages: [{ role: 'user', content: 'hola' }] }),
    });
    assert.equal(response.status, 200);
    assert.equal(providerRequest.providerUrl, 'https://api.groq.com/openai/v1/chat/completions');
    const body = JSON.parse(providerRequest.request.body);
    assert.equal(body.model, 'test-model');
    assert.deepEqual(body.messages, [{ role: 'user', content: 'hola' }]);
    assert.equal(body.tools, undefined);
    assert.equal(providerRequest.request.headers.Authorization, 'Bearer groq-secret');
  });

  it('rejects unauthenticated requests and tools', async () => {
    const { url } = await start();
    const unauthorized = await fetch(`${url}/v1/chat/completions`, { method: 'POST', body: '{}' });
    assert.equal(unauthorized.status, 401);
    const tools = await fetch(`${url}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer gateway-test-token',
        'X-Titi-Course-Id': 'course-1',
        'X-Titi-Principal-Id': 'student-1',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tools: [{ type: 'function' }], messages: [{ role: 'user', content: 'hola' }] }),
    });
    assert.equal(tools.status, 400);
  });

  it('enforces quota per opaque principal', async () => {
    const { url } = await start({ env: { AI_GATEWAY_RATE_LIMIT_PER_MINUTE: '1' } });
    const request = () => fetch(`${url}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer gateway-test-token',
        'X-Titi-Course-Id': 'course-1',
        'X-Titi-Principal-Id': 'student-1',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hola' }] }),
    });
    assert.equal((await request()).status, 200);
    assert.equal((await request()).status, 429);
  });

  it('fails closed for production without a shared state store', () => {
    assert.throws(() => createGatewayServer({
      env: {
        NODE_ENV: 'production',
        AI_GATEWAY_TOKEN: 'gateway-test-token',
        GROQ_API_KEY: 'groq-secret',
        GROQ_MODEL: 'test-model',
      },
    }), /AI_GATEWAY_STATE_STORE=redis/);
  });
});
