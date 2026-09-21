import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../src/prisma.js', () => ({ default: {} }));
vi.mock('../../src/db.js', () => ({ default: {} }));
import { readiness } from '../../src/services/readiness.js';
let db, neo4j;
beforeEach(() => {
  db = { $queryRaw: vi.fn().mockResolvedValue([{ extname: 'vector' }]), credencialIa: { findMany: vi.fn().mockResolvedValue([]) } };
  neo4j = { verifyConnectivity: vi.fn().mockResolvedValue({}) };
  vi.stubEnv('RAG_ENABLED', 'true');
  vi.stubEnv('EMBEDDING_PROVIDER', 'cloudflare');
  vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', 'account');
  vi.stubEnv('CLOUDFLARE_AI_API_TOKEN', 'embedding-token');
  vi.stubEnv('RAG_CREDENTIAL_MODE', 'user_required');
  vi.stubEnv('AI_CREDENTIAL_KEY_CURRENT', 'V1');
  vi.stubEnv('AI_CREDENTIAL_KEY_V1', Buffer.alloc(32, 1).toString('base64'));
  vi.stubEnv('AI_PROVIDER_ROUTE', 'cloudflare_gateway');
  vi.stubEnv('CLOUDFLARE_AI_GATEWAY_ID', 'gateway');
  vi.stubEnv('CLOUDFLARE_AI_GATEWAY_TOKEN', 'gateway-token');
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });
describe('readiness', () => {
  it('bounds stalled dependencies to five seconds', async () => {
    vi.useFakeTimers();
    neo4j.verifyConnectivity.mockImplementation(() => new Promise(() => {}));
    const result = readiness({ db, neo4j });
    await vi.advanceTimersByTimeAsync(5000);
    expect((await result).checks.neo4j).toBe('error');
  });
  it('checks dependencies and configuration without provider calls', async () => {
    expect(await readiness({ db, neo4j })).toEqual({ status: 'ready', checks: { postgres: 'ok', neo4j: 'ok', pgvector: 'ok', rag: 'ok', keyring: 'ok' } });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('reports unavailable postgres and Neo4j without leaking exceptions', async () => {
    db.$queryRaw.mockRejectedValue(new Error('secret database url'));
    neo4j.verifyConnectivity.mockRejectedValue(new Error('secret password'));
    const result = await readiness({ db, neo4j });
    expect(result.status).toBe('not_ready');
    expect(result.checks).toMatchObject({ postgres: 'error', neo4j: 'error', pgvector: 'error' });
    expect(JSON.stringify(result)).not.toContain('secret');
  });
  it('requires pgvector extension', async () => {
    db.$queryRaw.mockResolvedValue([]);
    expect((await readiness({ db, neo4j })).checks.pgvector).toBe('error');
  });
  it('uses Cloudflare AI embedding token, not an unrelated token', async () => {
    vi.stubEnv('CLOUDFLARE_AI_API_TOKEN', ''); vi.stubEnv('CLOUDFLARE_API_TOKEN', 'wrong-token');
    expect((await readiness({ db, neo4j })).checks.rag).toBe('error');
  });
  it('detects missing historical encryption key and gateway configuration', async () => {
    db.credencialIa.findMany.mockResolvedValue([{ keyVersion: 'OLD' }]);
    vi.stubEnv('CLOUDFLARE_AI_GATEWAY_TOKEN', '');
    expect((await readiness({ db, neo4j })).checks).toMatchObject({ keyring: 'error', rag: 'error' });
  });
});
