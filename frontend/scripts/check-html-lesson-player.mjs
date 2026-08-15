import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const player = await readFile(new URL('../src/components/HtmlLessonPlayer.jsx', import.meta.url), 'utf8');
const editor = await readFile(new URL('../src/pages/teacher/ModulesEditor.jsx', import.meta.url), 'utf8');
const learn = await readFile(new URL('../src/pages/LearnCourse.jsx', import.meta.url), 'utf8');

assert.match(player, /srcDoc=\{srcDoc\}/);
assert.match(player, /sandbox="allow-scripts"/);
assert.doesNotMatch(player, /allow-same-origin|event\.origin/);
assert.match(player, /event\?\.source === iframeWindow/);
assert.match(player, /message\?\.source === 'titi-html'/);
assert.match(player, /message\?\.type === 'TITI_SCORE'/);
assert.match(player, /\/html-attempts/);
assert.match(player, /\/html-results/);
assert.match(editor, /accept="\.html,text\/html"/);
assert.match(editor, /\/lessons\/\$\{lesson\.id\}\/html/);
assert.match(learn, /<HtmlLessonPlayer lessonId=\{leccion\.id\} onScoreRecorded=\{onComplete\}/);

console.log('HTML lesson player security contract: pass');
