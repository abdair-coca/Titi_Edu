// Capturas reproducibles de Titi 3D desde varios ángulos (laboratorio visual).
// Uso: con `npm run dev` corriendo,
//   node scripts/titi-shots.mjs <carpeta-salida> [url-base]
// Saca frente, tres cuartos, costado, espalda, primer plano de la cara, vista
// del cuarto y algunas poses, y arma una hoja de contacto (contact.png).
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

// Playwright no es dependencia del proyecto: se usa el instalado en la máquina
// (con NODE_PATH apuntando a los módulos globales si hace falta).
const { chromium } = createRequire(import.meta.url)('playwright');

const out = process.argv[2] || 'titi-shots';
const base = process.argv[3] || 'http://localhost:5173';
mkdirSync(out, { recursive: true });

const SHOTS = [
  ['front', 'view=0&pitch=6'],
  ['three-quarter', 'view=38&pitch=14'],
  ['side', 'view=90&pitch=6'],
  ['back', 'view=180&pitch=14'],
  ['face', 'view=0&pitch=4&zoom=2.6'],
  ['face-3q', 'view=32&pitch=8&zoom=2.4'],
  ['room-iso', 'view=0&pitch=31'],
  ['wave', 'mode=wave&t=0.9&view=10&pitch=14'],
  ['celebrate', 'mode=celebrate&t=1.1&view=0&pitch=14'],
  ['walk', 'mode=walk&t=0.25&view=55&pitch=14'],
  ['face-celebrate', 'mode=celebrate&t=1.1&view=0&pitch=8&zoom=2.2&ty=1.0'],
  ['face-think', 'mode=think&t=1.5&view=15&pitch=8&zoom=2.2&ty=0.98'],
  ['face-land', 'mode=land&t=0.3&view=0&pitch=8&zoom=2.2&ty=0.75'],
  ['blink', 'view=0&pitch=8&zoom=2.4&lid=0.3'],
  ['carried', 'mode=carried&time=0.4&view=20&pitch=14'],
];

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 640, height: 640 }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
for (const [name, params] of SHOTS) {
  await page.goto(`${base}/titi-lab.html?${params}`);
  await page.waitForFunction(() => window.__titiLabReady === true, null, { timeout: 60000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: join(out, `${name}.png`) });
  console.log('ok', name);
}

// Hoja de contacto: todas las capturas en una grilla con su nombre.
const tiles = SHOTS.map(([name]) => `<figure><img src="data:image/png;base64,${readFileSync(join(out, name + '.png')).toString('base64')}"><figcaption>${name}</figcaption></figure>`).join('');
await page.setViewportSize({ width: 1600, height: 1000 });
await page.setContent(`<style>body{margin:0;display:grid;grid-template-columns:repeat(5,1fr);font:14px sans-serif;background:#fff}figure{margin:0}img{width:100%;display:block}figcaption{text-align:center;padding:2px}</style>${tiles}`);
await page.waitForTimeout(500);
await page.screenshot({ path: join(out, 'contact.png'), fullPage: true });
await browser.close();
if (errors.length) {
  console.error('errores de consola:', errors);
  process.exitCode = 1;
}
