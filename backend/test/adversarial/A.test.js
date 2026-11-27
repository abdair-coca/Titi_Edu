import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// Mismo patrón de dobles que test/routes/auth.test.js: Neo4j (db.js) y
// Postgres (prisma.js) stubbeados. runQuery se respalda con un almacén en
// memoria que imita la igualdad exacta de Cypher (`=` y `{prop: $x}`).
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
const asRecord = (props) => ({ get: () => ({ properties: props }) });

function fakeNeo4j(cypher, params) {
  if (cypher.includes('WHERE u.username = $username OR u.email = $email')) {
    return store
      .filter((u) => u.username === params.username || u.email === params.email)
      .slice(0, 1)
      .map(asRecord);
  }
  if (cypher.includes('CREATE (u:Usuario')) {
    const u = {
      id: params.id, username: params.username, email: params.email,
      password: params.password, bio: '', avatarUrl: params.avatarUrl,
      createdAt: new Date().toISOString(),
    };
    store.push(u);
    return [asRecord(u)];
  }
  if (cypher.includes('MATCH (u:Usuario {email: $email})')) {
    return store.filter((u) => u.email === params.email).slice(0, 1).map(asRecord);
  }
  return [];
}

beforeEach(() => {
  vi.clearAllMocks();
  store = [];
  runQuery.mockImplementation(async (c, p) => fakeNeo4j(c, p));
  prisma.usuario.create.mockResolvedValue({ rol: 'ESTUDIANTE', racha: 0 });
  prisma.usuario.findUnique.mockResolvedValue({ rol: 'ESTUDIANTE', racha: 0 });
});

const register = (body) => request(app).post('/api/auth/register').send(body);
const login = (body) => request(app).post('/api/auth/login').send(body);

describe('Ángulo A · validación de entrada en /api/auth', () => {
  // Incumple R1: un username de solo espacios queda vacío tras quitar espacios.
  it('R1 · register con username de solo espacios responde 400', async () => {
    const res = await register({ username: '   ', email: 'ana@umsa.bo', password: 'secret1' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // Incumple R2: "ana.umsa.bo" no es un email con formato válido.
  it('R2 · register con email sin @ responde 400', async () => {
    const res = await register({ username: 'ana', email: 'ana.umsa.bo', password: 'secret1' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // Incumple R4: el email duplicado solo difiere en mayúsculas y espacios alrededor.
  it('R4 · register con email ya usado en otra capitalización y con espacios responde 409', async () => {
    const first = await register({ username: 'ana', email: 'ana@umsa.bo', password: 'secret1' });
    expect(first.status).toBe(201);

    const dup = await register({ username: 'otra', email: '  ANA@Umsa.bo ', password: 'secret1' });
    expect(dup.status).toBe(409);
  });

  // Incumple R7: login con el email registrado en mayúsculas y con espacios.
  it('R7 · login acepta el email registrado sin distinguir mayúsculas ni espacios', async () => {
    const reg = await register({ username: 'ana', email: 'ana@umsa.bo', password: 'secret1' });
    expect(reg.status).toBe(201);

    const res = await login({ email: ' Ana@UMSA.bo ', password: 'secret1' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // Incumple R10: password numérica (tipo inesperado) debe dar 400, nunca 500.
  it('R10 · register con password numérica responde 400 y no 500', async () => {
    const res = await register({ username: 'ana', email: 'ana@umsa.bo', password: 12345678 });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
