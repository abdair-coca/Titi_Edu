import 'dotenv/config';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import request from 'supertest';

const courseId = process.env.RAG_E2E_COURSE_ID;
const adminUsername = process.env.RAG_E2E_ADMIN_USERNAME || 'admin';
const studentUsername = process.env.RAG_E2E_STUDENT_USERNAME;

if (process.env.RAG_E2E_ALLOW_DB_WRITE !== 'true') {
  throw new Error('Set RAG_E2E_ALLOW_DB_WRITE=true to allow the controlled indexing E2E');
}
if (!courseId || !studentUsername) {
  throw new Error('RAG_E2E_COURSE_ID and RAG_E2E_STUDENT_USERNAME are required');
}

function startProviderMock(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function json(response, status, payload) {
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(payload));
}

const embedding = Array.from({ length: 1024 }, () => 0.01);
const embeddingMock = await startProviderMock((req, res) => {
  if (req.method !== 'POST' || req.url !== '/embeddings') return json(res, 404, { error: 'not_found' });
  json(res, 200, { data: [{ embedding }], usage: { prompt_tokens: 1, total_tokens: 1 } });
});
const chatMock = await startProviderMock((req, res) => {
  if (req.method !== 'POST' || req.url !== '/chat/completions') return json(res, 404, { error: 'not_found' });
  json(res, 200, {
    choices: [{ message: { content: 'Respuesta E2E basada en el material publicado. [1]' } }],
    usage: { prompt_tokens: 10, completion_tokens: 9, total_tokens: 19 },
  });
});

process.env.RAG_ENABLED = 'true';
process.env.RAG_COURSE_IDS = courseId;
process.env.EMBEDDING_API_URL = `http://127.0.0.1:${embeddingMock.address().port}`;
process.env.EMBEDDING_API_KEY = 'e2e-mock';
process.env.EMBEDDING_MODEL = 'e2e-mock-1024';
process.env.EMBEDDING_DIMENSIONS = '1024';
process.env.GROQ_API_URL = `http://127.0.0.1:${chatMock.address().port}/chat/completions`;
process.env.GROQ_API_KEY = 'e2e-mock';
process.env.GROQ_MODEL = 'e2e-mock-chat';

const [{ default: app }, { default: prisma }] = await Promise.all([
  import('../src/app.js'),
  import('../src/prisma.js'),
]);

function tokenFor(usuario) {
  return jwt.sign({ id: usuario.neoId }, process.env.JWT_SECRET, { expiresIn: '10m' });
}

try {
  const [admin, student, lesson] = await Promise.all([
    prisma.usuario.findUnique({ where: { username: adminUsername }, select: { neoId: true, rol: true } }),
    prisma.usuario.findUnique({ where: { username: studentUsername }, select: { id: true, neoId: true, rol: true } }),
    prisma.leccion.findFirst({
      where: { estado: 'PUBLICADA', modulo: { cursoId: courseId, estado: 'PUBLICADO', curso: { publicado: true } } },
      select: { id: true },
      orderBy: { orden: 'asc' },
    }),
  ]);
  if (!admin || admin.rol !== 'ADMIN') throw new Error(`Admin user not found: ${adminUsername}`);
  if (!student || student.rol !== 'ESTUDIANTE') throw new Error(`Student user not found: ${studentUsername}`);
  if (!lesson) throw new Error('No published lesson found in the pilot course');

  const enrollment = await prisma.inscripcion.findUnique({ where: { usuarioId_cursoId: { usuarioId: student.id, cursoId: courseId } } });
  if (!enrollment) throw new Error('The selected student is not enrolled in the pilot course');

  const reindex = await request(app)
    .post(`/api/admin/rag/courses/${courseId}/reindex`)
    .set('Authorization', `Bearer ${tokenFor(admin)}`);
  if (reindex.status !== 200 || !reindex.body?.success || reindex.body.data.total < 1) {
    throw new Error(`Reindex failed: ${reindex.status} ${JSON.stringify(reindex.body)}`);
  }

  const documents = await prisma.documentoRag.findMany({
    where: { leccion: { modulo: { cursoId: courseId } }, activo: true, estado: 'LISTO' },
    select: { id: true },
  });
  const fragments = await prisma.fragmentoRag.count({ where: { documentoId: { in: documents.map(({ id }) => id) } } });
  if (!documents.length || !fragments) throw new Error('Reindex returned success but no ready documents/fragments were stored');

  const chat = await request(app)
    .post(`/api/lessons/${lesson.id}/chat`)
    .set('Authorization', `Bearer ${tokenFor(student)}`)
    .send({ message: '¿Qué explica esta lección?' });
  if (chat.status !== 200 || !chat.body?.success || !chat.body.data?.answer || !chat.body.data.citations?.length) {
    throw new Error(`Chat failed: ${chat.status} ${JSON.stringify(chat.body)}`);
  }

  console.log(JSON.stringify({
    courseId,
    lessonsProcessed: reindex.body.data.total,
    readyDocuments: documents.length,
    storedFragments: fragments,
    chatStatus: chat.status,
    citationCount: chat.body.data.citations.length,
  }, null, 2));
} finally {
  await prisma.$disconnect();
  await Promise.all([
    new Promise((resolve) => embeddingMock.close(resolve)),
    new Promise((resolve) => chatMock.close(resolve)),
  ]);
}
