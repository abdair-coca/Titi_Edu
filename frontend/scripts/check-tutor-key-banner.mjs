import fs from 'node:fs';

const learn = fs.readFileSync('src/pages/LearnCourse.jsx', 'utf8');
const panel = fs.readFileSync('src/components/TutorPanel.jsx', 'utf8');

for (const token of [
  'useTutorAvailability',
  'TutorCredentialBanner',
  'Configurar ahora',
  'showTutorKeyNotice',
  'showTutorNotice',
  'openSettings',
  'aria-live="polite"',
]) {
  if (!learn.includes(token) && !panel.includes(token)) {
    throw new Error(`Tutor key banner: falta el contrato ${token}`);
  }
}

for (const token of ['activeLessonReady', 'tutorAvailability?.indexed', 'tutorAvailability?.enabled', "user?.rol === 'ESTUDIANTE'"]) {
  if (!learn.includes(token)) throw new Error(`Tutor key banner: falta la condición ${token}`);
}

if (!learn.includes("tutorCredential?.status !== 'VALID'")) {
  throw new Error('Tutor key banner: no espera confirmación de clave válida');
}

console.log('Tutor key banner: OK');
