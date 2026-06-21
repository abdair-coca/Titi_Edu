import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

vi.mock('../../src/db.js', () => ({ runQuery: vi.fn(), toNumber: (v) => Number(v ?? 0), default: {} }));
vi.mock('../../src/prisma.js', () => ({ default: { curso: { findMany: vi.fn() } } }));

import app from '../../src/app.js';
import { runQuery } from '../../src/db.js';

const token = jwt.sign({ id: 'neo-1' }, process.env.JWT_SECRET, { expiresIn: '1h' });

beforeEach(() => vi.clearAllMocks());

describe('GET /api/posts/feed', () => {
  it('401 sin token', async () => {
    const res = await request(app).get('/api/posts/feed');
    expect(res.status).toBe(401);
  });

  it('200 y devuelve nextCursor con token', async () => {
    runQuery.mockResolvedValue([]); // feed vacío
    const res = await request(app).get('/api/posts/feed')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('nextCursor');
    expect(res.body.data.posts).toEqual([]);
  });
});

describe('GET /api/posts/explore', () => {
  it('200 anónimo (optionalAuth)', async () => {
    runQuery.mockResolvedValue([]);
    const res = await request(app).get('/api/posts/explore');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('nextCursor');
  });
});

describe('POST /api/posts', () => {
  it('400 si no hay contenido ni imagen', async () => {
    const res = await request(app).post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: '' });
    expect(res.status).toBe(400);
  });
});
