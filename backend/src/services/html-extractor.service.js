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
  // --- ampliado: JS runtime / bundler / DOM / CSS / misc ---
  'console',
  'log',
  'warn',
  'error',
  'debug',
  'import',
  'export',
  'require',
  'module',
  'exports',
  'default',
  'async',
  'await',
  'promise',
  'then',
  'catch',
  'finally',
  'resolve',
  'reject',
  'setTimeout',
  'setInterval',
  'clearTimeout',
  'clearInterval',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'fetch',
  'axios',
  'json',
  'parse',
  'stringify',
  'localStorage',
  'sessionStorage',
  'Math',
  'random',
  'floor',
  'ceil',
  'round',
  'Date',
  'Array',
  'Object',
  'JSON',
  'window',
  'document',
  'body',
  'head',
  'container',
  'wrapper',
  'btn',
  'button',
  'svg',
  'path',
  'rect',
  'circle',
  'g',
  'defs',
  'linearGradient',
  'radialGradient',
  'stop',
  'use',
  'href',
  'xlink',
  'transform',
  'translate',
  'scale',
  'rotate',
  'opacity',
  'background',
  'backgroundColor',
  'color',
  'fontSize',
  'fontFamily',
  'textAlign',
  'position',
  'zIndex',
  'overflow',
  'cursor',
  'transition',
  'animation',
  'keyframes',
  'boxShadow',
  'borderRadius',
]);

const UI_NOISE_TOKENS = new Set([
  'siguiente',
  'anterior',
  'continuar',
  'reiniciar',
  'reintentar',
  'cerrar',
  'abrir',
  'jugar',
  'pausa',
  'reanudar',
  'intentar',
  'intento',
  'puntaje',
  'puntos',
  'tiempo',
  'nivel',
  'vidas',
  'ganaste',
  'perdiste',
  'correcto',
  'incorrecto',
  'excelente',
  // english UI fallbacks
  'next',
  'previous',
  'close',
  'open',
  'play',
  'pause',
  'resume',
  'retry',
  'score',
  'time',
  'level',
  'lives',
  'win',
  'lose',
]);

const UI_NOISE_PHRASES = new Set([
  'siguiente',
  'anterior',
  'continuar',
  'reiniciar',
  'cerrar',
  'jugar de nuevo',
  'intentar de nuevo',
  'volver a intentar',
  'ver resultado',
  'ver resultados',
]);

const QUESTION_KEYS = ['pregunta', 'question', 'enunciado', 'prompt', 'q', 'consigna'];
const OPTIONS_KEYS = ['opciones', 'options', 'choices', 'alternativas', 'respuestas', 'answers'];
const CORRECT_KEYS = ['correcta', 'correct', 'respuesta', 'answer', 'solution', 'correctAnswer', 'respuestaCorrecta', 'esCorrecta'];
const EXPLANATION_KEYS = ['explicacion', 'explanation', 'feedback', 'pista', 'hint', 'retroalimentacion'];
const CONCEPT_KEYS = ['concepto', 'termino', 'term', 'palabra', 'word', 'item'];
const DEFINITION_KEYS = ['definicion', 'definition', 'significado', 'meaning', 'desc', 'descripcion', 'description'];
const TITLE_KEYS = ['titulo', 'title', 'slide', 'nombre', 'name', 'tema', 'topic'];
const CONTENT_KEYS = ['contenido', 'content', 'texto', 'text', 'body', 'detalle', 'detail'];

const ASSESSMENT_SECRET_KEYS = new Set([
  ...CORRECT_KEYS,
  ...EXPLANATION_KEYS,
  'answerKey',
  'claveRespuesta',
  'correctOption',
  'opcionCorrecta',
  'selectedAnswer',
  'expectedAnswer',
  'chosenAnswer',
  'submittedAnswer',
  'userAnswer',
  'studentAnswer',
  'selectedOption',
  'expectedOption',
  'chosenOption',
  'secret',
  'secreto',
  'private',
  'privado',
].map((key) => key.replace(/[-_\s]/g, '').toLowerCase()));

const ASSESSMENT_SECRET_KEY_PATTERN = /^(?:(?:selected|expected|chosen|given|submitted|user|student|provided)?(?:answer|answers|respuesta|respuestas)|(?:selected|expected|chosen|given|submitted|user|student|provided|correct|right)?(?:option|options|choice|choices|opcion|opciones|alternativa|alternativas)|(?:is|es)?(?:correct|correcta|correcto|right)|solution|solucion|explicacion|explanation|feedback|pista|hint)(?:answer|answers|key|option|choice|value|text|index|id|respuesta|correcta|correcto|explicacion|explanation|feedback|pista|hint)*$/i;
const ASSESSMENT_SECRET_TEXT_PATTERN = /\b(?:respuesta\s+(?:correcta|correcto|esperada|esperado)|(?:respuesta|answer|solution|soluci[oó]n)\s+(?:es|is)|(?:opci[oó]n|option)\s+(?:correcta|correct|seleccionada|selected)|correct\s+answer|expected\s+answer|(?:answer|respuesta|solution|soluci[oó]n)\s*[:=]|answer\s+(?:key|explanation)|clave\s+(?:de\s+)?respuesta|soluci[oó]n(?:\s+(?:correcta|answer|key))?|feedback|retroalimentaci[oó]n)\b/i;
const HTML_VOID_ELEMENTS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

function normalizeKey(value) {
  return String(value || '').replace(/[-_\s]/g, '').toLowerCase();
}

function isAssessmentSecretKey(key) {
  const normalized = normalizeKey(key);
  const withoutDataPrefix = normalized.replace(/^data/, '');
  return ASSESSMENT_SECRET_KEYS.has(normalized)
    || ASSESSMENT_SECRET_KEYS.has(withoutDataPrefix)
    || ASSESSMENT_SECRET_KEY_PATTERN.test(withoutDataPrefix);
}

const SAFE_STRUCTURED_TEXT_KEYS = new Set([
  ...QUESTION_KEYS,
  ...CONCEPT_KEYS,
  ...DEFINITION_KEYS,
  ...TITLE_KEYS,
  ...CONTENT_KEYS,
  'intro',
  'introduccion',
  'description',
  'descripcion',
  'instruction',
  'instructions',
  'instruccion',
  'instrucciones',
  'message',
  'mensaje',
  'dialogue',
  'dialogo',
  'visibleText',
  'textoVisible',
].map(normalizeKey));

function isAssessmentSecretLiteral(value) {
  return ASSESSMENT_SECRET_TEXT_PATTERN.test(value);
}

function hasHiddenDomState(attributes) {
  if (/(?:^|\s)hidden(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?(?=\s|\/?>(?:$|\s))/i.test(attributes)) return true;

  const ariaHidden = attributes.match(/\baria-hidden\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
  if (['true', '1', 'yes', 'on'].includes((ariaHidden?.[1] ?? ariaHidden?.[2] ?? ariaHidden?.[3] ?? '').trim().toLowerCase())) return true;

  const style = attributes.match(/\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
  const styleValue = style?.[1] ?? style?.[2] ?? style?.[3] ?? '';
  if (/(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden)(?:\s*!\s*important)?\s*(?:;|$)/i.test(styleValue)) return true;

  const classAttr = attributes.match(/\bclass\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
  const classValue = classAttr?.[1] ?? classAttr?.[2] ?? classAttr?.[3] ?? '';
  if (classValue.split(/\s+/).some((className) => /(?:hidden|ishidden|dnone|displaynone|invisible|visuallyhidden|sronly|opacity0|secret|answer|solution|feedback|correct)/i.test(normalizeKey(className)))) return true;

  const dataHidden = attributes.match(/\bdata-hidden(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?(?=\s|\/?>(?:$|\s))/i);
  const dataHiddenValue = dataHidden?.[1] ?? dataHidden?.[2] ?? dataHidden?.[3] ?? '';
  if (dataHidden && (!dataHiddenValue || ['true', '1', 'yes', 'on', 'hidden', 'none'].includes(dataHiddenValue.trim().toLowerCase()))) return true;

  const dataVisibility = attributes.match(/\bdata-(?:hidden|visible|visibility|show|display|state)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
  const dataName = dataVisibility?.[0]?.match(/\b(data-[\w-]+)/i)?.[1]?.toLowerCase() || '';
  const dataValue = (dataVisibility?.[1] ?? dataVisibility?.[2] ?? dataVisibility?.[3] ?? '').trim().toLowerCase();
  if (/data-(?:visible|visibility|show|state)/.test(dataName)) {
    return ['false', '0', 'no', 'off', 'hidden', 'none', 'invisible'].includes(dataValue);
  }
  if (/data-hidden/.test(dataName)) return ['true', '1', 'yes', 'on', 'hidden', 'none'].includes(dataValue);
  if (/data-display/.test(dataName)) return ['none', 'hidden', 'invisible'].includes(dataValue);
  return false;
}

function maskUnsafeDomSubtrees(html) {
  const tagRegex = /<\/?[a-z][^>]*>/gi;
  const stack = [];
  let cursor = 0;
  let masked = '';
  let match;

  while ((match = tagRegex.exec(html)) !== null) {
    const tag = match[0];
    const closing = /^<\//.test(tag);
    const name = tag.match(/^<\/?\s*([a-z0-9-]+)/i)?.[1]?.toLowerCase();
    const parentHidden = stack.some((entry) => entry.hidden);

    if (!parentHidden && !(closing === false && (name === 'template' || hasHiddenDomState(tag)))) {
      masked += html.slice(cursor, match.index);
    }

    if (closing) {
      if (!parentHidden) masked += tag;
      const stackIndex = [...stack].reverse().findIndex((entry) => entry.name === name);
      if (stackIndex !== -1) stack.splice(stack.length - 1 - stackIndex, 1);
    } else {
      const selfClosing = /\/\s*>$/.test(tag) || HTML_VOID_ELEMENTS.has(name);
      const hidden = parentHidden || name === 'template' || hasHiddenDomState(tag);
      if (!parentHidden && !hidden) masked += tag;
      if (!selfClosing) stack.push({ name, hidden });
    }

    cursor = match.index + tag.length;
  }

  if (!stack.some((entry) => entry.hidden)) masked += html.slice(cursor);
  return masked;
}

function findKeyCaseInsensitive(obj, candidateKeys) {
  if (!obj || typeof obj !== 'object') return null;
  const entries = Object.entries(obj);
  for (const candidate of candidateKeys) {
    const found = entries.find(([key]) => key.toLowerCase() === candidate.toLowerCase());
    if (found) return found[1];
  }
  return null;
}

function isStructuredItemHidden(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false;

  const hidden = findKeyCaseInsensitive(item, ['hidden', 'isHidden', 'oculto', 'oculta', 'aria-hidden', 'ariaHidden', 'data-hidden', 'dataHidden']);
  if (['true', '1', 'yes', 'on', 'hidden', 'none'].includes(String(hidden ?? '').trim().toLowerCase())) return true;

  const visible = findKeyCaseInsensitive(item, ['visible', 'isVisible', 'visibleEnPantalla', 'aria-visible', 'ariaVisible', 'data-visible', 'dataVisible']);
  if (['false', '0', 'no', 'off', 'hidden', 'none', 'invisible'].includes(String(visible ?? '').trim().toLowerCase())) return true;

  const show = findKeyCaseInsensitive(item, ['show', 'mostrar', 'data-show', 'dataShow']);
  if (['false', '0', 'no', 'off', 'hidden', 'none', 'invisible'].includes(String(show ?? '').trim().toLowerCase())) return true;

  const visibility = findKeyCaseInsensitive(item, ['visibility', 'data-visibility', 'dataVisibility', 'state', 'data-state', 'dataState']);
  if (['false', '0', 'no', 'off', 'hidden', 'none', 'invisible'].includes(String(visibility ?? '').trim().toLowerCase())) return true;

  const display = findKeyCaseInsensitive(item, ['display', 'data-display', 'dataDisplay']);
  if (['none', 'hidden'].includes(String(display ?? '').trim().toLowerCase())) return true;

  const style = findKeyCaseInsensitive(item, ['style']);
  if (typeof style === 'string' && /(?:display\s*:\s*none|visibility\s*:\s*hidden)(?:\s*!\s*important)?/i.test(style)) return true;

  const className = findKeyCaseInsensitive(item, ['class', 'className']);
  return typeof className === 'string'
    && className.split(/\s+/).some((token) => /(?:hidden|ishidden|dnone|displaynone|invisible|visuallyhidden|sronly|opacity0|secret|answer|solution|feedback|correct)/i.test(normalizeKey(token)));
}

function cleanString(value) {
  if (typeof value !== 'string') return '';
  return decodeHtmlEntities(value).replace(/\s+/g, ' ').trim();
}

function isUiNoise(text) {
  const lower = text.trim().toLowerCase();
  if (UI_NOISE_TOKENS.has(lower)) return true;
  if (UI_NOISE_PHRASES.has(lower)) return true;
  // protocolos internos / eventos de juegos
  if (/^juegoart:/i.test(text)) return true;
  if (/^titi[-_]/i.test(text)) return true;
  // frases muy cortas compuestas solo de tokens UI (ej. "Siguiente >" o "Nivel 1")
  if (/^(?:nivel|level|puntaje|score|tiempo|time)\s*\d+\s*$/i.test(text)) return true;
  if (/^(?:puntaje|score|puntos|tiempo|time)\s*[:-]?\s*\d+.*$/i.test(text)) return true;
  if (/^[<>»«›‹]+\s*$/.test(text)) return true;
  // tokens tipo "foo:bar" sin espacios (event names, handlers)
  if (/^\w+:\w+$/ .test(text) && !text.includes(' ')) return true;
  return false;
}

function isNaturalLanguageText(str) {
  const text = str.trim();
  if (text.length < 8) return false;
  if (text.length > 5000) return false; // descarta blobs masivos o scripts embebidos

  // Excluir URLs, base64 data URIs, selectores CSS y colores
  if (/^(?:https?:\/\/|data:|blob:|\/|\.\/|\.\.\/)/i.test(text)) return false;
  if (/^#[0-9a-f]{3,8}$/i.test(text)) return false;
  if (/^(?:rgba?|hsla?)\(/i.test(text)) return false;
  if (/^\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw|s|ms|deg)$/i.test(text)) return false;
  if (/^[.#][a-zA-Z0-9_-]+$/.test(text)) return false;
  if (CODE_EXCLUDE_TOKENS.has(text) || CODE_EXCLUDE_TOKENS.has(text.toLowerCase())) return false;
  if (isUiNoise(text)) return false;

  // Excluir código JS evidente (e.g. "function() {", "return false;")
  if (/(?:function\s*\(|=>\s*\{|=>|var\s+\w+\s*=|const\s+\w+\s*=|let\s+\w+\s*=|document\.|window\.|console\.|Math\.|import\s|export\s|require\s*\()/.test(text)) {
    return false;
  }
  // Excluir plantillas con interpolación JS/CSS sin contenido educativo
  if (/\$\{[^}]+\}/.test(text)) return false;
  if (/^\s*(?:\{[^}]*\})\s*$/.test(text)) return false;
  // Excluir patrones de código de juegos (BackendTown, engine)
  if (/(?:this\.|world\.|ui\.|renderer\.|ctx\.|asset\.|camera\.|challenge\.|lesson\.|spec\.|page\.|stats\.|escapeHtml|addEventListener|querySelector|getElementById|classList|innerHTML|innerText|textContent|setTimeout|setInterval|requestAnimation)/.test(text)) {
    return false;
  }
  // Excluir líneas con alta densidad de símbolos de código
  const codeSymbols = (text.match(/[{}();=<>$?:+.]/g) || []).length;
  if (codeSymbols >= 3 && codeSymbols / text.length > 0.06) return false;
  if (/[{}();=]{2,}/.test(text) && /\(.*\)/.test(text)) return false;
  // Excluir líneas que son expresiones ternarias o comparaciones sueltas
  if (/^\s*[+*/<>=!&|]+\s*\(/.test(text)) return false;
  if (/\?\s*[^?]*:/.test(text) && /[()<>]/.test(text)) return false;
  if (/^\s*\W*\(.*\)\s*$/.test(text) && /[.?]/.test(text)) return false;
  // Excluir llamadas de método tipo foo.bar(
  if (/\w+\.\w+\s*\(/.test(text) && /[;{}]/.test(text)) return false;

  // Debe contener al menos una letra válida (incluyendo tildes y ñ)
  if (!/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(text)) return false;

  // Señales de lenguaje natural más estrictas:
  // - al menos 2 palabras con letras, O signo de pregunta/exclamación, O puntuación + longitud
  const hasTwoWords = /\b\p{L}{2,}\s+\p{L}{2,}\b/u.test(text);
  const hasQuestion = /[¿?¡!]/.test(text);
  const hasPunctuatedPhrase = /[.,:;]/.test(text) && text.length >= 12;
  const isLongPhrase = hasTwoWords && text.length >= 12;

  if (hasTwoWords || hasQuestion || hasPunctuatedPhrase) {
    // descartar si es solo UI corta aun con 2 palabras (ej. "Siguiente Nivel")
    if (text.length < 16 && isUiNoise(text)) return false;
    return true;
  }

  // Long phrase con al menos 12 chars y 2 palabras ya pasó arriba
  // Frase larga sin puntuación pero con verbos comunes educativos
  if (isLongPhrase) return true;

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

function formatStructuredItem(item, { assessmentSafe = false } = {}) {
  if (!item || typeof item !== 'object') return null;

  // Caso 1: Pregunta / Quiz / Trivia
  const question = findKeyCaseInsensitive(item, QUESTION_KEYS);
  if (question && typeof question === 'string') {
    const parts = [`Pregunta: ${cleanString(question)}`];

    const rawOptions = findKeyCaseInsensitive(item, OPTIONS_KEYS);
    if (Array.isArray(rawOptions)) {
      const optionsText = rawOptions
        .map((opt) => {
          if (typeof opt !== 'object') return String(opt);
          if (assessmentSafe && isStructuredItemHidden(opt)) return '';
          const optionText = findKeyCaseInsensitive(opt, ['texto', 'text', 'label', 'valor', 'value']);
          if (optionText) return optionText;
          return assessmentSafe ? '' : JSON.stringify(opt);
        })
        .map(cleanString)
        .filter(Boolean);
      if (optionsText.length > 0) parts.push(`Opciones: ${optionsText.join(', ')}`);
    }

    const rawCorrect = findKeyCaseInsensitive(item, CORRECT_KEYS);
    if (!assessmentSafe && rawCorrect !== null && rawCorrect !== undefined) {
      const correctText = typeof rawCorrect === 'object'
        ? findKeyCaseInsensitive(rawCorrect, ['texto', 'text', 'label', 'valor', 'value'])
        : String(rawCorrect);
      if (correctText) parts.push(`Respuesta correcta: ${cleanString(correctText)}`);
    }

    const explanation = findKeyCaseInsensitive(item, EXPLANATION_KEYS);
    if (!assessmentSafe && explanation && typeof explanation === 'string') {
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

function extractStructuredData(data, results, seenStrings, options = {}) {
  if (!data) return;

  if (Array.isArray(data)) {
    for (const elem of data) {
      extractStructuredData(elem, results, seenStrings, options);
    }
    return;
  }

  if (typeof data === 'object') {
    if (options.assessmentSafe && isStructuredItemHidden(data)) return;
    const formatted = formatStructuredItem(data, options);
    if (formatted) {
      results.push(formatted);
      // Registrar las cadenas individuales como vistas para evitar duplicación
      for (const [key, val] of Object.entries(data)) {
        if (options.assessmentSafe && isAssessmentSecretKey(key)) continue;
        if (typeof val === 'string') seenStrings.add(cleanString(val));
      }
      return;
    }

    for (const [key, val] of Object.entries(data)) {
      if (options.assessmentSafe && isAssessmentSecretKey(key)) continue;
      if (options.assessmentSafe && !SAFE_STRUCTURED_TEXT_KEYS.has(normalizeKey(key)) && typeof val === 'string') continue;
      if (typeof val === 'string') {
        const cleaned = cleanString(val);
        if (isNaturalLanguageText(cleaned) && !seenStrings.has(cleaned)) {
          results.push(cleaned);
          seenStrings.add(cleaned);
        }
      } else if (typeof val === 'object') {
        extractStructuredData(val, results, seenStrings, options);
      }
    }
  }
}

function extractScriptContent(html, seenStrings, { assessmentSafe = false } = {}) {
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
        extractStructuredData(parsed, extracted, seenStrings, { assessmentSafe });
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
        extractStructuredData(parsed, extracted, seenStrings, { assessmentSafe });
      }
    }

    // C. Extracción de literales de strings de JavaScript (preguntas sueltas, pistas, diálogos, textos de retroalimentación)
    // Coincide con comillas dobles, simples y template strings con backticks
    const stringLiteralRegex = /(?:"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|`([^`\\]*(?:\\.[^`\\]*)*)`)/g;
    let literalMatch;
    while ((literalMatch = stringLiteralRegex.exec(scriptBody)) !== null) {
      // Arbitrary JS strings can be answer values referenced by a later branch.
      // Safe mode only trusts structured data and visible DOM text.
      if (assessmentSafe) continue;
      const rawString = literalMatch[1] ?? literalMatch[2] ?? literalMatch[3] ?? '';
      if (rawString.length < 4) continue;
      // descartar literales que son claramente selectores / rutas / código
      if (/^[.#][\w-]+$/.test(rawString.trim())) continue;
      if (/^(?:\/|\.\/|\.\.\/)/.test(rawString.trim())) continue;
      const unescaped = rawString
        .replace(/\\n/g, ' ')
        .replace(/\\t/g, ' ')
        .replace(/\\"/g, '"')
        .replace(/\\'/g, "'")
        .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)));

      const cleaned = cleanString(unescaped);
      if (cleaned.length < 8) continue;
      if (isUiNoise(cleaned)) continue;
      if (isNaturalLanguageText(cleaned) && !seenStrings.has(cleaned)) {
        extracted.push(cleaned);
        seenStrings.add(cleaned);
      }
    }
  }

  return extracted;
}

function extractDomContent(html, seenStrings, { assessmentSafe = false } = {}) {
  const extracted = [];

  // Eliminar etiquetas que nunca aportan contenido educativo o rompen el flujo
  const cleanedHtml = (assessmentSafe ? maskUnsafeDomSubtrees(html) : html)
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ');

  // 1. Extraer atributos educativos relevantes: data-question, data-title, data-flow, alt, aria-label, title
  const attributeRegex = /\b(data-[a-zA-Z0-9_-]+|alt|title|aria-label)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
  let attrMatch;
  while ((attrMatch = attributeRegex.exec(cleanedHtml)) !== null) {
    const attrName = attrMatch[1] || '';
    const rawValue = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? '';
    const cleaned = cleanString(rawValue);
    if (assessmentSafe && (isAssessmentSecretKey(attrName) || isAssessmentSecretLiteral(cleaned))) continue;
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
    if (!cleaned || seenStrings.has(cleaned)) continue;
    if (isUiNoise(cleaned)) continue;
    if (CODE_EXCLUDE_TOKENS.has(cleaned) || CODE_EXCLUDE_TOKENS.has(cleaned.toLowerCase())) continue;
    if (isNaturalLanguageText(cleaned)) {
      extracted.push(cleaned);
      seenStrings.add(cleaned);
      continue;
    }
    // Fallback para DOM visible: headings / párrafos cortos de una palabra capitalizada
    // ej. "Actividad", "Variables", "Modelo OSI" corto pero válido
    if (cleaned.length >= 4 && cleaned.length <= 40 && /^[A-ZÁÉÍÓÚÑa-záéíóúñ0-9][A-Za-zÁÉÍÓÚÑa-záéíóúñ0-9\s\-:]+$/.test(cleaned)) {
      if (/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(cleaned) && !cleaned.includes('_') && !/^[A-Z0-9_]+$/.test(cleaned)) {
        extracted.push(cleaned);
        seenStrings.add(cleaned);
      }
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
export function extractLessonHtmlContent(html, { assessmentSafe = false } = {}) {
  if (!html || typeof html !== 'string') return '';

  const seenStrings = new Set();
  const scriptSource = assessmentSafe ? maskUnsafeDomSubtrees(html) : html;

  // 1. Extraer contenido visible y atributos educativos del DOM
  const domParts = extractDomContent(html, seenStrings, { assessmentSafe });

  // 2. Extraer contenido interactivo, preguntas, respuestas y datos de <script>
  const scriptParts = extractScriptContent(scriptSource, seenStrings, { assessmentSafe });

  // 3. Unir de forma estructurada para mantener coherencia semántica en los chunks
  // Preservamos \n\n entre bloques para que chunkText pueda mantener Pregunta+Opciones+Respuesta juntas
  const domBlock = domParts.length > 0 ? normalizeText(domParts.join(' ')) : '';
  const scriptBlock = scriptParts.length > 0
    ? scriptParts.map((part) => normalizeText(part)).filter(Boolean).join('\n\n')
    : '';

  const allParts = [domBlock, scriptBlock].filter(Boolean);
  if (allParts.length === 0) return '';
  // No colapsar \n\n finales — son delimitadores semánticos para chunkText
  return allParts.join('\n\n');
}
