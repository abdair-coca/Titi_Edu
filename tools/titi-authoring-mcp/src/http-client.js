import { TitiApiError } from './errors.js';

const DEFAULT_TIMEOUT_MS = 20_000;

function normalizeBaseUrl(value) {
  let url;
  try {
    url = new URL(value || 'http://localhost:3000');
  } catch {
    throw new TitiApiError('TITI_API_URL must be a valid HTTP(S) URL', { code: 'INVALID_CONFIGURATION' });
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new TitiApiError('TITI_API_URL must use HTTP or HTTPS', { code: 'INVALID_CONFIGURATION' });
  }
  return url.toString().replace(/\/$/, '');
}

async function parseEnvelope(response, idempotencyKey) {
  const text = await response.text();
  let envelope = null;
  if (text) {
    try {
      envelope = JSON.parse(text);
    } catch {
      if (response.ok) {
        throw new TitiApiError('Titi API returned a non-JSON success response', {
          status: response.status,
          code: 'INVALID_API_RESPONSE',
          idempotencyKey,
        });
      }
    }
  }

  if (!response.ok || envelope?.success === false) {
    throw new TitiApiError(
      typeof envelope?.message === 'string' && envelope.message.trim()
        ? envelope.message.trim()
        : `Titi API request failed with HTTP ${response.status}`,
      {
        status: response.status,
        code: 'BACKEND_ERROR',
        data: envelope?.data ?? null,
        idempotencyKey,
      },
    );
  }
  if (!envelope || envelope.success !== true || !Object.hasOwn(envelope, 'data')) {
    throw new TitiApiError('Titi API returned an invalid response envelope', {
      status: response.status,
      code: 'INVALID_API_RESPONSE',
      idempotencyKey,
    });
  }
  return envelope.data;
}

export function createHttpClient({
  baseUrl = process.env.TITI_API_URL,
  tokenProvider = () => process.env.TITI_SERVICE_TOKEN,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl = globalThis.fetch,
} = {}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  if (typeof fetchImpl !== 'function') {
    throw new TitiApiError('Native fetch is unavailable; Node 20 or newer is required', { code: 'INVALID_CONFIGURATION' });
  }

  return {
    async request({ method = 'GET', path, body, form, idempotencyKey = null, safeRead = false }) {
      const token = tokenProvider();
      if (!token) {
        throw new TitiApiError('TITI_SERVICE_TOKEN is not configured', {
          code: 'MISSING_SERVICE_TOKEN',
          idempotencyKey,
        });
      }

      const attempts = safeRead ? 2 : 1;
      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const headers = { Accept: 'application/json', Authorization: `Bearer ${token}` };
          if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
          let requestBody;
          if (form) {
            requestBody = form;
          } else if (body !== undefined) {
            headers['Content-Type'] = 'application/json';
            requestBody = JSON.stringify(body);
          }
          const response = await fetchImpl(`${normalizedBaseUrl}${path}`, {
            method,
            headers,
            body: requestBody,
            signal: controller.signal,
          });
          const data = await parseEnvelope(response, idempotencyKey);
          return { data, idempotencyReplayed: response.headers.get('idempotency-replayed') === 'true' };
        } catch (error) {
          const retryable = error instanceof TitiApiError
            ? error.status !== null && error.status >= 500
            : true;
          if (attempt < attempts && retryable) continue;
          if (error instanceof TitiApiError) throw error;
          if (controller.signal.aborted) {
            throw new TitiApiError(`Titi API request timed out after ${timeoutMs} ms`, {
              code: 'TIMEOUT',
              idempotencyKey,
            });
          }
          throw new TitiApiError('Titi API network request failed', {
            code: 'NETWORK_ERROR',
            idempotencyKey,
          });
        } finally {
          clearTimeout(timeout);
        }
      }
      throw new TitiApiError('Titi API request failed', { idempotencyKey });
    },
  };
}

export { DEFAULT_TIMEOUT_MS };
