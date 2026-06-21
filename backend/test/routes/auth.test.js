import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';

// Neo4j (db.js) y Postgres (prisma.js) stubbeados.
vi.mock('../../src/db.js', () => ({
  runQuery: vi.fn(),
  toNumber: (v) => Number(v ?? 0),
  default: {},
}));
vi.mock('../../src/prisma.js', () => ({
  default: { usuario: { create: vi.fn(), findUnique: vi.fn() } },
}));

import app from '../../src/app.js';
import { runQuery } from '../../src/db.js';
import prisma from '../../src/prisma.js';

// Simula un record de Neo4j: record.get('u').properties
const userRecord = (props) => ({ get: () => ({ properties: props }) });

beforeEach(() => vi.clearAllMocks());

describe('POST /api/auth/register', () => {
  it('400 si faltan campos', async () => {
    const res = await request(app).post('/api/auth/register').send({ username: 'a' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('400 si la contraseña es corta', async () => {
    const res = await request(app).post('/api/auth/register')
      .send({ username: 'a', email: 'a@b.com', password: '123' });
    expect(res.status).toBe(400);
  });

  it('409 si el usuario o email ya existe', async () => {
    runQuery.mockResolvedValueOnce([userRecord({ id: 'x' })]); // existing check
    const res = await request(app).post('/api/auth/register')
      .send({ username: 'taken', email: 'a@b.com', password: 'secret1' });
    expect(res.status).toBe(409);
  });

  it('201 y token en el camino feliz', async () => {
    runQuery
      .mockResolvedValueOnce([]) // no existe
      .mockResolvedValueOnce([userRecord({ id: 'new-id', username: 'nuevo', email: 'n@b.com' })]); // create
    prisma.usuario.create.mockResolvedValue({ rol: 'ESTUDIANTE', racha: 0 });

    const res = await request(app).post('/api/auth/register')
      .send({ username: 'nuevo', email: 'n@b.com', password: 'secret1' });

    expect(res.status).toBe(201);
    expect(res.body.data.token).toBeTruthy();
    expect(res.body.data.user.username).toBe('nuevo');
  });
});

describe('POST /api/auth/login', () => {
  it('400 si faltan credenciales', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.com' });
    expect(res.status).toBe(400);
  });

  it('401 si el usuario no existe', async () => {
    runQuery.mockResolvedValueOnce([]);
    const res = await request(app).post('/api/auth/login')
      .send({ email: 'no@b.com', password: 'secret1' });
    expect(res.status).toBe(401);
  });

  it('401 si la contraseña no coincide', async () => {
    const hash = await bcrypt.hash('correcta', 10);
    runQuery.mockResolvedValueOnce([userRecord({ id: 'u1', username: 'u', email: 'u@b.com', password: hash })]);
    const res = await request(app).post('/api/auth/login')
      .send({ email: 'u@b.com', password: 'incorrecta' });
    expect(res.status).toBe(401);
  });

  it('200 y token en el camino feliz', async () => {
    const hash = await bcrypt.hash('correcta', 10);
    runQuery.mockResolvedValueOnce([userRecord({ id: 'u1', username: 'u', email: 'u@b.com', password: hash })]);
    prisma.usuario.findUnique.mockResolvedValue({ rol: 'PROFESOR', racha: 3 });
    const res = await request(app).post('/api/auth/login')
      .send({ email: 'u@b.com', password: 'correcta' });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeTruthy();
    expect(res.body.data.user.rol).toBe('PROFESOR');
  });
});
