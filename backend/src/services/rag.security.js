export const NO_EVIDENCE_ANSWER = 'No encontré evidencia suficiente en los materiales publicados de este curso.';

const INJECTION_PATTERNS = [
  /ignore\s+(all|any|the|previous|prior)\s+instructions?/i,
  /ignora\s+(todas\s+)?(las\s+)?instrucciones/i,
  /system\s+prompt/i,
  /mensaje\s+del\s+sistema/i,
  /reveal\s+(the\s+)?(system|hidden)\s+prompt/i,
  /revela(r)?\s+(el\s+)?(prompt|mensaje)\s+(del\s+)?sistema/i,
  /developer\s+message/i,
  /mensaje\s+del\s+desarrollador/i,
  /act\s+as\s+(an?\s+)?(admin|developer|system)/i,
  /act[uú]a\s+como\s+(administrador|desarrollador|sistema)/i,
];

const ACTION_PATTERNS = [
  /cambia(r)?\s+(mi|la|las|el|los)?\s*(nota|notas|progreso|inscripci[oó]n)/i,
  /modifica(r)?\s+(mi|la|las|el|los)?\s*(nota|notas|progreso|inscripci[oó]n)/i,
  /actualiza(r)?\s+(mi|la|las|el|los)?\s*(nota|notas|progreso|inscripci[oó]n)/i,
  /inscribe(me)?\s+(en|al|a)/i,
  /\b(exec|execute|sql|delete|update)\b/i,
];

export function detectPromptInjection(value) {
  const text = String(value || '');
  return INJECTION_PATTERNS
    .map((pattern, index) => (pattern.test(text) ? `pattern_${index + 1}` : null))
    .filter(Boolean);
}

export function isBlockedActionRequest(value) {
  const text = String(value || '');
  return ACTION_PATTERNS.some((pattern) => pattern.test(text));
}

export function extractCitationNumbers(answer) {
  const numbers = [];
  const pattern = /\[(\d{1,3})\]/g;
  let match;
  while ((match = pattern.exec(String(answer || '')))) numbers.push(Number(match[1]));
  return [...new Set(numbers)];
}

export function validateGroundedAnswer(answer, chunks) {
  const text = String(answer || '').trim();
  if (!text || text === NO_EVIDENCE_ANSWER) {
    return { valid: false, answer: NO_EVIDENCE_ANSWER, citationNumbers: [], reason: 'empty_or_no_evidence' };
  }

  const citationNumbers = extractCitationNumbers(text);
  const validNumbers = new Set((chunks || []).map((chunk) => chunk.index));
  const invalidCitation = citationNumbers.some((number) => !validNumbers.has(number));
  if (!citationNumbers.length || invalidCitation) {
    return {
      valid: false,
      answer: NO_EVIDENCE_ANSWER,
      citationNumbers,
      reason: invalidCitation ? 'citation_out_of_context' : 'missing_citation',
    };
  }

  return { valid: true, answer: text, citationNumbers, reason: null };
}

export function safeUsage(usage) {
  if (!usage || typeof usage !== 'object') return null;
  const allowed = ['prompt_tokens', 'completion_tokens', 'total_tokens'];
  const result = {};
  for (const key of allowed) {
    if (Number.isFinite(Number(usage[key]))) result[key] = Number(usage[key]);
  }
  return Object.keys(result).length ? result : null;
}

export function securityEvent(type, details = {}) {
  const safeDetails = Object.fromEntries(Object.entries(details)
    .filter(([key, value]) => ['courseId', 'lessonId', 'reason', 'count', 'status'].includes(key) && value != null)
    .map(([key, value]) => [key, String(value).slice(0, 120)]));
  console.warn('RAG security event', { type, ...safeDetails });
}

export class ChatRateLimiter {
  constructor({ perMinute = 5, daily = 30, now = () => Date.now() } = {}) {
    this.perMinute = perMinute;
    this.daily = daily;
    this.now = now;
    this.buckets = new Map();
  }

  consume(principalId) {
    const principal = String(principalId || 'anonymous');
    const current = this.now();
    const minute = Math.floor(current / 60_000);
    const day = new Date(current).toISOString().slice(0, 10);
    const bucket = this.buckets.get(principal) || { minute, minuteCount: 0, day, dayCount: 0 };
    if (bucket.minute !== minute) {
      bucket.minute = minute;
      bucket.minuteCount = 0;
    }
    if (bucket.day !== day) {
      bucket.day = day;
      bucket.dayCount = 0;
    }
    if (bucket.minuteCount >= this.perMinute) return { allowed: false, reason: 'minute_limit' };
    if (bucket.dayCount >= this.daily) return { allowed: false, reason: 'daily_quota' };
    bucket.minuteCount += 1;
    bucket.dayCount += 1;
    this.buckets.set(principal, bucket);
    return { allowed: true, minuteRemaining: this.perMinute - bucket.minuteCount, dailyRemaining: this.daily - bucket.dayCount };
  }

  clear() {
    this.buckets.clear();
  }
}
