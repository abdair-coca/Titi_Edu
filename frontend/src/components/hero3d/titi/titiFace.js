// Micro-vida de la cara de Titi: parpadeo con ease, mirada que salta un poco
// (sacadas), bigote que se mueve como olfateando y orejas que se sacuden.
// Sin three ni React: un estado y una función por frame (se testea en Node).
//
// Todo son impulsos cortos que vuelven solos a reposo, así nunca se acumulan
// ni pelean con la pose: Titi.jsx los suma encima.

const BLINK_S = 0.16;

export function createFace() {
  return {
    blinkWait: 1.5,
    blinkLeft: 0,
    blinkTwice: false,
    lookWait: 1,
    look: { x: 0, y: 0 },
    lookTo: { x: 0, y: 0 },
    twitchWait: 3,
    twitchT: -1,
    earWait: 4,
    earT: -1,
    earSide: 1,
  };
}

// Campana suave 0 → 1 → 0 en `dur` segundos.
const bell = (t, dur) => (t < 0 || t > dur ? 0 : Math.sin((t / dur) * Math.PI));

/**
 * Avanza la cara un paso.
 * @param {ReturnType<typeof createFace>} f
 * @param {number} dt
 * @param {{ calm?: boolean, rand?: () => number }} opts
 *   calm: Titi está tranquilo (sentado, de pie, caminando): solo ahí mira de
 *   reojo, olfatea y sacude las orejas.
 * @returns {{ lid: number, sx: number, sy: number, twitch: number, ear: number, earSide: number }}
 *   lid: apertura 0..1; sx/sy: desvío extra de la mirada (-1..1);
 *   twitch: bigote (-1..1); ear: sacudida de oreja 0..1 (earSide: cuál).
 */
export function stepFace(f, dt, { calm = true, rand = Math.random } = {}) {
  // Parpadeo: cierra rápido y abre un poco más lento (ease), cada 2–5 s;
  // a veces dos veces seguidas.
  f.blinkWait -= dt;
  if (f.blinkWait <= 0) {
    f.blinkWait = 2 + rand() * 3;
    f.blinkLeft = BLINK_S;
    f.blinkTwice = rand() < 0.2;
  }
  let lid = 1;
  if (f.blinkLeft > 0) {
    f.blinkLeft -= dt;
    const p = 1 - Math.max(0, f.blinkLeft) / BLINK_S; // 0..1
    const close = p < 0.4 ? p / 0.4 : 1 - (p - 0.4) / 0.6;
    lid = 1 - 0.92 * Math.sin((close * Math.PI) / 2);
    if (f.blinkLeft <= 0 && f.blinkTwice) {
      f.blinkTwice = false;
      f.blinkLeft = BLINK_S;
    }
  }

  // Sacadas: cada 0,8–2,6 s la vista salta a un punto cercano y se queda.
  f.lookWait -= dt;
  if (f.lookWait <= 0) {
    f.lookWait = 0.8 + rand() * 1.8;
    f.lookTo = calm ? { x: (rand() - 0.5) * 1.2, y: (rand() - 0.5) * 0.8 } : { x: 0, y: 0 };
  }
  const k = 1 - Math.exp(-28 * dt); // salto rápido, como un ojo de verdad
  f.look.x += (f.lookTo.x - f.look.x) * k;
  f.look.y += (f.lookTo.y - f.look.y) * k;

  // Bigote: olfateo (dos tirones rápidos) cada 3–8 s.
  f.twitchWait -= dt;
  if (f.twitchWait <= 0 && calm) {
    f.twitchWait = 3 + rand() * 5;
    f.twitchT = 0;
  }
  let twitch = 0;
  if (f.twitchT >= 0) {
    f.twitchT += dt;
    twitch = Math.sin(f.twitchT * 38) * bell(f.twitchT, 0.32);
    if (f.twitchT > 0.32) f.twitchT = -1;
  }

  // Orejas: una sacudida de una oreja cada 4–10 s.
  f.earWait -= dt;
  if (f.earWait <= 0 && calm) {
    f.earWait = 4 + rand() * 6;
    f.earT = 0;
    f.earSide = rand() < 0.5 ? 1 : -1;
  }
  let ear = 0;
  if (f.earT >= 0) {
    f.earT += dt;
    ear = bell(f.earT, 0.28);
    if (f.earT > 0.28) f.earT = -1;
  }

  return { lid, sx: f.look.x, sy: f.look.y, twitch, ear, earSide: f.earSide };
}
