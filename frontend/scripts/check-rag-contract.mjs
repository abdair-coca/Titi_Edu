import fs from 'node:fs';

const lesson = fs.readFileSync('src/pages/LearnCourse.jsx', 'utf8');
const card = fs.readFileSync('src/components/RagTutorCard.jsx', 'utf8');
const required = [
  'RagTutorCard',
  '/api/lessons/${lessonId}/chat/status',
  '/api/lessons/${lessonId}/chat',
  'citations',
];
const missing = required.filter((token) => !lesson.includes(token) && !card.includes(token));
if (missing.length) throw new Error(`Contrato RAG incompleto: ${missing.join(', ')}`);
console.log('RAG frontend contract: OK');
