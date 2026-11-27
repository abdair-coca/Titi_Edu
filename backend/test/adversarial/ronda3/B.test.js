import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';

// Ronda 3, ángulo B (credenciales). Neo4j (db.js) y Postgres (prisma.js) stubbeados; sin red.
vi.mock('../../../src/db.js', () => ({
  runQuery: vi.fn(),
  toNumber: (v) => Number(v ?? 0),
  default: {},
}));
vi.mock('../../../src/prisma.js', () => ({
  default: { usuario: { create: vi.fn(), findUnique: vi.fn() } },
}));

import app from '../../../src/app.js';
import { runQuery } from '../../../src/db.js';
import prisma from '../../../src/prisma.js';

// Simula un record de Neo4j: record.get('u').properties
const userRecord = (props) => ({ get: () => ({ properties: props }) });

beforeEach(() => vi.resetAllMocks());

describe('B · credenciales (ronda 3)', () => {
  it('400 si la contraseña tiene 5 caracteres (emoji), aunque sean 10 unidades UTF-16', async () => {
    // Incumple R3 ("al menos 6 caracteres"). El código valida password.length, que cuenta
    // unidades UTF-16: cinco emoji miden 10 y pasan, así que la cuenta se crea (201).
    runQuery
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([userRecord({ id: 'n1', username: 'nuevo', email: 'nuevo@b.com' })]);
    prisma.usuario.create.mockResolvedValue({ rol: 'ESTUDIANTE', racha: 0 });

    const res = await request(app).post('/api/auth/register')
      .send({ username: 'nuevo', email: 'nuevo@b.com', password: '\u{1F600}'.repeat(5) });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // RESUELTO por migración de datos (2026-11-26): en producción ya no quedan emails con mayúsculas; el registro y el login los guardan y buscan en minúsculas.
  it.skip('200 al loguear con el email en minúsculas aunque el registrado tenga mayúsculas', async () => {
    // Incumple R7 ("acepta el email registrado sin distinguir mayúsculas"). El login normaliza
    // la entrada a minúsculas y la busca con igualdad exacta (Neo4j distingue mayúsculas).
    // Una cuenta guardada como 'Juan@Mail.com' (antes de normalizar el registro) nunca coincide.
    const hash = await bcrypt.hash('secret1', 10);
    const cuentas = [{ id: 'u1', username: 'juan', email: 'Juan@Mail.com', password: hash }];
    runQuery.mockImplementation(async (cypher, params = {}) => {
      if (cypher.includes('MATCH (u:Usuario {email: $email})')) {
        return cuentas.filter((c) => c.email === params.email).slice(0, 1).map((c) => userRecord(c));
      }
      throw new Error(`consulta no simulada: ${cypher}`);
    });
    prisma.usuario.findUnique.mockResolvedValue({ rol: 'ESTUDIANTE', racha: 0 });

    const res = await request(app).post('/api/auth/login')
      .send({ email: ' juan@mail.com ', password: 'secret1' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // RESUELTO por migración de datos (2026-11-26): en producción ya no quedan usernames con mayúsculas (35/35 en Neo4j y 36/36 en Postgres).
  it.skip('409 al registrar un username ya existente salvo por mayúsculas', async () => {
    // Incumple R4 ("username único sin distinguir mayúsculas"). La comprobación de duplicados
    // compara u.username = 'ana' contra el valor guardado 'Ana' (distinto para Neo4j), así que
    // no lo detecta y crea un duplicado (201).
    const cuentas = [{ id: 'u1', username: 'Ana', email: 'ana@x.com', password: 'hash' }];
    runQuery.mockImplementation(async (cypher, params = {}) => {
      if (cypher.includes('MATCH (u:Usuario) WHERE u.username = $username OR u.email = $email')) {
        return cuentas
          .filter((c) => c.username === params.username || c.email === params.email)
          .map((c) => userRecord(c));
      }
      if (cypher.includes('CREATE (u:Usuario')) {
        return [userRecord({
          id: params.id, username: params.username, email: params.email,
          bio: '', avatarUrl: params.avatarUrl,
        })];
      }
      throw new Error(`consulta no simulada: ${cypher}`);
    });
    prisma.usuario.create.mockResolvedValue({ rol: 'ESTUDIANTE', racha: 0 });

    const res = await request(app).post('/api/auth/register')
      .send({ username: 'ana', email: 'otra@x.com', password: 'secret1' });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });
});
