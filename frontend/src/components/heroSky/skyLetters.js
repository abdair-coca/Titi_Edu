// Interacción del cielo con las letras del título (change rediseno-hero-cursos).
//
// Las letras son HTML; el cielo solo conoce su tinta medida (`layout.letters`,
// en px del lienzo) y les manda golpes por el puente. HeroTitle hace el resto.

/** Manda un golpe a una letra: kind = 'wind' | 'bounce' | 'crash'. */
export function hitLetter(sky, index, kind, dir = 1, strength = 1) {
  sky.bridge?.emit('hit', { index, kind, dir, strength });
}

// Distancia de un punto a la tinta de una letra (0 si está adentro).
function distToInk(l, x, y) {
  const dx = Math.max(l.left - x, 0, x - l.right);
  const dy = Math.max(l.top - y, 0, y - l.bottom);
  return Math.hypot(dx, dy);
}

/**
 * Viento: cada letra a menos de `radius` px del objeto se inclina en el
 * sentido del vuelo. `memo` (Map por objeto) evita repetir el empujón mientras
 * el objeto sigue encima: una letra recibe un soplo cada `cooldown` s.
 */
export function brushLetters(sky, L, memo, t, x, y, dir, radius, { skip = -1, cooldown = 0.8 } = {}) {
  if (!L?.letters) return;
  for (const l of L.letters) {
    if (l.index === skip) continue;
    const d = distToInk(l, x, y);
    if (d > radius) continue;
    if (t - (memo.get(l.index) ?? -Infinity) < cooldown) continue;
    memo.set(l.index, t);
    hitLetter(sky, l.index, 'wind', dir, 0.45 + 0.75 * (1 - d / radius));
  }
}

/**
 * Superficie donde se apoya algo que cae en (x, y): la tinta de la letra más
 * alta por debajo, el borde del buscador o el piso del lienzo.
 * Devuelve { y, letter } (letter = índice o -1).
 */
export function surfaceBelow(L, x, y) {
  let best = { y: L.floorY, letter: -1 };
  const { landing } = L;
  if (x > landing.x0 && x < landing.x1 && landing.y >= y - 1 && landing.y < best.y) best = { y: landing.y, letter: -1 };
  for (const l of L.letters ?? []) {
    // Un margen de 2 px: la gota se resbala del borde en vez de quedarse en el aire.
    if (x < l.left + 2 || x > l.right - 2) continue;
    if (l.top < y - 1 || l.top >= best.y) continue;
    best = { y: l.top, letter: l.index };
  }
  return best;
}

const overlaps = (a, b, pad) =>
  a.left < b.right + pad && a.right > b.left - pad && a.top < b.bottom + pad && a.bottom > b.top - pad;

/** ¿La caja (px) toca la tinta de alguna letra o un bloque de texto? */
export function touchesText(L, rect, pad = 4) {
  if (!L) return false;
  for (const l of L.letters ?? []) if (overlaps(rect, l, pad)) return true;
  for (const b of L.blocks ?? []) if (overlaps(rect, b, pad)) return true;
  return false;
}

/**
 * Capa del lienzo medio (avión y globos): pide pasar delante o detrás del
 * texto y solo cambia cuando nada de ese lienzo toca texto, así ningún objeto
 * "salta" encima de una letra.
 */
export function requestLayer(sky, L, front) {
  const layer = sky.midLayer;
  if (!layer || layer.isFront() === front) return;
  for (const rect of sky.midRects.current.values()) if (rect && touchesText(L, rect)) return;
  layer.set(front);
}

/** Letra al azar (para el choque del avión y las gotas del repartidor). */
export function randomLetter(L, filter = () => true) {
  const list = (L?.letters ?? []).filter((l) => l.right - l.left > 6 && filter(l));
  return list.length ? list[Math.floor(Math.random() * list.length)] : null;
}
