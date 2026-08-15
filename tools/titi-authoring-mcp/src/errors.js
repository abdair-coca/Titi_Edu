const SENSITIVE_KEY = /authorization|token|secret|password|credential/i;

export function sanitize(value, depth = 0) {
  if (depth > 6) return '[truncated]';
  if (Array.isArray(value)) return value.slice(0, 100).map((entry) => sanitize(entry, depth + 1));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
    key,
    SENSITIVE_KEY.test(key) ? '[redacted]' : sanitize(entry, depth + 1),
  ]));
}

export class TitiApiError extends Error {
  constructor(message, { status = null, code = 'TITI_API_ERROR', data = null, idempotencyKey = null } = {}) {
    super(message);
    this.name = 'TitiApiError';
    this.status = status;
    this.code = code;
    this.data = sanitize(data);
    this.idempotencyKey = idempotencyKey;
  }

  toSafeObject() {
    return {
      error: this.code,
      message: this.message,
      ...(this.status === null ? {} : { status: this.status }),
      ...(this.data === null ? {} : { data: this.data }),
      ...(this.idempotencyKey ? {
        idempotencyKey: this.idempotencyKey,
        retryGuidance: 'Reuse this exact idempotencyKey after a timeout or unknown write outcome.',
      } : {}),
    };
  }
}

export function safeError(error, idempotencyKey = null) {
  if (error instanceof TitiApiError) {
    if (idempotencyKey && !error.idempotencyKey) error.idempotencyKey = idempotencyKey;
    return error;
  }
  return new TitiApiError('Unexpected local MCP error', {
    code: 'LOCAL_MCP_ERROR',
    idempotencyKey,
  });
}
