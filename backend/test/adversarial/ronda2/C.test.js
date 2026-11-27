import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';

// Fake en memoria de Neo4j: una lista de nodos Usuario con latencia simulada.
// Solo modela la restricción UNIQUE sobre email que menciona routes/auth.js.
const store = vi.hoisted(() => ({ usuarios: [] }));

vi.mock('../../../src/db.js', () => {
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  const record = (props) => ({ get: () => ({ properties: props }) });
  return {
    toNumber: (v) => Number(v ?? 0),
    default: {},
    runQuery: vi.fn(async (cypher, params) => {
      await espera(40); // latencia de red de Aura
      if (cypher.includes('WHERE u.username = $username OR u.email = $email')) {
        const u = store.usuarios.find((x) => x.username === params.username || x.email === params.email);
        return u ? [record(u)] : [];
      }
      if (cypher.includes('MATCH (u:Usuario {email: $email})')) {
        const u = store.usuarios.find((x) => x.email === params.email);
        return u ? [record(u)] : [];
      }
      if (cypher.trim().startsWith('CREATE (u:Usuario')) {
        if (store.usuarios.some((x) => x.email === params.email)) {
          const err = new Error('constraint');
          err.code = 'Neo.ClientError.Schema.ConstraintValidationFailed';
          throw err;
        }
        const u = { ...params, bio: '', createdAt: new Date().toISOString() };
        store.usuarios.push(u);
        return [record(u)];
      }
      return [];
    }),
  };
});
vi.mock('../../../src/prisma.js', () => ({
  default: {
    usuario: {
      create: vi.fn(async () => ({ rol: 'ESTUDIANTE', racha: 0 })),
      findUnique: vi.fn(async () => ({ rol: 'ESTUDIANTE', racha: 0 })),
    },
  },
}));

import app from '../../../src/app.js';

beforeEach(() => {
  store.usuarios.length = 0;
});

describe('Ataque C · flujo y estado', () => {
  // Incumple R8: el bloqueo es solo por email; 5 fallos seguidos desde la misma IP
  // (probando emails distintos) no llevan a 429.
  it('tras 5 logins fallidos desde la misma IP con emails distintos, el sexto da 429', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await request(app).post('/api/auth/login')
        .send({ email: `ip-victima${i}@b.com`, password: 'adivina1' });
      expect(res.status).toBe(401);
    }
    const sexto = await request(app).post('/api/auth/login')
      .send({ email: 'ip-victima-final@b.com', password: 'adivina1' });
    expect(sexto.status).toBe(429);
  });

  // Incumple R8: con peticiones simultáneas todas pasan el chequeo de bloqueo antes
  // de que se registre ningún fallo, así que se prueban más de 5 contraseñas.
  it('20 logins fallidos simultáneos del mismo email: como mucho 5 reciben 401, el resto 429', async () => {
    const hash = await bcrypt.hash('correcta1', 4);
    store.usuarios.push({ id: 'u-rafaga', username: 'rafaga', email: 'rafaga@b.com', password: hash });

    const respuestas = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        request(app).post('/api/auth/login').send({ email: 'rafaga@b.com', password: `mala${i}xx` })
      )
    );
    const fallidos = respuestas.filter((r) => r.status === 401).length;
    const bloqueados = respuestas.filter((r) => r.status === 429).length;
    expect(fallidos).toBeLessThanOrEqual(5);
    expect(bloqueados).toBeGreaterThanOrEqual(15);
  });

  // Incumple R4: la exclusión mutua es por email; dos registros a la vez con el mismo
  // username (distinto en mayúsculas) y emails distintos crean dos usuarios.
  // DESCARTADO (juez, 2026-11-26): el doble no modela la UNIQUE de username (src/db.js:35); con ella la ruta responde 409.
  it.skip('dos registros simultáneos con el mismo username y distinto email: uno 201 y otro 409', async () => {
    const [a, b] = await Promise.all([
      request(app).post('/api/auth/register')
        .send({ username: 'Mateo', email: 'mateo1@b.com', password: 'secret1' }),
      request(app).post('/api/auth/register')
        .send({ username: ' mateo ', email: 'mateo2@b.com', password: 'secret1' }),
    ]);
    const estados = [a.status, b.status].sort();
    expect(estados).toEqual([201, 409]);
    expect(store.usuarios.filter((u) => u.username === 'mateo')).toHaveLength(1);
  });
});
