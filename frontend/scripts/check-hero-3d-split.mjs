// Contrato de las escenas 3D de /courses: three, R3F y drei solo viven en los
// chunks diferidos (HeroScene para la habitación, SkyScene para el cielo del
// header). Courses y los componentes que deciden si montar 3D no los importan.
//   - change hero-3d-cursos (spec H6) y habitacion-3d-cursos
//   - change cielo-hero-cursos (cielo del header)
import fs from 'node:fs';

const THREE_IMPORT = /from\s+['"](three|@react-three\/[^'"]+)['"]/;

const mainChunkFiles = [
  'src/pages/Courses.jsx',
  'src/components/hero3d/Hero3D.jsx',
  'src/components/hero3d/heroModels.js',
  'src/components/hero3d/support.js',
  'src/components/heroSky/HeroSky.jsx',
  'src/components/heroSky/skyLayout.js',
  'src/components/heroTitle/HeroTitle.jsx',
  'src/components/heroTitle/letterSprings.js',
  'src/lib/heroBridge.js',
];

for (const file of mainChunkFiles) {
  const src = fs.readFileSync(file, 'utf8');
  if (THREE_IMPORT.test(src)) throw new Error(`Hero 3D: ${file} importa three de forma estática`);
  if (/import\s+(HeroScene|SkyScene)\s+from/.test(src)) {
    throw new Error(`Hero 3D: ${file} importa una escena de forma estática`);
  }
}

// Las piezas de las escenas importan three: solo las traen HeroScene o
// SkyScene, nunca el chunk principal.
const SCENE_FILES = new RegExp(
  "from\\s+['\"][./]*(hero3d/|heroSky/)?(HeroScene|HeroObject|RoomRig|RoomShell|RoomToys|roomTextures|roomLayout|sceneKit|dropGeometry|SkyScene|Drone|PaperPlane|SkyDrops|Balloons|skyKit|skyLetters)(\\.jsx?)?['\"]",
);
for (const file of mainChunkFiles) {
  if (SCENE_FILES.test(fs.readFileSync(file, 'utf8'))) {
    throw new Error(`Hero 3D: ${file} importa una pieza de escena de forma estática`);
  }
}

const expect = (file, tokens) => {
  const src = fs.readFileSync(file, 'utf8');
  for (const token of tokens) {
    if (!src.includes(token)) throw new Error(`Hero 3D: falta el contrato ${token} en ${file}`);
  }
};

// Respaldo común: reduced-motion, ahorro de datos y WebGL.
expect('src/components/hero3d/support.js', ['prefers-reduced-motion', 'saveData', 'webgl']);
expect('src/components/hero3d/Hero3D.jsx', ["lazy(() => import('./HeroScene.jsx'))", 'canShow3D']);
expect('src/components/heroSky/HeroSky.jsx', [
  "lazy(() => import('./SkyScene.jsx'))",
  'canShow3D',
  'aria-hidden="true"',
  'pointer-events-none',
]);
// El cielo nunca tapa la UI: un toque en el buscador, botones o links no llega al 3D.
expect('src/components/heroSky/skyKit.js', ['isUiTarget', 'input', 'button']);

console.log('Hero 3D code split: OK');
