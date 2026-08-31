import fs from 'node:fs';

const learn = fs.readFileSync('src/pages/LearnCourse.jsx', 'utf8');
const panel = fs.readFileSync('src/components/TutorPanel.jsx', 'utf8');
const required = [
  'TutorPanel',
  '/api/lessons/${lessonId}/chat/status',
  '/api/lessons/${lessonId}/chat',
  'citations',
];
const missing = required.filter((token) => !learn.includes(token) && !panel.includes(token));
if (missing.length) throw new Error(`Contrato RAG incompleto: ${missing.join(', ')}`);
console.log('RAG frontend contract: OK');