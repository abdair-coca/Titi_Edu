import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// Ronda 3, ángulo A (validación de entrada). Dobles en memoria, mismo patrón que test/routes/auth.test.js.
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

const userRecord = (props) => ({ get: () => ({ properties: props }) });

// Registro sin duplicados: la búsqueda no encuentra nada y la creación devuelve el usuario nuevo.
function mockRegistroLibre() {
  runQuery
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([userRecord({ id: 'nuevo', username: 'x', email: 'x@b.com' })]);
  prisma.usuario.create.mockResolvedValue({ rol: 'ESTUDIANTE', racha: 0 });
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('ataque A: validación de entrada', () => {
  it('R3: una contraseña de 5 caracteres con un emoji debe rechazarse con 400', async () => {
    // Incumple R3: "pass" + emoji son 5 caracteres, pero .length cuenta 6 unidades UTF-16 y la acepta.
    mockRegistroLibre();
    const res = await request(app).post('/api/auth/register')
      .send({ username: 'emoji', email: 'emoji@b.com', password: 'pass\u{1F600}' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('R2: un email con etiqueta vacía en el dominio (gmail..com) debe rechazarse con 400', async () => {
    // Incumple R2: "juan@gmail..com" no tiene formato válido; EMAIL_RE lo acepta.
    mockRegistroLibre();
    const res = await request(app).post('/api/auth/register')
      .send({ username: 'juan', email: 'juan@gmail..com', password: 'secret1' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
