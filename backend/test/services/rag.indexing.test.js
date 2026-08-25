import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  leccion: { findUnique: vi.fn() },
  documentoRag: { findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn(), create: vi.fn() },
  fragmentoRag: { deleteMany: vi.fn() },
  executeRaw: vi.fn(),
}));

vi.mock('../../src/prisma.js', () => ({ default: mocks }));

import { indexLesson } from '../../src/services/rag.service.js';

describe('RAG indexing feature flag', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
