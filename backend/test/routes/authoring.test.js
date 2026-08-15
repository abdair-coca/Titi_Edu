import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { sha256 } from '../../src/services/authoring.service.js';

const mocks = vi.hoisted(() => {
  const operations = new Map();
  const client = {
    usuario: { findUnique: vi.fn() },
    categoria: { findMany: vi.fn() },
    curso: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), delete: vi.fn() },
    modulo: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
    leccion: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
    material: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
    evaluacion: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
    pregunta: { findMany: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
    opcion: { deleteMany: vi.fn() },
    intento: { findMany: vi.fn(), count: vi.fn() },
    progreso: { count: vi.fn() },
    notaLeccion: { count: vi.fn() },
    comentarioLeccion: { count: vi.fn() },
    cursoProfesor: { deleteMany: vi.fn() },
    inscripcion: { findUnique: vi.fn() },
    tokenServicio: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    operacionAutoria: {
      findUnique: vi.fn(({ where }) => Promise.resolve(operations.get(`${where.actorKey_idempotencyKey.actorKey}:${where.actorKey_idempotencyKey.idempotencyKey}`) || null)),
      create: vi.fn(({ data }) => {
        const operation = { id: `op-${operations.size + 1}`, estado: 'PENDIENTE', ...data };
        operations.set(`${data.actorKey}:${data.idempotencyKey}`, operation);
        return Promise.resolve(operation);
      }),
      update: vi.fn(({ where, data }) => {
        const entry = [...operations.entries()].find(([, operation]) => operation.id === where.id);
        const updated = { ...entry[1], ...data };
        operations.set(entry[0], updated);
        return Promise.resolve(updated);
      }),
    },
  };
  client.$transaction = vi.fn(async (callback) => callback(client));
  return { client, operations };
});

vi.mock('../../src/prisma.js', () => ({ default: mocks.client }));
vi.mock('../../src/db.js', () => ({ runQuery: vi.fn(), toNumber: (value) => Number(value || 0), default: {} }));

import app from '../../src/app.js';

const jwtToken = jwt.sign({ id: 'neo-author' }, process.env.JWT_SECRET, { expiresIn: '1h' });
const auth = { Authorization: `Bearer ${jwtToken}` };
const author = { id: 'u-author', neoId: 'neo-author', rol: 'PROFESOR', verificado: true };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.operations.clear();
  process.env.AUTHORING_API_ENABLED = 'false';
  process.env.AUTHORING_CONFIRMATION_SECRET = 'authoring-test-secret';
  mocks.client.usuario.findUnique.mockResolvedValue(author);
  mocks.client.categoria.findMany.mockResolvedValue([]);
  mocks.client.evaluacion.findFirst.mockResolvedValue(null);
  mocks.client.curso.updateMany.mockResolvedValue({ count: 1 });
  mocks.client.modulo.updateMany.mockResolvedValue({ count: 1 });
});

describe('authoring JWT and idempotency', () => {
  it('mantiene autoría manual JWT disponible con feature flag apagado', async () => {
    mocks.client.curso.create.mockResolvedValue({ id: 'c1', titulo: 'Course', publicado: false });
    const body = { titulo: 'Course', descripcion: 'Description', nivel: 'basic', categoriaId: 'cat1' };
    const first = await request(app).post('/api/authoring/courses')
      .set(auth).set('Idempotency-Key', 'create-course-1').send(body);
    expect(first.status).toBe(201);
    expect(mocks.client.curso.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ creadorId: author.id, publicado: false }),
    }));

    const replay = await request(app).post('/api/authoring/courses')
      .set(auth).set('Idempotency-Key', 'create-course-1').send(body);
    expect(replay.status).toBe(201);
    expect(replay.headers['idempotency-replayed']).toBe('true');
    expect(mocks.client.curso.create).toHaveBeenCalledTimes(1);

    const conflict = await request(app).post('/api/authoring/courses')
      .set(auth).set('Idempotency-Key', 'create-course-1').send({ ...body, titulo: 'Other' });
    expect(conflict.status).toBe(409);
  });

  it('exige Idempotency-Key en mutations', async () => {
    const response = await request(app).post('/api/authoring/courses').set(auth).send({});
    expect(response.status).toBe(400);
    expect(mocks.client.curso.create).not.toHaveBeenCalled();
  });
});

describe('legacy authoring security boundary', () => {
  it.each([
    ['post', '/api/courses', {}],
    ['put', '/api/courses/c1', {}],
    ['post', '/api/courses/c1/publish', {}],
    ['post', '/api/courses/c1/unpublish', {}],
    ['delete', '/api/courses/c1', {}],
    ['post', '/api/courses/c1/modules', {}],
    ['put', '/api/modules/m1', {}],
    ['delete', '/api/modules/m1', {}],
    ['post', '/api/modules/m1/lessons', {}],
    ['put', '/api/lessons/l1', {}],
    ['delete', '/api/lessons/l1', {}],
    ['post', '/api/modules/m1/evaluation', {}],
    ['post', '/api/courses/c1/final-evaluation', {}],
    ['put', '/api/evaluations/e1', {}],
    ['delete', '/api/evaluations/e1', {}],
    ['post', '/api/lessons/l1/materials', {}],
    ['delete', '/api/materials/mat1', {}],
  ])('%s %s queda bloqueado fuera de /api/authoring', async (method, path, body) => {
    const response = await request(app)[method](path).set(auth).send(body);
    expect(response.status).toBe(410);
    expect(response.body).toMatchObject({ success: false });
    expect(response.body.message).toContain('/api/authoring');
  });
});

describe('service token enforcement', () => {
  const plain = `titi_svc_deadbeef_${Buffer.alloc(32, 7).toString('base64url')}`;
  const record = {
    id: 'svc1',
    prefijo: 'titi_svc_deadbeef',
    tokenHash: sha256(plain),
    scopes: ['course:read'],
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null,
    usuario: author,
  };

  it('bloquea tokens de servicio cuando flag está apagado', async () => {
    const response = await request(app).get('/api/authoring/categories').set('Authorization', `Bearer ${plain}`);
    expect(response.status).toBe(401);
  });

  it('valida hash, scope, expiración y revocación en cada request', async () => {
    process.env.AUTHORING_API_ENABLED = 'true';
    mocks.client.tokenServicio.findUnique.mockResolvedValue(record);
    mocks.client.tokenServicio.update.mockResolvedValue(record);
    expect((await request(app).get('/api/authoring/categories').set('Authorization', `Bearer ${plain}`)).status).toBe(200);

    mocks.client.tokenServicio.findUnique.mockResolvedValue({ ...record, scopes: ['content:write'] });
    expect((await request(app).get('/api/authoring/categories').set('Authorization', `Bearer ${plain}`)).status).toBe(403);

    mocks.client.tokenServicio.findUnique.mockResolvedValue({ ...record, expiresAt: new Date(Date.now() - 1) });
    expect((await request(app).get('/api/authoring/categories').set('Authorization', `Bearer ${plain}`)).status).toBe(401);

    mocks.client.tokenServicio.findUnique.mockResolvedValue({ ...record, revokedAt: new Date() });
    expect((await request(app).get('/api/authoring/categories').set('Authorization', `Bearer ${plain}`)).status).toBe(401);
  });

  it('limita token general a cursos creados por su usuario', async () => {
    process.env.AUTHORING_API_ENABLED = 'true';
    mocks.client.tokenServicio.findUnique.mockResolvedValue(record);
    mocks.client.tokenServicio.update.mockResolvedValue(record);
    mocks.client.curso.findUnique.mockResolvedValue({ id: 'other', creadorId: 'another-user' });
    const response = await request(app).get('/api/authoring/courses/other').set('Authorization', `Bearer ${plain}`);
    expect(response.status).toBe(403);
  });
});

describe('service token lifecycle', () => {
  it('persiste solo prefix+hash y entrega plaintext una sola vez', async () => {
    mocks.client.tokenServicio.create.mockImplementation(({ data }) => Promise.resolve({
      id: 'svc-new', nombre: data.nombre, prefijo: data.prefijo, scopes: data.scopes,
      expiresAt: data.expiresAt, createdAt: new Date(),
    }));
    const body = { nombre: 'Integration', scopes: ['course:read'] };
    const first = await request(app).post('/api/authoring/service-tokens')
      .set(auth).set('Idempotency-Key', 'token-create-1').send(body);
    expect(first.status).toBe(201);
    expect(first.body.data.token).toMatch(/^titi_svc_/);
    const createData = mocks.client.tokenServicio.create.mock.calls[0][0].data;
    expect(createData).not.toHaveProperty('token');
    expect(createData.tokenHash).toBe(sha256(first.body.data.token));
    expect(createData.expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * 24 * 60 * 60_000);

    const replay = await request(app).post('/api/authoring/service-tokens')
      .set(auth).set('Idempotency-Key', 'token-create-1').send(body);
    expect(replay.headers['idempotency-replayed']).toBe('true');
    expect(replay.body.data.token).toBeNull();
  });
});

describe('publication freshness', () => {
  it('devuelve 412 cuando el snapshot cambia luego del preview', async () => {
    const snapshot = {
      id: 'm1', titulo: 'Draft', descripcion: null, orden: 1, estado: 'BORRADOR',
      curso: { id: 'c1', creadorId: author.id, publicado: false, version: 0 },
      version: 0,
      lecciones: [], evaluacion: null,
    };
    mocks.client.modulo.findUnique.mockResolvedValueOnce(snapshot);
    const preview = await request(app).post('/api/authoring/modules/m1/preview-publication').set(auth).send({});
    expect(preview.status).toBe(200);

    mocks.client.modulo.findUnique.mockResolvedValueOnce({ ...snapshot, titulo: 'Changed' });
    const publish = await request(app).post('/api/authoring/modules/m1/publish')
      .set(auth).set('Idempotency-Key', 'publish-m1').send({
        expectedFingerprint: preview.body.data.fingerprint,
        confirmationToken: preview.body.data.confirmationToken,
        phrase: preview.body.data.phrase,
      });
    expect(publish.status).toBe(412);
    expect(mocks.client.modulo.update).not.toHaveBeenCalled();
  });

  it('rechaza publicar un curso sin módulos publicados', async () => {
    const course = {
      id: 'c1', titulo: 'Course', descripcion: 'Description', nivel: 'basic', categoriaId: 'cat1',
      portadaUrl: null, emiteCertificado: true, publicado: false, creadorId: author.id, version: 0,
      modulos: [],
    };
    mocks.client.curso.findUnique.mockResolvedValue(course);
    const preview = await request(app).post('/api/authoring/courses/c1/preview-publication').set(auth).send({});
    const publish = await request(app).post('/api/authoring/courses/c1/publish')
      .set(auth).set('Idempotency-Key', 'publish-c1').send({
        expectedFingerprint: preview.body.data.fingerprint,
        confirmationToken: preview.body.data.confirmationToken,
        phrase: preview.body.data.phrase,
      });
    expect(publish.status).toBe(422);
    expect(mocks.client.curso.update).not.toHaveBeenCalled();
  });

  it('devuelve 412 si una mutacion descendiente gana el CAS durante publicacion', async () => {
    const snapshot = {
      id: 'm-race', titulo: 'Draft', descripcion: null, orden: 1, estado: 'BORRADOR', version: 2,
      curso: { id: 'c-race', creadorId: author.id, publicado: false, version: 5 },
      lecciones: [], evaluacion: null,
    };
    mocks.client.modulo.findUnique.mockResolvedValue(snapshot);
    const preview = await request(app).post('/api/authoring/modules/m-race/preview-publication').set(auth).send({});
    mocks.client.curso.updateMany.mockResolvedValue({ count: 1 });
    mocks.client.modulo.updateMany.mockResolvedValue({ count: 0 });

    const publish = await request(app).post('/api/authoring/modules/m-race/publish')
      .set(auth).set('Idempotency-Key', 'publish-race').send({
        expectedFingerprint: preview.body.data.fingerprint,
        confirmationToken: preview.body.data.confirmationToken,
        phrase: preview.body.data.phrase,
      });

    expect(publish.status).toBe(412);
    expect(mocks.client.modulo.update).not.toHaveBeenCalled();
  });

  it('exige preview firmado completo para despublicar', async () => {
    const snapshot = {
      id: 'm-live', titulo: 'Live', descripcion: null, orden: 1, estado: 'PUBLICADO', version: 3,
      curso: { id: 'c-live', creadorId: author.id, publicado: true, version: 8 },
      lecciones: [], evaluacion: null,
    };
    mocks.client.modulo.findUnique.mockResolvedValue(snapshot);
    const preview = await request(app).post('/api/authoring/modules/m-live/preview-unpublish').set(auth).send({});
    expect(preview.status).toBe(200);
    expect(preview.body.data.summary.id).toBe('m-live');
    expect(preview.body.data.phrase).toBe('DESPUBLICAR MODULO m-live');

    const missing = await request(app).post('/api/authoring/modules/m-live/unpublish')
      .set(auth).set('Idempotency-Key', 'unpublish-missing').send({ expectedFingerprint: preview.body.data.fingerprint });
    expect(missing.status).toBe(422);

    mocks.client.modulo.update.mockResolvedValue({ ...snapshot, estado: 'BORRADOR', version: 4 });
    const valid = await request(app).post('/api/authoring/modules/m-live/unpublish')
      .set(auth).set('Idempotency-Key', 'unpublish-valid').send({
        expectedFingerprint: preview.body.data.fingerprint,
        confirmationToken: preview.body.data.confirmationToken,
        phrase: preview.body.data.phrase,
      });
    expect(valid.status).toBe(200);
    expect(valid.body.data.module.estado).toBe('BORRADOR');
  });
});
