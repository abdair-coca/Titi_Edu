import http from 'node:http';
import { createHash } from 'node:crypto';

const DEFAULT_LIMIT_PER_MINUTE = 5;
const DEFAULT_DAILY_QUOTA = 30;
const DEFAULT_MAX_BODY = 64 * 1024;
const DEFAULT_MAX_CONCURRENCY = 2;
const DEFAULT_TIMEOUT_MS = 30_000;
const CIRCUIT_FAILURE_THRESHOLD = 3;
const CIRCUIT_COOLDOWN_MS = 30_000;

function json(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function bearer(request) {
  const value = request.headers.authorization || '';
  return value.startsWith('Bearer ') ? value.slice(7) : '';
}

function hashPrincipal(value, salt) {
  return createHash('sha256').update(`${salt}:${value}`).digest('hex').slice(0, 16);
}

function readRequest(request, maxBody) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let body = '';
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBody) {
        reject(Object.assign(new Error('request_too_large'), { status: 413 }));
        request.destroy();
        return;
      }
      body += chunk;
    });
    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(Object.assign(new Error('invalid_json'), { status: 400 }));
      }
    });
    request.on('error', reject);
  });
}

function createState(now) {
  return {
    now,
    inFlight: 0,
    minute: new Map(),
    daily: new Map(),
    failures: 0,
    circuitOpenUntil: 0,
    metrics: { requests: 0, success: 0, rejected: 0, upstreamErrors: 0, timeouts: 0 },
  };
}

function consumeQuota(state, principal, config) {
  const current = state.now();
  const minuteKey = Math.floor(current / 60_000);
  const dayKey = new Date(current).toISOString().slice(0, 10);
  const minute = state.minute.get(principal);
  const daily = state.daily.get(principal);
  const minuteValue = minute?.key === minuteKey ? minute.count : 0;
  const dailyValue = daily?.key === dayKey ? daily.count : 0;
  if (minuteValue >= config.limitPerMinute) return 'minute_limit';
  if (dailyValue >= config.dailyQuota) return 'daily_quota';
  state.minute.set(principal, { key: minuteKey, count: minuteValue + 1 });
  state.daily.set(principal, { key: dayKey, count: dailyValue + 1 });
  return null;
}

function validateRequest(body) {
  if (!body || typeof body !== 'object' || !Array.isArray(body.messages) || !body.messages.length) return 'messages_required';
  if (body.tools?.length) return 'tools_not_allowed';
  if (body.messages.some((message) => !['system', 'user', 'assistant'].includes(message?.role) || typeof message?.content !== 'string')) {
    return 'invalid_messages';
  }
  return null;
}

export function createGatewayServer(options = {}) {
  const env = options.env || process.env;
  const config = {
    token: env.AI_GATEWAY_TOKEN || '',
    groqUrl: env.GROQ_API_URL || 'https://api.groq.com/openai/v1/chat/completions',
    groqKey: env.GROQ_API_KEY || '',
    groqModel: env.GROQ_MODEL || '',
    salt: env.AI_GATEWAY_USER_SALT || 'local-only-salt',
    limitPerMinute: Math.max(1, Number(env.AI_GATEWAY_RATE_LIMIT_PER_MINUTE) || DEFAULT_LIMIT_PER_MINUTE),
    dailyQuota: Math.max(1, Number(env.AI_GATEWAY_DAILY_QUOTA) || DEFAULT_DAILY_QUOTA),
    maxConcurrency: Math.max(1, Number(env.AI_GATEWAY_MAX_CONCURRENCY) || DEFAULT_MAX_CONCURRENCY),
    timeoutMs: Math.max(1000, Number(env.AI_GATEWAY_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS),
    maxBody: Math.max(1024, Number(env.AI_GATEWAY_MAX_BODY_BYTES) || DEFAULT_MAX_BODY),
    production: env.NODE_ENV === 'production',
    stateStore: env.AI_GATEWAY_STATE_STORE || 'memory',
  };
  if (config.production && config.stateStore !== 'redis') {
    throw new Error('AI gateway production requires AI_GATEWAY_STATE_STORE=redis');
  }
  if (!config.token || !config.groqKey || !config.groqModel) {
    throw new Error('AI gateway requires AI_GATEWAY_TOKEN, GROQ_API_KEY and GROQ_MODEL');
  }

  const fetchImpl = options.fetchImpl || fetch;
  const logger = options.logger || console;
  const state = createState(options.now || (() => Date.now()));

  function recordFailure(timeout = false) {
    state.failures += 1;
    if (timeout) state.metrics.timeouts += 1;
    if (state.failures >= CIRCUIT_FAILURE_THRESHOLD) state.circuitOpenUntil = state.now() + CIRCUIT_COOLDOWN_MS;
  }

  async function callGroq(body) {
    if (state.circuitOpenUntil > state.now()) throw Object.assign(new Error('circuit_open'), { status: 503 });
    try {
      const response = await fetchImpl(config.groqUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.groqKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.groqModel,
          temperature: Number(body.temperature) || 0.2,
          messages: body.messages,
        }),
        signal: AbortSignal.timeout(config.timeoutMs),
      });
      if (!response.ok) {
        recordFailure(false);
        const error = Object.assign(new Error('upstream_error'), { status: response.status === 429 ? 429 : 502 });
        throw error;
      }
      state.failures = 0;
      return response.json();
    } catch (error) {
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        recordFailure(true);
        throw Object.assign(new Error('upstream_timeout'), { status: 504 });
      }
      if (error.status) throw error;
      recordFailure(false);
      throw Object.assign(new Error('upstream_unavailable'), { status: 502 });
    }
  }

  const server = http.createServer(async (request, response) => {
    if (request.method === 'GET' && request.url === '/health') {
      return json(response, 200, { status: 'ok', service: 'titi-ai-gateway', productionReady: config.stateStore === 'redis' });
    }
    if (request.method === 'GET' && request.url === '/metrics') {
      if (bearer(request) !== config.token) return json(response, 401, { success: false, message: 'Unauthorized' });
      return json(response, 200, { ...state.metrics, inFlight: state.inFlight, circuitOpen: state.circuitOpenUntil > state.now() });
    }
    if (request.method !== 'POST' || request.url !== '/v1/chat/completions') return json(response, 404, { success: false, message: 'Not found' });
    state.metrics.requests += 1;
    if (bearer(request) !== config.token) {
      state.metrics.rejected += 1;
      return json(response, 401, { success: false, message: 'Unauthorized' });
    }
    if (!request.headers['x-titi-course-id'] || !request.headers['x-titi-principal-id']) {
      state.metrics.rejected += 1;
      return json(response, 400, { success: false, message: 'Missing request scope' });
    }
    const principal = hashPrincipal(request.headers['x-titi-principal-id'], config.salt);
    const quotaReason = consumeQuota(state, principal, config);
    if (quotaReason) {
      state.metrics.rejected += 1;
      return json(response, 429, { success: false, message: 'AI gateway rate limit exceeded', reason: quotaReason });
    }
    if (state.inFlight >= config.maxConcurrency) {
      state.metrics.rejected += 1;
      return json(response, 429, { success: false, message: 'AI gateway busy' });
    }

    state.inFlight += 1;
    try {
      const body = await readRequest(request, config.maxBody);
      const invalid = validateRequest(body);
      if (invalid) {
        state.metrics.rejected += 1;
        return json(response, 400, { success: false, message: 'Invalid chat request', reason: invalid });
      }
      const payload = await callGroq(body);
      state.metrics.success += 1;
      return json(response, 200, payload);
    } catch (error) {
      state.metrics.upstreamErrors += 1;
      logger.warn?.('AI gateway request failed', { status: error.status || 500 });
      return json(response, error.status || 500, { success: false, message: 'AI provider unavailable' });
    } finally {
      state.inFlight -= 1;
    }
  });

  return { server, state, config };
}
