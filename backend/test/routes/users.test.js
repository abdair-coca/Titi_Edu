import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

vi.mock('../../src/db.js', () => ({
  runQuery: vi.fn(),
  toNumber: (v) => Number(v ?? 0),
  default: {},
}));
vi.mock('../../src/prisma.js', () => ({
  default: {
    usuario: { findUnique: vi.fn() },
  },
}));
vi.mock('../../src/services/upload.service.js', () => ({
  cloudinaryEnabled: false,
  uploadBuffer: vi.fn().mockResolvedValue({ url: 'https://cloudinary.test/img.png', publicId: 'pid-1' }),
  destroyAsset: vi.fn(),
}));

import app from '../../src/app.js';
import { runQuery } from '../../src/db.js';

const token = jwt.sign(
  { id: 'user-1', username: 'testuser', email: 'test@example.com', rol: 'ESTUDIANTE' },
  process.env.JWT_SECRET,
  { expiresIn: '1h' }
);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PUT /api/users/me', () => {
  it('401 si no está autenticado', async () => {
    const res = await request(app).put('/api/users/me').send({ bio: 'Hola' });
    expect(res.status).toBe(401);
  });

  it('400 si bio excede 280 caracteres', async () => {
    const longBio = 'a'.repeat(281);
    const res = await request(app)
      .put('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ bio: longBio });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('280');
  });

  it('400 si no se envían campos para actualizar', async () => {
    const res = await request(app)
      .put('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('200 actualiza perfil y devuelve usuario con bannerUrl', async () => {
    const mockNode = {
      properties: {
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
        bio: 'Estudiante de Informática',
        avatarUrl: 'https://ejemplo.com/avatar.png',
        bannerUrl: 'https://ejemplo.com/banner.png',
        createdAt: '2026-09-01T00:00:00.000Z',
      },
    };

    runQuery.mockResolvedValueOnce([{ get: () => mockNode }]);

    const res = await request(app)
      .put('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({
        bio: 'Estudiante de Informática',
        avatarUrl: 'https://ejemplo.com/avatar.png',
        bannerUrl: 'https://ejemplo.com/banner.png',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.bio).toBe('Estudiante de Informática');
    expect(res.body.data.user.bannerUrl).toBe('https://ejemplo.com/banner.png');
    expect(runQuery).toHaveBeenCalledWith(
      expect.stringContaining('SET u.bio = $bio, u.avatarUrl = $avatarUrl, u.bannerUrl = $bannerUrl'),
      expect.objectContaining({
        id: 'user-1',
        bio: 'Estudiante de Informática',
      })
    );
  });
});

describe('POST /api/users/me/avatar', () => {
  it('401 si no está autenticado', async () => {
    const res = await request(app).post('/api/users/me/avatar');
    expect(res.status).toBe(401);
  });

  it('400 si no se envía archivo', async () => {
    const res = await request(app)
      .post('/api/users/me/avatar')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('200 si se sube una imagen válida', async () => {
    const mockNode = {
      properties: {
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
        avatarUrl: '/uploads/avatar-mock.png',
        bannerUrl: null,
      },
    };
    runQuery.mockResolvedValueOnce([{ get: () => mockNode }]);

    const res = await request(app)
      .post('/api/users/me/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('fake-image-content'), {
        filename: 'avatar.png',
        contentType: 'image/png',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('avatarUrl');
  });
});

describe('POST /api/users/me/banner', () => {
  it('401 si no está autenticado', async () => {
    const res = await request(app).post('/api/users/me/banner');
    expect(res.status).toBe(401);
  });

  it('400 si no se envía archivo', async () => {
    const res = await request(app)
      .post('/api/users/me/banner')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('200 si se sube un banner válido', async () => {
    const mockNode = {
      properties: {
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
        avatarUrl: null,
        bannerUrl: '/uploads/banner-mock.png',
      },
    };
    runQuery.mockResolvedValueOnce([{ get: () => mockNode }]);

    const res = await request(app)
      .post('/api/users/me/banner')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('fake-banner-content'), {
        filename: 'banner.png',
        contentType: 'image/png',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('bannerUrl');
  });
});
