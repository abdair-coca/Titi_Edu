import { describe, expect, it } from 'vitest';
import {
  DIL_JSON_SCHEMA,
  DIL_MAX_NODES,
  dilPromptInstructions,
  dilToCanonicalText,
  parseDil,
  validateDil,
} from '../../src/services/rag.dil.js';
import { extractCitationNumbers } from '../../src/services/rag.security.js';

const valid = {
  Text: { c: 'Text', text: 'Una variable guarda un valor [1].' },
  Steps: { c: 'Steps', title: null, items: ['Declarás el nombre [1]', 'Asignás el valor [1]'] },
  Callout: { c: 'Callout', tone: 'advertencia', title: 'Error común', text: 'No uses palabras reservadas [1].' },
  Concepts: { c: 'Concepts', items: [{ term: 'Variable', text: 'Nombre que guarda un valor [1].' }] },
  Table: { c: 'Table', caption: 'Comparación [1]', head: ['let', 'const'], rows: [['se reasigna', 'no se reasigna']] },
  Code: { c: 'Code', language: 'javascript', code: 'let x = 1;\nx = 2;', caption: 'Reasignación [1]' },
  Diagram: { c: 'Diagram', kind: 'flowchart', source: 'flowchart LR\n  A --> B', caption: 'Flujo de asignación [1]' },
  Quiz: { c: 'Quiz', question: '¿Qué guarda una variable? [1]', options: ['Un valor', 'Una pantalla'] },
  Check: { c: 'Check', question: '¿Con tus palabras, qué es una variable?' },
};

function nodesOf(nodes, intent = 'PRACTICA') {
  return validateDil({ version: 1, nodes }, { intent });
}

function walkObjects(schema, visit) {
  if (!schema || typeof schema !== 'object') return;
  if (schema.type === 'object') visit(schema);
  for (const value of Object.values(schema)) {
    if (Array.isArray(value)) value.forEach((item) => walkObjects(item, visit));
    else walkObjects(value, visit);
  }
}

describe('DIL schema', () => {
  it('meets Groq strict mode: every property required and no extra properties', () => {
    walkObjects(DIL_JSON_SCHEMA, (object) => {
      expect(object.additionalProperties).toBe(false);
      expect([...object.required].sort()).toEqual(Object.keys(object.properties).sort());
    });
  });

  it('declares one branch per component', () => {
    const components = DIL_JSON_SCHEMA.properties.nodes.items.anyOf.map((branch) => branch.properties.c.enum[0]);
    expect(components).toEqual(Object.keys(valid));
  });
});

describe('dilPromptInstructions', () => {
  it('asks for a quiz only in practice', () => {
    expect(dilPromptInstructions('PRACTICA')).toContain('presentá la consigna como un nodo Quiz');
    expect(dilPromptInstructions('PRACTICA')).not.toContain('No uses Quiz');
    expect(dilPromptInstructions('EXPLICAR')).toContain('No uses Quiz en esta respuesta.');
  });
});

describe('parseDil', () => {
  it('reads a version 1 tree', () => {
    expect(parseDil(JSON.stringify({ version: 1, nodes: [valid.Text] }))).toEqual({ version: 1, nodes: [valid.Text] });
  });

  it.each([
    ['cut JSON', '{"version":1,"nodes":[{"c":"Text","text":"Una var'],
    ['wrong version', '{"version":2,"nodes":[]}'],
    ['nodes missing', '{"version":1}'],
    ['plain Markdown', 'Una variable guarda un valor [1].'],
    ['empty', ''],
  ])('returns null for %s', (_, raw) => {
    expect(parseDil(raw)).toBeNull();
  });
});

describe('validateDil', () => {
  it('keeps every valid component', () => {
    const { nodes, dropped } = nodesOf(Object.values(valid));
    expect(nodes.map((node) => node.c)).toEqual(Object.keys(valid));
    expect(dropped).toEqual([]);
  });

  it('drops unknown components and keeps the rest', () => {
    const { nodes, dropped } = nodesOf([{ c: 'Video', url: 'https://x' }, valid.Text, null]);
    expect(nodes).toEqual([valid.Text]);
    expect(dropped).toEqual(['unknown_component', 'unknown_component']);
  });

  it.each([
    ['Text too long', { ...valid.Text, text: 'a'.repeat(801) }],
    ['Text empty', { ...valid.Text, text: '   ' }],
    ['one step', { ...valid.Steps, items: ['Solo uno [1]'] }],
    ['nine steps', { ...valid.Steps, items: Array.from({ length: 9 }, (_, i) => `Paso ${i} [1]`) }],
    ['unknown tone', { ...valid.Callout, tone: 'peligro' }],
    ['seven concepts', { ...valid.Concepts, items: Array.from({ length: 7 }, () => valid.Concepts.items[0]) }],
    ['ragged table row', { ...valid.Table, rows: [['solo una celda']] }],
    ['five columns', { ...valid.Table, head: ['a', 'b', 'c', 'd', 'e'], rows: [['1', '2', '3', '4', '5']] }],
    ['unknown language', { ...valid.Code, language: 'cobol' }],
    ['code with a fence', { ...valid.Code, code: '```\nx\n```' }],
    ['diagram init directive', { ...valid.Diagram, source: '%%{init: {"theme":"dark"}}%%\nflowchart LR\nA-->B' }],
    ['diagram of another type', { ...valid.Diagram, source: 'pie\n"a": 1' }],
    ['diagram without caption', { ...valid.Diagram, caption: '' }],
    ['one quiz option', { ...valid.Quiz, options: ['Un valor'] }],
    ['repeated quiz options', { ...valid.Quiz, options: ['Un valor', 'un valor'] }],
  ])('drops a node with %s', (_, node) => {
    const { nodes, dropped } = nodesOf([node, valid.Text]);
    expect(nodes).toEqual([valid.Text]);
    expect(dropped).toEqual(['invalid_props']);
  });

  it('adds the Mermaid header when the source omits it', () => {
    const { nodes } = nodesOf([{ ...valid.Diagram, source: 'A --> B' }]);
    expect(nodes[0].source).toBe('flowchart TD\nA --> B');
  });

  it('accepts a quiz only in practice and only once', () => {
    expect(nodesOf([valid.Quiz, valid.Text], 'EXPLICAR')).toEqual({ nodes: [valid.Text], dropped: ['quiz_not_allowed'] });
    expect(nodesOf([valid.Quiz, valid.Quiz]).dropped).toEqual(['extra_quiz']);
  });

  it(`keeps at most ${DIL_MAX_NODES} nodes`, () => {
    const { nodes, dropped } = nodesOf(Array.from({ length: DIL_MAX_NODES + 2 }, () => valid.Text));
    expect(nodes).toHaveLength(DIL_MAX_NODES);
    expect(dropped).toEqual(['too_many_nodes', 'too_many_nodes']);
  });

  it('normalizes wide citation markers like the Markdown path', () => {
    const { nodes } = nodesOf([{ c: 'Text', text: 'Una variable guarda un valor【1】.' }]);
    expect(nodes[0].text).toBe('Una variable guarda un valor[1].');
  });

  it('returns no nodes for a tree without nodes', () => {
    expect(validateDil(null)).toEqual({ nodes: [], dropped: [] });
  });
});

describe('dilToCanonicalText', () => {
  it('serializes every component to Markdown with its citations', () => {
    const { nodes } = nodesOf(Object.values(valid));
    expect(dilToCanonicalText(nodes)).toBe([
      'Una variable guarda un valor [1].',
      '1. Declarás el nombre [1]\n2. Asignás el valor [1]',
      '> **Atención: Error común.** No uses palabras reservadas [1].',
      '- **Variable:** Nombre que guarda un valor [1].',
      'Comparación [1]',
      '| let | const |\n| --- | --- |\n| se reasigna | no se reasigna |',
      'Reasignación [1]',
      '```javascript\nlet x = 1;\nx = 2;\n```',
      'Flujo de asignación [1]',
      '```mermaid\nflowchart LR\n  A --> B\n```',
      '**Pregunta:** ¿Qué guarda una variable? [1]\n- A) Un valor\n- B) Una pantalla',
      '**Comprobá tu comprensión:** ¿Con tus palabras, qué es una variable?',
    ].join('\n\n'));
  });

  it('keeps citations in prose and leaves code and diagram bodies out of them', () => {
    const { nodes } = nodesOf([
      { ...valid.Code, code: 'const arr = [1, 2];\narr[3];', caption: 'Arreglos [2]' },
      valid.Diagram,
    ]);
    expect(extractCitationNumbers(dilToCanonicalText(nodes), new Set([1, 2, 3]))).toEqual([2, 1]);
  });

  it('escapes pipes inside table cells', () => {
    const { nodes } = nodesOf([{ ...valid.Table, rows: [['a | b', 'c']] }]);
    expect(dilToCanonicalText(nodes)).toContain('| a \\| b | c |');
  });
});
