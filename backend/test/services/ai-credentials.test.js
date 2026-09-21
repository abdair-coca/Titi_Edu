import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ credencialIa: { findUnique: vi.fn(), upsert: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() } }));
const quota = vi.hoisted(() => vi.fn());
vi.mock('../../src/prisma.js', () => ({ default: db }));
vi.mock('../../src/services/rag.quota.js', () => ({ consumeRagQuota: quota }));
import { saveValidatedGroqCredential, withGroqCredential, groqCredentialMetadata, deleteGroqCredential } from '../../src/services/ai-credentials.js';

let stored;
const validResponse = () => ({ ok: true, status: 200, json: async () => ({ data: [{ id: 'openai/gpt-oss-20b' }] }) });
beforeEach(() => {
  vi.clearAllMocks();
  stored = null;
  vi.stubEnv('RAG_CHAT_MODEL', 'openai/gpt-oss-20b');
  vi.stubEnv('AI_CREDENTIAL_KEY_CURRENT', 'V1');
  vi.stubEnv('AI_CREDENTIAL_KEY_V1', Buffer.alloc(32, 1).toString('base64'));
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(validResponse()));
  db.credencialIa.upsert.mockImplementation(async ({ create }) => { stored = { ...create, updatedAt: new Date() }; return stored; });
  db.credencialIa.findUnique.mockImplementation(async () => stored);
  db.credencialIa.updateMany.mockImplementation(async ({ where, data }) => {
    if (stored?.id !== where.id || (where.keyVersion && stored?.keyVersion !== where.keyVersion)) return { count: 0 };
    stored = { ...stored, ...data }; return { count: 1 };
  });
  db.credencialIa.deleteMany.mockImplementation(async () => { stored = null; return { count: 1 }; });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('Groq credential vault', () => {
  it('validates with non-generating models request and returns only safe metadata', async () => {
    const result = await saveValidatedGroqCredential('pg-user', 'gsk_test-secret-1234');
    expect(fetch).toHaveBeenCalledWith('https://api.groq.com/openai/v1/models', expect.objectContaining({ headers: { Authorization: 'Bearer gsk_test-secret-1234' }, signal: expect.any(AbortSignal) }));
    expect(quota).toHaveBeenCalledWith('pg-user', ['CREDENTIAL_VALIDATE']);
    expect(result).toMatchObject({ provider: 'groq', configured: true, status: 'VALID', last4: '1234' });
    expect(result).not.toHaveProperty('ciphertext');
    expect(stored.ciphertext.toString()).not.toContain('gsk_test-secret');
    expect(await withGroqCredential('pg-user', (key) => key === 'gsk_test-secret-1234')).toBe(true);
  });

  it.each(['id', 'usuarioId', 'proveedor', 'keyVersion', 'ciphertext', 'authTag'])('rejects tampering with %s', async (field) => {
    await saveValidatedGroqCredential('pg-user', 'gsk_test-secret-1234');
    if (Buffer.isBuffer(stored[field])) stored[field][0] ^= 1;
    else stored[field] += 'tampered';
    const use = vi.fn();
    await expect(withGroqCredential('pg-user', use)).rejects.toMatchObject({ status: 503 });
    expect(use).not.toHaveBeenCalled();
  });

  it('rotates ciphertext lazily while preserving usable plaintext', async () => {
    await saveValidatedGroqCredential('pg-user', 'gsk_secret');
    const old = Buffer.from(stored.ciphertext);
    vi.stubEnv('AI_CREDENTIAL_KEY_CURRENT', 'V2');
    vi.stubEnv('AI_CREDENTIAL_KEY_V2', Buffer.alloc(32, 2).toString('base64'));
    expect(await withGroqCredential('pg-user', (key) => key)).toBe('gsk_secret');
    expect(stored.keyVersion).toBe('V2');
    expect(stored.ciphertext.equals(old)).toBe(false);
    expect(await withGroqCredential('pg-user', (key) => key)).toBe('gsk_secret');
  });

  it('invalid replacement preserves working credential; upstream 401 becomes 422', async () => {
    await saveValidatedGroqCredential('pg-user', 'gsk_old');
    const previous = stored;
    fetch.mockResolvedValue({ ok: false, status: 401 });
    await expect(saveValidatedGroqCredential('pg-user', 'gsk_bad')).rejects.toMatchObject({ status: 422 });
    expect(stored).toBe(previous);
    expect(await withGroqCredential('pg-user', (key) => key)).toBe('gsk_old');
  });

  it('rejects unavailable configured model without replacing credential', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });
    await expect(saveValidatedGroqCredential('pg-user', 'gsk_bad')).rejects.toMatchObject({ status: 422 });
    expect(db.credencialIa.upsert).not.toHaveBeenCalled();
  });

  it('revocation cannot invalidate a concurrent replacement', async () => {
    await saveValidatedGroqCredential('pg-user', 'gsk_old');
    await withGroqCredential('pg-user', async (_key, invalidate) => {
      await saveValidatedGroqCredential('pg-user', 'gsk_new');
      await invalidate();
    });
    expect(stored.status).toBe('VALID');
    expect(await withGroqCredential('pg-user', (key) => key)).toBe('gsk_new');
  });

  it('missing and invalid credentials fail closed; deleting is idempotent', async () => {
    await expect(withGroqCredential('pg-user', vi.fn())).rejects.toMatchObject({ status: 409 });
    await saveValidatedGroqCredential('pg-user', 'gsk_old');
    await withGroqCredential('pg-user', async (_key, invalidate) => invalidate());
    await expect(withGroqCredential('pg-user', vi.fn())).rejects.toMatchObject({ status: 422 });
    expect(await deleteGroqCredential('pg-user')).toEqual({ deleted: true });
    expect(await deleteGroqCredential('pg-user')).toEqual({ deleted: true });
    expect(await groqCredentialMetadata('pg-user')).toEqual({ provider: 'groq', configured: false, status: null, last4: null, validatedAt: null, updatedAt: null });
  });

  it('validates input and keyring before contacting provider', async () => {
    await expect(saveValidatedGroqCredential('pg-user', 'x'.repeat(513))).rejects.toMatchObject({ status: 400 });
    vi.stubEnv('AI_CREDENTIAL_KEY_V1', 'invalid');
    await expect(saveValidatedGroqCredential('pg-user', 'gsk_key')).rejects.toMatchObject({ status: 503 });
    expect(fetch).not.toHaveBeenCalled();
  });
});
