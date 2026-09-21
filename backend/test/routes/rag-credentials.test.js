import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
const db = vi.hoisted(() => ({
  usuario: { findUnique: vi.fn() }, credencialIa: { findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
  $transaction: vi.fn(), $queryRaw: vi.fn(), ragQuotaWindow: { deleteMany: vi.fn() },
}));
vi.mock('../../src/prisma.js', () => ({ default: db }));
import router from '../../src/routes/rag-credentials.js';
const app = express(); app.use(express.json()); app.use('/api/rag/credentials/groq', router);
const token = jwt.sign({ id: 'neo-user' }, process.env.JWT_SECRET);
const endpoint = '/api/rag/credentials/groq';
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('AI_CREDENTIAL_KEY_CURRENT', 'V1');
  vi.stubEnv('AI_CREDENTIAL_KEY_V1', Buffer.alloc(32, 3).toString('base64'));
  vi.stubEnv('RAG_CHAT_MODEL', 'openai/gpt-oss-20b');
  db.usuario.findUnique.mockResolvedValue({ id: 'pg-user' });
  db.credencialIa.findUnique.mockResolvedValue(null);
  db.credencialIa.upsert.mockImplementation(async ({ create }) => create);
  db.credencialIa.deleteMany.mockResolvedValue({ count: 0 });
  db.$transaction.mockImplementation((callback) => callback(db));
  db.$queryRaw.mockResolvedValue([{ count: 1 }]);
  db.ragQuotaWindow.deleteMany.mockResolvedValue({ count: 0 });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [{ id: 'openai/gpt-oss-20b' }] }) }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('Groq credentials HTTP', () => {
  it.each(['get', 'put', 'delete'])('%s requires a session', async (method) => {
    expect((await request(app)[method](endpoint)).status).toBe(401);
  });
  it('loads Postgres identity from Neo4j JWT and hides secret fields', async () => {
    const response = await request(app).put(endpoint).set('Authorization', `Bearer ${token}`).send({ apiKey: 'gsk_private1234' });
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(db.usuario.findUnique).toHaveBeenCalledWith({ where: { neoId: 'neo-user' } });
    expect(db.credencialIa.upsert.mock.calls[0][0].create.usuarioId).toBe('pg-user');
    expect(response.body.data.last4).toBe('1234');
    expect(JSON.stringify(response.body)).not.toContain('gsk_private');
    expect(Object.keys(response.body.data).sort()).toEqual(['provider', 'configured', 'status', 'last4', 'validatedAt', 'updatedAt'].sort());
  });
  it('returns missing metadata and idempotent deletion', async () => {
    const response = await request(app).get(endpoint).set('Authorization', `Bearer ${token}`);
    expect(response.body.data.configured).toBe(false);
    const deleted = await request(app).delete(endpoint).set('Authorization', `Bearer ${token}`);
    expect(deleted.body).toEqual({ success: true, data: { deleted: true } });
  });
  it('maps provider rejection to 422 without exposing provider payload', async () => {
    fetch.mockResolvedValue({ ok: false, status: 401, json: async () => ({ message: 'gsk_private1234' }) });
    const response = await request(app).put(endpoint).set('Authorization', `Bearer ${token}`).send({ apiKey: 'gsk_private1234' });
    expect(response.status).toBe(422);
    expect(JSON.stringify(response.body)).not.toContain('gsk_private');
    expect(db.credencialIa.upsert).not.toHaveBeenCalled();
  });
  it('blocks quota exhaustion before validation fetch', async () => {
    db.$queryRaw.mockResolvedValue([]);
    const response = await request(app).put(endpoint).set('Authorization', `Bearer ${token}`).send({ apiKey: 'gsk_key' });
    expect(response.status).toBe(429);
    expect(fetch).not.toHaveBeenCalled();
  });
});
