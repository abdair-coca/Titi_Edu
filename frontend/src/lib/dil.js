// DIL (Declarative Interface Language): the tutor declares its answer as a tree
// of known components. The backend validates it; this file only decides what the
// panel can draw. Contract: docs/specs/changes/respuestas-estructuradas-tutor/spec.md §1.

export const DIL_COMPONENTS = Object.freeze(['Text', 'Steps', 'Callout', 'Concepts', 'Table', 'Code', 'Diagram', 'Quiz', 'Check']);

const CODE_SPAN = /(`[^`\n]*`)/;
// `arr[1]` is an index, not a citation: a number glued to a word stays text.
const CITATION = /(^|[^\p{L}\p{N}_\]])\[(\d{1,3})\]/gu;
export const CITATION_HREF_PREFIX = '#cita-';

// Nodes the panel does not know are skipped, so a newer backend never breaks it.
export function renderableNodes(dil) {
  if (!dil || dil.version !== 1 || !Array.isArray(dil.nodes)) return [];
  return dil.nodes.filter((node) => node && DIL_COMPONENTS.includes(node.c));
}

// Turns [n] into a link the inline renderer draws as a source badge, outside code
// spans and only for sources the answer actually returned.
export function linkCitations(text, citationNumbers) {
  const known = new Set(citationNumbers);
  return String(text || '').split(CODE_SPAN)
    .map((segment, index) => (index % 2 ? segment : segment.replace(CITATION, (match, before, number) => (
      known.has(Number(number)) ? `${before}[\\[${number}\\]](${CITATION_HREF_PREFIX}${number})` : match
    ))))
    .join('');
}

export function citationNumberFromHref(href) {
  const value = String(href || '');
  if (!value.startsWith(CITATION_HREF_PREFIX)) return null;
  const number = Number(value.slice(CITATION_HREF_PREFIX.length));
  return Number.isInteger(number) && number > 0 ? number : null;
}

export function quizAnswerMessage(option) {
  return `Mi respuesta: ${String(option || '').trim()}`;
}
