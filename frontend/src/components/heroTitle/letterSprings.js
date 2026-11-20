// Resortes por letra del título del hero (change rediseno-hero-cursos).
//
// Cada letra tiene tres resortes independientes (desplazamiento, giro y
// estirón/aplastón) que vuelven a cero con rebote tipo gelatina. Los golpes
// suman velocidad, así varios impactos seguidos se combinan sin cortarse.
// Un solo requestAnimationFrame para todas las letras, que se apaga cuando
// todas quedan quietas. Escribe `transform` directo (sin renders de React).

// [rigidez, amortiguación] — poca amortiguación = más rebote.
const MOVE = [170, 11];
const TURN = [150, 7];
const SQUASH = [260, 10];
const REST = 0.01;

const blank = () => ({ x: 0, vx: 0, y: 0, vy: 0, r: 0, vr: 0, q: 0, vq: 0, hold: 0 });

function spring(s, key, vkey, [k, c], dt) {
  s[vkey] += (-k * s[key] - c * s[vkey]) * dt;
  s[key] += s[vkey] * dt;
}

function write(el, s) {
  // q > 0 estira hacia arriba, q < 0 aplasta (conserva un poco el volumen).
  const sy = 1 + s.q;
  const sx = 1 - s.q * 0.45;
  el.style.transform = `translate3d(${s.x.toFixed(2)}px, ${s.y.toFixed(2)}px, 0) rotate(${s.r.toFixed(2)}deg) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
}

const settled = (s) =>
  Math.abs(s.x) + Math.abs(s.y) + Math.abs(s.r) + Math.abs(s.q * 40) < REST &&
  Math.abs(s.vx) + Math.abs(s.vy) + Math.abs(s.vr) + Math.abs(s.vq * 40) < REST * 10;

export function createLetterSprings() {
  const states = new Map();
  let raf = 0;
  let last = 0;

  const frame = (now) => {
    const dt = Math.min(0.033, (now - last) / 1000 || 0.016);
    last = now;
    for (const [el, s] of states) {
      if (!el.isConnected) {
        states.delete(el);
        continue;
      }
      if (s.hold > now) continue;
      if (s.hold) {
        // Fin de la espera de entrada: aparece y el resorte la lleva a su lugar.
        s.hold = 0;
        el.style.opacity = '';
      }
      spring(s, 'x', 'vx', MOVE, dt);
      spring(s, 'y', 'vy', MOVE, dt);
      spring(s, 'r', 'vr', TURN, dt);
      spring(s, 'q', 'vq', SQUASH, dt);
      if (settled(s)) {
        el.style.transform = '';
        states.delete(el);
      } else write(el, s);
    }
    raf = states.size ? requestAnimationFrame(frame) : 0;
  };

  const start = () => {
    if (raf) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };

  const get = (el) => {
    let s = states.get(el);
    if (!s) {
      s = blank();
      states.set(el, s);
    }
    return s;
  };

  return {
    /** Suma velocidad: { vx, vy (px/s), vr (grados/s), vq (estirón/s) }. */
    kick(el, { vx = 0, vy = 0, vr = 0, vq = 0 }) {
      if (!el) return;
      const s = get(el);
      s.vx += vx;
      s.vy += vy;
      s.vr += vr;
      s.vq += vq;
      start();
    },
    /** Entrada: la letra espera `delayMs` invisible y desplazada, y salta a su lugar. */
    enter(el, delayMs, { y = 36, q = -0.35, r = 0 } = {}) {
      if (!el) return;
      const s = get(el);
      Object.assign(s, { y, q, r, vy: 0, vq: 0, vr: 0, hold: performance.now() + delayMs });
      el.style.opacity = '0';
      write(el, s);
      start();
    },
    dispose() {
      cancelAnimationFrame(raf);
      raf = 0;
      for (const el of states.keys()) {
        el.style.transform = '';
        el.style.opacity = '';
      }
      states.clear();
    },
  };
}
