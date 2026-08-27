import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  leccion: { findUnique: vi.fn() },
  documentoRag: { findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn(), create: vi.fn() },
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

  it('does not delete previous fragments when embedding generation fails', async () => {
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
    expect(mocks.documentoRag.updateMany).not.toHaveBeenCalled();
    expect(mocks.fragmentoRag.deleteMany).not.toHaveBeenCalled();
    expect(mocks.executeRaw).not.toHaveBeenCalled();
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
  });
});
