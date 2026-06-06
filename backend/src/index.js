import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { initConstraints, closeDriver } from './db.js';
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import postsRoutes from './routes/posts.js';
import searchRoutes from './routes/search.js';
import commentsRoutes from './routes/comments.js';
import notificationsRoutes from './routes/notifications.js';
import soundsRoutes from './routes/sounds.js';
import locationsRoutes from './routes/locations.js';
import courseRoutes from './routes/courses.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const app = express();

// ---- CORS ----
// Orígenes permitidos: localhost (dev) + lo que venga en FRONTEND_URL.
// FRONTEND_URL admite múltiples URLs separadas por coma — útil para
// combinar el dominio de producción con previews de Vercel.
//   FRONTEND_URL=https://neosocial.vercel.app
//   FRONTEND_URL=https://neosocial.vercel.app,https://neosocial-git-dev.vercel.app
const LOCAL_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const extraOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const allowedOrigins = [...new Set([...LOCAL_ORIGINS, ...extraOrigins])];

console.log('CORS allowed origins:', allowedOrigins);

app.use(cors({
  origin(origin, cb) {
    // Permite herramientas sin Origin header (curl, Thunder Client, health checks)
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    console.warn(`CORS rechazado para origin: ${origin}`);
    return cb(new Error(`Origin ${origin} no permitido por CORS`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadsDir));

app.get('/api/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok', service: 'neosocial-backend' } });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/comments', commentsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/sounds', soundsRoutes);
app.use('/api/locations', locationsRoutes);
app.use('/api/courses', courseRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Ruta no encontrada' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  const status = err.status || 500;
  res.status(status).json({ success: false, message: err.message || 'Error interno del servidor' });
});

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
