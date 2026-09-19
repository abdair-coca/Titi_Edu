import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const migration = fs.readFileSync(
  path.join(dirname, '../../prisma/migrations/20260916010000_rag_assessment_safe/migration.sql'),
  'utf8',
);

describe('RAG assessment-safe migration', () => {
  it('marca provenance segura y desactiva índices históricos evaluables', () => {
    expect(migration).toContain('ADD COLUMN "assessmentSafe" BOOLEAN NOT NULL DEFAULT false');
    expect(migration).toContain('FROM "RecursoHtmlLeccion" r');
    expect(migration).toContain('r."evaluable" = true');
    expect(migration).toContain('d."activo" = true');
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN|TYPE)/i);
  });
});

describe('RAG authorial context migration', () => {
  it('is additive and adds provenance fields without Material or destructive SQL', async () => {
    const migration = await import('node:fs').then(({ readFileSync }) => readFileSync(
      new URL('../../prisma/migrations/20260918010000_rag_authorial_context/migration.sql', import.meta.url),
      'utf8',
    ));
    expect(migration).toContain('ADD COLUMN "contextoRag" TEXT');
    expect(migration).toContain('ADD COLUMN "contextoRagNombre" TEXT');
    expect(migration).toContain('CREATE TYPE "OrigenDocumentoRag"');
    expect(migration).toContain('ADD COLUMN "origen"');
    expect(migration).toContain('ADD COLUMN "seccion" TEXT');
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN|TYPE)/i);
    expect(migration).not.toContain('Material');
  });
});
