// Carriles de vuelo del cielo del header de /courses (change cielo-hero-cursos).
//
// Vive en el chunk principal y NO importa three: mide el texto real del hero
// (marcado con `data-sky="…"`) y devuelve, en píxeles relativos al lienzo, por
// dónde puede pasar cada objeto. Así las trayectorias esquivan el buscador sin
// importar cómo se acomode el texto en cada ancho.

const PART_NAMES = ['promo', 'title', 'paragraph', 'search', 'stats'];

// Mitad del espacio entre columnas del hero en desktop (`lg:gap-10` = 40 px).
const DESKTOP_GAP_HALF = 20;
// Aire debajo de las cifras para que las gotas nazcan "del piso".
const BOTTOM_PAD = 16;
// Ancho mínimo libre a la derecha del párrafo para que entre el dron chico.
const SMALL_DRONE_MIN_ZONE = 84;

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

/**
 * Mide el hero y arma los carriles.
 *
 * @param {HTMLElement} region   Contenedor de promo + hero (origen del lienzo).
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

  // Desktop: hasta la mitad del espacio entre columnas (el borde se funde, ver
  // HeroSky). Una columna: hasta el borde derecho de la pantalla.
  const width = Math.round(desktop ? col.right + DESKTOP_GAP_HALF : viewportWidth);
  const height = Math.round(col.bottom + BOTTOM_PAD);
  if (width < 200 || height < 200) return null;

  const { promo, title, paragraph, search, stats } = parts;

  // Dron repartidor: la fila del badge, entre la barra amarilla y el título.
  const deliveryY = (promo.bottom + title.top) / 2;

  // Avión: vuela por debajo del párrafo y el rizo sube sobre título y texto,
  // sin bajar nunca al buscador.
  const planeBase = Math.min(paragraph.bottom - 4, search.top - 28);
  const planeLoopR = Math.max(28, Math.min(desktop ? 72 : 52, (planeBase - title.top) / 2.2));

  // Gotas: nacen en las cifras y se esfuman antes de llegar al buscador.
  const dropsFrom = height - 26;
  const dropsTo = search.bottom + 18;

  // Dron chico: el hueco a la derecha del párrafo (si entra).
  const zoneLeft = paragraph.right + 16;
  const zoneRight = width - 16;
  const smallZone = zoneRight - zoneLeft >= SMALL_DRONE_MIN_ZONE
    ? {
        x0: zoneLeft,
        x1: zoneRight,
        y0: title.bottom + 6,
        y1: Math.min(paragraph.bottom + 10, search.top - 30),
      }
    : null;

  return {
    offsetX: -shiftX,
    fadeRight: desktop,
    width,
    height,
    deliveryY,
    planeBase,
    planeLoopR,
    dropsFrom,
    dropsTo: Math.min(dropsTo, dropsFrom - 40),
    smallZone,
    // Las gotas que sueltan los drones "aterrizan" sobre el borde del buscador.
    landing: { x0: search.left + 12, x1: search.right - 12, y: search.top },
    floorY: height - 6,
    statsTop: stats.top,
    promoBottom: promo.bottom,
  };
}
