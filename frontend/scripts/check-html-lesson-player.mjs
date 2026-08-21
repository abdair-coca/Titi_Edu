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
assert.match(player, /viewOnly/);
assert.match(player, /attemptsExhausted/);
assert.match(player, /err\.response\?\.status !== 409/);
assert.match(player, /renderHtmlDiagrams\(resource\.html\)/);
assert.match(player, /withAttemptToken\(preparedHtml, maxAttemptsReached \? null : token\)/);
assert.match(player, /import\('mermaid'\)/);
assert.match(player, /querySelectorAll\('\.mermaid, \.flowchart\[data-flow\]'\)/);
assert.match(player, /htmlLabels: false/);
assert.match(player, /parseFromString\(svg, 'image\/svg\+xml'\)/);
assert.match(player, /decodeMermaidDefinition\(rawDefinition\)/);
assert.match(player, /node\.textContent = decodeMermaidDefinition\(node\.textContent\)/);
assert.match(player, /evaluable && !viewOnly/);
assert.match(player, /Agotaste tus intentos\. Pod\u00e9s revisar la presentaci\u00f3n, pero ya no se registrar\u00e1 una nota\./u);
assert.match(player, /evaluable && !viewOnly/);
assert.match(editor, /accept="\.html,text\/html"/);
assert.match(editor, /\/lessons\/\$\{lesson\.id\}\/html/);
assert.match(learn, /<HtmlLessonPlayer[\s\S]*lessonId=\{leccion\.id\}[\s\S]*title=\{leccion\.titulo\}[\s\S]*onScoreRecorded=\{onComplete\}/);

console.log('HTML lesson player security contract: pass');
