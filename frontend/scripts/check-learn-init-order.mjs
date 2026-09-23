import fs from 'node:fs';

const source = fs.readFileSync('src/pages/LearnCourse.jsx', 'utf8');
const activeLessonDeclaration = source.indexOf('const activeLesson = useMemo(');
const lessonReadyEffect = source.indexOf("markPerformance('learn:lesson-ready'");

if (activeLessonDeclaration < 0) {
  throw new Error('Learn init order: no se encontró la declaración de activeLesson');
}

if (lessonReadyEffect < 0) {
  throw new Error('Learn init order: no se encontró la marca learn:lesson-ready');
}

if (lessonReadyEffect < activeLessonDeclaration) {
  throw new Error(
    'Learn init order: learn:lesson-ready usa activeLesson antes de su inicialización',
  );
}

console.log('Learn init order: OK');
