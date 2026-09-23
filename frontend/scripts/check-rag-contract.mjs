import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PRACTICE_AWAITING_ANSWER,
  practiceStateAfterResponse,
  resolveTutorIntent,
} from '../src/lib/tutorPractice.js';

const learn = fs.readFileSync('src/pages/LearnCourse.jsx', 'utf8');
const panel = fs.readFileSync('src/components/TutorPanel.jsx', 'utf8');
const comments = fs.readFileSync('src/components/LessonComments.jsx', 'utf8');
const availability = fs.readFileSync('src/hooks/useTutorAvailability.js', 'utf8');
const editor = fs.readFileSync('src/pages/teacher/ModulesEditor.jsx', 'utf8');
const required = [
  'TutorPanel',
  '/api/lessons/${lessonId}/chat/status',
  '/api/lessons/${lessonId}/chat',
  'citations',
];
const missing = required.filter((token) => !learn.includes(token) && !panel.includes(token) && !availability.includes(token));
if (missing.length) throw new Error(`Contrato RAG incompleto: ${missing.join(', ')}`);

for (const intent of ['EXPLICAR', 'EJEMPLO', 'PRACTICA', 'RESUMEN']) {
  assert.match(panel, new RegExp(`intent: '${intent}'`));
}
assert.match(panel, /\.post\(`\/api\/lessons\/\$\{lessonId\}\/chat`/);
assert.match(panel, /message: question, history, intent: requestIntent/);
assert.ok(availability.includes('/api/lessons/${lessonId}/chat/status'));
assert.doesNotMatch(panel, /client\.get\('\/api\/rag\/credentials\/groq'\)/);
assert.match(panel, /client\.put\('\/api\/rag\/credentials\/groq', \{ apiKey: submittedKey \}\)/);
assert.match(panel, /client\.delete\('\/api\/rag\/credentials\/groq'\)/);
assert.match(panel, /Conectá tu clave para usar el Tutor IA/);
assert.match(panel, /https:\/\/console\.groq\.com\/keys/);
assert.match(panel, /target="_blank"/);
assert.match(panel, /rel="noopener noreferrer"/);
assert.match(panel, /type=\{revealed \? 'text' : 'password'\}/);
assert.match(panel, /autoComplete="off"/);
assert.match(panel, /autoCapitalize="none"/);
assert.match(panel, /spellCheck=\{false\}/);
assert.match(panel, /maxLength=\{512\}/);
assert.match(panel, /aria-pressed=\{revealed\}/);
assert.match(panel, /<ConfirmModal/);
assert.doesNotMatch(panel, /localStorage|sessionStorage|window\.history|URLSearchParams|console\.(?:log|error)|analytics/i);
assert.doesNotMatch(panel, /message: question, history, intent: requestIntent,\s*apiKey/);
assert.match(panel, /PRACTICE_AWAITING_ANSWER/);
assert.match(panel, /resolveTutorIntent\(intent, practiceState\)/);
assert.match(panel, /practiceStateAfterResponse\(requestIntent, citations\.length\)/);
assert.match(panel, /relatedLesson = data\.data\?\.relatedLesson \?\? null/);
assert.match(panel, /relatedLesson\s*\}/);
assert.match(panel, /Esta respuesta usa material de otra lección del curso\./);
assert.match(panel, /Ir a la lección/);
assert.match(panel, /onNavigateToLesson\(relatedLesson\.lessonId\)/);
assert.match(panel, /latestTutorMessageRef/);
assert.match(panel, /scrollIntoView\(\{ block: 'start'/);
assert.match(panel, /scrollIntoView\(\{ block: 'end'/);
assert.match(panel, /messageRef/);
assert.match(panel, /Fuente publicada del curso/);
assert.doesNotMatch(panel, /Relevancia\s*:/i);
assert.doesNotMatch(panel, /citation\.similarity|similarity.*%/i);

assert.match(editor, /setContextText\(await file\.text\(\)\)/);
assert.match(editor, /contextoRag/);
assert.match(editor, /\.txt,\.md/);
assert.match(editor, /RAG|Tutor|indexad/i);
assert.doesNotMatch(editor, /materials.*contextoRag|contextoRag.*Material/i);

assert.match(learn, /const \[tutorPractice, setTutorPractice\] = useState\(\{\}\)/);
assert.match(learn, /delete next\[previousLessonId\]/);
assert.match(learn, /practiceState: tutorPractice\[activeLesson\.id\]/);
assert.match(learn, /onPracticeStateChange:/);
assert.match(learn, /role="dialog"/);
assert.match(learn, /aria-modal="true"/);
assert.match(learn, /event\.key === 'Escape'/);
assert.match(learn, /LearnCourseSkeleton/);
assert.match(learn, /learn:shell-ready/);
assert.match(learn, /progressLoading/);
assert.match(panel, /learn:tutor-ready/);
assert.match(comments, /learn:comments-ready/);

assert.equal(PRACTICE_AWAITING_ANSWER, 'awaiting_answer');
assert.equal(resolveTutorIntent(undefined, { phase: PRACTICE_AWAITING_ANSWER }), 'RETROALIMENTAR');
assert.equal(resolveTutorIntent(undefined, null), 'DUDA');
assert.equal(resolveTutorIntent('PRACTICA', { phase: PRACTICE_AWAITING_ANSWER }), 'PRACTICA');
assert.deepEqual(practiceStateAfterResponse('PRACTICA', 1), { phase: PRACTICE_AWAITING_ANSWER });
assert.equal(practiceStateAfterResponse('PRACTICA', 0), null);
assert.equal(practiceStateAfterResponse('RETROALIMENTAR', 2), null);
assert.equal(practiceStateAfterResponse('EXPLICAR', 2), undefined);

console.log('RAG frontend contract: OK');
