import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

vi.mock('../../src/db.js', () => ({ runQuery: vi.fn(), toNumber: (v) => Number(v ?? 0), default: {} }));
vi.mock('../../src/prisma.js', () => ({
  default: { usuario: { findUnique: vi.fn() } },
}));
vi.mock('../../src/services/tienda.service.js', () => ({
  catalogoConInventario: vi.fn(),
  inventarioDe: vi.fn(),
  comprarItem: vi.fn(),
  consumirItem: vi.fn(),
  activarMultiplicador: vi.fn(),
}));

import app from '../../src/app.js';
import prisma from '../../src/prisma.js';
import { catalogoConInventario, inventarioDe, comprarItem, activarMultiplicador } from '../../src/services/tienda.service.js';

const tokenFor = (neoId) => jwt.sign({ id: neoId }, process.env.JWT_SECRET, { expiresIn: '1h' });

beforeEach(() => vi.clearAllMocks());

describe('GET /api/shop/items', () => {
  it('401 sin token', async () => {
    const res = await request(app).get('/api/shop/items');
    expect(res.status).toBe(401);
  });

  it('200 devuelve catálogo + saldo', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'u1', gotasSaldo: 120 });
    catalogoConInventario.mockResolvedValue([
      { codigo: 'congelar_racha', precio: 50, cantidad: 1 },
    ]);
    const res = await request(app).get('/api/shop/items')
      .set('Authorization', `Bearer ${tokenFor('neo-1')}`);
    expect(res.status).toBe(200);
    expect(res.body.data.saldo).toBe(120);
    expect(res.body.data.items).toHaveLength(1);
  });
});

describe('GET /api/shop/inventory', () => {
  it('200 devuelve el inventario', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'u1', gotasSaldo: 0 });
    inventarioDe.mockResolvedValue([{ codigo: 'intento_extra', cantidad: 2 }]);
    const res = await request(app).get('/api/shop/inventory')
      .set('Authorization', `Bearer ${tokenFor('neo-1')}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items[0].codigo).toBe('intento_extra');
  });
});

describe('POST /api/shop/buy', () => {
  it('401 sin token', async () => {
    const res = await request(app).post('/api/shop/buy').send({ codigo: 'congelar_racha' });
    expect(res.status).toBe(401);
  });

  it('400 sin código', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'u1', gotasSaldo: 100 });
    const res = await request(app).post('/api/shop/buy')
      .set('Authorization', `Bearer ${tokenFor('neo-1')}`).send({});
    expect(res.status).toBe(400);
  });

  it('200 compra exitosa', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'u1', gotasSaldo: 100 });
    comprarItem.mockResolvedValue({ ok: true, saldo: 50, cantidad: 1 });
    const res = await request(app).post('/api/shop/buy')
      .set('Authorization', `Bearer ${tokenFor('neo-1')}`).send({ codigo: 'congelar_racha' });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ saldo: 50, cantidad: 1 });
  });

  it('409 si no alcanza el saldo', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'u1', gotasSaldo: 0 });
    comprarItem.mockResolvedValue({ ok: false, error: 'saldo' });
    const res = await request(app).post('/api/shop/buy')
      .set('Authorization', `Bearer ${tokenFor('neo-1')}`).send({ codigo: 'congelar_racha' });
    expect(res.status).toBe(409);
  });

  it('404 si el ítem no existe', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'u1', gotasSaldo: 100 });
    comprarItem.mockResolvedValue({ ok: false, error: 'no_encontrado' });
    const res = await request(app).post('/api/shop/buy')
      .set('Authorization', `Bearer ${tokenFor('neo-1')}`).send({ codigo: 'xxx' });
    expect(res.status).toBe(404);
  });
});

describe('POST /api/shop/use', () => {
  it('200 activa el multiplicador', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'u1', gotasSaldo: 0 });
    const hasta = new Date(Date.now() + 3600_000);
    activarMultiplicador.mockResolvedValue({ ok: true, hasta });
    const res = await request(app).post('/api/shop/use')
      .set('Authorization', `Bearer ${tokenFor('neo-1')}`).send({ codigo: 'multiplicador_gotas' });
    expect(res.status).toBe(200);
    expect(res.body.data.multiplicadorHasta).toBeTruthy();
  });

  it('409 si no tiene multiplicador', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'u1', gotasSaldo: 0 });
    activarMultiplicador.mockResolvedValue({ ok: false, error: 'sin_stock' });
    const res = await request(app).post('/api/shop/use')
      .set('Authorization', `Bearer ${tokenFor('neo-1')}`).send({ codigo: 'multiplicador_gotas' });
    expect(res.status).toBe(409);
  });

  it('400 para ítems de uso automático', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'u1', gotasSaldo: 0 });
    const res = await request(app).post('/api/shop/use')
      .set('Authorization', `Bearer ${tokenFor('neo-1')}`).send({ codigo: 'congelar_racha' });
    expect(res.status).toBe(400);
  });
});
