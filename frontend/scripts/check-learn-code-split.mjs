import fs from 'node:fs';

const learn = fs.readFileSync('src/pages/LearnCourse.jsx', 'utf8');
const commentsCache = fs.readFileSync('src/lib/lesson-comments-cache.js', 'utf8');

for (const token of [
  'lazy(',
  'Suspense',
  'loadTutorPanel',
  'loadLessonComments',
  'loadEvaluationQuiz',
  'loadMarkdownContent',
  'loadHtmlLessonPlayer',
  'onMouseEnter',
  'onFocus',
]) {
  if (!learn.includes(token)) throw new Error(`Learn phase 5: falta el contrato ${token}`);
}

for (const component of ['LessonComments', 'EvaluationQuiz', 'MarkdownContent', 'HtmlLessonPlayer', 'TutorPanel']) {
  const staticImport = new RegExp(`import\\s+${component}\\s+from\\s+['"]\\.\\./components/${component}\\.jsx['"]`);
  if (staticImport.test(learn)) throw new Error(`Learn phase 5: ${component} sigue en el chunk principal`);
}

for (const token of ['limit: 100', 'pagination', 'nextCursor']) {
  if (!commentsCache.includes(token)) throw new Error(`Learn phase 5: falta la paginación ${token}`);
}

console.log('Learn code split: OK');
