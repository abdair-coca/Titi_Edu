export const NO_EVIDENCE_ANSWER = 'No encontré evidencia suficiente en los materiales publicados de este curso.';
export const ACTION_BLOCKED_ANSWER = 'No puedo cambiar notas, progreso ni inscripciones, ni ejecutar comandos. Sí puedo ayudarte a entender el material de este curso.';
export const SOCIAL_ANSWER = '¡Con gusto! Contame qué parte de la lección querés repasar.';

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

const ACADEMIC_RECORD = '(?:nota|notas|calificaci[oó]n|calificaciones|progreso|inscripci[oó]n|inscripciones)';
const POLITE_START = '^\\s*[¿¡]?\\s*(?:por favor,?\\s+)?';

// Blocks requests to act on the platform, never vocabulary: a database course
// must be able to ask what SQL or UPDATE mean.
const ACTION_PATTERNS = [
  new RegExp(`\\b(?:c[aá]mbi|modif[ií]c|actual[ií]z|b[oó]rr|el[ií]min|s[uú]b)(?:a|á|e|í|ar|ir|ame|eme|ime)\\s+(?:mi|mis)\\s+${ACADEMIC_RECORD}\\b`, 'i'),
  new RegExp(`${POLITE_START}(?:c[aá]mbia|modif[ií]ca|actual[ií]za|s[uú]be)(?:me)?\\s+(?:la|las|el|los)\\s+${ACADEMIC_RECORD}\\b`, 'i'),
  /\b(?:update|change|modify|delete|set)\s+my\s+(?:grade|grades|progress|enrollment|score)\b/i,
  /\b(?:des)?inscr[ií]b[ea]me\b/i,
  new RegExp(`${POLITE_START}(?:des)?inscr[ií]be\\s+(?:en|al|a)\\b`, 'i'),
  new RegExp(`${POLITE_START}(?:ejecut[aá]|corr[eé]|run|execute|exec)\\s+(?:(?:este|esta|el|la|un|una|this|the|a)\\s+)?(?:sql|query|consulta|comando|command|script)\\b`, 'i'),
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

// Odd segments of the split are code, where brackets are never citations.
const CODE_SEGMENTS = /(```[\s\S]*?(?:```|$)|`[^`\n]*`)/;
const WIDE_CITATION = /[【［]\s*(\d{1,3})(?:\s*[†‡][^】］]*)?\s*[】］]/g;
const CITATION_LIST = /(?<![\p{L}\p{N}_\])]|=\s*)\[\s*\d{1,3}(?:\s*,\s*\d{1,3})+\s*\]/gu;

function mapProse(text, transform) {
  return String(text || '').split(CODE_SEGMENTS)
    .map((segment, index) => (index % 2 ? segment : transform(segment)))
    .join('');
}

export function normalizeCitationMarkers(answer) {
  return mapProse(answer, (prose) => prose
    .replace(WIDE_CITATION, '[$1]')
    .replace(CITATION_LIST, (list) => list.match(/\d+/g).map((number) => `[${number}]`).join(' ')));
}

export function stripCitationMarkers(text) {
  return mapProse(normalizeCitationMarkers(text), (prose) => prose
    .replace(/(?<![\p{L}\p{N}_\])])\[\d{1,3}\](?:\s*\[\d{1,3}\])*/gu, '')
    .replace(/[ \t]+([.,;:!?])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')).trim();
}

// `arr[7]` is an index, not a citation: an identifier-attached number only counts
// when it names a real source, because models also write `valor[1]` in prose.
export function extractCitationNumbers(answer, validNumbers = null) {
  const prose = normalizeCitationMarkers(answer).split(CODE_SEGMENTS)
    .map((segment, index) => (index % 2 ? ' '.repeat(segment.length) : segment))
    .join('');
  const numbers = [];
  const pattern = /\[(\d{1,3})\]/g;
  let previous = null;
  let match;
  while ((match = pattern.exec(prose))) {
    const number = Number(match[1]);
    const before = prose.slice(0, match.index);
    const continuesChain = previous !== null && !prose.slice(previous.end, match.index).trim();
    const attached = /[\p{L}\p{N}_\])]$/u.test(before) && !continuesChain;
    const assigned = /=\s*$/.test(before);
    const counts = continuesChain
      ? previous.counts
      : !assigned && (!attached || !validNumbers || validNumbers.has(number));
    if (counts) numbers.push(number);
    previous = { end: match.index + match[0].length, counts };
  }
  return [...new Set(numbers)];
}

const DEFAULT_SUPPORT_MIN_OVERLAP = 0.15;
const MIN_TERMS_FOR_SUPPORT_CHECK = 4;
const TERM_PREFIX_LENGTH = 5;
const COMMON_TERMS = new Set([
  'como', 'para', 'pero', 'porque', 'sobre', 'entre', 'desde', 'hasta', 'cuando', 'donde', 'tambien', 'esto', 'esta',
  'este', 'estos', 'estas', 'esos', 'esas', 'aquel', 'cada', 'otro', 'otra', 'otros', 'otras', 'solo', 'puede', 'pueden',
  'tiene', 'tienen', 'hacer', 'hace', 'segun', 'antes', 'despues', 'mismo', 'misma', 'muy', 'mas', 'menos', 'that',
  'this', 'with', 'from', 'have', 'which', 'your',
]);

function contentTerms(text) {
  const plain = String(text || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
  const words = plain.match(/\p{L}[\p{L}\p{N}_-]{3,}/gu) || [];
  return new Set(words.filter((word) => !COMMON_TERMS.has(word)).map((word) => word.slice(0, TERM_PREFIX_LENGTH)));
}

function supportMinOverlap() {
  const configured = process.env.RAG_SUPPORT_MIN_OVERLAP?.trim();
  const parsed = configured ? Number(configured) : DEFAULT_SUPPORT_MIN_OVERLAP;
  return Math.max(0, Math.min(1, Number.isFinite(parsed) ? parsed : DEFAULT_SUPPORT_MIN_OVERLAP));
}

// Heuristic: catches answers unrelated to their citations. It cannot prove that
// each claim is true, and very short answers do not carry enough terms to judge.
function hasTermSupport(answer, sources, extraContext) {
  const minOverlap = supportMinOverlap();
  const sourceText = sources.join(' ');
  if (minOverlap === 0 || !sourceText.trim()) return true;
  const prose = stripCitationMarkers(answer).split(CODE_SEGMENTS).filter((_, index) => index % 2 === 0);
  const answerTerms = contentTerms(prose.join(' '));
  if (answerTerms.size < MIN_TERMS_FOR_SUPPORT_CHECK) return true;
  const known = contentTerms(`${sourceText} ${extraContext}`);
  const shared = [...answerTerms].filter((term) => known.has(term)).length;
  return shared / answerTerms.size >= minOverlap;
}

export function validateGroundedAnswer(answer, chunks, { extraContext = '' } = {}) {
  const text = normalizeCitationMarkers(answer).trim();
  if (!text || text === NO_EVIDENCE_ANSWER) {
    return { valid: false, answer: NO_EVIDENCE_ANSWER, citationNumbers: [], reason: 'empty_or_no_evidence' };
  }

  const validNumbers = new Set((chunks || []).map((chunk) => chunk.index));
  const citationNumbers = extractCitationNumbers(text, validNumbers);
  const invalidCitation = citationNumbers.some((number) => !validNumbers.has(number));
  if (!citationNumbers.length || invalidCitation) {
    return {
      valid: false,
      answer: NO_EVIDENCE_ANSWER,
      citationNumbers,
      reason: invalidCitation ? 'citation_out_of_context' : 'missing_citation',
    };
  }

  const cited = new Set(citationNumbers);
  const sources = (chunks || []).filter((chunk) => cited.has(chunk.index)).map((chunk) => chunk.content || '');
  if (!hasTermSupport(text, sources, extraContext)) {
    return { valid: false, answer: NO_EVIDENCE_ANSWER, citationNumbers, reason: 'unsupported_by_cited_sources' };
  }

  return { valid: true, answer: text, citationNumbers, reason: null };
}

const SOCIAL_WORDS = new Set([
  'hola', 'buenas', 'buenos', 'dias', 'tardes', 'noches', 'gracias', 'muchas', 'mil', 'ok', 'okay', 'dale', 'genial',
  'perfecto', 'listo', 'chau', 'adios', 'hasta', 'luego', 'de', 'nada', 'tutor', 'titi',
]);

export function isSocialMessage(value) {
  const words = String(value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .match(/[\p{L}\p{N}]+/gu) || [];
  return words.length > 0 && words.length <= 5 && words.every((word) => SOCIAL_WORDS.has(word));
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
