import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// Mismo patrón de dobles que test/routes/auth.test.js: Neo4j (db.js) y
// Postgres (prisma.js) stubbeados. runQuery se respalda con un store en
// memoria que imita la semántica de Neo4j (igualdad exacta de strings).
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

let store;
const rec = (props) => ({ get: () => ({ properties: props }) });

function fakeRunQuery(cypher, params = {}) {
  if (cypher.includes('WHERE u.username = $username OR u.email = $email')) {
    const hit = store.find((u) => u.username === params.username || u.email === params.email);
    return Promise.resolve(hit ? [rec(hit)] : []);
  }
  if (cypher.startsWith('CREATE (u:Usuario')) {
    const u = { id: params.id, username: params.username, email: params.email,
      password: params.password, bio: '', avatarUrl: params.avatarUrl, createdAt: 'now' };
    store.push(u);
    return Promise.resolve([rec(u)]);
  }
  if (cypher.includes('MATCH (u:Usuario {email: $email})')) {
    const hit = store.find((u) => u.email === params.email);
    return Promise.resolve(hit ? [rec(hit)] : []);
  }
  return Promise.resolve([]);
}

async function register(body) {
  return request(app).post('/api/auth/register').send(body);
}

beforeEach(() => {
  vi.clearAllMocks();
  store = [];
  runQuery.mockImplementation(fakeRunQuery);
  prisma.usuario.create.mockResolvedValue({ rol: 'ESTUDIANTE', racha: 0 });
  prisma.usuario.findUnique.mockResolvedValue({ rol: 'ESTUDIANTE', racha: 0 });
});

describe('Adversarial B · credenciales y seguridad', () => {
  // Incumple R1: una password de solo espacios queda vacía tras quitar espacios.
  it('R1: rechaza una password formada solo por espacios', async () => {
    const res = await register({ username: 'maria', email: 'maria@umsa.bo', password: '        ' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // Incumple R4: el mismo email con otras mayúsculas y espacios es un duplicado.
  it('R4: email duplicado con mayúsculas/espacios distintos → 409', async () => {
    const first = await register({ username: 'ana', email: 'ana@umsa.bo', password: 'secret1' });
    expect(first.status).toBe(201);
    const dup = await register({ username: 'ana2', email: '  Ana@UMSA.bo ', password: 'secret1' });
    expect(dup.status).toBe(409);
  });

  // Incumple R7: login debe aceptar el email registrado sin distinguir mayúsculas ni espacios.
  it('R7: login con el email en otras mayúsculas y con espacios → 200', async () => {
    const reg = await register({ username: 'luis', email: 'luis@umsa.bo', password: 'secret1' });
    expect(reg.status).toBe(201);
    const res = await request(app).post('/api/auth/login')
      .send({ email: ' Luis@UMSA.bo ', password: 'secret1' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // Incumple R10: password numérica debe dar 400, nunca 500.
  it('R10: password de tipo número en register → 400 (no 500)', async () => {
    const res = await register({ username: 'carla', email: 'carla@umsa.bo', password: 12345678 });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // Incumple R8: tras 5 logins fallidos seguidos del mismo email → 429.
  it('R8: el sexto intento tras 5 fallos seguidos del mismo email → 429', async () => {
    const reg = await register({ username: 'pedro', email: 'pedro@umsa.bo', password: 'correcta1' });
    expect(reg.status).toBe(201);
    for (let i = 0; i < 5; i++) {
      const fail = await request(app).post('/api/auth/login')
        .send({ email: 'pedro@umsa.bo', password: `mala${i}xx` });
      expect(fail.status).toBe(401);
    }
    const sixth = await request(app).post('/api/auth/login')
      .send({ email: 'pedro@umsa.bo', password: 'mala5xx' });
    expect(sixth.status).toBe(429);
  });
});
