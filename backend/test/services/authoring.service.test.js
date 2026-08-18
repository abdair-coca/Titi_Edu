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
  validateHttpsUrl,
  validateHtmlLessonResource,
  validateVideoUrl,
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

  it('firma despublicacion con accion, frase y expiracion ligadas', () => {
    process.env.AUTHORING_CONFIRMATION_SECRET = 'test-authoring-secret';
    const expectedFingerprint = fingerprint({ id: 'm1', version: 4 });
    const confirmation = createPublicationConfirmation({
      resourceType: 'module', resourceId: 'm1', expectedFingerprint, action: 'unpublish',
    });
    expect(confirmation.phrase).toBe('DESPUBLICAR MODULO m1');
    expect(new Date(confirmation.expiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(verifyPublicationConfirmation({
      confirmationToken: confirmation.confirmationToken,
      phrase: confirmation.phrase,
      resourceType: 'module', resourceId: 'm1', expectedFingerprint, action: 'unpublish',
    })).toEqual({ ok: true });
    expect(verifyPublicationConfirmation({
      confirmationToken: confirmation.confirmationToken,
      phrase: confirmation.phrase,
      resourceType: 'module', resourceId: 'm1', expectedFingerprint, action: 'publish',
    }).ok).toBe(false);
  });
});

describe('analytics privacy', () => {
  it('suprime promedios, tasas y distribución con menos de 3 estudiantes', () => {
    const result = privateAnalytics([
      { usuarioId: 'u1', nota: 80, aprobado: true },
      { usuarioId: 'u2', nota: 40, aprobado: false },
    ]);
    expect(result).toMatchObject({ totalAttempts: null, uniqueStudents: null, passedStudents: null, suppressed: true, suprimida: true });
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

describe('active URL validation', () => {
  it('requires HTTPS, rejects SVG covers, and allowlists video hosts', () => {
    expect(validateHttpsUrl('http://example.com/cover.png', { rejectSvg: true }).ok).toBe(false);
    expect(validateHttpsUrl('https://example.com/cover.svg', { rejectSvg: true }).ok).toBe(false);
    expect(validateHttpsUrl('https://example.com/cover.png', { rejectSvg: true }).ok).toBe(true);
    expect(validateVideoUrl('https://evil.example/embed/1').ok).toBe(false);
    expect(validateVideoUrl('https://www.youtube.com/watch?v=abc').ok).toBe(true);
    expect(validateVideoUrl('javascript:alert(1)').ok).toBe(false);
  });
});

describe('HTML lesson resource validation', () => {
  const html = '<!doctype html><html><body><img src="data:image/png;base64,AA=="><script>window.parent.postMessage({ source: "titi-html" }, "*")</script></body></html>';

  it('injects restrictive CSP and requires attempts only for evaluable lessons', () => {
    const valid = validateHtmlLessonResource({ html, evaluable: true, intentosMax: 2 });
    expect(valid).toMatchObject({ ok: true, data: { evaluable: true, intentosMax: 2 } });
    expect(valid.data.html).toContain("default-src 'none'");
    expect(validateHtmlLessonResource({ html, evaluable: true, intentosMax: 0 })).toMatchObject({ ok: false });
    expect(validateHtmlLessonResource({ html, evaluable: false, intentosMax: 1 })).toMatchObject({ ok: false });
  });

  it('allows internal SVG references and credential-free HTTP(S) anchor navigation', () => {
    const resource = validateHtmlLessonResource({
      html: '<html><body><a href="https://app.diagrams.net/?embed=1">Diagrama</a><svg><defs><marker id="arrow" /></defs><path style="marker-end:url(#arrow)" /></svg></body></html>',
    });
    expect(resource).toMatchObject({ ok: true });
  });

  it('allows a self-authored CSP meta but rejects other http-equiv metas', () => {
    const withCsp = validateHtmlLessonResource({
      html: '<html><head><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'"></head><body>ok</body></html>',
    });
    expect(withCsp).toMatchObject({ ok: true });
    expect(withCsp.data.html).toContain("default-src 'none'");

    const withRefresh = validateHtmlLessonResource({
      html: '<html><head><meta http-equiv="refresh" content="0;url=https://evil.example"></head><body>no</body></html>',
    });
    expect(withRefresh).toMatchObject({ ok: false });
  });

  it('ignores src/href/url tokens inside script code but validates CSS url()', () => {
    const html = '<html><body><script>const src = "x".trim(); if (a == b) {} const u = "url(foo)";</script><img src="data:image/png;base64,AA=="></body></html>';
    const resource = validateHtmlLessonResource({ html });
    expect(resource).toMatchObject({ ok: true });

    const withRealExternal = validateHtmlLessonResource({
      html: '<html><body><script>const x=1</script><img src="https://evil.example/x.png"></body></html>',
    });
    expect(withRealExternal).toMatchObject({ ok: false });

    const cssExternal = validateHtmlLessonResource({
      html: '<html><body><style>.a{background:url(https://evil.example/x)}</style></body></html>',
    });
    expect(cssExternal).toMatchObject({ ok: false });
  });

  it('rejects external resources and unsafe anchor protocols', () => {
    for (const html of [
      '<html><body><img src="https://example.com/x.png"></body></html>',
      '<html><body><video poster="https://example.com/x.png"></video></body></html>',
      '<html><head><link rel="stylesheet" href="https://example.com/site.css"></head><body></body></html>',
      '<html><body><iframe src="https://example.com"></iframe></body></html>',
      '<html><body><object data="https://example.com/file"></object></body></html>',
      '<html><body><embed src="https://example.com/file"></body></html>',
      '<html><body><style>@import url(https://example.com/site.css)</style></body></html>',
      '<html><body><style>body{background:url(https://example.com/x)}</style></body></html>',
      '<html><body><a href="javascript:alert(1)">go</a></body></html>',
      '<html><body><a href="vbscript:msgbox(1)">go</a></body></html>',
      '<html><body><a href="https://user:pass@example.com">go</a></body></html>',
      '<html><body><a href="//example.com">go</a></body></html>',
      '<html><body><use href="https://example.com/icon.svg#shape"></use></body></html>',
    ]) {
      expect(validateHtmlLessonResource({ html })).toMatchObject({ ok: false });
    }
  });
});
