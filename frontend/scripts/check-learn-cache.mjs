import fs from 'node:fs';

const page = fs.readFileSync('src/pages/LearnCourse.jsx', 'utf8');
const cache = fs.readFileSync('src/lib/lesson-cache.js', 'utf8');

for (const token of [
  'requestLessonDetail',
  'invalidateLessonDetail',
  'clearLessonDetailCache',
  'userCacheKey',
  'requestIdleCallback',
]) {
  if (!page.includes(token) && !cache.includes(token)) {
    throw new Error(`Learn phase 3: falta el contrato ${token}`);
  }
}

for (const token of ['lessonCache', 'pendingRequests', 'AbortController', 'entry.controller.abort']) {
  if (!cache.includes(token)) {
    throw new Error(`Learn phase 3: falta la garantía ${token}`);
  }
}

console.log('Learn cache and prefetch: OK');
