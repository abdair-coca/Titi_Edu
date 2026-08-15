import { describe, expect, it } from 'vitest';
import {
  createPublicationConfirmation,
  fingerprint,
  generateServiceToken,
  inspectAuthoringFile,
  matchesTokenHash,
  parseServiceToken,
  privateAnalytics,
  sha256,
  verifyPublicationConfirmation,
} from '../../src/services/authoring.service.js';

describe('authoring service tokens', () => {
  it('genera formato estricto y valida solo el hash SHA-256', () => {
    const generated = generateServiceToken();
    expect(generated.token).toMatch(/^titi_svc_[a-f0-9]{8}_[A-Za-z0-9_-]{43}$/);
    expect(parseServiceToken(generated.token)).toEqual({ prefijo: generated.prefijo });
    expect(generated.tokenHash).toBe(sha256(generated.token));
    expect(matchesTokenHash(generated.token, generated.tokenHash)).toBe(true);
    expect(matchesTokenHash(`${generated.token}x`, generated.tokenHash)).toBe(false);
  });
});

describe('publication confirmation', () => {
  it('firma fingerprint y rechaza contenido alterado', () => {
    process.env.AUTHORING_CONFIRMATION_SECRET = 'test-authoring-secret';
    const expectedFingerprint = fingerprint({ id: 'm1', title: 'Original' });
    const confirmation = createPublicationConfirmation({ resourceType: 'module', resourceId: 'm1', expectedFingerprint });
    expect(verifyPublicationConfirmation({
      confirmationToken: confirmation.confirmationToken,
      phrase: confirmation.phrase,
      resourceType: 'module',
      resourceId: 'm1',
      expectedFingerprint,
    })).toEqual({ ok: true });
    expect(verifyPublicationConfirmation({
      confirmationToken: confirmation.confirmationToken,
      phrase: confirmation.phrase,
      resourceType: 'module',
      resourceId: 'm1',
      expectedFingerprint: fingerprint({ id: 'm1', title: 'Changed' }),
    }).ok).toBe(false);
  });
});

describe('analytics privacy', () => {
  it('suprime promedios, tasas y distribución con menos de 3 estudiantes', () => {
    const result = privateAnalytics([
      { usuarioId: 'u1', nota: 80, aprobado: true },
      { usuarioId: 'u2', nota: 40, aprobado: false },
    ]);
    expect(result).toMatchObject({ totalAttempts: 2, uniqueStudents: 2, passedStudents: 1, suprimida: true });
    expect(result.averageScore).toBeNull();
    expect(result.attemptPassRate).toBeNull();
    expect(result.studentPassRate).toBeNull();
    expect(result.scoreDistribution).toBeNull();
  });

  it('calcula buckets fijos sin exponer identidades con 3+ estudiantes', () => {
    const result = privateAnalytics([
      { usuarioId: 'u1', nota: 0, aprobado: false },
      { usuarioId: 'u2', nota: 50, aprobado: false },
      { usuarioId: 'u3', nota: 100, aprobado: true },
    ]);
    expect(result.suprimida).toBe(false);
    expect(result.scoreDistribution.map((bucket) => bucket.count)).toEqual([1, 0, 1, 0, 1]);
    expect(JSON.stringify(result)).not.toContain('u1');
  });
});

describe('upload inspection', () => {
  it('acepta PDF por firma y rechaza extensión engañosa', () => {
    expect(inspectAuthoringFile({ originalname: 'guide.pdf', buffer: Buffer.from('%PDF-1.7') }).ok).toBe(true);
    expect(inspectAuthoringFile({ originalname: 'guide.pdf', buffer: Buffer.from('not a pdf') })).toMatchObject({ ok: false });
  });

  it('acepta UTF-8 permitido y rechaza NUL', () => {
    expect(inspectAuthoringFile({ originalname: 'lesson.md', buffer: Buffer.from('# Hola') }).ok).toBe(true);
    expect(inspectAuthoringFile({ originalname: 'script.py', buffer: Buffer.from([112, 0, 121]) })).toMatchObject({ ok: false });
    expect(inspectAuthoringFile({ originalname: 'run.exe', buffer: Buffer.from('MZ') })).toMatchObject({ ok: false });
  });
});
