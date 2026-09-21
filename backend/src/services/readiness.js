import prisma from '../prisma.js';
import driver from '../db.js';
import { validateAiRuntimeConfiguration, validateCredentialKeyring } from './ai-credentials.js';

async function boundedCheck(check) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(check),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Readiness timeout')), 5000); timer.unref(); }),
    ]);
  } finally { clearTimeout(timer); }
}

export async function readiness({ db = prisma, neo4j = driver } = {}) {
  const checks = { postgres: 'error', neo4j: 'error', pgvector: 'error', rag: 'ok', keyring: 'ok' };
  let credentialRequired = false;
  try {
    ({ credentialRequired } = validateAiRuntimeConfiguration());
  } catch {
    checks.rag = 'error';
    checks.keyring = 'error';
  }
  const results = await Promise.allSettled([
    boundedCheck(() => db.$queryRaw`SELECT 1`),
    boundedCheck(() => neo4j.verifyConnectivity()),
    boundedCheck(() => db.$queryRaw`SELECT extname FROM pg_extension WHERE extname = 'vector'`),
  ]);
  if (results[0].status === 'fulfilled') checks.postgres = 'ok';
  if (results[1].status === 'fulfilled') checks.neo4j = 'ok';
  if (results[2].status === 'fulfilled' && results[2].value.length) checks.pgvector = 'ok';
  if (process.env.RAG_ENABLED === 'true') {
    const cloudflare = process.env.EMBEDDING_PROVIDER === 'cloudflare';
    const embeddingReady = cloudflare
      ? process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_AI_API_TOKEN
      : process.env.EMBEDDING_API_URL;
    checks.rag = embeddingReady ? 'ok' : 'error';
  }
  if (credentialRequired) {
    checks.keyring = 'error';
    try {
      validateCredentialKeyring();
      // Rotation readiness checks every version still referenced by stored keys.
      const versions = await boundedCheck(() => db.credencialIa.findMany({ distinct: ['keyVersion'], select: { keyVersion: true } }));
      for (const { keyVersion } of versions) {
        const value = process.env[`AI_CREDENTIAL_KEY_${keyVersion}`];
        if (!value || !/^[A-Za-z0-9+/]{43}=$/.test(value) || Buffer.from(value, 'base64').length !== 32) throw new Error('Unavailable key');
      }
      checks.keyring = 'ok';
    } catch { /* Expose state only, never configuration or credentials. */ }
    if (process.env.RAG_ENABLED === 'true' && process.env.RAG_CHAT_ENABLED !== 'false') {
      const gatewayReady = process.env.AI_PROVIDER_ROUTE === 'cloudflare_gateway'
        && process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_AI_GATEWAY_ID && process.env.CLOUDFLARE_AI_GATEWAY_TOKEN;
      if (!gatewayReady) checks.rag = 'error';
    }
  }
  const ready = Object.values(checks).every((value) => value === 'ok');
  return { status: ready ? 'ready' : 'not_ready', checks };
}
