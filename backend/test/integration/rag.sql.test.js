import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Exercises the real retrieval SQL, which the hermetic suite can only mock. Opt-in:
//   docker run -d --name titi-rag-test -e POSTGRES_PASSWORD=test -e POSTGRES_DB=rag -p 55433:5432 pgvector/pgvector:pg16
//   DATABASE_URL=<local url> npx prisma migrate deploy
//   RAG_TEST_DATABASE_URL=<local url> npx vitest run test/integration
const testUrl = process.env.RAG_TEST_DATABASE_URL;

vi.mock('../../src/db.js', () => ({ runQuery: vi.fn(), toNumber: (value) => Number(value || 0), default: {} }));

function assertDisposableDatabase(url) {
  const { hostname } = new URL(url);
  if (!['localhost', '127.0.0.1'].includes(hostname)) {
    throw new Error('RAG_TEST_DATABASE_URL must point to a local disposable database');
  }
}

// With the query fixed at the first axis, the cosine similarity equals `value`.
function vectorWithSimilarity(value) {
  const vector = Array.from({ length: 768 }, () => 0);
  vector[0] = value;
  vector[1] = Math.sqrt(1 - value ** 2);
  return `[${vector.join(',')}]`;
}

describe.skipIf(!testUrl)('RAG retrieval SQL on real Postgres with pgvector', () => {
  let prisma;
  let searchCourseContext;
  const courseId = randomUUID();
  const lessonId = randomUUID();
  const staleLessonId = randomUUID();

  async function insertDocument(leccionId, version) {
    const documento = await prisma.documentoRag.create({
      data: { leccionId, version, estado: 'LISTO', activo: true, hashContenido: randomUUID(), modelo: 'test', assessmentSafe: true },
    });
    return documento.id;
  }

  async function insertFragment(documentoId, orden, contenido, similarity) {
    const embedding = vectorWithSimilarity(similarity);
    await prisma.$executeRaw`
      INSERT INTO "FragmentoRag" ("id", "documentoId", "orden", "contenido", "embedding")
      VALUES (${randomUUID()}, ${documentoId}, ${orden}, ${contenido}, ${embedding}::vector)
    `;
  }

  beforeAll(async () => {
    assertDisposableDatabase(testUrl);
    process.env.DATABASE_URL = testUrl;
    Object.assign(process.env, {
      EMBEDDING_PROVIDER: 'local',
      EMBEDDING_API_URL: 'https://embeddings.example',
      EMBEDDING_API_KEY: 'test-key',
      EMBEDDING_MODEL: 'test',
    });
    const queryVector = Array.from({ length: 768 }, (_, index) => (index === 0 ? 1 : 0));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ embedding: queryVector }] }),
    }));

    prisma = (await import('../../src/prisma.js')).default;
    ({ searchCourseContext } = await import('../../src/services/rag.service.js'));

    const suffix = randomUUID();
    const usuario = await prisma.usuario.create({ data: { neoId: suffix, username: suffix, email: `${suffix}@example.com` } });
    const categoria = await prisma.categoria.create({ data: { nombre: suffix, icono: 'x' } });
    await prisma.curso.create({
      data: {
        id: courseId,
        titulo: 'Redes',
        descripcion: 'Curso',
        nivel: 'BASICO',
        publicado: true,
        categoriaId: categoria.id,
        creadorId: usuario.id,
        modulos: {
          create: {
            titulo: 'Fundamentos',
            orden: 1,
            estado: 'PUBLICADO',
            lecciones: {
              create: [
                { id: lessonId, titulo: 'NAT', contenido: 'x', orden: 1, estado: 'PUBLICADA', version: 2 },
                { id: staleLessonId, titulo: 'Vieja', contenido: 'x', orden: 2, estado: 'PUBLICADA', version: 5 },
              ],
            },
          },
        },
      },
    });

    const documentoId = await insertDocument(lessonId, 2);
    await insertFragment(documentoId, 0, 'NAT traduce direcciones privadas en direcciones públicas.', 0.2);
    await insertFragment(documentoId, 1, 'Las direcciones aparecen en muchos protocolos distintos.', 0.2);
    await insertFragment(documentoId, 2, 'Una subred divide un bloque en partes pequeñas.', 0.7);
    await insertFragment(documentoId, 3, 'Una tabla de enrutamiento indica por dónde enviar paquetes.', 0.69);

    const staleDocumentoId = await insertDocument(staleLessonId, 4);
    await insertFragment(staleDocumentoId, 0, 'NAT en un documento de una versión anterior.', 0.99);
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    await prisma?.$disconnect();
  });

  it('qualifies a fragment that contains every term despite low similarity', async () => {
    const fallback = vi.spyOn(console, 'error').mockImplementation(() => {});
    const rows = await searchCourseContext(courseId, 'q', 5, { ftsQuery: '¿Qué es NAT?' });
    const match = rows.find((row) => row.content.startsWith('NAT traduce'));
    expect(match).toMatchObject({ ftsMatch: true });
    expect(match.similarity).toBeCloseTo(0.2, 5);
    expect(fallback).not.toHaveBeenCalled();
    fallback.mockRestore();
  });

  it('would not match if full-text received the enriched embedding query', async () => {
    const rows = await searchCourseContext(courseId, 'q', 5, { ftsQuery: '¿Qué es NAT?\nTema de la lección actual: Redes' });
    expect(rows.some((row) => row.ftsMatch)).toBe(false);
  });

  it('does not qualify a low-similarity fragment that shares only some terms', async () => {
    const rows = await searchCourseContext(courseId, 'q', 5, { ftsQuery: 'direcciones de protocolos cifrados' });
    expect(rows.some((row) => row.content.startsWith('Las direcciones'))).toBe(false);
    expect(rows.some((row) => row.content.startsWith('NAT traduce'))).toBe(false);
  });

  it('lets a partial match reorder evidence that already qualifies', async () => {
    const vectorOnly = await searchCourseContext(courseId, 'q', 5, { ftsQuery: 'zzzzz' });
    expect(vectorOnly[0].content).toMatch(/^Una subred/);

    const boosted = await searchCourseContext(courseId, 'q', 5, { ftsQuery: 'enrutamiento de transporte' });
    expect(boosted[0].content).toMatch(/^Una tabla de enrutamiento/);
    expect(boosted[0].ftsMatch).toBe(false);
  });

  it('continues by vector when the message has no useful terms', async () => {
    const fallback = vi.spyOn(console, 'error').mockImplementation(() => {});
    const rows = await searchCourseContext(courseId, 'q', 5, { ftsQuery: '¿y eso?' });
    expect(rows.map((row) => row.content)).toEqual([
      'Una subred divide un bloque en partes pequeñas.',
      'Una tabla de enrutamiento indica por dónde enviar paquetes.',
    ]);
    expect(fallback).not.toHaveBeenCalled();
    fallback.mockRestore();
  });

  it('survives punctuation that is special in tsquery syntax', async () => {
    const fallback = vi.spyOn(console, 'error').mockImplementation(() => {});
    await searchCourseContext(courseId, 'q', 5, { ftsQuery: "O'Reilly & co | !NAT (x) <-> :*" });
    expect(fallback).not.toHaveBeenCalled();
    fallback.mockRestore();
  });

  it('excludes documents from an older lesson version', async () => {
    const rows = await searchCourseContext(courseId, 'q', 5, { ftsQuery: 'NAT' });
    expect(rows.some((row) => row.content.includes('versión anterior'))).toBe(false);
  });

  it('finds a lesson again once its document moves to the current version', async () => {
    const before = await searchCourseContext(courseId, 'q', 5, { ftsQuery: 'versión anterior' });
    expect(before.some((row) => row.lessonId === staleLessonId)).toBe(false);

    await prisma.documentoRag.updateMany({ where: { leccionId: staleLessonId }, data: { version: 5 } });

    const after = await searchCourseContext(courseId, 'q', 5, { ftsQuery: 'versión anterior' });
    expect(after.some((row) => row.lessonId === staleLessonId)).toBe(true);
    await prisma.documentoRag.updateMany({ where: { leccionId: staleLessonId }, data: { version: 4 } });
  });

  it('lists lessons whose active document belongs to another version', async () => {
    const { staleLessonIds } = await import('../../src/routes/admin-rag.js');
    await expect(staleLessonIds(courseId)).resolves.toEqual([staleLessonId]);
    await expect(staleLessonIds(randomUUID())).resolves.toEqual([]);
    expect(await staleLessonIds(null)).toContain(staleLessonId);
  });

  it('honors the lesson filter in both modes', async () => {
    const rows = await searchCourseContext(courseId, 'q', 5, { lessonId, ftsQuery: 'NAT' });
    expect(rows.every((row) => row.lessonId === lessonId)).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
  });
});
