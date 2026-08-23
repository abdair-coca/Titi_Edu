import { describe, expect, it } from 'vitest';
import { chunkText, htmlToText, lessonRagText, normalizeText } from '../../src/services/rag.service.js';

describe('RAG text preparation', () => {
  it('removes executable HTML and keeps visible text', () => {
    expect(htmlToText('<h1>Variables</h1><script>alert(1)</script><p>x &amp; y</p>'))
      .toBe('Variables x & y');
  });

  it('normalizes whitespace and creates overlapping chunks', () => {
    const text = normalizeText('  uno\n\n dos   tres ');
    expect(text).toBe('uno dos tres');
    const chunks = chunkText('abcdefghijklmnopqrstuvwxyz', 10, 3);
    expect(chunks).toEqual(['abcdefghij', 'hijklmnopq', 'opqrstuvwx', 'vwxyz']);
  });

  it('combines lesson text with HTML visible content', () => {
    expect(lessonRagText({ titulo: 'Título', contenido: 'Contenido', recursoHtml: { html: '<p>Actividad</p>' } }))
      .toBe('Título Contenido Actividad');
  });
});
