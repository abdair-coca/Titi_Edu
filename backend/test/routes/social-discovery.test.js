import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

vi.mock('../../src/db.js', () => ({
  runQuery: vi.fn(),
  toNumber: (v) => Number(v ?? 0),
  default: {},
}));
vi.mock('../../src/prisma.js', () => ({ default: { usuario: { findUnique: vi.fn() } } }));
vi.mock('../../src/services/upload.service.js', () => ({
  cloudinaryEnabled: false,
  uploadBuffer: vi.fn(),
  destroyAsset: vi.fn(),
}));

import app from '../../src/app.js';
import { runQuery } from '../../src/db.js';

const token = jwt.sign(
  { id: 'user-1', username: 'testuser', email: 'test@example.com', rol: 'ESTUDIANTE' },
  process.env.JWT_SECRET,
  { expiresIn: '1h' },
);
const auth = { Authorization: `Bearer ${token}` };

/** Registro falso de Neo4j: get/has sobre un objeto plano. */
const rec = (obj) => ({ get: (k) => obj[k], has: (k) => k in obj });
const userNode = (id, username, extra = {}) => ({ properties: { id, username, ...extra } });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/users/suggestions', () => {
  it('401 sin token', async () => {
    const res = await request(app).get('/api/users/suggestions');
    expect(res.status).toBe(401);
  });

  it('amigos de amigos primero y relleno con los más seguidos', async () => {
    runQuery
      .mockResolvedValueOnce([
        rec({ s: userNode('u-2', 'ana', { bio: 'Hola' }), mutualCount: 2, mutualSample: ['beto', 'caro'], followerCount: 5 }),
      ])
      .mockResolvedValueOnce([rec({ s: userNode('u-3', 'dani'), followerCount: 9 })]);

    const res = await request(app).get('/api/users/suggestions?limit=2').set(auth);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.users).toEqual([
      { id: 'u-2', username: 'ana', bio: 'Hola', avatarUrl: null, followerCount: 5, mutualCount: 2, mutualSample: ['beto', 'caro'] },
      { id: 'u-3', username: 'dani', bio: null, avatarUrl: null, followerCount: 9, mutualCount: 0, mutualSample: [] },
    ]);
    // El relleno excluye a los ya sugeridos y pide solo lo que falta.
    expect(runQuery).toHaveBeenCalledTimes(2);
    expect(runQuery.mock.calls[1][1]).toMatchObject({ userId: 'user-1', exclude: ['u-2'], limit: 1 });
  });

  it('no rellena si los amigos de amigos alcanzan', async () => {
    runQuery.mockResolvedValueOnce([
      rec({ s: userNode('u-2', 'ana'), mutualCount: 1, mutualSample: ['beto'], followerCount: 1 }),
    ]);
    const res = await request(app).get('/api/users/suggestions?limit=1').set(auth);
    expect(res.status).toBe(200);
    expect(res.body.data.users).toHaveLength(1);
    expect(runQuery).toHaveBeenCalledTimes(1);
  });

  it('acota el límite a 20', async () => {
    runQuery.mockResolvedValue([]);
    await request(app).get('/api/users/suggestions?limit=500').set(auth);
    expect(runQuery.mock.calls[0][1].limit).toBe(20);
  });

  it('500 con mensaje en español si Neo4j falla', async () => {
    runQuery.mockRejectedValueOnce(new Error('neo caído'));
    const res = await request(app).get('/api/users/suggestions').set(auth);
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ success: false, message: 'Error obteniendo sugerencias' });
  });
});

describe('GET /api/search/trending', () => {
  it('401 sin token', async () => {
    const res = await request(app).get('/api/search/trending');
    expect(res.status).toBe(401);
  });

  it('devuelve los hashtags recientes', async () => {
    runQuery.mockResolvedValueOnce([rec({ name: 'calculo', postCount: 4 }), rec({ name: 'python', postCount: 2 })]);
    const res = await request(app).get('/api/search/trending').set(auth);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      hashtags: [
        { name: 'calculo', postCount: 4 },
        { name: 'python', postCount: 2 },
      ],
      recent: true,
    });
    expect(runQuery).toHaveBeenCalledTimes(1);
    expect(runQuery.mock.calls[0][0]).toContain('duration');
  });

  it('sin recientes cae a los de siempre', async () => {
    runQuery.mockResolvedValueOnce([]).mockResolvedValueOnce([rec({ name: 'titi', postCount: 7 })]);
    const res = await request(app).get('/api/search/trending?limit=3').set(auth);
    expect(res.body.data).toEqual({ hashtags: [{ name: 'titi', postCount: 7 }], recent: false });
    expect(runQuery.mock.calls[1][0]).not.toContain('duration');
    expect(runQuery.mock.calls[1][1].limit).toBe(3);
  });

  it('500 si Neo4j falla', async () => {
    runQuery.mockRejectedValueOnce(new Error('x'));
    const res = await request(app).get('/api/search/trending').set(auth);
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

describe('GET /api/search (usuarios)', () => {
  it('suma followerCount e isFollowing a cada usuario', async () => {
    runQuery
      .mockResolvedValueOnce([rec({ u: userNode('u-2', 'ana', { bio: 'Cálculo' }), followerCount: 3, isFollowing: true })])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const res = await request(app).get('/api/search?q=ana').set(auth);
    expect(res.status).toBe(200);
    expect(res.body.data.users).toEqual([
      { id: 'u-2', username: 'ana', bio: 'Cálculo', avatarUrl: undefined, followerCount: 3, isFollowing: true },
    ]);
    expect(runQuery.mock.calls[0][1]).toEqual({ q: 'ana', userId: 'user-1' });
  });

  it('sin término no consulta Neo4j', async () => {
    const res = await request(app).get('/api/search?q=').set(auth);
    expect(res.body.data).toEqual({ users: [], posts: [], hashtags: [] });
    expect(runQuery).not.toHaveBeenCalled();
  });
});
