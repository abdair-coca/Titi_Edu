import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// Ángulo B: credenciales y seguridad. Neo4j y Postgres son fakes en memoria,
// igual que en test/routes/auth.test.js.
vi.mock('../../../src/db.js', () => ({
  runQuery: vi.fn(),
  toNumber: (v) => Number(v ?? 0),
  default: {},
}));
vi.mock('../../../src/prisma.js', () => ({
  default: { usuario: { create: vi.fn(), findUnique: vi.fn() } },
}));

let app;
let runQuery;
let prisma;

// Neo4j falso: guarda los nodos creados y responde a las consultas de auth.js.
function neo4jEnMemoria() {
  const nodos = [];
  const record = (props) => ({ get: () => ({ properties: props }) });
  return async (cypher, params) => {
    if (cypher.includes('CREATE (u:Usuario')) {
      const props = { ...params, bio: '', createdAt: new Date().toISOString() };
      nodos.push(props);
      return [record(props)];
    }
    if (cypher.includes('u.username = $username OR u.email = $email')) {
      return nodos
        .filter((n) => n.username === params.username || n.email === params.email)
        .slice(0, 1)
        .map(record);
    }
    if (cypher.includes('MATCH (u:Usuario {email: $email})')) {
      return nodos.filter((n) => n.email === params.email).slice(0, 1).map(record);
    }
    return [];
  };
}

// Módulo fresco en cada test: el contador de intentos vive en memoria del módulo.
beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  ({ runQuery } = await import('../../../src/db.js'));
  prisma = (await import('../../../src/prisma.js')).default;
  app = (await import('../../../src/app.js')).default;
  runQuery.mockImplementation(neo4jEnMemoria());
  prisma.usuario.create.mockResolvedValue({ rol: 'ESTUDIANTE', racha: 0 });
  prisma.usuario.findUnique.mockResolvedValue({ rol: 'ESTUDIANTE', racha: 0 });
});

describe('Ronda 2 · B · credenciales y seguridad', () => {
  // Incumple R8: el bloqueo solo cuenta por email; desde una misma IP se pueden
  // probar emails distintos sin límite (credential stuffing).
  it('bloquea con 429 tras 5 logins fallidos seguidos desde la misma IP con emails distintos', async () => {
    for (let i = 1; i <= 5; i += 1) {
      const res = await request(app).post('/api/auth/login')
        .send({ email: `victima${i}@umsa.bo`, password: 'adivino123' });
      expect(res.status).toBe(401);
    }
    const sexto = await request(app).post('/api/auth/login')
      .send({ email: 'victima6@umsa.bo', password: 'adivino123' });
    expect(sexto.status).toBe(429);
    expect(sexto.body.success).toBe(false);
  });

  // Incumple R8: el contador sube recién al terminar bcrypt, así que intentos
  // lanzados en paralelo contra el mismo email pasan todos el chequeo de bloqueo.
  it('no deja más de 5 intentos fallidos contra el mismo email aunque lleguen en paralelo', async () => {
    await request(app).post('/api/auth/register')
      .send({ username: 'ana', email: 'ana@umsa.bo', password: 'correcta123' });

    const intentos = await Promise.all(
      Array.from({ length: 12 }, (_, i) => request(app).post('/api/auth/login')
        .send({ email: 'ana@umsa.bo', password: `mala${i}xx` }))
    );
    const rechazadas401 = intentos.filter((r) => r.status === 401).length;
    const bloqueadas429 = intentos.filter((r) => r.status === 429).length;

    expect(rechazadas401).toBeLessThanOrEqual(5);
    expect(bloqueadas429).toBeGreaterThanOrEqual(7);
  });

  // Incumple R6: bcrypt solo mira los primeros 72 bytes; una password mala que
  // comparte ese prefijo con la buena entra con 200 en vez de 401.
  // RESUELTO (juez, 2026-11-26): el registro rechaza con 400 las passwords de más de 72 bytes, así que el caso de R6 ya no se puede reproducir.
  it.skip('rechaza con 401 una password mala que solo difiere después del byte 72', async () => {
    const frase = 'mi frase secreta de la universidad mayor de san andres en la paz bolivia';
    expect(Buffer.byteLength(frase)).toBeGreaterThanOrEqual(72);
    const buena = `${frase} 2026!`;
    const mala = `${frase} cualquier otra cosa`;

    const reg = await request(app).post('/api/auth/register')
      .send({ username: 'luis', email: 'luis@umsa.bo', password: buena });
    expect(reg.status).toBe(201);

    const res = await request(app).post('/api/auth/login')
      .send({ email: 'luis@umsa.bo', password: mala });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, message: expect.any(String) });
  });
});
