import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import postsRoutes from './routes/posts.js';
import searchRoutes from './routes/search.js';
import commentsRoutes from './routes/comments.js';
import notificationsRoutes from './routes/notifications.js';
import soundsRoutes from './routes/sounds.js';
import locationsRoutes from './routes/locations.js';
import courseRoutes from './routes/courses.js'
import moduleRoutes from './routes/modules.js'
import lessonRoutes from './routes/lessons.js'
import materialRoutes from './routes/materials.js'
import categoryRoutes from './routes/categories.js'
import progressRoutes from './routes/progress.js'
import evaluationRoutes from './routes/evaluations.js'
import adminRoutes from './routes/admin.js'
import gotasRoutes from './routes/gotas.js'
import missionsRoutes from './routes/missions.js'
import rankingRoutes from './routes/ranking.js'
import shopRoutes from './routes/shop.js'
import authoringRoutes from './routes/authoring.js'
import gradesRoutes from './routes/grades.js'
import ragRoutes from './routes/rag.js'
import adminRagRoutes from './routes/admin-rag.js'
import ragCredentialRoutes from './routes/rag-credentials.js';
import { readiness } from './services/readiness.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const app = express();

// ---- CORS ----
// Orígenes permitidos: localhost (dev) + lo que venga en FRONTEND_URL.
// FRONTEND_URL admite múltiples URLs separadas por coma — útil para
// combinar el dominio de producción con previews de Vercel.
//   FRONTEND_URL=https://titiedu.vercel.app
//   FRONTEND_URL=https://titiedu.vercel.app,https://titiedu-git-dev.vercel.app
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
// Estático /uploads: se mantiene para dos casos — el fallback a disco en dev
// (cuando no hay credenciales de Cloudinary) y los archivos legacy previos a
// la migración. En prod con Cloudinary configurado queda inactivo (Render
// tiene FS efímero, así que ningún archivo nuevo aterriza aquí).
app.use('/uploads', express.static(uploadsDir));

app.get('/api/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok', service: 'neosocial-backend' } });
});

app.get('/api/ready', async (req, res) => {
  try {
    const data = await readiness();
    res.status(data.status === 'ready' ? 200 : 503).json({ success: data.status === 'ready', data });
  } catch {
    res.status(503).json({ success: false, data: { status: 'not_ready', checks: { postgres: 'error', neo4j: 'error', pgvector: 'error', rag: 'error', keyring: 'error' } } });
  }
});
app.use('/api/rag/credentials/groq', ragCredentialRoutes);

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/comments', commentsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/sounds', soundsRoutes);
app.use('/api/locations', locationsRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api', moduleRoutes)
app.use('/api', lessonRoutes)
app.use('/api', materialRoutes)
app.use('/api', evaluationRoutes)
app.use('/api/categories', categoryRoutes)
app.use('/api/progress', progressRoutes)
app.use('/api', ragRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/admin/rag', adminRagRoutes)
app.use('/api/gotas', gotasRoutes)
app.use('/api/missions', missionsRoutes)
app.use('/api/ranking', rankingRoutes)
app.use('/api/shop', shopRoutes)
app.use('/api/authoring', authoringRoutes)
app.use('/api', gradesRoutes)

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Ruta no encontrada' });
});

app.use((err, req, res, next) => {
  if (err?.type === 'entity.parse.failed') {
    if (req.originalUrl?.startsWith('/api/rag/credentials/')) res.set('Cache-Control', 'no-store');
    return res.status(400).json({ success: false, message: 'El cuerpo JSON no es válido' });
  }

  const status = Number.isInteger(err?.status) ? err.status : 500;
  // Never log request/error objects here: body-parser attaches the raw body to
  // parse errors and credential routes can contain provider secrets.
  console.error('Unhandled error', {
    method: req.method,
    path: req.path,
    status,
    name: err?.name || 'Error',
  });
  const message = status >= 500 ? 'Error interno del servidor' : err?.message || 'Solicitud inválida';
  return res.status(status).json({ success: false, message });
});

export default app;
