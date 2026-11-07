// DIL (Declarative Interface Language): the tutor declares its answer as a tree
// of known components and the frontend builds the interface. Groq strict mode
// guarantees the shape; sizes and counts are enforced here, because the schema
// subset it accepts does not cover them.
import { normalizeCitationMarkers } from './rag.security.js';

export const DIL_VERSION = 1;
export const DIL_MAX_NODES = 12;
export const DIL_CODE_LANGUAGES = Object.freeze([
  'python', 'javascript', 'typescript', 'bash', 'json', 'xml', 'css', 'sql', 'markdown', 'yaml', 'c', 'cpp', 'java', 'text',
]);
const CALLOUT_TONES = Object.freeze(['definicion', 'tip', 'advertencia', 'nota']);
const CALLOUT_LABELS = Object.freeze({ definicion: 'Definición', tip: 'Tip', advertencia: 'Atención', nota: 'Nota' });
const DIAGRAM_KINDS = Object.freeze(['flowchart', 'sequence']);
const DIAGRAM_HEADERS = Object.freeze({ flowchart: /^(?:flowchart|graph)\b/, sequence: /^sequenceDiagram\b/ });
const OTHER_DIAGRAM_HEADER = /^(?:classDiagram|stateDiagram|erDiagram|gantt|pie|journey|gitGraph|mindmap|timeline|quadrantChart|C4\w*|block|xychart|sankey|requirementDiagram|architecture)\b/;
const QUIZ_LETTERS = 'ABCD';
const FENCE = '```';

const LIMITS = Object.freeze({
  text: 800,
  stepsMin: 2,
  stepsMax: 8,
  step: 300,
  title: 120,
  callout: 400,
  conceptsMax: 6,
  term: 60,
  concept: 300,
  columnsMin: 2,
  columnsMax: 4,
  rowsMax: 8,
  cell: 120,
  caption: 200,
  code: 1500,
  diagram: 1200,
  question: 300,
  optionsMin: 2,
  optionsMax: 4,
  option: 150,
});

const string = { type: 'string' };
const nullableString = { type: ['string', 'null'] };
const stringList = { type: 'array', items: string };

function nodeSchema(component, properties) {
  return {
    type: 'object',
    properties: { c: { type: 'string', enum: [component] }, ...properties },
    required: ['c', ...Object.keys(properties)],
    additionalProperties: false,
  };
}

export const DIL_JSON_SCHEMA = Object.freeze({
  type: 'object',
  properties: {
    version: { type: 'integer' },
    nodes: {
      type: 'array',
      items: {
        anyOf: [
          nodeSchema('Text', { text: string }),
          nodeSchema('Steps', { title: nullableString, items: stringList }),
          nodeSchema('Callout', { tone: { type: 'string', enum: [...CALLOUT_TONES] }, title: nullableString, text: string }),
          nodeSchema('Concepts', {
            items: {
              type: 'array',
              items: { type: 'object', properties: { term: string, text: string }, required: ['term', 'text'], additionalProperties: false },
            },
          }),
          nodeSchema('Table', { caption: nullableString, head: stringList, rows: { type: 'array', items: stringList } }),
          nodeSchema('Code', { language: { type: 'string', enum: [...DIL_CODE_LANGUAGES] }, code: string, caption: nullableString }),
          nodeSchema('Diagram', { kind: { type: 'string', enum: [...DIAGRAM_KINDS] }, source: string, caption: string }),
          nodeSchema('Quiz', { question: string, options: stringList }),
          nodeSchema('Check', { question: string }),
        ],
      },
    },
  },
  required: ['version', 'nodes'],
  additionalProperties: false,
});

export const DIL_RESPONSE_FORMAT = Object.freeze({
  type: 'json_schema',
  json_schema: { name: 'tutor_dil', strict: true, schema: DIL_JSON_SCHEMA },
});

export const DIL_PROMPT_INSTRUCTIONS = [
  'FORMATO DE RESPUESTA (DIL v1): devolvé solo un objeto JSON {"version":1,"nodes":[...]} que declare la interfaz de tu respuesta con estos componentes:',
  '- Text {text}: párrafo breve; admite **negrita**, *cursiva* y `código` en línea.',
  '- Steps {title|null, items[]}: de 2 a 8 pasos ordenados.',
  '- Callout {tone, title|null, text}: tone "definicion" para definir, "tip" para un consejo, "advertencia" para un error común, "nota" para una aclaración.',
  '- Concepts {items[{term,text}]}: de 1 a 6 conceptos clave con su explicación.',
  '- Table {caption|null, head[], rows[][]}: comparación de 2 a 4 columnas y hasta 8 filas; cada fila con tantas celdas como head.',
  '- Code {language, code, caption|null}: un ejemplo de código; el código va sin backticks.',
  '- Diagram {kind, source, caption}: kind "flowchart" o "sequence"; source en sintaxis Mermaid sin backticks; caption describe el diagrama y lleva su cita.',
  '- Quiz {question, options[]}: solo en práctica; una pregunta con 2 a 4 opciones. Nunca indiques cuál es la correcta.',
  '- Check {question}: una pregunta abierta para que el estudiante compruebe lo que entendió.',
  'Usá entre 1 y 12 nodos y elegí el componente que mejor muestre cada parte; no repitas lo mismo en dos nodos.',
  'Las citas [n] van dentro de text, items, celdas, title y caption. Todo nodo con contenido del material debe citar su fuente.',
].join('\n');

const INVALID = Symbol('invalid');

function cleanText(value, max) {
  if (typeof value !== 'string') return INVALID;
  const text = normalizeCitationMarkers(value.replace(/\r\n?/g, '\n')).trim();
  return text && text.length <= max ? text : INVALID;
}

function cleanOptionalText(value, max) {
  if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) return null;
  return cleanText(value, max);
}

function cleanCell(value) {
  if (typeof value !== 'string') return INVALID;
  const cell = normalizeCitationMarkers(value.replace(/\s+/g, ' ')).trim();
  return cell.length <= LIMITS.cell ? cell : INVALID;
}

// Code keeps its whitespace and never holds a fence: it would close the block
// in the canonical text and turn code into prose for the citation check.
function cleanCode(value, max) {
  if (typeof value !== 'string') return INVALID;
  const code = value.replace(/\r\n?/g, '\n').replace(/^\n+|\s+$/g, '');
  return code.trim() && code.length <= max && !code.includes(FENCE) ? code : INVALID;
}

function cleanList(value, min, max, clean) {
  if (!Array.isArray(value) || value.length < min || value.length > max) return INVALID;
  const items = value.map(clean);
  return items.includes(INVALID) ? INVALID : items;
}

function hasInvalid(values) {
  return values.some((value) => value === INVALID);
}

function cleanDiagramSource(kind, value) {
  const source = cleanCode(value, LIMITS.diagram);
  if (source === INVALID || source.includes('%%{')) return INVALID;
  const trimmed = source.trimStart();
  if (DIAGRAM_HEADERS[kind].test(trimmed)) return source;
  if (OTHER_DIAGRAM_HEADER.test(trimmed)) return INVALID;
  return `${kind === 'flowchart' ? 'flowchart TD' : 'sequenceDiagram'}\n${source}`;
}

const NODE_CLEANERS = Object.freeze({
  Text: (node) => {
    const text = cleanText(node.text, LIMITS.text);
    return text === INVALID ? null : { c: 'Text', text };
  },
  Steps: (node) => {
    const title = cleanOptionalText(node.title, LIMITS.title);
    const items = cleanList(node.items, LIMITS.stepsMin, LIMITS.stepsMax, (item) => cleanText(item, LIMITS.step));
    return hasInvalid([title, items]) ? null : { c: 'Steps', title, items };
  },
  Callout: (node) => {
    if (!CALLOUT_TONES.includes(node.tone)) return null;
    const title = cleanOptionalText(node.title, LIMITS.title);
    const text = cleanText(node.text, LIMITS.callout);
    return hasInvalid([title, text]) ? null : { c: 'Callout', tone: node.tone, title, text };
  },
  Concepts: (node) => {
    const items = cleanList(node.items, 1, LIMITS.conceptsMax, (item) => {
      if (!item || typeof item !== 'object') return INVALID;
      const term = cleanText(item.term, LIMITS.term);
      const text = cleanText(item.text, LIMITS.concept);
      return hasInvalid([term, text]) ? INVALID : { term, text };
    });
    return items === INVALID ? null : { c: 'Concepts', items };
  },
  Table: (node) => {
    const caption = cleanOptionalText(node.caption, LIMITS.caption);
    const head = cleanList(node.head, LIMITS.columnsMin, LIMITS.columnsMax, cleanCell);
    if (hasInvalid([caption, head]) || head.every((cell) => !cell)) return null;
    const rows = cleanList(node.rows, 1, LIMITS.rowsMax, (row) => cleanList(row, head.length, head.length, cleanCell));
    return rows === INVALID ? null : { c: 'Table', caption, head, rows };
  },
  Code: (node) => {
    if (!DIL_CODE_LANGUAGES.includes(node.language)) return null;
    const code = cleanCode(node.code, LIMITS.code);
    const caption = cleanOptionalText(node.caption, LIMITS.caption);
    return hasInvalid([code, caption]) ? null : { c: 'Code', language: node.language, code, caption };
  },
  Diagram: (node) => {
    if (!DIAGRAM_KINDS.includes(node.kind)) return null;
    const source = cleanDiagramSource(node.kind, node.source);
    const caption = cleanText(node.caption, LIMITS.caption);
    return hasInvalid([source, caption]) ? null : { c: 'Diagram', kind: node.kind, source, caption };
  },
  Quiz: (node) => {
    const question = cleanText(node.question, LIMITS.question);
    const options = cleanList(node.options, LIMITS.optionsMin, LIMITS.optionsMax, (option) => cleanText(option, LIMITS.option));
    if (hasInvalid([question, options])) return null;
    const distinct = new Set(options.map((option) => option.toLowerCase()));
    return distinct.size === options.length ? { c: 'Quiz', question, options } : null;
  },
  Check: (node) => {
    const question = cleanText(node.question, LIMITS.question);
    return question === INVALID ? null : { c: 'Check', question };
  },
});

// A model reply that is not a DIL tree (cut by the token limit, wrong version)
// counts as an empty answer: retrying would spend the student's own key.
export function parseDil(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  let tree;
  try {
    tree = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!tree || typeof tree !== 'object' || tree.version !== DIL_VERSION || !Array.isArray(tree.nodes)) return null;
  return tree;
}

export function validateDil(tree, { intent } = {}) {
  const nodes = [];
  const dropped = [];
  let quizSeen = false;
  for (const node of Array.isArray(tree?.nodes) ? tree.nodes : []) {
    if (nodes.length >= DIL_MAX_NODES) {
      dropped.push('too_many_nodes');
      continue;
    }
    const clean = node && typeof node === 'object' ? NODE_CLEANERS[node.c] : null;
    if (!clean) {
      dropped.push('unknown_component');
      continue;
    }
    if (node.c === 'Quiz' && (intent !== 'PRACTICA' || quizSeen)) {
      dropped.push(intent === 'PRACTICA' ? 'extra_quiz' : 'quiz_not_allowed');
      continue;
    }
    const cleaned = clean(node);
    if (!cleaned) {
      dropped.push('invalid_props');
      continue;
    }
    if (cleaned.c === 'Quiz') quizSeen = true;
    nodes.push(cleaned);
  }
  return { nodes, dropped };
}

function quoteLines(text) {
  return text.split('\n').map((line) => `> ${line}`).join('\n');
}

function tableRow(cells) {
  return `| ${cells.map((cell) => cell.replace(/\|/g, '\\|')).join(' | ')} |`;
}

const NODE_TEXT = Object.freeze({
  Text: (node) => node.text,
  Steps: (node) => [node.title && `**${node.title}**`, node.items.map((item, index) => `${index + 1}. ${item}`).join('\n')]
    .filter(Boolean).join('\n'),
  Callout: (node) => quoteLines(`**${CALLOUT_LABELS[node.tone]}${node.title ? `: ${node.title}` : ''}.** ${node.text}`),
  Concepts: (node) => node.items.map((item) => `- **${item.term}:** ${item.text}`).join('\n'),
  Table: (node) => [
    node.caption,
    [tableRow(node.head), tableRow(node.head.map(() => '---')), ...node.rows.map(tableRow)].join('\n'),
  ].filter(Boolean).join('\n\n'),
  Code: (node) => [node.caption, `${FENCE}${node.language}\n${node.code}\n${FENCE}`].filter(Boolean).join('\n\n'),
  Diagram: (node) => `${node.caption}\n\n${FENCE}mermaid\n${node.source}\n${FENCE}`,
  Quiz: (node) => [`**Pregunta:** ${node.question}`, ...node.options.map((option, index) => `- ${QUIZ_LETTERS[index]}) ${option}`)].join('\n'),
  Check: (node) => `**Comprobá tu comprensión:** ${node.question}`,
});

// The canonical text is what the citation check, the assessment guard and the
// conversation history read, so a DIL answer passes the same protections as Markdown.
export function dilToCanonicalText(nodes) {
  return (nodes || []).map((node) => NODE_TEXT[node.c]?.(node)).filter(Boolean).join('\n\n');
}
