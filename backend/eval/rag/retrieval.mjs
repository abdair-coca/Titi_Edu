// Mide la búsqueda del Tutor RAG con el golden set. Manual: no corre en CI ni llama a Groq.
// Uso: npm run eval:rag -- [--variants actual,sin-intro] [--split dev|holdout|all]
//      [--course eval/rag/data/course.json] [--db postgresql://...@127.0.0.1/...] [--env .env]
import { createHash, randomUUID } from 'node:crypto';
import { execSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const here = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(here, '..', '..');
const DEFAULT_DB = 'postgresql://postgres:test@127.0.0.1:55434/rag_eval';
const CHARS_PER_TOKEN = 3.6;
const PARTIAL_MATCH = 0.7;

const { values: args } = parseArgs({
  options: {
    variants: { type: 'string' }, split: { type: 'string' }, course: { type: 'string' }, db: { type: 'string' }, env: { type: 'string' },
    check: { type: 'boolean' },
  },
});
const dbUrl = args.db || DEFAULT_DB;
const coursePath = path.resolve(backendDir, args.course || 'eval/rag/data/course.json');
const envPath = path.resolve(backendDir, args.env || '.env');
const split = args.split || 'dev';

if (!['localhost', '127.0.0.1'].includes(new URL(dbUrl).hostname)) {
  throw new Error('Solo se aceptan bases de datos locales (localhost o 127.0.0.1)');
}
if (!existsSync(coursePath)) throw new Error(`No existe la copia del curso: ${coursePath}. Ver eval/rag/README.md`);

// Solo se leen las credenciales de embeddings; DATABASE_URL del .env nunca se usa.
const fileEnv = Object.fromEntries(readFileSync(envPath, 'utf8').split(/\r?\n/)
  .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)).filter(Boolean)
  .map(([, name, value]) => [name, value.trim().replace(/^["']|["']$/g, '')]));
const course = JSON.parse(readFileSync(coursePath, 'utf8'));
Object.assign(process.env, {
  DATABASE_URL: dbUrl,
  NODE_ENV: 'test',
  RAG_ENABLED: 'true',
  RAG_COURSE_IDS: course.id,
  EMBEDDING_PROVIDER: 'cloudflare',
  EMBEDDING_MODEL: fileEnv.EMBEDDING_MODEL,
  CLOUDFLARE_ACCOUNT_ID: fileEnv.CLOUDFLARE_ACCOUNT_ID,
  CLOUDFLARE_AI_API_TOKEN: fileEnv.CLOUDFLARE_AI_API_TOKEN,
});
if (!process.env.CLOUDFLARE_AI_API_TOKEN || !process.env.EMBEDDING_MODEL) {
  throw new Error(`Faltan CLOUDFLARE_AI_API_TOKEN o EMBEDDING_MODEL en ${envPath}`);
}

// Caché de embeddings: misma petición al proveedor → misma respuesta, sin volver a llamarlo.
const cacheDir = path.join(here, '.cache');
const cacheFile = path.join(cacheDir, 'embeddings.jsonl');
mkdirSync(cacheDir, { recursive: true });
const cache = new Map(existsSync(cacheFile)
  ? readFileSync(cacheFile, 'utf8').split('\n').filter(Boolean).map((line) => { const row = JSON.parse(line); return [row.k, row.v]; })
  : []);
const stats = { cached: 0, fetched: 0 };
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, options = {}) => {
  if (!String(url).includes('/ai/run/')) return realFetch(url, options);
  const cacheKey = createHash('sha256').update(`${url}\n${options.body}`).digest('hex');
  if (cache.has(cacheKey)) {
    stats.cached += 1;
    return new Response(JSON.stringify(cache.get(cacheKey)), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  const response = await realFetch(url, options);
  if (!response.ok) return response;
  const body = await response.json();
  cache.set(cacheKey, body);
  appendFileSync(cacheFile, `${JSON.stringify({ k: cacheKey, v: body })}\n`);
  stats.fetched += 1;
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
};

// --- Base local -------------------------------------------------------------------------
const { PrismaClient } = await import('@prisma/client');
const adminUrl = new URL(dbUrl);
const dbName = adminUrl.pathname.slice(1);
adminUrl.pathname = '/postgres';
const admin = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
const exists = await admin.$queryRaw`SELECT 1 FROM pg_database WHERE datname = ${dbName}`;
if (!exists.length) await admin.$executeRawUnsafe(`CREATE DATABASE "${dbName.replace(/"/g, '')}"`);
await admin.$disconnect();
execSync('npx prisma migrate deploy', { cwd: backendDir, env: { ...process.env, DATABASE_URL: dbUrl }, stdio: 'ignore' });

const prisma = (await import('../../src/prisma.js')).default;
const rag = await import('../../src/services/rag.service.js');
const { normalizeText } = await import('../../src/services/html-extractor.service.js');
const { VARIANTS } = await import('./variants.mjs');

const lessons = course.modulos.flatMap((module) => module.lecciones);
if (!await prisma.curso.findUnique({ where: { id: course.id } })) {
  const owner = await prisma.usuario.create({ data: { neoId: 'eval-owner', username: 'eval-owner', email: 'owner@eval.local', rol: 'PROFESOR', verificado: true } });
  const categoria = await prisma.categoria.create({ data: { nombre: 'Eval RAG', icono: 'x' } });
  await prisma.curso.create({
    data: {
      id: course.id, titulo: course.titulo, descripcion: course.descripcion, nivel: course.nivel, publicado: true,
      categoriaId: categoria.id, creadorId: owner.id,
      modulos: {
        create: course.modulos.map((module) => ({
          id: module.id, titulo: module.titulo, descripcion: module.descripcion, orden: module.orden, estado: 'PUBLICADO',
          lecciones: {
            create: module.lecciones.map((lesson) => ({
              id: lesson.id, titulo: lesson.titulo, contenido: lesson.contenido, formatoContenido: lesson.formatoContenido,
              orden: lesson.orden, estado: 'PUBLICADA', version: lesson.version, publishedAt: new Date(),
              contextoRag: lesson.contextoRag, contextoRagNombre: lesson.contextoRagNombre,
              ...(lesson.recursoHtml ? { recursoHtml: { create: lesson.recursoHtml } } : {}),
            })),
          },
        })),
      },
    },
  });
}

// Mismo texto que indexaría producción (lessonRagSource en rag.service.js).
const lessonText = (lesson) => {
  if (lesson.contextoRag && String(lesson.contextoRag).trim()) {
    const validated = rag.validateAuthorialContext({ texto: lesson.contextoRag, nombreOrigen: lesson.contextoRagNombre });
    if (!validated.ok) throw new Error(`Contexto autoral inválido en ${lesson.titulo}: ${validated.message}`);
    return { text: validated.value.texto, origin: 'AUTOR' };
  }
  return { text: rag.lessonRagText(lesson), origin: 'HTML_FALLBACK' };
};

// --- Golden set ------------------------------------------------------------------------
const plain = (value) => String(value || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  .replace(/[`*_$\\#>]/g, '').replace(/\s+/g, ' ').trim();
const words = (value) => plain(value).split(' ').filter(Boolean);

const golden = JSON.parse(readFileSync(path.join(here, 'golden-set.json'), 'utf8'));
const lessonIdByKey = golden.lessons;
const lessonKeyById = Object.fromEntries(Object.entries(lessonIdByKey).map(([lessonKey, id]) => [id, lessonKey]));
const textByLessonId = Object.fromEntries(lessons.map((lesson) => [lesson.id, plain(lessonText(lesson).text)]));
const parseAlternative = (value) => {
  const [, lessonKey, quote] = value.match(/^(L\d+):\s*(.+)$/) || [];
  return { lessonId: lessonIdByKey[lessonKey], lessonKey, quote: plain(quote) };
};
const questions = golden.questions
  .filter((question) => split === 'all' || question.split === split)
  .map((question) => ({ ...question, lessonId: lessonIdByKey[question.lesson], groups: question.evidence.map((group) => group.map(parseAlternative)) }));

const missing = questions.flatMap((question) => question.groups.flat()
  .filter((alternative) => !alternative.lessonId || !textByLessonId[alternative.lessonId]?.includes(alternative.quote))
  .map((alternative) => `${question.id} → ${alternative.lessonKey}: "${alternative.quote}"`));
if (missing.length) {
  console.error(`Evidencia que no existe literalmente en su lección (${missing.length}):\n${missing.join('\n')}`);
  process.exit(1);
}
if (args.check) {
  console.log(`Golden set válido: ${questions.length} preguntas (${split}).`);
  process.exit(0);
}

// Una frase partida entre fragmentos cuenta si el fragmento tiene la mayor parte seguida.
function longestRun(haystack, needle) {
  let best = 0;
  for (let start = 0; start < haystack.length; start += 1) {
    for (let offset = 0; offset < needle.length; offset += 1) {
      let length = 0;
      while (haystack[start + length] && haystack[start + length] === needle[offset + length]) length += 1;
      if (length > best) best = length;
    }
  }
  return best;
}
const matches = (chunk, alternative) => {
  if (chunk.lessonId !== alternative.lessonId) return false;
  const content = plain(chunk.content);
  if (content.includes(alternative.quote)) return true;
  const needle = alternative.quote.split(' ');
  return needle.length >= 5 && longestRun(words(chunk.content), needle) / needle.length >= PARTIAL_MATCH;
};

// --- Medición --------------------------------------------------------------------------
async function indexVariant(variant) {
  await prisma.documentoRag.deleteMany({ where: { leccionId: { in: lessons.map((lesson) => lesson.id) } } });
  let fragments = 0;
  for (const lesson of lessons) {
    const { text, origin } = lessonText(lesson);
    const chunks = variant.chunk(text, lesson.titulo);
    const document = await prisma.documentoRag.create({
      data: {
        leccionId: lesson.id, version: lesson.version, estado: 'LISTO', activo: true, hashContenido: 'eval',
        modelo: process.env.EMBEDDING_MODEL, origen: origin, assessmentSafe: true, indexadoAt: new Date(),
      },
    });
    for (const [index, chunk] of chunks.entries()) {
      const title = variant.docTitle === 'section'
        ? chunk.section || lesson.titulo
        : chunk.section ? `${lesson.titulo} - ${chunk.section}` : lesson.titulo;
      const embedding = rag.formatVector(await rag.createEmbedding(chunk.content, { kind: 'document', title }));
      await prisma.$executeRaw`
        INSERT INTO "FragmentoRag" ("id", "documentoId", "orden", "contenido", "seccion", "embedding")
        VALUES (${randomUUID()}, ${document.id}, ${index}, ${chunk.content}, ${chunk.section}, ${embedding}::vector)
      `;
    }
    fragments += chunks.length;
  }
  return fragments;
}

// Reordena candidatos con el reranker de Cloudflare (mismo proveedor que los embeddings).
async function rerank(model, query, chunks) {
  if (!chunks.length) return [];
  const url = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/${model}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_AI_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, contexts: chunks.map((chunk) => ({ text: chunk.content })) }),
  });
  if (!response.ok) throw new Error(`El reranker respondió ${response.status}`);
  const payload = await response.json();
  return payload.result.response
    .map(({ id, score }) => ({ ...chunks[id], rerankScore: score }))
    .sort((a, b) => b.rerankScore - a.rerankScore);
}

async function measure(question, variant) {
  const limit = variant.limit || 5;
  const lesson = lessons.find((item) => item.id === question.lessonId);
  const history = rag.normalizeChatHistory(question.history || [], undefined, question.query);
  const title = variant.queryTitle === false ? null : normalizeText(lesson.titulo).slice(0, 200);
  const query = rag.buildContextualRetrievalQuery(question.query, history, title);
  // El umbral de similitud se lee del entorno en cada búsqueda; se cambia solo para esta variante.
  const previousThreshold = process.env.RAG_EVIDENCE_THRESHOLD;
  if (variant.candidateThreshold !== undefined) process.env.RAG_EVIDENCE_THRESHOLD = String(variant.candidateThreshold);
  let chunks;
  try {
    // `produccion` usa el código del tutor tal cual: búsqueda híbrida, reranker y bajada de secciones generales.
    chunks = variant.production
      ? await rag.retrieveLessonContext(course.id, { message: question.query, history, lessonId: question.lessonId, lessonTitle: title, limit })
      : await rag.searchCourseContext(course.id, query, variant.rerank?.candidates || limit, {
        lessonId: question.lessonId,
        ftsQuery: rag.buildFullTextQuery(question.query),
      });
  } finally {
    if (previousThreshold === undefined) delete process.env.RAG_EVIDENCE_THRESHOLD;
    else process.env.RAG_EVIDENCE_THRESHOLD = previousThreshold;
  }
  let rerankTop = null;
  if (variant.rerank) {
    let reranked = await rerank(variant.rerank.model, rag.buildContextualRetrievalQuery(question.query, history, null), chunks);
    if (variant.demote) {
      reranked = reranked
        .map((chunk) => (variant.demote.pattern.test(chunk.seccion || '') ? { ...chunk, rerankScore: chunk.rerankScore * variant.demote.factor } : chunk))
        .sort((a, b) => b.rerankScore - a.rerankScore);
    }
    rerankTop = reranked[0]?.rerankScore ?? null;
    chunks = reranked.filter((chunk) => chunk.rerankScore >= (variant.rerank.minScore || 0)).slice(0, limit);
    // Número de fuentes variable: además de la primera, quedan las que están cerca de su puntaje.
    if (variant.cutoff) chunks = chunks.filter((chunk, index) => index === 0 || chunk.rerankScore >= rerankTop * variant.cutoff.ratio);
  }
  const useful = chunks.map((chunk) => question.groups.some((group) => group.some((alternative) => matches(chunk, alternative))));
  const groupRanks = question.groups.map((group) => {
    const index = chunks.findIndex((chunk) => group.some((alternative) => matches(chunk, alternative)));
    return index + 1;
  });
  const firstHit = useful.indexOf(true) + 1;
  return {
    id: question.id,
    category: question.category,
    answerable: question.groups.length > 0,
    firstHit,
    complete: groupRanks.length > 0 && groupRanks.every((rank) => rank > 0),
    useful: useful.filter(Boolean).length,
    returned: chunks.length,
    contextTokens: Math.round(chunks.reduce((sum, chunk) => sum + chunk.content.length, 0) / CHARS_PER_TOKEN),
    topSimilarity: chunks.length ? Math.max(...chunks.map((chunk) => chunk.similarity)) : null,
    rerankTop,
    ftsMatches: chunks.filter((chunk) => chunk.ftsMatch).length,
    sources: chunks.map((chunk) => `${lessonKeyById[chunk.lessonId] ?? '?'}:${chunk.seccion ?? '-'}`),
    // Por fuente, para simular cortes sin volver a correr la búsqueda.
    sourceScores: chunks.map((chunk) => (chunk.rerankScore === undefined ? null : Number(chunk.rerankScore.toPrecision(4)))),
    sourceUseful: useful,
  };
}

const pct = (value, total) => (total ? `${Math.round((100 * value) / total)}%` : '-');
function summarize(rows) {
  const answerable = rows.filter((row) => row.answerable);
  const negative = rows.filter((row) => !row.answerable);
  const hit = (k) => answerable.filter((row) => row.firstHit > 0 && row.firstHit <= k).length;
  const returned = answerable.reduce((sum, row) => sum + row.returned, 0);
  return {
    preguntas: answerable.length,
    'acierto@1': pct(hit(1), answerable.length),
    'acierto@3': pct(hit(3), answerable.length),
    'acierto@5': pct(hit(5), answerable.length),
    completa: pct(answerable.filter((row) => row.complete).length, answerable.length),
    MRR: (answerable.reduce((sum, row) => sum + (row.firstHit ? 1 / row.firstHit : 0), 0) / (answerable.length || 1)).toFixed(3),
    'fuentes útiles': pct(answerable.reduce((sum, row) => sum + row.useful, 0), returned),
    'tokens contexto': Math.round(answerable.reduce((sum, row) => sum + row.contextTokens, 0) / (answerable.length || 1)),
    'sin respuesta con fuentes': `${negative.filter((row) => row.returned > 0).length}/${negative.length}`,
  };
}

const selected = (args.variants || 'actual').split(',').map((name) => name.trim()).filter(Boolean);
const unknown = selected.filter((name) => !VARIANTS[name]);
if (unknown.length) throw new Error(`Variantes desconocidas: ${unknown.join(', ')}. Disponibles: ${Object.keys(VARIANTS).join(', ')}`);

const resultsDir = path.join(here, 'results');
mkdirSync(resultsDir, { recursive: true });
const summaries = {};
const byCategory = {};
for (const name of selected) {
  const variant = VARIANTS[name];
  const fragments = await indexVariant(variant);
  const rows = [];
  for (const question of questions) rows.push(await measure(question, variant));
  summaries[name] = { fragmentos: fragments, ...summarize(rows) };
  for (const category of [...new Set(rows.map((row) => row.category))]) {
    const inCategory = rows.filter((row) => row.category === category);
    byCategory[category] ||= {};
    byCategory[category][name] = inCategory[0].answerable
      ? `${inCategory.filter((row) => row.firstHit > 0).length}/${inCategory.length}`
      : `${inCategory.filter((row) => row.returned > 0).length}/${inCategory.length} con fuentes`;
  }
  writeFileSync(path.join(resultsDir, `${name}-${split}.json`), JSON.stringify({ variant: name, split, summary: summaries[name], rows }, null, 1));
  const misses = rows.filter((row) => row.answerable && !row.firstHit);
  console.log(`\n${name} (${split}): ${variant.description}`);
  if (misses.length) console.log(`  sin evidencia en las fuentes: ${misses.map((row) => `${row.id} [${row.sources.join(' | ')}]`).join('\n    ')}`);
  if (variant.rerank) {
    // Separación entre preguntas con y sin respuesta según el mejor puntaje del reranker.
    const scores = (answerable) => rows.filter((row) => row.answerable === answerable && row.rerankTop !== null)
      .map((row) => row.rerankTop).sort((a, b) => a - b).map((score) => score.toFixed(3));
    console.log(`  reranker, con respuesta (menores): ${scores(true).slice(0, 8).join(' ')}`);
    console.log(`  reranker, sin respuesta (mayores): ${scores(false).slice(-8).join(' ')}`);
  }
}

console.log('\nResumen');
console.table(summaries);
console.log('Aciertos por categoría (preguntas con evidencia entre las fuentes devueltas)');
console.table(byCategory);
console.log(`embeddings: ${stats.fetched} pedidos al proveedor, ${stats.cached} desde caché`);
await prisma.$disconnect();
