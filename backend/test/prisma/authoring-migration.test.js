import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const migration = fs.readFileSync(
  path.join(dirname, '../../prisma/migrations/20260814120000_authoring_api/migration.sql'),
  'utf8',
);

describe('authoring migration', () => {
  it('es aditiva y publica los módulos legacy', () => {
    expect(migration).toContain('ADD COLUMN "estado"');
    expect(migration).toContain('UPDATE "Modulo" SET "estado" = \'PUBLICADO\'');
    expect(migration).toContain('ADD COLUMN "emiteCertificado" BOOLEAN NOT NULL DEFAULT true');
    expect(migration).toContain('ADD COLUMN "formatoContenido"');
    expect(migration).toContain('ADD COLUMN "sha256" TEXT');
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN|TYPE)/i);
    expect(migration).not.toMatch(/RENAME\s+/i);
  });
});
