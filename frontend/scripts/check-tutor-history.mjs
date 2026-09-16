import assert from 'node:assert/strict';
import { buildTutorHistory } from '../src/lib/tutorHistory.js';

const previous = [
  { role: 'user', content: '¿Qué es una variable?' },
  { role: 'tutor', content: 'Es un contenedor de valores.' },
];

assert.deepEqual(buildTutorHistory(previous, '¿Y qué más?'), [
  { role: 'user', content: '¿Qué es una variable?' },
  { role: 'assistant', content: 'Es un contenedor de valores.' },
]);

const failedQuestion = [...previous, { role: 'user', content: '¿Y qué más?' }];
assert.deepEqual(buildTutorHistory(failedQuestion, '¿Y qué más?'), [
  { role: 'user', content: '¿Qué es una variable?' },
  { role: 'assistant', content: 'Es un contenedor de valores.' },
]);

assert.deepEqual(buildTutorHistory([
  ...previous,
  { role: 'system', content: 'No debe llegar.' },
], 'Nueva pregunta'), [
  { role: 'user', content: '¿Qué es una variable?' },
  { role: 'assistant', content: 'Es un contenedor de valores.' },
]);

const lessonOne = [{ role: 'user', content: 'Pregunta de lección uno' }];
const lessonTwo = [{ role: 'user', content: 'Pregunta de lección dos' }];
assert.deepEqual(buildTutorHistory(lessonOne, 'Seguimiento'), lessonOne.map(({ role, content }) => ({ role, content })));
assert.deepEqual(buildTutorHistory(lessonTwo, 'Seguimiento'), lessonTwo.map(({ role, content }) => ({ role, content })));
assert.notDeepEqual(buildTutorHistory(lessonOne, 'Seguimiento'), buildTutorHistory(lessonTwo, 'Seguimiento'));

console.log('Tutor history: OK');
