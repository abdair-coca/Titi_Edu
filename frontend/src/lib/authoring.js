import client from '../api/client.js';

function requestId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const pendingIntentions = new Map();

function stablePayload(value) {
  if (value instanceof FormData) {
    return JSON.stringify([...value.entries()].map(([key, item]) => [
      key,
      typeof File !== 'undefined' && item instanceof File
        ? { name: item.name, size: item.size, type: item.type, lastModified: item.lastModified }
        : String(item),
    ]));
  }
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stablePayload).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stablePayload(value[key])}`).join(',')}}`;
}

export function authoringHeaders(extra = {}) {
  return { ...extra, 'Idempotency-Key': requestId() };
}

export async function authoringMutation(method, url, payload, options = {}) {
  const intent = options.intentKey || `${String(method).toUpperCase()} ${url} ${stablePayload(payload)}`;
  const existingHeader = options.headers?.['Idempotency-Key'];
  const idempotencyKey = existingHeader || pendingIntentions.get(intent) || requestId();
  pendingIntentions.set(intent, idempotencyKey);
  try {
    const response = await client.request({
      ...options,
      method,
      url: `/api/authoring${url}`,
      data: payload,
      headers: { ...options.headers, 'Idempotency-Key': idempotencyKey },
    });
    pendingIntentions.delete(intent);
    return response;
  } catch (error) {
    const status = error.response?.status;
    if (status && status < 500 && status !== 408 && status !== 429) pendingIntentions.delete(intent);
    throw error;
  }
}

export function authoringError(error, fallback = 'No se pudo completar la operación') {
  return error.response?.data?.message || error.message || fallback;
}
