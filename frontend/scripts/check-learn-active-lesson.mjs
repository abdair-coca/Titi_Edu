import fs from 'node:fs';

const source = fs.readFileSync('src/pages/LearnCourse.jsx', 'utf8');
const cache = fs.readFileSync('src/lib/lesson-cache.js', 'utf8');

if (source.includes('/api/modules/${activeModulo.id}/lessons')) {
  throw new Error('Learn phase 2: todavía se descarga el módulo completo para la lección activa');
}

for (const token of [
  'activeLessonDetail',
  'requestLessonDetail({',
  'materiales={activeLesson.materiales || []}',
]) {
  if (!source.includes(token)) {
    throw new Error(`Learn phase 2: falta el contrato ${token}`);
  }
}

if (!cache.includes('/api/lessons/${lessonId}')) {
  throw new Error('Learn phase 2: el cargador no solicita el detalle de una sola lección');
}

console.log('Learn active lesson: OK');
