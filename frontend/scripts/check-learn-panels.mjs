import fs from 'node:fs';

const learn = fs.readFileSync('src/pages/LearnCourse.jsx', 'utf8');
const panel = fs.readFileSync('src/components/TutorPanel.jsx', 'utf8');
const availability = fs.readFileSync('src/hooks/useTutorAvailability.js', 'utf8');
const comments = fs.readFileSync('src/components/LessonComments.jsx', 'utf8');
const commentsCache = fs.readFileSync('src/lib/lesson-comments-cache.js', 'utf8');

for (const token of ['useTutorAvailability', 'requestLessonComments', 'requestIdleCallback']) {
  if (!learn.includes(token) && !panel.includes(token) && !availability.includes(token)) {
    throw new Error(`Learn phase 4: falta el contrato ${token}`);
  }
}

if (panel.match(/client\.get\('\/api\/rag\/credentials\/groq'\)/)) {
  throw new Error('Learn phase 4: TutorPanel todavía duplica la consulta de credencial');
}

for (const [token, source] of [
  ['credential', panel],
  ['chat/status', availability],
  ['pendingRequests', commentsCache],
  ['aria-busy="true"', comments],
]) {
  if (!source.includes(token)) throw new Error(`Learn phase 4: falta la garantía ${token}`);
}

console.log('Learn panels: OK');
