import 'dotenv/config';

import app from './app.js';
import { initConstraints, closeDriver } from './db.js';
import prisma from './prisma.js';
import { startIndexWorker } from './services/rag.queue.js';
import { indexLesson } from './services/rag.service.js';
import { validateAiRuntimeConfiguration } from './services/ai-credentials.js';

const PORT = process.env.PORT || 3001;
let server;
let stopWorker = async () => {};

async function start() {
  validateAiRuntimeConfiguration();
  try {
    await initConstraints();
    console.log('Neo4j: constraints listos');
  } catch (err) {
    console.error('No se pudieron inicializar los constraints de Neo4j:', err.message);
  }

  stopWorker = startIndexWorker(indexLesson);
  server = app.listen(PORT, () => {
    console.log(`NeoSocial backend escuchando en http://localhost:${PORT}`);
  });
}

start().catch(() => {
  console.error('No se pudo iniciar el backend: configuración IA inválida');
  process.exitCode = 1;
});

async function shutdown() {
  console.log('\nCerrando servidor...');
  server?.close();
  await stopWorker();
  await Promise.all([closeDriver(), prisma.$disconnect()]);
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
