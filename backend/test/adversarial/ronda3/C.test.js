// Ronda 3 · ángulo C (flujo y estado) sobre src/routes/auth.js.
// Cada test cita la cláusula de la especificación que el código actual incumple.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';

// Neo4j (db.js) y Postgres (prisma.js) stubbeados, igual que test/routes/auth.test.js.
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

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

// Simula un record de Neo4j: record.get('u').properties
const registro = (props) => ({ get: () => ({ properties: props }) });

let nodos = [];

// Base en memoria que responde a las consultas de auth.js con igualdad exacta,
// como Cypher (sensible a mayúsculas). No simula ninguna restricción UNIQUE.
function instalarBase({ semilla = [], antesDeLeer = async () => {} } = {}) {
  nodos = [...semilla];
  runQuery.mockImplementation(async (cypher, params) => {
    if (cypher.startsWith('MATCH (u:Usuario) WHERE')) {
      // La lectura de duplicados toma su foto al llamarse, como una consulta real.
      const hallados = nodos
        .filter((n) => n.username === params.username || n.email === params.email)
        .slice(0, 1);
      await antesDeLeer();
      return hallados.map(registro);
    }
    if (cypher.startsWith('CREATE (u:Usuario')) {
      const nodo = {
        id: params.id,
        username: params.username,
        email: params.email,
        password: params.password,
        bio: '',
        avatarUrl: params.avatarUrl,
        createdAt: 'ahora',
      };
      nodos.push(nodo);
      return [registro(nodo)];
    }
    if (cypher.startsWith('MATCH (u:Usuario {email: $email})')) {
      const hallado = nodos.find((n) => n.email === params.email);
      return hallado ? [registro(hallado)] : [];
    }
    throw new Error(`consulta no prevista: ${cypher}`);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  prisma.usuario.create.mockResolvedValue({ rol: 'ESTUDIANTE', racha: 0 });
  prisma.usuario.findUnique.mockResolvedValue({ rol: 'ESTUDIANTE', racha: 0 });
});

describe('flujo y estado de registro y login (ángulo C)', () => {
  // DESCARTADO (juez, 2026-11-26): el doble no modela la UNIQUE de username (src/db.js:35); con ella la ruta responde 409.
  it.skip('dos registros simultáneos con el mismo username: uno debe recibir 409', async () => {
    // Incumple R4: username único. El bloqueo en auth.js solo serializa por email, así que
    // dos altas con emails distintos y el mismo username leen la base antes de que cualquiera
    // escriba, y ambas responden 201.
    // Supuesto: Neo4j no tiene restricción UNIQUE sobre Usuario.username (no verificado;
    // la configuración de constraints está fuera del ámbito).
    let lecturas = 0;
    let abrir;
    const dosLecturas = new Promise((r) => { abrir = r; });
    instalarBase({
      antesDeLeer: async () => {
        lecturas += 1;
        if (lecturas === 2) abrir();
        await Promise.race([dosLecturas, new Promise((r) => setTimeout(r, 2000))]);
      },
    });

    const [a, b] = await Promise.all([
      request(app).post('/api/auth/register')
        .send({ username: 'ana', email: 'ana1@mail.com', password: 'secret1' }),
      request(app).post('/api/auth/register')
        .send({ username: 'ana', email: 'ana2@mail.com', password: 'secret1' }),
    ]);

    expect([a.status, b.status].sort()).toEqual([201, 409]);
  });

  // RESUELTO por migración de datos (2026-11-26): en producción ya no quedan emails con mayúsculas; el registro y el login los guardan y buscan en minúsculas.
  it.skip('registrar un email ya existente con otras mayúsculas responde 409', async () => {
    // Incumple R4: email único sin distinguir mayúsculas. Supuesto: la cuenta antigua quedó
    // guardada como "Ana@Mail.com", antes de la normalización (commit 5a65c14). La consulta
    // compara u.email = $email con el email ya en minúsculas y no la encuentra.
    const hash = await bcrypt.hash('secret1', 4);
    instalarBase({
      semilla: [{
        id: 'viejo', username: 'Ana', email: 'Ana@Mail.com',
        password: hash, bio: '', avatarUrl: '', createdAt: 'antes',
      }],
    });

    const res = await request(app).post('/api/auth/register')
      .send({ username: 'otra', email: 'ana@mail.com', password: 'secret1' });

    expect(res.status).toBe(409);
  });

  // RESUELTO por migración de datos (2026-11-26): en producción ya no quedan emails con mayúsculas; el registro y el login los guardan y buscan en minúsculas.
  it.skip('login con el email tal como se registró (con mayúsculas) responde 200', async () => {
    // Incumple R7: login debe aceptar el email registrado sin distinguir mayúsculas.
    // Mismo supuesto de cuenta antigua: login pasa el email a minúsculas y busca por igualdad
    // exacta, así que no encuentra la cuenta guardada como "Ana@Mail.com".
    const hash = await bcrypt.hash('secret1', 4);
    instalarBase({
      semilla: [{
        id: 'viejo', username: 'ana', email: 'Ana@Mail.com',
        password: hash, bio: '', avatarUrl: '', createdAt: 'antes',
      }],
    });

    const res = await request(app).post('/api/auth/login')
      .send({ email: 'Ana@Mail.com', password: 'secret1' });

    expect(res.status).toBe(200);
  });
});
