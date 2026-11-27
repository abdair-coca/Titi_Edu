import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// Mismo patrón de dobles que test/routes/auth.test.js: Neo4j y Postgres stubbeados.
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

// Neo4j falso en memoria: aplica la igualdad exacta de Cypher sobre los valores guardados.
let usuarios = [];
const rec = (props) => ({ get: () => ({ properties: props }) });

beforeEach(() => {
  vi.clearAllMocks();
  usuarios = [];
  runQuery.mockImplementation(async (cypher, params) => {
    if (cypher.includes('WHERE u.username = $username OR u.email = $email')) {
      return usuarios
        .filter((u) => u.username === params.username || u.email === params.email)
        .slice(0, 1)
        .map(rec);
    }
    if (cypher.includes('CREATE (u:Usuario')) {
      const props = { ...params, bio: '', createdAt: '2026-11-26T00:00:00Z' };
      usuarios.push(props);
      return [rec(props)];
    }
    if (cypher.includes('MATCH (u:Usuario {email: $email})')) {
      return usuarios.filter((u) => u.email === params.email).slice(0, 1).map(rec);
    }
    return [];
  });
  prisma.usuario.create.mockResolvedValue({ rol: 'ESTUDIANTE', racha: 0 });
  prisma.usuario.findUnique.mockResolvedValue({ rol: 'ESTUDIANTE', racha: 0 });
});

const registrar = (body) => request(app).post('/api/auth/register').send(body);

describe('Ronda 2 · A · validación de entrada', () => {
  // Incumple R3: "😀😀😀" son 3 caracteres; el código mide unidades UTF-16 (.length === 6) y lo acepta.
  it('rechaza con 400 una password de 3 caracteres emoji', async () => {
    const res = await registrar({ username: 'emoji', email: 'emoji@gmail.com', password: '😀😀😀' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // Incumple R2: dos puntos seguidos en el dominio no es un email válido.
  it('rechaza con 400 un email con puntos consecutivos en el dominio', async () => {
    const res = await registrar({ username: 'juan', email: 'juan@gmail..com', password: 'secreta1' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // Incumple R2: la parte local de un email admite como máximo 64 caracteres (RFC 5321);
  // este email tiene 300 en total.
  // DESCARTADO (usuario, 2026-11-26): R2 no limita el largo del email; solo se rechazan partes vacías del dominio.
  it.skip('rechaza con 400 un email muy largo', async () => {
    const email = `${'a'.repeat(290)}@gmail.com`;
    const res = await registrar({ username: 'largo', email, password: 'secreta1' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // Incumple R4: "ana" + U+200B (ZERO WIDTH SPACE, típico al copiar y pegar) es el mismo
  // username con un espacio alrededor; trim() no lo quita y se registra un duplicado.
  it('responde 409 al registrar un username existente con un espacio de ancho cero al final', async () => {
    const primero = await registrar({ username: 'ana', email: 'ana@gmail.com', password: 'secreta1' });
    expect(primero.status).toBe(201);

    const res = await registrar({ username: 'ana​', email: 'otra@gmail.com', password: 'secreta1' });
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });
});
