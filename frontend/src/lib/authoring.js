import client from '../api/client.js';

function requestId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function authoringHeaders(extra = {}) {
  return { ...extra, 'Idempotency-Key': requestId() };
}

export async function authoringMutation(method, url, payload, options = {}) {
  return client.request({
    method,
    url: `/api/authoring${url}`,
    data: payload,
    ...options,
    headers: authoringHeaders(options.headers),
  });
}

export function authoringError(error, fallback = 'No se pudo completar la operación') {
  return error.response?.data?.message || error.message || fallback;
}
