import 'dotenv/config';

import app from './app.js';
import { initConstraints, closeDriver } from './db.js';

const PORT = process.env.PORT || 3001;

async function start() {
  try {
    await initConstraints();
    console.log('Neo4j: constraints listos');
  } catch (err) {
    console.error('No se pudieron inicializar los constraints de Neo4j:', err.message);
  }

  app.listen(PORT, () => {
    console.log(`NeoSocial backend escuchando en http://localhost:${PORT}`);
  });
}

start();

async function shutdown() {
  console.log('\nCerrando servidor...');
  await closeDriver();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
