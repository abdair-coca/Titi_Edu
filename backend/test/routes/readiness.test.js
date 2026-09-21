import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
const mocks = vi.hoisted(() => ({
  readiness: vi.fn(), db: {
    usuario: { findUnique: vi.fn() },
    ragIndexJob: { groupBy: vi.fn() }, credencialIa: { groupBy: vi.fn() }, ragQuotaWindow: { aggregate: vi.fn() },
  },
}));
vi.mock('../../src/prisma.js', () => ({ default: mocks.db }));
vi.mock('../../src/db.js', () => ({ default: {}, runQuery: vi.fn(), toNumber: (n) => Number(n) }));
vi.mock('../../src/services/readiness.js', () => ({ readiness: mocks.readiness }));
import app from '../../src/app.js';
const allOk = { status: 'ready', checks: { postgres: 'ok', neo4j: 'ok', pgvector: 'ok', rag: 'ok', keyring: 'ok' } };
const token = jwt.sign({ id: 'neo-admin' }, process.env.JWT_SECRET);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.readiness.mockResolvedValue(allOk);
  mocks.db.usuario.findUnique.mockResolvedValue({ id: 'pg-admin', rol: 'ADMIN' });
  mocks.db.ragIndexJob.groupBy.mockResolvedValue([{ status: 'PENDING', _count: { _all: 3 } }]);
  mocks.db.credencialIa.groupBy.mockResolvedValue([{ status: 'VALID', _count: { _all: 7 } }]);
  mocks.db.ragQuotaWindow.aggregate.mockResolvedValue({ _sum: { count: 12 } });
});
describe('health, readiness and RAG operations', () => {
  it('health stays live without accessing dependencies', async () => {
    expect((await request(app).get('/api/health')).status).toBe(200);
    expect(mocks.readiness).not.toHaveBeenCalled();
  });
  it('ready returns complete safe checks', async () => {
    const response = await request(app).get('/api/ready');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, data: allOk });
  });
  it('not ready uses 503 without changing response shape', async () => {
    const data = { status: 'not_ready', checks: { ...allOk.checks, postgres: 'error' } };
    mocks.readiness.mockResolvedValue(data);
    const response = await request(app).get('/api/ready');
    expect(response.status).toBe(503);
    expect(response.body).toEqual({ success: false, data });
  });
  it('unexpected readiness failure stays sanitized with full checks', async () => {
    mocks.readiness.mockRejectedValue(new Error('secret password'));
    const response = await request(app).get('/api/ready');
    expect(response.status).toBe(503);
    expect(response.body.data.status).toBe('not_ready');
    expect(Object.values(response.body.data.checks)).toEqual(Array(5).fill('error'));
    expect(JSON.stringify(response.body)).not.toContain('secret');
  });
  it('does not log credential material when JSON parsing fails before the route', async () => {
    const marker = 'gsk_parse_marker_secret';
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await request(app)
      .put('/api/rag/credentials/groq')
      .set('Content-Type', 'application/json')
      .send(`{"apiKey":"${marker}"`);
    expect(response.status).toBe(400);
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(marker);
    errorSpy.mockRestore();
  });
  it('admin operations exposes counts only', async () => {
    const response = await request(app).get('/api/admin/rag/operations').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ jobs: { PENDING: 3 }, credentials: { VALID: 7 }, usageToday: { chatRequests: 12 }, readiness: allOk });
    expect(mocks.db.credencialIa.groupBy).toHaveBeenCalledWith({ by: ['status'], _count: { _all: true } });
  });
  it('operations requires admin role', async () => {
    mocks.db.usuario.findUnique.mockResolvedValue({ id: 'pg-student', rol: 'ESTUDIANTE' });
    const response = await request(app).get('/api/admin/rag/operations').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(403);
    expect(mocks.db.credencialIa.groupBy).not.toHaveBeenCalled();
  });
});
