import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import prisma from '../prisma.js';
import { RagError } from './rag.errors.js';
import { consumeRagQuota } from './rag.quota.js';

export const GROQ_CHAT_MODEL = 'openai/gpt-oss-20b';

export function userCredentialRequired() {
  const mode = process.env.RAG_CREDENTIAL_MODE?.trim().toLowerCase();
  const productionChatEnabled = process.env.NODE_ENV === 'production'
    && process.env.RAG_CHAT_ENABLED !== 'false';

  if (mode === 'user_required') return true;
  if (mode === 'platform' || !mode) {
    if (productionChatEnabled) {
      throw new RagError(503, 'El tutor IA requiere credenciales personales en producción');
    }
    return false;
  }
  throw new RagError(503, 'El modo de credenciales IA no es válido');
}

export function groqModel() {
  const configured = process.env.RAG_CHAT_MODEL?.trim() || process.env.GROQ_MODEL?.trim();
  if (configured && configured !== GROQ_CHAT_MODEL) {
    throw new RagError(503, 'El modelo del tutor IA no coincide con la configuración permitida');
  }
  return GROQ_CHAT_MODEL;
}

export function validateAiRuntimeConfiguration() {
  return { credentialRequired: userCredentialRequired(), model: groqModel() };
}

function keyFor(version) {
  const value = process.env[`AI_CREDENTIAL_KEY_${version}`];
  if (!value || !/^[A-Za-z0-9+/]{43}=$/.test(value)) throw new RagError(503, 'La protección de credenciales IA no está configurada');
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32) throw new RagError(503, 'La protección de credenciales IA no está configurada');
  return key;
}

export function validateCredentialKeyring() {
  const version = process.env.AI_CREDENTIAL_KEY_CURRENT;
  if (!version || !/^[A-Z0-9_]+$/.test(version)) throw new RagError(503, 'La protección de credenciales IA no está configurada');
  keyFor(version);
  return version;
}

const aad = (row) => Buffer.from(JSON.stringify([row.id, row.usuarioId, row.proveedor, row.keyVersion]));
function encrypt(apiKey, row) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFor(row.keyVersion), iv);
  cipher.setAAD(aad(row));
  return { ciphertext: Buffer.concat([cipher.update(apiKey, 'utf8'), cipher.final()]), iv, authTag: cipher.getAuthTag() };
}
function decrypt(row) {
  try {
    const cipher = createDecipheriv('aes-256-gcm', keyFor(row.keyVersion), row.iv);
    cipher.setAAD(aad(row));
    cipher.setAuthTag(row.authTag);
    return Buffer.concat([cipher.update(row.ciphertext), cipher.final()]);
  } catch {
    throw new RagError(503, 'No se pudo abrir la credencial IA; contacta al administrador');
  }
}

const whereUser = (usuarioId) => ({ usuarioId_proveedor: { usuarioId, proveedor: 'GROQ' } });
const metadata = (row) => ({
  provider: 'groq', configured: Boolean(row), status: row?.status || null,
  last4: row?.last4 || null, validatedAt: row?.validatedAt || null, updatedAt: row?.updatedAt || null,
});

export async function groqCredentialMetadata(usuarioId) {
  const row = await prisma.credencialIa.findUnique({ where: whereUser(usuarioId), select: { status: true, last4: true, validatedAt: true, updatedAt: true } });
  return metadata(row);
}

export async function saveValidatedGroqCredential(usuarioId, apiKey) {
  if (typeof apiKey !== 'string' || !apiKey.trim() || apiKey.length > 512 || /[\r\n]/.test(apiKey)) {
    throw new RagError(400, 'apiKey es requerida y debe tener hasta 512 caracteres');
  }
  const model = groqModel();
  const keyVersion = validateCredentialKeyring();
  await consumeRagQuota(usuarioId, ['CREDENTIAL_VALIDATE']);
  let response;
  try {
    response = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${apiKey.trim()}` }, signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    throw new RagError(error.name === 'TimeoutError' || error.name === 'AbortError' ? 504 : 502, 'No se pudo validar la credencial con Groq');
  }
  if ([401, 403].includes(response.status)) throw new RagError(422, 'La clave Groq no es válida o fue revocada');
  if (response.status === 429) throw new RagError(429, 'Groq limitó temporalmente la validación; intenta más tarde');
  if (!response.ok) throw new RagError(502, 'No se pudo validar la credencial con Groq');
  const payload = await response.json().catch(() => null);
  if (!payload?.data?.some((item) => item.id === model)) throw new RagError(422, 'La clave Groq no tiene acceso al modelo del tutor');
  // A fresh identity binds each replacement. Upsert changes id and ciphertext
  // atomically, avoiding races between first save, replacement and deletion.
  const row = { id: randomUUID(), usuarioId, proveedor: 'GROQ', keyVersion };
  const data = { ...row, ...encrypt(apiKey.trim(), row), last4: apiKey.trim().slice(-4), status: 'VALID', validatedAt: new Date(), invalidatedAt: null };
  const saved = await prisma.credencialIa.upsert({ where: whereUser(usuarioId), create: data, update: data });
  return metadata(saved);
}

// A gateway 401/403 is ambiguous: it may reject Titi's Cloudflare token rather
// than the user's Groq key. Only Groq's own non-generating models endpoint can
// confirm revocation before the stored credential is marked INVALID.
export async function groqCredentialIsRevoked(apiKey) {
  try {
    const response = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });
    return response.status === 401 || response.status === 403;
  } catch {
    return false;
  }
}

export async function deleteGroqCredential(usuarioId) {
  await prisma.credencialIa.deleteMany({ where: { usuarioId, proveedor: 'GROQ' } });
  return { deleted: true };
}

// Plaintext stays within one request callback, never returned to HTTP callers.
// Conditional updates cannot invalidate/overwrite a concurrent replacement.
export async function withGroqCredential(usuarioId, use) {
  const row = await prisma.credencialIa.findUnique({ where: whereUser(usuarioId) });
  if (!row) throw new RagError(409, 'Configura tu clave Groq para usar el tutor IA');
  if (row.status !== 'VALID') throw new RagError(422, 'Tu clave Groq no es válida; reemplázala para continuar');
  const plaintext = decrypt(row);
  try {
    const version = validateCredentialKeyring();
    if (row.keyVersion !== version) {
      const rotated = { ...row, keyVersion: version };
      await prisma.credencialIa.updateMany({ where: { id: row.id, keyVersion: row.keyVersion }, data: { ...encrypt(plaintext, rotated), keyVersion: version } });
    }
    return await use(plaintext.toString('utf8'), async () => {
      await prisma.credencialIa.updateMany({ where: { id: row.id }, data: { status: 'INVALID', invalidatedAt: new Date() } });
    });
  } finally {
    plaintext.fill(0);
  }
}
