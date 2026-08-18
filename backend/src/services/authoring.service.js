import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'crypto';
import path from 'path';

export const AUTHORING_SCOPES = Object.freeze([
  'course:read',
  'course:create',
  'content:write',
  'material:write',
  'publish',
  'analytics:read',
]);

export function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .filter((key) => value[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
    .join(',')}}`;
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function fingerprint(value) {
  return sha256(canonicalJson(value));
}

const DEFAULT_VIDEO_HOSTS = Object.freeze([
  'youtube.com',
  'www.youtube.com',
  'youtu.be',
  'vimeo.com',
  'www.vimeo.com',
  'player.vimeo.com',
]);

function configuredVideoHosts() {
  const configured = String(process.env.AUTHORING_VIDEO_HOSTS || '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  return new Set(configured.length ? configured : DEFAULT_VIDEO_HOSTS);
}

export function validateHttpsUrl(value, { allowNull = true, rejectSvg = false } = {}) {
  if (value === null || value === undefined || value === '') {
    return allowNull ? null : { ok: false, message: 'La URL es requerida' };
  }
  let parsed;
  try {
    parsed = new URL(String(value).trim());
  } catch {
    return { ok: false, message: 'La URL no es vÃƒÂ¡lida' };
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
    return { ok: false, message: 'La URL debe usar HTTPS sin credenciales embebidas' };
  }
  if (rejectSvg && parsed.pathname.toLowerCase().endsWith('.svg')) {
    return { ok: false, message: 'No se permiten imÃƒÂ¡genes SVG remotas' };
  }
  return { ok: true, value: parsed.toString() };
}

export function validateVideoUrl(value) {
  const checked = validateHttpsUrl(value);
  if (checked === null || !checked.ok) return checked;
  const parsed = new URL(checked.value);
  if (!configuredVideoHosts().has(parsed.hostname.toLowerCase())) {
    return { ok: false, message: 'El host del video no estÃƒÂ¡ permitido' };
  }
  return checked;
}

export function requestFingerprint(req, extra = {}) {
  return fingerprint({
    method: req.method,
    path: req.baseUrl + req.path,
    params: req.params,
    query: req.query,
    body: req.body || {},
    ...extra,
  });
}

export function generateServiceToken() {
  const prefijo = `titi_svc_${randomBytes(4).toString('hex')}`;
  const secret = randomBytes(32).toString('base64url');
  const token = `${prefijo}_${secret}`;
  return { token, prefijo, tokenHash: sha256(token) };
}

export function matchesTokenHash(token, expectedHex) {
  if (!/^[a-f0-9]{64}$/i.test(expectedHex || '')) return false;
  const actual = Buffer.from(sha256(token), 'hex');
  const expected = Buffer.from(expectedHex, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function parseServiceToken(token) {
  const match = /^(titi_svc_[a-f0-9]{8})_([A-Za-z0-9_-]{43})$/.exec(token || '');
  return match ? { prefijo: match[1] } : null;
}

function confirmationSecret() {
  const secret = process.env.AUTHORING_CONFIRMATION_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') return null;
  return 'authoring-development-only-secret';
}

export function createPublicationConfirmation({ resourceType, resourceId, expectedFingerprint, action = 'publish' }) {
  const secret = confirmationSecret();
  if (!secret) return null;
  const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
  const verb = action === 'delete' ? 'ELIMINAR' : action === 'unpublish' ? 'DESPUBLICAR' : 'PUBLICAR';
  const label = { course: 'CURSO', module: 'MODULO', lesson: 'LECCION' }[resourceType];
  if (!label) throw new Error('resourceType de confirmación no soportado');
  const phrase = `${verb} ${label} ${resourceId}`;
  const payload = Buffer.from(canonicalJson({ action, resourceType, resourceId, expectedFingerprint, phrase, expiresAt }))
    .toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return { confirmationToken: `${payload}.${signature}`, phrase, expiresAt };
}

export function verifyPublicationConfirmation({
  confirmationToken,
  phrase,
  resourceType,
  resourceId,
  expectedFingerprint,
  action = 'publish',
}) {
  const secret = confirmationSecret();
  if (!secret) return { ok: false, reason: 'secret_missing' };
  const [payload, signature, extra] = String(confirmationToken || '').split('.');
  if (!payload || !signature || extra) return { ok: false, reason: 'invalid' };
  const expectedSignature = createHmac('sha256', secret).update(payload).digest();
  let providedSignature;
  try {
    providedSignature = Buffer.from(signature, 'base64url');
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (providedSignature.length !== expectedSignature.length || !timingSafeEqual(providedSignature, expectedSignature)) {
    return { ok: false, reason: 'invalid' };
  }
  let decoded;
  try {
    decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (
    decoded.action !== action ||
    decoded.resourceType !== resourceType ||
    decoded.resourceId !== resourceId ||
    decoded.expectedFingerprint !== expectedFingerprint ||
    decoded.phrase !== phrase
  ) return { ok: false, reason: 'invalid' };
  if (!decoded.expiresAt || new Date(decoded.expiresAt).getTime() <= Date.now()) {
    return { ok: false, reason: 'expired' };
  }
  return { ok: true };
}

export function coursePublicationSummary(course) {
  return {
    id: course.id,
    titulo: course.titulo,
    descripcion: course.descripcion,
    nivel: course.nivel,
    categoriaId: course.categoriaId,
    emiteCertificado: course.emiteCertificado,
    version: course.version,
    modules: (course.modulos || []).map(modulePublicationSummary),
    finalEvaluation: evaluationPublicationSummary(course.evaluacionFinal),
  };
}

function evaluationPublicationSummary(evaluation) {
  return evaluation
    ? {
        id: evaluation.id,
        titulo: evaluation.titulo,
        intentosMax: evaluation.intentosMax,
        notaMinima: evaluation.notaMinima,
        questions: (evaluation.preguntas || []).map((question) => ({
          id: question.id,
          texto: question.texto,
          tipo: question.tipo,
          orden: question.orden,
          options: (question.opciones || []).map((option) => ({
            id: option.id,
            texto: option.texto,
            esCorrecta: option.esCorrecta,
          })),
        })),
      }
    : null;
}

export function modulePublicationSummary(module) {
  return {
    id: module.id,
    titulo: module.titulo,
    descripcion: module.descripcion,
    orden: module.orden,
    estado: module.estado,
    version: module.version,
    courseVersion: module.curso?.version ?? null,
    lessons: (module.lecciones || []).map((lesson) => ({
      id: lesson.id,
      titulo: lesson.titulo,
      contenido: lesson.contenido,
      formatoContenido: lesson.formatoContenido,
      videoUrl: lesson.videoUrl,
      orden: lesson.orden,
      htmlResource: lesson.recursoHtml
        ? {
            sha256: sha256(lesson.recursoHtml.html),
            evaluable: lesson.recursoHtml.evaluable,
            intentosMax: lesson.recursoHtml.intentosMax,
          }
        : null,
      materials: (lesson.materiales || []).map((material) => ({
        id: material.id,
        nombre: material.nombre,
        tipo: material.tipo,
        sha256: material.sha256,
      })),
    })),
    evaluation: evaluationPublicationSummary(module.evaluacion),
  };
}

const BINARY_TYPES = [
  { extensions: ['.pdf'], type: 'pdf', resourceType: 'raw', match: (b) => b.subarray(0, 5).toString() === '%PDF-' },
  { extensions: ['.png'], type: 'imagen', resourceType: 'image', match: (b) => b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
  { extensions: ['.jpg', '.jpeg'], type: 'imagen', resourceType: 'image', match: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { extensions: ['.webp'], type: 'imagen', resourceType: 'image', match: (b) => b.length >= 12 && b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP' },
  { extensions: ['.doc'], type: 'word', resourceType: 'raw', match: (b) => b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) },
  { extensions: ['.docx'], type: 'word', resourceType: 'raw', match: (b) => b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && [0x03, 0x05, 0x07].includes(b[2]) && [0x04, 0x06, 0x08].includes(b[3]) },
];

export function inspectAuthoringFile(file) {
  const extension = path.extname(file?.originalname || '').toLowerCase();
  const binary = BINARY_TYPES.find((entry) => entry.extensions.includes(extension));
  if (binary) {
    if (!binary.match(file.buffer)) return { ok: false, message: 'La firma del archivo no coincide con su extensiÃƒÂ³n' };
    return { ok: true, extension, tipo: binary.type, resourceType: binary.resourceType, sha256: sha256(file.buffer) };
  }
  if (!['.txt', '.md', '.py'].includes(extension)) {
    return { ok: false, message: 'Tipo de archivo no permitido' };
  }
  if (file.buffer.includes(0)) return { ok: false, message: 'El archivo de texto contiene bytes NUL' };
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(file.buffer);
  } catch {
    return { ok: false, message: 'El archivo de texto debe usar UTF-8 vÃ¡lido' };
  }
  return { ok: true, extension, tipo: extension === '.py' ? 'codigo' : 'otro', resourceType: 'raw', sha256: sha256(file.buffer) };
}

const HTML_LESSON_CSP = "default-src 'none'; base-uri 'none'; connect-src 'none'; form-action 'none'; frame-src 'none'; img-src data:; media-src data:; font-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'";
const HTML_RESOURCE_ATTRIBUTES = /\b(?:src|poster)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
const HTML_HREF_ATTRIBUTE = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
const HTML_TAG = /<([a-z][a-z0-9:-]*)\b[^>]*>/gi;

function attributeValue(match) {
  return (match[1] ?? match[2] ?? match[3] ?? '').trim();
}

function isSafeAnchorHref(value) {
  if (!value || value.startsWith('#')) return true;
  if (!/^https?:\/\//i.test(value)) return false;
  try {
    const parsed = new URL(value);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

function hasOnlySafeHtmlReferences(html) {
  for (const match of html.matchAll(HTML_RESOURCE_ATTRIBUTES)) {
    if (!attributeValue(match).toLowerCase().startsWith('data:')) return false;
  }
  for (const tag of html.matchAll(HTML_TAG)) {
    const tagName = tag[1].toLowerCase();
    for (const href of tag[0].matchAll(HTML_HREF_ATTRIBUTE)) {
      const value = attributeValue(href);
      if (tagName === 'a' ? !isSafeAnchorHref(value) : value && !value.startsWith('#')) return false;
    }
  }
  for (const match of html.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)) {
    const value = match[2].trim();
    if (!value.toLowerCase().startsWith('data:') && !value.startsWith('#')) return false;
  }
  return true;
}

function enforceHtmlLessonCsp(html) {
  const cspMeta = `<meta http-equiv="Content-Security-Policy" content="${HTML_LESSON_CSP}">`;
  if (/<head\b[^>]*>/i.test(html)) return html.replace(/<head\b[^>]*>/i, (head) => `${head}${cspMeta}`);
  return html.replace(/<html\b[^>]*>/i, (tag) => `${tag}<head>${cspMeta}</head>`);
}

export function validateHtmlLessonResource({ html, evaluable = false, intentosMax = null } = {}) {
  if (typeof html !== 'string' || !html.trim()) return { ok: false, message: 'html es requerido' };
  if (Buffer.byteLength(html, 'utf8') > 1_000_000) return { ok: false, message: 'El HTML no puede superar 1 MB' };
  if (typeof evaluable !== 'boolean') return { ok: false, message: 'evaluable debe ser booleano' };
  if (!/<html\b[^>]*>/i.test(html)) return { ok: false, message: 'El recurso debe contener un documento HTML autocontenido' };
  if (/<(?:iframe|frame|object|embed|base|link|form)\b/i.test(html)) {
    return { ok: false, message: 'El HTML no permite recursos embebidos ni formularios externos' };
  }
  // Se tolera el meta CSP propio de Titi (se re-inyecta igual), pero no otros
  // metadatos activos (refresh/redirect) ni srcset con recursos remotos.
  if (/<meta\b[^>]*http-equiv\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i.test(html) && !/<meta\b[^>]*http-equiv\s*=\s*["']?content-security-policy["']?/i.test(html)) {
    return { ok: false, message: 'El HTML no permite metadatos activos ni srcset' };
  }
  if (/\bsrcset\s*=/i.test(html)) {
    return { ok: false, message: 'El HTML no permite metadatos activos ni srcset' };
  }
  if (/\b(?:javascript|vbscript)\s*:/i.test(html) || /@import\b/i.test(html) || !hasOnlySafeHtmlReferences(html)) {
    return { ok: false, message: 'El HTML solo permite recursos inline, data:, fragmentos internos y enlaces HTTP(S) seguros' };
  }
  const parsedAttempts = intentosMax === null || intentosMax === undefined || intentosMax === ''
    ? null
    : Number(intentosMax);
  if (evaluable && (!Number.isInteger(parsedAttempts) || parsedAttempts < 1 || parsedAttempts > 10)) {
    return { ok: false, message: 'intentosMax debe ser un entero entre 1 y 10 para HTML evaluable' };
  }
  if (!evaluable && parsedAttempts !== null) {
    return { ok: false, message: 'intentosMax solo se permite para HTML evaluable' };
  }
  return {
    ok: true,
    data: {
      html: enforceHtmlLessonCsp(html.trim()),
      evaluable,
      intentosMax: evaluable ? parsedAttempts : null,
    },
  };
}

export function sanitizeFilename(filename) {
  const base = path.basename(String(filename || 'material'));
  const extension = path.extname(base).toLowerCase();
  const stem = path.basename(base, extension)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100) || 'material';
  return `${stem}${extension}`;
}

export function privateAnalytics(intents) {
  const totalAttempts = intents.length;
  const uniqueStudents = new Set(intents.map((attempt) => attempt.usuarioId)).size;
  const passedStudents = new Set(intents.filter((attempt) => attempt.aprobado).map((attempt) => attempt.usuarioId)).size;
  const suppressed = uniqueStudents < 3;
  const bucketCounts = [0, 0, 0, 0, 0];
  for (const attempt of intents) bucketCounts[Math.min(4, Math.floor(Math.max(0, attempt.nota) / 20))] += 1;
  if (suppressed) {
    return {
      suppressed: true,
      suprimida: true,
      totalAttempts: null,
      uniqueStudents: null,
      passedStudents: null,
      averageScore: null,
      attemptPassRate: null,
      studentPassRate: null,
      scoreDistribution: null,
    };
  }
  return {
    suppressed: false,
    totalAttempts,
    uniqueStudents,
    passedStudents,
    averageScore: suppressed || totalAttempts === 0 ? null : intents.reduce((sum, attempt) => sum + attempt.nota, 0) / totalAttempts,
    attemptPassRate: suppressed || totalAttempts === 0 ? null : intents.filter((attempt) => attempt.aprobado).length / totalAttempts,
    studentPassRate: suppressed || uniqueStudents === 0 ? null : passedStudents / uniqueStudents,
    scoreDistribution: suppressed ? null : [
      { range: '0-19', count: bucketCounts[0] },
      { range: '20-39', count: bucketCounts[1] },
      { range: '40-59', count: bucketCounts[2] },
      { range: '60-79', count: bucketCounts[3] },
      { range: '80-100', count: bucketCounts[4] },
    ],
    suprimida: false,
  };
}
