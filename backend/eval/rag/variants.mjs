// Formas de fragmentar una lección para comparar la búsqueda. `produccion` usa el código
// del tutor tal cual; `actual` reproduce la indexación anterior (INDEX_FORMAT_VERSION 2).
import { chunkStructuredText, chunkText, prepareLessonFragments } from '../../src/services/rag.service.js';
import { normalizeText } from '../../src/services/html-extractor.service.js';

const INTRO_SECTIONS = new Set(['proposito', 'objetivos de aprendizaje', 'contexto']);
const SHORT_SECTION_CHARS = 250;
const MERGED_CHUNK_CHARS = 900;

const key = (value) => normalizeText(value).toLocaleLowerCase();
const plainSection = (section) => key(section || '').normalize('NFD').replace(/\p{M}/gu, '');

// Copias de withoutBareTitle y deduplicatePreparedFragments (privadas en rag.service.js).
function withoutBareTitle(fragments, title) {
  const titleKey = key(title);
  const rest = fragments.filter((fragment) => key(fragment.content) !== titleKey);
  return rest.length ? rest : fragments;
}

function deduplicate(fragments) {
  const seen = new Set();
  return fragments.filter((fragment) => {
    const fragmentKey = key(fragment.content);
    if (!fragmentKey || seen.has(fragmentKey)) return false;
    seen.add(fragmentKey);
    return true;
  });
}

const production = (text, title, size, overlap) => deduplicate(withoutBareTitle(chunkStructuredText(text, size, overlap), title));

// Un encabezado seguido directamente de un subencabezado queda como fragmento con solo
// su título (por ejemplo "Conceptos clave"); no aporta evidencia.
const withoutHeadingOnly = (fragments) => fragments.filter((fragment) => key(fragment.content) !== key(fragment.section || ''));
// Opción 1: en secciones tipo lista, un fragmento por ítem, con el nombre de la sección delante.
const LIST_SECTIONS = new Set(['errores frecuentes', 'glosario', 'resumen']);
const HEADING = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/;

function rawSectionLines(text) {
  const sections = new Map();
  let current = null;
  for (const line of String(text || '').replace(/\r\n?/g, '\n').split('\n')) {
    const heading = line.match(HEADING);
    if (heading) {
      current = normalizeText(heading[1]);
      if (!sections.has(current)) sections.set(current, []);
    } else if (current) {
      sections.get(current).push(line);
    }
  }
  return sections;
}

function listItems(lines) {
  const items = [];
  for (const line of lines) {
    const item = line.match(/^\s*(?:[-*]|\d+\.)\s+(.+)$/);
    if (item) items.push(item[1]);
    else if (items.length && line.trim()) items[items.length - 1] += ` ${line.trim()}`;
  }
  return items;
}

function splitLists(text, fragments) {
  const sections = rawSectionLines(text);
  const split = new Set();
  const result = [];
  for (const fragment of fragments) {
    if (!LIST_SECTIONS.has(plainSection(fragment.section))) {
      result.push(fragment);
      continue;
    }
    if (split.has(fragment.section)) continue;
    const items = listItems(sections.get(fragment.section) || []);
    if (items.length < 2) {
      result.push(fragment);
      continue;
    }
    split.add(fragment.section);
    result.push(...items.map((item) => ({ content: normalizeText(`${fragment.section}: ${item}`), section: fragment.section })));
  }
  return result;
}

const withoutIntro = (fragments) => fragments.filter((fragment) => !INTRO_SECTIONS.has(plainSection(fragment.section)));
const RERANKER = '@cf/baai/bge-reranker-base';
// Opción 2: secciones generales que mencionan todo el tema.
const GENERIC_SECTIONS = /^(presentación|pista|pistas progresivas)/i;

// Une fragmentos seguidos más cortos que SHORT_SECTION_CHARS (por ejemplo las tres pistas)
// hasta MERGED_CHUNK_CHARS; conserva la sección del primero.
function mergeShort(fragments) {
  const merged = [];
  for (const fragment of fragments) {
    const last = merged.at(-1);
    const bothShort = last && last.short && fragment.content.length < SHORT_SECTION_CHARS;
    if (bothShort && last.content.length + 2 + fragment.content.length <= MERGED_CHUNK_CHARS) {
      last.content = `${last.content}\n\n${fragment.content}`;
    } else {
      merged.push({ ...fragment, short: fragment.content.length < SHORT_SECTION_CHARS });
    }
  }
  return merged.map(({ short, ...fragment }) => fragment);
}

// Junta propósito, objetivos y contexto en un solo bloque de presentación.
function mergeIntro(fragments) {
  const intro = fragments.filter((fragment) => INTRO_SECTIONS.has(plainSection(fragment.section)));
  if (!intro.length) return fragments;
  const introChunks = chunkText(intro.map((fragment) => fragment.content).join('\n\n'), 1400, 0)
    .map((content) => ({ content, section: 'Presentación' }));
  const firstIndex = fragments.indexOf(intro[0]);
  const rest = fragments.filter((fragment) => !intro.includes(fragment));
  return [...rest.slice(0, firstIndex), ...introChunks, ...rest.slice(firstIndex)];
}

export const VARIANTS = {
  produccion: {
    description: 'Código del tutor: prepareLessonFragments y retrieveLessonContext (equivale a op12-k5).',
    chunk: (text, title) => prepareLessonFragments(text, title),
    production: true,
  },
  actual: {
    description: 'Indexación anterior: una sección por fragmento, máximo 900 caracteres, solapamiento 120.',
    chunk: (text, title) => production(text, title, 900, 120),
  },
  'sin-intro': {
    description: 'Como actual, sin las secciones Propósito, Objetivos de aprendizaje y Contexto.',
    chunk: (text, title) => production(text, title, 900, 120)
      .filter((fragment) => !INTRO_SECTIONS.has(plainSection(fragment.section))),
  },
  'intro-unida': {
    description: 'Como actual, con Propósito, Objetivos y Contexto en un solo fragmento.',
    chunk: (text, title) => mergeIntro(production(text, title, 900, 120)),
  },
  'cortas-unidas': {
    description: 'Como actual, uniendo secciones seguidas de menos de 250 caracteres.',
    chunk: (text, title) => mergeShort(production(text, title, 900, 120)),
  },
  'partido-400': {
    description: 'Secciones largas partidas en piezas de unos 400 caracteres, solapamiento 60.',
    chunk: (text, title) => production(text, title, 400, 60),
  },
  'sin-titulos': {
    description: 'Como actual, sin fragmentos que solo contienen un encabezado.',
    chunk: (text, title) => withoutHeadingOnly(production(text, title, 900, 120)),
  },
  'sin-intro-titulos': {
    description: 'Sin Propósito, Objetivos, Contexto ni fragmentos de solo encabezado.',
    chunk: (text, title) => withoutHeadingOnly(production(text, title, 900, 120))
      .filter((fragment) => !INTRO_SECTIONS.has(plainSection(fragment.section))),
  },
  'sin-intro-titulos-k4': {
    description: 'Como sin-intro-titulos, devolviendo 4 fuentes.',
    chunk: (text, title) => withoutHeadingOnly(production(text, title, 900, 120))
      .filter((fragment) => !INTRO_SECTIONS.has(plainSection(fragment.section))),
    limit: 4,
  },
  'sin-intro-titulos-k3': {
    description: 'Como sin-intro-titulos, devolviendo 3 fuentes.',
    chunk: (text, title) => withoutHeadingOnly(production(text, title, 900, 120))
      .filter((fragment) => !INTRO_SECTIONS.has(plainSection(fragment.section))),
    limit: 3,
  },
  'q-sin-titulo': {
    description: 'Fragmentos actuales; la consulta no agrega el título de la lección.',
    chunk: (text, title) => production(text, title, 900, 120),
    queryTitle: false,
  },
  'sit-q-sin-titulo': {
    description: 'sin-intro-titulos; la consulta no agrega el título de la lección.',
    chunk: (text, title) => withoutIntro(withoutHeadingOnly(production(text, title, 900, 120))),
    queryTitle: false,
  },
  'sit-doc-seccion': {
    description: 'sin-intro-titulos; sin título de lección ni en la consulta ni en el embedding del fragmento.',
    chunk: (text, title) => withoutIntro(withoutHeadingOnly(production(text, title, 900, 120))),
    queryTitle: false,
    docTitle: 'section',
  },
  'actual-rerank': {
    description: 'Fragmentos actuales; 15 candidatos reordenados con bge-reranker-base, se devuelven 5.',
    chunk: (text, title) => production(text, title, 900, 120),
    rerank: { model: RERANKER, candidates: 15 },
  },
  'sit-rerank': {
    description: 'sin-intro-titulos; 15 candidatos reordenados con bge-reranker-base, se devuelven 5.',
    chunk: (text, title) => withoutIntro(withoutHeadingOnly(production(text, title, 900, 120))),
    rerank: { model: RERANKER, candidates: 15 },
  },
  'sit-rerank-k4': {
    description: 'sin-intro-titulos; 15 candidatos reordenados, se devuelven 4.',
    chunk: (text, title) => withoutIntro(withoutHeadingOnly(production(text, title, 900, 120))),
    rerank: { model: RERANKER, candidates: 15 },
    limit: 4,
  },
  'iu-rerank-k4': {
    description: 'Propósito, Objetivos y Contexto unidos en un fragmento, sin títulos sueltos; reranker, se devuelven 4.',
    chunk: (text, title) => withoutHeadingOnly(mergeIntro(production(text, title, 900, 120))),
    rerank: { model: RERANKER, candidates: 15 },
    limit: 4,
  },
  'op1-listas': {
    description: 'iu-rerank-k4 + un fragmento por ítem en Errores frecuentes, Glosario y Resumen.',
    chunk: (text, title) => splitLists(text, withoutHeadingOnly(mergeIntro(production(text, title, 900, 120)))),
    rerank: { model: RERANKER, candidates: 15 },
    limit: 4,
  },
  'op2-degradar': {
    description: 'iu-rerank-k4 + Presentación y Pistas bajan de puntaje (×0.3) al reordenar.',
    chunk: (text, title) => withoutHeadingOnly(mergeIntro(production(text, title, 900, 120))),
    rerank: { model: RERANKER, candidates: 15 },
    demote: { pattern: GENERIC_SECTIONS, factor: 0.3 },
    limit: 4,
  },
  'op5-umbral': {
    description: 'iu-rerank-k4 + candidatos desde similitud 0.35 (en vez de 0.45).',
    chunk: (text, title) => withoutHeadingOnly(mergeIntro(production(text, title, 900, 120))),
    rerank: { model: RERANKER, candidates: 15 },
    candidateThreshold: 0.35,
    limit: 4,
  },
  'op12': {
    description: 'Opciones 1 y 2 sobre iu-rerank-k4 (4 fuentes).',
    chunk: (text, title) => splitLists(text, withoutHeadingOnly(mergeIntro(production(text, title, 900, 120)))),
    rerank: { model: RERANKER, candidates: 15 },
    demote: { pattern: GENERIC_SECTIONS, factor: 0.3 },
    limit: 4,
  },
  'op12-k5': {
    description: 'Opciones 1 y 2, devolviendo 5 fuentes.',
    chunk: (text, title) => splitLists(text, withoutHeadingOnly(mergeIntro(production(text, title, 900, 120)))),
    rerank: { model: RERANKER, candidates: 15 },
    demote: { pattern: GENERIC_SECTIONS, factor: 0.3 },
    limit: 5,
  },
  'op12-k5-corte': {
    description: 'op12-k5 + número de fuentes variable: quedan las que tienen al menos 5 % del mejor puntaje.',
    chunk: (text, title) => splitLists(text, withoutHeadingOnly(mergeIntro(production(text, title, 900, 120)))),
    rerank: { model: RERANKER, candidates: 15 },
    demote: { pattern: GENERIC_SECTIONS, factor: 0.3 },
    limit: 5,
    cutoff: { ratio: 0.05 },
  },
  'op125': {
    description: 'Opciones 1, 2 y 5 juntas sobre iu-rerank-k4.',
    chunk: (text, title) => splitLists(text, withoutHeadingOnly(mergeIntro(production(text, title, 900, 120)))),
    rerank: { model: RERANKER, candidates: 15 },
    demote: { pattern: GENERIC_SECTIONS, factor: 0.3 },
    candidateThreshold: 0.35,
    limit: 4,
  },
  'sit-rerank-k3': {
    description: 'sin-intro-titulos; 15 candidatos reordenados, se devuelven 3.',
    chunk: (text, title) => withoutIntro(withoutHeadingOnly(production(text, title, 900, 120))),
    rerank: { model: RERANKER, candidates: 15 },
    limit: 3,
  },
  'actual-k3': {
    description: 'Como actual, devolviendo 3 fuentes en vez de 5.',
    chunk: (text, title) => production(text, title, 900, 120),
    limit: 3,
  },
  'actual-k4': {
    description: 'Como actual, devolviendo 4 fuentes en vez de 5.',
    chunk: (text, title) => production(text, title, 900, 120),
    limit: 4,
  },
};
