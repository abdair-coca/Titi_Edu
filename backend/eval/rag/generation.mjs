// Mide las respuestas del Tutor RAG con Groq real: Markdown contra DIL sobre las mismas
// preguntas. Manual y con costo: cada pregunta gasta una llamada a Groq por modo.
// Requisito: la base local indexada con `npm run eval:rag -- --variants produccion`.
// Uso: npm run eval:rag:generation -- [--limit 20] [--split dev] [--modes markdown,dil] [--ids a,b]
//      [--db postgresql://...@127.0.0.1/...] [--env .env] [--course eval/rag/data/course.json]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const here = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(here, '..', '..');
const DEFAULT_DB = 'postgresql://postgres:test@127.0.0.1:55434/rag_eval';
const INTENTS = ['DUDA', 'EXPLICAR', 'EJEMPLO', 'PRACTICA', 'RESUMEN'];
const RATE_LIMIT_WAIT_MS = 20_000;
const EMBEDDING_RETRY_WAIT_MS = 3_000;
const MAX_RATE_LIMIT_RETRIES = 4;

const { values: args } = parseArgs({
  options: {
    limit: { type: 'string' }, split: { type: 'string' }, modes: { type: 'string' }, ids: { type: 'string' },
    db: { type: 'string' }, env: { type: 'string' }, course: { type: 'string' },
  },
});
const limit = Math.max(1, Number(args.limit) || 20);
const split = args.split || 'dev';
const modes = (args.modes || 'markdown,dil').split(',').map((mode) => mode.trim());
const dbUrl = args.db || DEFAULT_DB;
const envPath = path.resolve(backendDir, args.env || '.env');
const coursePath = path.resolve(backendDir, args.course || 'eval/rag/data/course.json');

if (!['localhost', '127.0.0.1'].includes(new URL(dbUrl).hostname)) {
  throw new Error('Solo se aceptan bases de datos locales (localhost o 127.0.0.1)');
}
if (modes.some((mode) => !['markdown', 'dil'].includes(mode))) throw new Error('--modes acepta markdown y dil');
if (!existsSync(coursePath)) throw new Error(`No existe la copia del curso: ${coursePath}. Ver eval/rag/README.md`);

// Solo se leen credenciales de proveedores; DATABASE_URL del .env nunca se usa.
const fileEnv = Object.fromEntries(readFileSync(envPath, 'utf8').split(/\r?\n/)
  .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)).filter(Boolean)
  .map(([, name, value]) => [name, value.trim().replace(/^["']|["']$/g, '')]));
const course = JSON.parse(readFileSync(coursePath, 'utf8'));
Object.assign(process.env, {
  DATABASE_URL: dbUrl,
  NODE_ENV: 'test',
  RAG_ENABLED: 'true',
  RAG_CHAT_ENABLED: 'true',
  RAG_COURSE_IDS: course.id,
  RAG_CREDENTIAL_MODE: 'platform',
  RAG_CHAT_MODE: 'direct',
  AI_PROVIDER_ROUTE: 'legacy',
  RAG_CHAT_RATE_LIMIT_PER_MINUTE: '1000',
  RAG_CHAT_DAILY_QUOTA: '100000',
  EMBEDDING_PROVIDER: 'cloudflare',
  EMBEDDING_MODEL: fileEnv.EMBEDDING_MODEL,
  CLOUDFLARE_ACCOUNT_ID: fileEnv.CLOUDFLARE_ACCOUNT_ID,
  CLOUDFLARE_AI_API_TOKEN: fileEnv.CLOUDFLARE_AI_API_TOKEN,
  GROQ_API_KEY: fileEnv.GROQ_API_KEY,
  GROQ_MODEL: fileEnv.GROQ_MODEL || 'openai/gpt-oss-20b',
});
if (!process.env.GROQ_API_KEY || !process.env.CLOUDFLARE_AI_API_TOKEN || !process.env.EMBEDDING_MODEL) {
  throw new Error(`Faltan GROQ_API_KEY, CLOUDFLARE_AI_API_TOKEN o EMBEDDING_MODEL en ${envPath}`);
}

// El backend no expone el cuerpo de un error de Groq; acá se guarda para diagnosticar.
let providerError = null;
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  const response = await realFetch(url, options);
  if (String(url).includes('groq.com') && !response.ok) {
    providerError = { status: response.status, body: (await response.clone().text()).slice(0, 12000) };
  }
  return response;
};

// Los eventos de seguridad dicen por qué se rechazó o recortó cada respuesta.
let events = [];
const realWarn = console.warn;
console.warn = (label, details) => {
  if (label === 'RAG security event') events.push(details);
  else realWarn(label, details);
};

const prisma = (await import('../../src/prisma.js')).default;
const rag = await import('../../src/services/rag.service.js');
const { NO_EVIDENCE_ANSWER } = await import('../../src/services/rag.security.js');

const fragments = await prisma.fragmentoRag.count();
if (!fragments) throw new Error('La base local no está indexada: corre antes npm run eval:rag -- --variants produccion');

// Preguntas con respuesta en el curso, repartidas por todo el split: mismo conjunto en cada corrida.
const golden = JSON.parse(readFileSync(path.join(here, 'golden-set.json'), 'utf8'));
const answerable = golden.questions.filter((question) => question.split === split && question.evidence.length);
const step = Math.max(1, Math.floor(answerable.length / limit));
const questions = answerable.filter((_, index) => index % step === 0).slice(0, limit)
  .map((question, index) => ({ ...question, lessonId: golden.lessons[question.lesson], intent: INTENTS[index % INTENTS.length] }))
  // --ids repeats some questions with the intent they get in the full run.
  .filter((question) => !args.ids || args.ids.split(',').includes(question.id));
const lessonTitle = Object.fromEntries(course.modulos.flatMap((module) => module.lecciones).map((lesson) => [lesson.id, lesson.titulo]));

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

async function ask(question) {
  for (let attempt = 0; ; attempt += 1) {
    events = [];
    providerError = null;
    const started = performance.now();
    try {
      const result = await rag.chatWithCourseContext({
        courseId: course.id,
        lessonId: question.lessonId,
        lessonTitle: lessonTitle[question.lessonId],
        principalId: 'eval-generation',
        message: question.query,
        history: question.history || [],
        intent: question.intent,
        protectAssessments: false,
        learningContext: rag.neutralLearningContext(),
      });
      return { result, error: null, ms: performance.now() - started, events };
    } catch (error) {
      if (error?.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
        await sleep(RATE_LIMIT_WAIT_MS * (attempt + 1));
        continue;
      }
      // A Cloudflare network blip is not what this measures: a few retries.
      if (/embeddings/.test(error?.message || '') && attempt < 3) {
        await sleep(EMBEDDING_RETRY_WAIT_MS);
        continue;
      }
      return {
        result: null,
        error: { status: error?.status || null, message: error?.message || String(error), provider: providerError },
        ms: performance.now() - started,
        events,
      };
    }
  }
}

function outcomeOf({ result, error, events: seen }) {
  if (error) return seen.some((event) => event.type === 'dil_nodes_dropped' && event.reason === 'unreadable') ? 'json_cortado' : `error_${error.status}`;
  if (result.answer === NO_EVIDENCE_ANSWER) {
    const rejected = seen.find((event) => event.type === 'ungrounded_answer_rejected');
    return rejected ? `rechazo_${rejected.reason}` : 'sin_evidencia';
  }
  return 'respondida';
}

const percentile = (values, p) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
};
const count = (items) => items.reduce((acc, item) => ({ ...acc, [item]: (acc[item] || 0) + 1 }), {});

const report = { date: new Date().toISOString(), split, questions: questions.length, modes: {} };
for (const mode of modes) {
  process.env.RAG_DIL_ENABLED = mode === 'dil' ? 'true' : 'false';
  const rows = [];
  for (const [index, question] of questions.entries()) {
    const run = await ask(question);
    const outcome = outcomeOf(run);
    const dropped = run.events.filter((event) => event.type === 'dil_nodes_dropped' && event.reason !== 'unreadable');
    rows.push({
      id: question.id,
      category: question.category,
      intent: question.intent,
      outcome,
      ms: Math.round(run.ms),
      completionTokens: run.result?.usage?.completion_tokens ?? null,
      components: run.result?.dil?.nodes.map((node) => node.c) || [],
      droppedNodes: dropped.reduce((total, event) => total + Number(event.count || 0), 0),
      droppedReasons: dropped.map((event) => event.reason),
      salvaged: run.events.some((event) => event.type === 'dil_salvaged'),
      answer: run.result?.answer ?? null,
      dil: run.result?.dil ?? null,
      error: run.error,
    });
    console.log(`[${mode}] ${index + 1}/${questions.length} ${question.id} (${question.intent}) → ${outcome} ${Math.round(run.ms)}ms`);
  }
  const tokens = rows.map((row) => row.completionTokens).filter((value) => value != null);
  const latencies = rows.filter((row) => !row.error).map((row) => row.ms);
  const answered = rows.filter((row) => row.outcome === 'respondida').length;
  report.modes[mode] = {
    summary: {
      respondidas: answered,
      tasaRechazo: Number((1 - answered / rows.length).toFixed(3)),
      resultados: count(rows.map((row) => row.outcome)),
      jsonCortados: rows.filter((row) => row.outcome === 'json_cortado').length,
      rescatadas: rows.filter((row) => row.salvaged).length,
      nodosDescartados: rows.reduce((total, row) => total + row.droppedNodes, 0),
      motivosDescarte: count(rows.flatMap((row) => row.droppedReasons)),
      componentes: count(rows.flatMap((row) => row.components)),
      tokensSalidaPromedio: tokens.length ? Math.round(tokens.reduce((a, b) => a + b, 0) / tokens.length) : null,
      tokensSalidaMax: tokens.length ? Math.max(...tokens) : null,
      latenciaP50Ms: percentile(latencies, 50),
      latenciaP90Ms: percentile(latencies, 90),
    },
    rows,
  };
}

const resultsDir = path.join(here, 'results');
mkdirSync(resultsDir, { recursive: true });
const outFile = path.join(resultsDir, `generation-${split}-${modes.join('+')}.json`);
writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`);
console.log('\nResumen');
for (const [mode, { summary }] of Object.entries(report.modes)) console.log(mode, JSON.stringify(summary, null, 2));
console.log(`\nDetalle por pregunta: ${path.relative(backendDir, outFile)}`);
await prisma.$disconnect();
