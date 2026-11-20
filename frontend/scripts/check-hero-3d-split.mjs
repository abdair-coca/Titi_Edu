// Contrato del hero 3D (change hero-3d-cursos, spec H6): three, R3F y drei solo
// viven en el chunk diferido de HeroScene. Courses y Hero3D no los importan.
import fs from 'node:fs';

const THREE_IMPORT = /from\s+['"](three|@react-three\/[^'"]+)['"]/;

const mainChunkFiles = [
  'src/pages/Courses.jsx',
  'src/components/hero3d/Hero3D.jsx',
  'src/components/hero3d/heroModels.js',
];

for (const file of mainChunkFiles) {
  const src = fs.readFileSync(file, 'utf8');
  if (THREE_IMPORT.test(src)) throw new Error(`Hero 3D: ${file} importa three de forma estática`);
  if (/import\s+HeroScene\s+from/.test(src)) throw new Error(`Hero 3D: ${file} importa HeroScene de forma estática`);
}

const hero = fs.readFileSync('src/components/hero3d/Hero3D.jsx', 'utf8');
for (const token of ["lazy(() => import('./HeroScene.jsx'))", 'prefers-reduced-motion', 'saveData', 'webgl']) {
  if (!hero.includes(token)) throw new Error(`Hero 3D: falta el contrato ${token}`);
}

console.log('Hero 3D code split: OK');
