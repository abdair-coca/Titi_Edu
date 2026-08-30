const ISO_DATETIME_WITH_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})$/;

export function parseOptionalDeadline(value) {
  if (value === undefined) return { ok: true, value: undefined };
  if (value === null) return { ok: true, value: null };
  if (typeof value !== 'string' || !ISO_DATETIME_WITH_ZONE.test(value)) {
    return { ok: false, message: 'fechaLimite debe ser una fecha ISO válida o null' };
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    return { ok: false, message: 'fechaLimite debe ser una fecha ISO válida o null' };
  }
  return { ok: true, value: parsed };
}

export function isDeadlineExpired(deadline, now = Date.now()) {
  if (!deadline) return false;
  const timestamp = deadline instanceof Date ? deadline.getTime() : new Date(deadline).getTime();
  return Number.isFinite(timestamp) && now > timestamp;
}
