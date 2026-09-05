export function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

export function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

// Lista de palabras y tokens técnicos comunes de JS/DOM/CSS que NO deben ser considerados contenido educativo
const CODE_EXCLUDE_TOKENS = new Set([
  'use strict',
  'addEventListener',
  'removeEventListener',
  'getElementById',
  'getElementsByClassName',
  'getElementsByTagName',
  'querySelector',
  'querySelectorAll',
  'createElement',
  'appendChild',
  'removeChild',
  'replaceChild',
  'setAttribute',
  'getAttribute',
  'removeAttribute',
  'classList',
  'innerHTML',
  'innerText',
  'textContent',
  'style',
  'display',
  'none',
  'block',
  'inline',
  'inline-block',
  'flex',
  'grid',
  'center',
  'pointer',
  'click',
  'dblclick',
  'mousedown',
  'mouseup',
  'mousemove',
  'touchstart',
  'touchend',
  'touchmove',
  'keydown',
  'keyup',
  'keypress',
  'submit',
  'change',
  'input',
  'load',
  'unload',
  'resize',
  'scroll',
  'canvas',
  '2d',
  '3d',
  'webgl',
  'absolute',
  'relative',
  'fixed',
  'static',
  'auto',
  'hidden',
  'visible',
  'solid',
  'border',
  'margin',
  'padding',
  'width',
  'height',
  'top',
  'bottom',
  'left',
  'right',
  'true',
  'false',
  'null',
  'undefined',
  'string',
  'number',
  'boolean',
  'object',
  'function',
  'constructor',
  'prototype',
  'titi-html',
  'TITI_SCORE',
  'postMessage',
  'attemptToken',
  'source',
  'type',
  'score',
]);

const QUESTION_KEYS = ['pregunta', 'question', 'enunciado', 'prompt', 'q', 'consigna'];
const OPTIONS_KEYS = ['opciones', 'options', 'choices', 'alternativas', 'respuestas', 'answers'];
const CORRECT_KEYS = ['correcta', 'correct', 'respuesta', 'answer', 'solution', 'correctAnswer', 'respuestaCorrecta', 'esCorrecta'];
const EXPLANATION_KEYS = ['explicacion', 'explanation', 'feedback', 'pista', 'hint', 'retroalimentacion'];
const CONCEPT_KEYS = ['concepto', 'termino', 'term', 'palabra', 'word', 'item'];
const DEFINITION_KEYS = ['definicion', 'definition', 'significado', 'meaning', 'desc', 'descripcion', 'description'];
const TITLE_KEYS = ['titulo', 'title', 'slide', 'nombre', 'name', 'tema', 'topic'];
const CONTENT_KEYS = ['contenido', 'content', 'texto', 'text', 'body', 'detalle', 'detail'];

function findKeyCaseInsensitive(obj, candidateKeys) {
  if (!obj || typeof obj !== 'object') return null;
  const entries = Object.entries(obj);
  for (const candidate of candidateKeys) {
    const found = entries.find(([key]) => key.toLowerCase() === candidate.toLowerCase());
    if (found) return found[1];
  }
  return null;
}

function cleanString(value) {
  if (typeof value !== 'string') return '';
  return decodeHtmlEntities(value).replace(/\s+/g, ' ').trim();
}

function isNaturalLanguageText(str) {
  const text = str.trim();
  if (text.length < 3) return false;
  if (text.length > 5000) return false; // descarta blobs masivos o scripts embebidos

  // Excluir URLs, base64 data URIs, selectores CSS y colores
  if (/^(?:https?:\/\/|data:|blob:|\/|\.\/|\.\.\/)/i.test(text)) return false;
  if (/^#[0-9a-f]{3,8}$/i.test(text)) return false;
  if (/^(?:rgba?|hsla?)\(/i.test(text)) return false;
  if (/^\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw|s|ms|deg)$/i.test(text)) return false;
  if (/^[.#][a-zA-Z0-9_-]+$/.test(text)) return false;
  if (CODE_EXCLUDE_TOKENS.has(text) || CODE_EXCLUDE_TOKENS.has(text.toLowerCase())) return false;

  // Excluir código JS evidente (e.g. "function() {", "return false;")
  if (/(?:function\s*\(|=>\s*\{|var\s+\w+\s*=|const\s+\w+\s*=|let\s+\w+\s*=|document\.|window\.)/.test(text)) {
    return false;
  }

  // Debe contener al menos una letra válida (incluyendo tildes y ñ)
  if (!/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(text)) return false;

  // Es lenguaje natural si contiene espacios entre palabras, signos de interrogación/admiración o puntuación
  if (/\b\p{L}+\s+\p{L}+\b/u.test(text)) return true;
  if (/[¿?¡!.,:;]/.test(text)) return true;

  // Si es una sola palabra, que empiece con mayúscula o tenga más de 3 letras sin guiones bajos
  if (!text.includes('_') && text.length >= 4 && !/^[A-Z0-9_]+$/.test(text)) return true;

  return false;
}

function parseRelaxedJson(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']')))) {
    return null;
  }

  // 1. Intento directo JSON estándar
  try {
    return JSON.parse(trimmed);
  } catch {}

  // 2. Intento relajando sintaxis de objetos JavaScript comunes
  try {
    const relaxed = trimmed
      // Comentarios de una línea y multilínea
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
      // Quitar comas colgantes antes de ] o }
      .replace(/,\s*([\]}])/g, '$1')
      // Comillas en propiedades no entrecomilladas: { pregunta: "x" } -> { "pregunta": "x" }
      .replace(/([{,]\s*)([a-zA-Z0-9_$]+)\s*:/g, '$1"$2":')
      // Reemplazar comillas simples con dobles si no están escapadas
      .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_, inner) => JSON.stringify(inner));

    return JSON.parse(relaxed);
  } catch {}

  return null;
}

function formatStructuredItem(item) {
  if (!item || typeof item !== 'object') return null;

  // Caso 1: Pregunta / Quiz / Trivia
  const question = findKeyCaseInsensitive(item, QUESTION_KEYS);
  if (question && typeof question === 'string') {
    const parts = [`Pregunta: ${cleanString(question)}`];

    const rawOptions = findKeyCaseInsensitive(item, OPTIONS_KEYS);
    if (Array.isArray(rawOptions)) {
      const optionsText = rawOptions
        .map((opt) => (typeof opt === 'object' ? findKeyCaseInsensitive(opt, ['texto', 'text', 'label', 'valor', 'value']) || JSON.stringify(opt) : String(opt)))
        .map(cleanString)
        .filter(Boolean);
      if (optionsText.length > 0) parts.push(`Opciones: ${optionsText.join(', ')}`);
    }

    const rawCorrect = findKeyCaseInsensitive(item, CORRECT_KEYS);
    if (rawCorrect !== null && rawCorrect !== undefined) {
      const correctText = typeof rawCorrect === 'object'
        ? findKeyCaseInsensitive(rawCorrect, ['texto', 'text', 'label', 'valor', 'value'])
        : String(rawCorrect);
      if (correctText) parts.push(`Respuesta correcta: ${cleanString(correctText)}`);
    }

    const explanation = findKeyCaseInsensitive(item, EXPLANATION_KEYS);
    if (explanation && typeof explanation === 'string') {
      parts.push(`Explicación: ${cleanString(explanation)}`);
    }

    return parts.join(' | ');
  }

  // Caso 2: Concepto / Definición (Flashcards / Tarjetas de memoria)
  const concept = findKeyCaseInsensitive(item, CONCEPT_KEYS);
  const definition = findKeyCaseInsensitive(item, DEFINITION_KEYS);
  if (concept && definition && typeof concept === 'string' && typeof definition === 'string') {
    return `Concepto: ${cleanString(concept)} | Definición: ${cleanString(definition)}`;
  }

  // Caso 3: Slide / Pantalla / Sección
  const title = findKeyCaseInsensitive(item, TITLE_KEYS);
  const content = findKeyCaseInsensitive(item, CONTENT_KEYS);
  if (title && content && typeof title === 'string' && typeof content === 'string') {
    return `${cleanString(title)}: ${cleanString(content)}`;
  }

  return null;
}

function extractStructuredData(data, results, seenStrings) {
  if (!data) return;

  if (Array.isArray(data)) {
    for (const elem of data) {
      extractStructuredData(elem, results, seenStrings);
    }
    return;
  }

  if (typeof data === 'object') {
    const formatted = formatStructuredItem(data);
    if (formatted) {
      results.push(formatted);
      // Registrar las cadenas individuales como vistas para evitar duplicación
      for (const val of Object.values(data)) {
        if (typeof val === 'string') seenStrings.add(cleanString(val));
      }
      return;
    }

    for (const val of Object.values(data)) {
      if (typeof val === 'string') {
        const cleaned = cleanString(val);
        if (isNaturalLanguageText(cleaned) && !seenStrings.has(cleaned)) {
          results.push(cleaned);
          seenStrings.add(cleaned);
        }
      } else if (typeof val === 'object') {
        extractStructuredData(val, results, seenStrings);
      }
    }
  }
}

function extractScriptContent(html, seenStrings) {
  const extracted = [];
  const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = scriptRegex.exec(html)) !== null) {
    const scriptTag = match[0];
    const scriptBody = match[1]?.trim();
    if (!scriptBody) continue;

    // A. ¿Es un bloque de datos JSON explícito? (<script type="application/json">)
    if (/type\s*=\s*["'](?:application\/json|text\/json)["']/i.test(scriptTag)) {
      const parsed = parseRelaxedJson(scriptBody);
      if (parsed) {
        extractStructuredData(parsed, extracted, seenStrings);
        continue;
      }
    }

    // B. Buscar declaraciones de objetos o arrays asignados en JavaScript:
    // e.g. const questions = [...]; let cards = [...]; window.data = {...};
    const varMatches = scriptBody.matchAll(/(?:const|let|var|window\.[a-zA-Z0-9_$]+)\s*[a-zA-Z0-9_$]*\s*=\s*(\[[\s\S]*?\]|\{[\s\S]*?\})\s*(?:;|$)/g);
    for (const varMatch of varMatches) {
      const literalCandidate = varMatch[1];
      const parsed = parseRelaxedJson(literalCandidate);
      if (parsed) {
        extractStructuredData(parsed, extracted, seenStrings);
      }
    }

    // C. Extracción de literales de strings de JavaScript (preguntas sueltas, pistas, diálogos, textos de retroalimentación)
    // Coincide con comillas dobles, simples y template strings con backticks
    const stringLiteralRegex = /(?:"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|`([^`\\]*(?:\\.[^`\\]*)*)`)/g;
    let literalMatch;
    while ((literalMatch = stringLiteralRegex.exec(scriptBody)) !== null) {
      const rawString = literalMatch[1] ?? literalMatch[2] ?? literalMatch[3] ?? '';
      const unescaped = rawString
        .replace(/\\n/g, ' ')
        .replace(/\\t/g, ' ')
        .replace(/\\"/g, '"')
        .replace(/\\'/g, "'")
        .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)));

      const cleaned = cleanString(unescaped);
      if (isNaturalLanguageText(cleaned) && !seenStrings.has(cleaned)) {
        extracted.push(cleaned);
        seenStrings.add(cleaned);
      }
    }
  }

  return extracted;
}

function extractDomContent(html, seenStrings) {
  const extracted = [];

  // Eliminar etiquetas que nunca aportan contenido educativo o rompen el flujo
  const cleanedHtml = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ');

  // 1. Extraer atributos educativos relevantes: data-question, data-title, data-flow, alt, aria-label, title
  const attributeRegex = /\b(?:data-[a-zA-Z0-9_-]+|alt|title|aria-label)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
  let attrMatch;
  while ((attrMatch = attributeRegex.exec(cleanedHtml)) !== null) {
    const rawValue = attrMatch[1] ?? attrMatch[2] ?? attrMatch[3] ?? '';
    const cleaned = cleanString(rawValue);
    if (isNaturalLanguageText(cleaned) && !seenStrings.has(cleaned)) {
      extracted.push(cleaned);
      seenStrings.add(cleaned);
    }
  }

  // 2. Extraer texto visible del DOM (descartando <script> para esta pasada)
  const withoutScripts = cleanedHtml.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ');
  const domText = decodeHtmlEntities(
    withoutScripts
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(?:p|div|section|article|li|h[1-6]|tr|button|summary|details|td|th)>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of domText) {
    const cleaned = cleanString(line);
    if (cleaned && !seenStrings.has(cleaned)) {
      extracted.push(cleaned);
      seenStrings.add(cleaned);
    }
  }

  return extracted;
}

/**
 * Extrae todo el contenido educativo relevante de una presentación o juego interactivo HTML.
 * Captura tanto el texto del DOM visible como las estructuras de datos (preguntas, opciones,
 * flashcards, diálogos y pistas) embebidas en JavaScript y atributos data-*.
 *
 * @param {string} html - Código HTML completo autocontenido de la lección
 * @returns {string} Texto educativo normalizado y estructurado, óptimo para embeddings RAG
 */
export function extractLessonHtmlContent(html) {
  if (!html || typeof html !== 'string') return '';

  const seenStrings = new Set();

  // 1. Extraer contenido visible y atributos educativos del DOM
  const domParts = extractDomContent(html, seenStrings);

  // 2. Extraer contenido interactivo, preguntas, respuestas y datos de <script>
  const scriptParts = extractScriptContent(html, seenStrings);

  // 3. Unir de forma estructurada para mantener coherencia semántica en los chunks
  const allParts = [];

  if (domParts.length > 0) {
    allParts.push(domParts.join(' '));
  }

  if (scriptParts.length > 0) {
    allParts.push(scriptParts.join('\n'));
  }

  return normalizeText(allParts.join('\n\n'));
}
