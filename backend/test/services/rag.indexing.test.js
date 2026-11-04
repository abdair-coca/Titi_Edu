import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  leccion: { findUnique: vi.fn() },
  documentoRag: { findUnique: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn(), update: vi.fn(), create: vi.fn() },
  fragmentoRag: { deleteMany: vi.fn() },
  executeRaw: vi.fn(),
  $transaction: vi.fn(),
}));

vi.mock('../../src/prisma.js', () => ({ default: mocks }));

import { indexLesson } from '../../src/services/rag.service.js';

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of ['RAG_ENABLED', 'RAG_COURSE_IDS', 'EMBEDDING_API_URL', 'EMBEDDING_API_KEY', 'EMBEDDING_MODEL', 'EMBEDDING_PROVIDER', 'EMBEDDING_MAX_RETRIES', 'RAG_INDEX_TRANSACTION_MAX_WAIT_MS', 'RAG_INDEX_TRANSACTION_TIMEOUT_MS']) {
    delete process.env[key];
  }
});

describe('RAG indexing feature flag', () => {
  beforeEach(() => {
      vi.clearAllMocks();
      mocks.documentoRag.findFirst.mockResolvedValue(null);
      mocks.documentoRag.updateMany.mockResolvedValue({ count: 0 });
      mocks.documentoRag.update.mockResolvedValue({});
    mocks.documentoRag.create.mockResolvedValue({});
    process.env.RAG_ENABLED = 'true';
    process.env.RAG_COURSE_IDS = 'course-pilot';
    mocks.leccion.findUnique.mockResolvedValue({
      id: 'lesson-1',
      estado: 'PUBLICADA',
      titulo: 'Lesson',
      contenido: 'Content',
      modulo: { estado: 'PUBLICADO', curso: { id: 'course-other', publicado: true } },
    });
  });

  it('does not index a published lesson outside the enabled course allowlist', async () => {
    await expect(indexLesson('lesson-1')).resolves.toMatchObject({
      status: 'SKIPPED',
      reason: 'feature_disabled',
    });
    expect(mocks.documentoRag.findUnique).not.toHaveBeenCalled();
    expect(mocks.executeRaw).not.toHaveBeenCalled();
  });

  it('quarantines active documents without deleting previous fragments when embedding fails', async () => {
    mocks.leccion.findUnique.mockResolvedValue({
      id: 'lesson-1',
      estado: 'PUBLICADA',
      titulo: 'Lesson',
      contenido: 'Content',
      modulo: { estado: 'PUBLICADO', curso: { id: 'course-pilot', publicado: true } },
    });
    mocks.documentoRag.findUnique.mockResolvedValue({
      id: 'document-1',
      activo: true,
      estado: 'LISTO',
      hashContenido: 'old-hash',
      modelo: 'old-model',
    });
    process.env.EMBEDDING_API_URL = 'https://embeddings.example';
    process.env.EMBEDDING_API_KEY = 'test-key';
    process.env.EMBEDDING_MODEL = 'google/embeddinggemma-300M';
    process.env.EMBEDDING_PROVIDER = 'local';
    process.env.EMBEDDING_MAX_RETRIES = '0';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('provider unavailable')));

    await expect(indexLesson('lesson-1')).rejects.toMatchObject({ status: 502 });
    expect(mocks.documentoRag.updateMany).toHaveBeenCalledWith({
      where: { leccionId: 'lesson-1', activo: true },
      data: expect.objectContaining({ estado: 'FALLIDO', activo: false, error: expect.any(String) }),
    });
    expect(mocks.fragmentoRag.deleteMany).not.toHaveBeenCalled();
    expect(mocks.executeRaw).not.toHaveBeenCalled();
  });

  it('quarantines an active evaluable document when reindexing fails', async () => {
    mocks.leccion.findUnique.mockResolvedValue({
      id: 'lesson-1',
      estado: 'PUBLICADA',
      titulo: 'Evaluación',
      contenido: 'Contenido evaluable',
      recursoHtml: { html: '<p>Actividad visible</p>', evaluable: true },
      modulo: { estado: 'PUBLICADO', curso: { id: 'course-pilot', publicado: true } },
    });
    mocks.documentoRag.findUnique.mockResolvedValue({
      id: 'document-1',
      activo: true,
      estado: 'LISTO',
      hashContenido: 'old-hash',
      modelo: 'old-model',
    });
    process.env.EMBEDDING_API_URL = 'https://embeddings.example';
    process.env.EMBEDDING_API_KEY = 'test-key';
    process.env.EMBEDDING_MODEL = 'google/embeddinggemma-300M';
    process.env.EMBEDDING_PROVIDER = 'local';
    process.env.EMBEDDING_MAX_RETRIES = '0';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('provider unavailable')));

    await expect(indexLesson('lesson-1')).rejects.toMatchObject({ status: 502 });
    expect(mocks.documentoRag.update).toHaveBeenCalledWith({
      where: { id: 'document-1' },
      data: expect.objectContaining({ estado: 'FALLIDO', activo: false, error: expect.any(String) }),
    });
    expect(mocks.documentoRag.updateMany).toHaveBeenCalledWith({
      where: { leccionId: 'lesson-1', activo: true },
      data: expect.objectContaining({ estado: 'FALLIDO', activo: false, error: expect.any(String) }),
    });
    expect(mocks.fragmentoRag.deleteMany).not.toHaveBeenCalled();
  });

  it('quarantines older active evaluable documents when the current version has no document', async () => {
    mocks.leccion.findUnique.mockResolvedValue({
      id: 'lesson-1',
      version: 2,
      estado: 'PUBLICADA',
      titulo: 'Evaluación actualizada',
      contenido: 'Contenido evaluable actualizado',
      recursoHtml: { html: '<p>Actividad visible</p>', evaluable: true },
      modulo: { estado: 'PUBLICADO', curso: { id: 'course-pilot', publicado: true } },
    });
    mocks.documentoRag.findUnique.mockResolvedValue(null);
    process.env.EMBEDDING_API_URL = 'https://embeddings.example';
    process.env.EMBEDDING_API_KEY = 'test-key';
    process.env.EMBEDDING_MODEL = 'google/embeddinggemma-300M';
    process.env.EMBEDDING_PROVIDER = 'local';
    process.env.EMBEDDING_MAX_RETRIES = '0';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('provider unavailable')));

    await expect(indexLesson('lesson-1')).rejects.toMatchObject({ status: 502 });
    expect(mocks.documentoRag.updateMany).toHaveBeenCalledWith({
      where: { leccionId: 'lesson-1', activo: true },
      data: expect.objectContaining({ estado: 'FALLIDO', activo: false, error: expect.any(String) }),
    });
    expect(mocks.documentoRag.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ leccionId: 'lesson-1', version: 2, estado: 'FALLIDO', activo: false }),
    });
  });

  it('swaps fragments only inside a transaction after embeddings are ready', async () => {
    mocks.leccion.findUnique.mockResolvedValue({
      id: 'lesson-1',
      estado: 'PUBLICADA',
      titulo: 'Lesson',
      contenido: 'Content',
      modulo: { estado: 'PUBLICADO', curso: { id: 'course-pilot', publicado: true } },
    });
    mocks.documentoRag.findUnique.mockResolvedValue(null);
    process.env.EMBEDDING_API_URL = 'https://embeddings.example';
    process.env.EMBEDDING_API_KEY = 'test-key';
    process.env.EMBEDDING_MODEL = 'google/embeddinggemma-300M';
    process.env.EMBEDDING_PROVIDER = 'local';
    process.env.EMBEDDING_MAX_RETRIES = '0';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ embedding: Array.from({ length: 768 }, () => 0.01) }] }),
    }));
    const tx = {
      documentoRag: {
        updateMany: vi.fn(),
        create: vi.fn().mockResolvedValue({ id: 'document-1' }),
        update: vi.fn().mockResolvedValue({ id: 'document-1' }),
      },
      fragmentoRag: { deleteMany: vi.fn() },
      $executeRaw: vi.fn(),
    };
    mocks.$transaction.mockImplementation((callback) => callback(tx));

    await expect(indexLesson('lesson-1')).resolves.toMatchObject({
      status: 'INDEXED',
      documentId: 'document-1',
      chunks: 1,
    });
    expect(mocks.$transaction).toHaveBeenCalledOnce();
    expect(mocks.$transaction).toHaveBeenCalledWith(expect.any(Function), { maxWait: 10000, timeout: 30000 });
    expect(tx.fragmentoRag.deleteMany).toHaveBeenCalledWith({ where: { documentoId: 'document-1' } });
    expect(tx.$executeRaw).toHaveBeenCalledOnce();
    expect(tx.documentoRag.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ assessmentSafe: false }),
    });
  });

  it('uses authorial context exclusively and stores source/section metadata', async () => {
    mocks.leccion.findUnique.mockResolvedValue({
      id: 'lesson-1', version: 3, estado: 'PUBLICADA', titulo: 'Lesson', contenido: 'LEGACY CONTENT',
      contextoRag: '# Variables\nUna variable almacena valores.', contextoRagNombre: 'guia.md',
      recursoHtml: { html: '<p>HTML MUST NOT ENTER</p>', evaluable: true },
      modulo: { estado: 'PUBLICADO', curso: { id: 'course-pilot', publicado: true } },
    });
    mocks.documentoRag.findUnique.mockResolvedValue(null);
    process.env.EMBEDDING_API_URL = 'https://embeddings.example';
    process.env.EMBEDDING_API_KEY = 'test-key';
    process.env.EMBEDDING_MODEL = 'google/embeddinggemma-300M';
    process.env.EMBEDDING_PROVIDER = 'local';
    process.env.EMBEDDING_MAX_RETRIES = '0';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({ data: [{ embedding: Array.from({ length: 768 }, () => 0.01) }] }),
    }));
    const tx = {
      documentoRag: { updateMany: vi.fn(), create: vi.fn().mockResolvedValue({ id: 'document-1' }), update: vi.fn().mockResolvedValue({ id: 'document-1' }) },
      fragmentoRag: { deleteMany: vi.fn() }, $executeRaw: vi.fn(),
    };
    mocks.$transaction.mockImplementation((callback) => callback(tx));

    await expect(indexLesson('lesson-1')).resolves.toMatchObject({ status: 'INDEXED' });
    expect(tx.documentoRag.create).toHaveBeenCalledWith({ data: expect.objectContaining({ origen: 'AUTOR', version: 3 }) });
    expect(tx.$executeRaw).toHaveBeenCalledOnce();
    const [sql] = tx.$executeRaw.mock.calls[0];
    expect(sql.join('?')).toContain('"seccion"');
    expect(sql.join('?')).not.toContain('HTML MUST NOT ENTER');
  });

  describe('new version with unchanged indexed text', () => {
    const publishedLesson = (overrides = {}) => ({
      id: 'lesson-1', version: 5, estado: 'PUBLICADA', titulo: 'Lesson', contenido: 'Content',
      modulo: { estado: 'PUBLICADO', curso: { id: 'course-pilot', publicado: true } },
      ...overrides,
    });
    let tx;

    beforeEach(() => {
      Object.assign(process.env, {
        EMBEDDING_API_URL: 'https://embeddings.example', EMBEDDING_API_KEY: 'test-key',
        EMBEDDING_MODEL: 'google/embeddinggemma-300M', EMBEDDING_PROVIDER: 'local', EMBEDDING_MAX_RETRIES: '0',
      });
      vi.stubGlobal('fetch', vi.fn());
      tx = { documentoRag: { update: vi.fn().mockResolvedValue({}) } };
      mocks.$transaction.mockImplementation((callback) => callback(tx));
      mocks.documentoRag.findUnique.mockResolvedValue(null);
    });

    it('moves the active document forward without generating embeddings', async () => {
      mocks.leccion.findUnique.mockResolvedValue(publishedLesson());
      mocks.documentoRag.findFirst.mockResolvedValue({ id: 'document-old' });

      await expect(indexLesson('lesson-1')).resolves.toEqual({ status: 'REUSED', documentId: 'document-old', lessonId: 'lesson-1' });

      expect(fetch).not.toHaveBeenCalled();
      expect(mocks.documentoRag.findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({
          leccionId: 'lesson-1', activo: true, estado: 'LISTO', hashContenido: expect.any(String),
          modelo: 'google/embeddinggemma-300M', assessmentSafe: false, origen: 'HTML_FALLBACK',
        }),
      });
      expect(tx.documentoRag.update).toHaveBeenCalledWith({ where: { id: 'document-old' }, data: { version: 5 } });
    });

    it('regenerates when no active document has the same fingerprint', async () => {
      mocks.leccion.findUnique.mockResolvedValue(publishedLesson());
      mocks.documentoRag.findFirst.mockResolvedValue(null);
      fetch.mockRejectedValue(new Error('provider unavailable'));

      await expect(indexLesson('lesson-1')).rejects.toMatchObject({ status: 502 });

      expect(fetch).toHaveBeenCalled();
      expect(tx.documentoRag.update).not.toHaveBeenCalled();
    });

    it('treats a title change as a different fingerprint', async () => {
      mocks.documentoRag.findFirst.mockResolvedValue({ id: 'document-old' });
      const authorial = { contextoRag: 'Una variable almacena valores.', contextoRagNombre: null };

      mocks.leccion.findUnique.mockResolvedValue(publishedLesson({ ...authorial, titulo: 'Antes' }));
      await indexLesson('lesson-1');
      mocks.leccion.findUnique.mockResolvedValue(publishedLesson({ ...authorial, titulo: 'Después' }));
      await indexLesson('lesson-1');

      const [first, second] = mocks.documentoRag.findFirst.mock.calls.map(([args]) => args.where.hashContenido);
      expect(first).not.toBe(second);
    });

    it('does not reuse over a document already recorded for this version', async () => {
      mocks.leccion.findUnique.mockResolvedValue(publishedLesson());
      mocks.documentoRag.findUnique.mockResolvedValue({ id: 'document-failed', activo: false, estado: 'FALLIDO', hashContenido: 'x', modelo: 'y' });
      fetch.mockRejectedValue(new Error('provider unavailable'));

      await expect(indexLesson('lesson-1')).rejects.toMatchObject({ status: 502 });

      expect(mocks.documentoRag.findFirst).not.toHaveBeenCalled();
    });
  });

  it('keeps legacy lessons on HTML_FALLBACK source', async () => {
    mocks.leccion.findUnique.mockResolvedValue({
      id: 'lesson-1', version: 1, estado: 'PUBLICADA', titulo: 'Lesson', contenido: 'Contenido legacy',
      contextoRag: null, contextoRagNombre: null, recursoHtml: { html: '<h1>Sección</h1><p>Visible</p>', evaluable: false },
      modulo: { estado: 'PUBLICADO', curso: { id: 'course-pilot', publicado: true } },
    });
    mocks.documentoRag.findUnique.mockResolvedValue(null);
    process.env.EMBEDDING_API_URL = 'https://embeddings.example';
    process.env.EMBEDDING_API_KEY = 'test-key';
    process.env.EMBEDDING_MODEL = 'google/embeddinggemma-300M';
    process.env.EMBEDDING_PROVIDER = 'local';
    process.env.EMBEDDING_MAX_RETRIES = '0';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({ data: [{ embedding: Array.from({ length: 768 }, () => 0.01) }] }),
    }));
    const tx = {
      documentoRag: { updateMany: vi.fn(), create: vi.fn().mockResolvedValue({ id: 'document-1' }), update: vi.fn().mockResolvedValue({ id: 'document-1' }) },
      fragmentoRag: { deleteMany: vi.fn() }, $executeRaw: vi.fn(),
    };
    mocks.$transaction.mockImplementation((callback) => callback(tx));

    await expect(indexLesson('lesson-1')).resolves.toMatchObject({ status: 'INDEXED' });
    expect(tx.documentoRag.create).toHaveBeenCalledWith({ data: expect.objectContaining({ origen: 'HTML_FALLBACK' }) });
  });
});
