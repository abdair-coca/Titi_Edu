import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PRACTICE_AWAITING_ANSWER,
  practiceStateAfterResponse,
  resolveTutorIntent,
} from '../src/lib/tutorPractice.js';
import {
  citationNumberFromHref,
  linkCitations,
  quizAnswerMessage,
  renderableNodes,
} from '../src/lib/dil.js';

const learn = fs.readFileSync('src/pages/LearnCourse.jsx', 'utf8');
const panel = fs.readFileSync('src/components/TutorPanel.jsx', 'utf8');
const comments = fs.readFileSync('src/components/LessonComments.jsx', 'utf8');
const availability = fs.readFileSync('src/hooks/useTutorAvailability.js', 'utf8');
const editor = fs.readFileSync('src/pages/teacher/ModulesEditor.jsx', 'utf8');
const dilDiagram = fs.readFileSync('src/components/tutor/DilDiagram.jsx', 'utf8');
const dilQuiz = fs.readFileSync('src/components/tutor/DilQuiz.jsx', 'utf8');
const mermaidLoader = fs.readFileSync('src/lib/mermaid.js', 'utf8');
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

// DIL: unknown components are skipped and a message without a tree keeps Markdown.
const textNode = { c: 'Text', text: 'Una variable [1].' };
assert.deepEqual(renderableNodes({ version: 1, nodes: [textNode, { c: 'Video' }, null] }), [textNode]);
assert.deepEqual(renderableNodes(null), []);
assert.deepEqual(renderableNodes({ version: 2, nodes: [textNode] }), []);
assert.match(panel, /dil = data\.data\?\.dil \?\? null/);
assert.match(panel, /dilNodes\.length \?/);
assert.match(panel, /<MarkdownContent content=\{msg\.content\}/);
assert.equal(linkCitations('Guarda un valor [1] y [7].', [1]), 'Guarda un valor [\\[1\\]](#cita-1) y [7].');
assert.equal(linkCitations('Usá `arr[1]` o arr[1] [1]', [1]), 'Usá `arr[1]` o arr[1] [\\[1\\]](#cita-1)');
assert.equal(citationNumberFromHref('#cita-3'), 3);
assert.equal(citationNumberFromHref('https://evil.example/#cita-3'), null);
assert.equal(quizAnswerMessage('  Un valor '), 'Mi respuesta: Un valor');

// Model-made diagrams land in the app document: strict Mermaid plus a second clean-up.
assert.match(dilDiagram, /renderMermaidSvg\(node\.source\)/);
assert.match(mermaidLoader, /securityLevel: 'strict'/);
assert.match(mermaidLoader, /suppressErrors: true/);
assert.match(mermaidLoader, /script, foreignObject/);
assert.match(mermaidLoader, /name\.startsWith\('on'\)/);

// Quiz: the choice travels as the student's answer; the client never grades it.
assert.match(panel, /onAsk\(quizAnswerMessage\(option\), \{ intent: 'RETROALIMENTAR' \}\)/);
assert.match(panel, /quizEnabled=\{index === conversation\.length - 1 && msg\.role === 'tutor' && !pending\}/);
assert.match(dilQuiz, /role="radiogroup"/);
assert.match(dilQuiz, /type="radio"/);
assert.doesNotMatch(dilQuiz, /isCorrect|esCorrecta|correctOption|answerKey|node\.answer/);

console.log('RAG frontend contract: OK');
