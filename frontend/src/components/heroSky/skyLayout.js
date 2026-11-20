// Carriles de vuelo del cielo del header de /courses (changes cielo-hero-cursos
// y rediseno-hero-cursos).
//
// Vive en el chunk principal y NO importa three: mide el texto real del hero
// (marcado con `data-sky="…"` y cada letra del título con `data-sky-letter`) y
// devuelve, en píxeles relativos al lienzo, por dónde puede pasar cada objeto
// y dónde está la tinta de cada letra (para chocar y apoyar gotas encima).

const PART_NAMES = ['title', 'paragraph', 'search'];

// Mitad del espacio entre columnas del hero en desktop (`lg:gap-10` = 40 px).
const DESKTOP_GAP_HALF = 20;
// Aire debajo del buscador (piso de las gotas).
const BOTTOM_PAD = 24;
// Ancho mínimo libre para que entre el dron chico.
const SMALL_DRONE_MIN_ZONE = 84;
// Alto mínimo de la franja sobre el título para que floten globos.
const BALLOON_MIN_BAND = 60;

// Rect relativo al lienzo: arriba alineado con la región; a la izquierda
// arranca en el borde de la pantalla (los objetos entran y salen por ahí).
const relRect = (el, origin, shiftX) => {
  const r = el.getBoundingClientRect();
  return {
    left: r.left - origin.left + shiftX,
    right: r.right - origin.left + shiftX,
    top: r.top - origin.top,
    bottom: r.bottom - origin.top,
  };
};

let measureCtx = null;

// Tinta de una letra: la caja del span incluye el interlineado, pero una gota
// tiene que apoyarse sobre el glifo ("a" es más baja que "A"). Se calcula con
// las métricas de la fuente: línea base a partir de la caja y alto real del
// carácter. `k` corrige la escala si el renglón está achicado (palabra larga).
function inkRect(outer, box) {
  const inner = outer.firstElementChild ?? outer;
  const ch = inner.textContent;
  measureCtx ??= document.createElement('canvas').getContext('2d');
  const cs = getComputedStyle(inner);
  measureCtx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const m = measureCtx.measureText(ch);
  const h = box.bottom - box.top;
  if (m.fontBoundingBoxAscent === undefined || !outer.offsetHeight) {
    return { ...box, top: box.top + h * 0.3, bottom: box.bottom - h * 0.1 };
  }
  const k = h / outer.offsetHeight;
  const lineHeight = outer.offsetHeight;
  const fA = m.fontBoundingBoxAscent;
  const fD = m.fontBoundingBoxDescent;
  const baseline = box.top + ((lineHeight - (fA + fD)) / 2 + fA) * k;
  return {
    left: box.left - m.actualBoundingBoxLeft * k,
    right: box.left + m.actualBoundingBoxRight * k,
    top: baseline - m.actualBoundingBoxAscent * k,
    bottom: baseline + m.actualBoundingBoxDescent * k,
  };
}

// Letras del título en orden de documento (el mismo índice que usa HeroTitle),
// con su tinta y el renglón al que pertenecen.
function measureLetters(region, origin, shiftX) {
  const out = [];
  let line = -1;
  let lineTop = -Infinity;
  region.querySelectorAll('[data-sky-letter]').forEach((outer, index) => {
    const box = relRect(outer, origin, shiftX);
    if (box.top > lineTop + (box.bottom - box.top) / 2) {
      line += 1;
      lineTop = box.top;
    }
    const ink = inkRect(outer, box);
    out.push({ index, line, ...ink, cx: (ink.left + ink.right) / 2, cy: (ink.top + ink.bottom) / 2 });
  });
  return out;
}

/**
 * Mide el hero y arma los carriles.
 *
 * @param {HTMLElement} region   Contenedor del hero (origen del lienzo).
 * @param {HTMLElement} textCol  Columna de texto del hero.
 * @param {boolean}     desktop  Layout de dos columnas (≥ lg).
 * @returns {object|null} Medidas en px, o null si falta alguna pieza.
 */
export function measureSky(region, textCol, desktop) {
  if (!region || !textCol) return null;
  const origin = region.getBoundingClientRect();
  const viewportWidth = document.documentElement.clientWidth;
  // El lienzo arranca en el borde izquierdo de la pantalla (debajo del menú
  // lateral fijo, si hay) para que los objetos no se corten en el margen.
  const shiftX = Math.max(0, Math.round(origin.left));
  const parts = {};
  for (const name of PART_NAMES) {
    const el = region.querySelector(`[data-sky="${name}"]`);
    if (!el) return null;
    parts[name] = relRect(el, origin, shiftX);
  }
  const col = relRect(textCol, origin, shiftX);
  const letters = measureLetters(region, origin, shiftX);
  if (!letters.length) return null;

  // Desktop: hasta la mitad del espacio entre columnas (el borde se funde, ver
  // HeroSky). Una columna: hasta el borde derecho de la pantalla.
  const width = Math.round(desktop ? col.right + DESKTOP_GAP_HALF : viewportWidth);
  const height = Math.round(col.bottom + BOTTOM_PAD);
  if (width < 200 || height < 200) return null;

  const { title, paragraph, search } = parts;
  const firstLine = letters.filter((l) => l.line === 0);
  const inkTop = Math.min(...firstLine.map((l) => l.top));
  const firstLineRight = Math.max(...firstLine.map((l) => l.right));
  const firstLineBottom = Math.max(...firstLine.map((l) => l.bottom));

  // Dron repartidor: rasante sobre el primer renglón (sus hélices "peinan" las
  // letras al pasar), sin salirse del lienzo por arriba.
  const deliveryY = Math.max(46, inkTop - 64);

  // Avión: vuela por el renglón del párrafo y el rizo sube sobre el título,
  // sin bajar nunca al buscador.
  const planeBase = Math.min(paragraph.bottom - 4, search.top - 28);
  const planeLoopR = Math.max(28, Math.min(desktop ? 80 : 56, (planeBase - title.top) / 2.4));

  // Dron chico: el hueco a la derecha de "Aprendé" (si entra); si no, a la
  // derecha del párrafo.
  const besideTitle = { x0: firstLineRight + 28, x1: width - 16, y0: inkTop, y1: firstLineBottom };
  const besideText = {
    x0: paragraph.right + 16,
    x1: width - 16,
    y0: paragraph.top - 6,
    y1: Math.min(paragraph.bottom + 10, search.top - 30),
  };
  const fits = (z) => z.x1 - z.x0 >= SMALL_DRONE_MIN_ZONE && z.y1 - z.y0 > 0;
  const smallZone = fits(besideTitle) ? besideTitle : fits(besideText) ? besideText : null;

  // Globos: la franja libre sobre el título (el hilo puede colgar por detrás
  // de las letras).
  const band = { y0: 30, y1: inkTop - 8 };
  const balloonBand = band.y1 - band.y0 >= BALLOON_MIN_BAND ? band : null;

  return {
    offsetX: -shiftX,
    fadeRight: desktop,
    width,
    height,
    deliveryY,
    planeBase,
    planeLoopR,
    smallZone,
    balloonBand,
    letters,
    // Otros bloques de texto: el avión y los globos cambian de capa solo
    // cuando no tocan letras ni estos bloques.
    blocks: [paragraph, search],
    // Centro del buscador: los drones lo miran cuando tiene foco.
    searchCenter: { x: (search.left + search.right) / 2, y: (search.top + search.bottom) / 2 },
    // Las gotas que no caen sobre una letra se apoyan sobre el buscador.
    landing: { x0: search.left + 12, x1: search.right - 12, y: search.top },
    floorY: height - 6,
  };
}
