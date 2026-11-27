import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// Mismo patrón de dobles que test/routes/auth.test.js: Neo4j y Postgres stubbeados.
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

// Fake en memoria de Neo4j: ejecuta literalmente las tres consultas de auth.js
// (igualdad exacta, como hace Cypher) con una pequeña latencia de red.
let store;
const record = (props) => ({ get: () => ({ properties: { ...props } }) });
const tick = () => new Promise((r) => setTimeout(r, 5));

function installFakeNeo4j() {
  store = [];
  runQuery.mockImplementation(async (cypher, params) => {
    await tick();
    if (cypher.includes('u.username = $username OR u.email = $email')) {
      return store
        .filter((u) => u.username === params.username || u.email === params.email)
        .slice(0, 1)
        .map(record);
    }
    if (cypher.includes('CREATE (u:Usuario')) {
      const u = {
        id: params.id,
        username: params.username,
        email: params.email,
        password: params.password,
        bio: '',
        avatarUrl: params.avatarUrl,
        createdAt: new Date().toISOString(),
      };
      store.push(u);
      return [record(u)];
    }
    if (cypher.includes('MATCH (u:Usuario {email: $email})')) {
      return store.filter((u) => u.email === params.email).slice(0, 1).map(record);
    }
    return [];
  });
  prisma.usuario.create.mockResolvedValue({ rol: 'ESTUDIANTE', racha: 0 });
  prisma.usuario.findUnique.mockResolvedValue({ rol: 'ESTUDIANTE', racha: 0 });
}

beforeEach(() => {
  vi.clearAllMocks();
  installFakeNeo4j();
});

describe('Ataque C: flujo y estado de auth', () => {
  // Incumple R4
  it('un segundo registro con el mismo email/username en otra capitalización y con espacios da 409', async () => {
    const first = await request(app).post('/api/auth/register')
      .send({ username: 'AnaQuispe', email: 'ana.quispe@umsa.bo', password: 'secret1' });
    expect(first.status).toBe(201);

    const dup = await request(app).post('/api/auth/register')
      .send({ username: '  anaquispe ', email: ' ANA.QUISPE@UMSA.BO ', password: 'secret1' });
    expect(dup.status).toBe(409);
  });

  // Incumple R4
  it('dos registros simultáneos con el mismo email: uno 201 y el otro 409', async () => {
    const body = { username: 'carlos', email: 'carlos@umsa.bo', password: 'secret1' };
    const [a, b] = await Promise.all([
      request(app).post('/api/auth/register').send(body),
      request(app).post('/api/auth/register').send(body),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
  });

  // Incumple R7
  it('login tras registro acepta el email con otra capitalización y espacios alrededor', async () => {
    const reg = await request(app).post('/api/auth/register')
      .send({ username: 'lucia', email: 'Lucia.Mamani@UMSA.bo', password: 'secret1' });
    expect(reg.status).toBe(201);

    const login = await request(app).post('/api/auth/login')
      .send({ email: '  lucia.mamani@umsa.bo ', password: 'secret1' });
    expect(login.status).toBe(200);
    expect(login.body.success).toBe(true);
  });

  // Incumple R8
  it('tras 5 logins fallidos seguidos del mismo email, el siguiente intento da 429', async () => {
    const reg = await request(app).post('/api/auth/register')
      .send({ username: 'jorge', email: 'jorge@umsa.bo', password: 'correcta1' });
    expect(reg.status).toBe(201);

    for (let i = 0; i < 5; i++) {
      const fail = await request(app).post('/api/auth/login')
        .send({ email: 'jorge@umsa.bo', password: `mala${i}xx` });
      expect(fail.status).toBe(401);
    }
    const sixth = await request(app).post('/api/auth/login')
      .send({ email: 'jorge@umsa.bo', password: 'mala5xx' });
    expect(sixth.status).toBe(429);
    expect(sixth.body.success).toBe(false);
  });
});
