// Lógica pura del catálogo de /courses (rediseno-catalogo-cursos R3-R4).
// Sin React ni DOM: la prueba `npm run test:catalog` la importa directo.

/** Minúsculas y sin acentos: "Inglés" → "ingles". */
export function normalizeText(s) {
  return (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Slug de categoría para la URL y las ilustraciones: "Diseño UX/UI" → "disenouxui". */
export function categoriaSlug(nombre) {
  return normalizeText(nombre).replace(/[^a-z0-9]/g, '');
}

export const LEVELS = [
  { id: 'principiante', label: 'Principiante' },
  { id: 'intermedio', label: 'Intermedio' },
  { id: 'avanzado', label: 'Avanzado' },
];

export const LENGTHS = [
  { id: 'corto', label: 'Corto', hint: 'hasta 5 lecciones' },
  { id: 'medio', label: 'Medio', hint: '6 a 12 lecciones' },
  { id: 'largo', label: 'Largo', hint: 'más de 12 lecciones' },
];

export const ORDERS = [
  { id: 'populares', label: 'Más populares' },
  { id: 'nuevos', label: 'Más nuevos' },
  { id: 'az', label: 'A-Z' },
];

export const DEFAULT_FILTERS = Object.freeze({
  q: '',
  cat: '',
  niveles: [],
  largo: '',
  orden: 'populares',
  cert: false,
});

export function lessonCount(curso) {
  return curso?._count?.lecciones ?? 0;
}

export function enrolledCount(curso) {
  return curso?._count?.inscripciones ?? 0;
}

export function lengthBucket(n) {
  if (n <= 5) return 'corto';
  if (n <= 12) return 'medio';
  return 'largo';
}

export function levelId(nivel) {
  return normalizeText(nivel);
}

const byPopular = (a, b) =>
  enrolledCount(b) - enrolledCount(a) || +new Date(b.createdAt || 0) - +new Date(a.createdAt || 0);
const byNewest = (a, b) => +new Date(b.createdAt || 0) - +new Date(a.createdAt || 0);
const byTitle = (a, b) => (a.titulo || '').localeCompare(b.titulo || '', 'es', { sensitivity: 'base' });

const SORTERS = { populares: byPopular, nuevos: byNewest, az: byTitle };

/**
 * Filtra y ordena el catálogo. Búsqueda por palabras (todas deben aparecer)
 * sobre título, categoría y profe, sin acentos ni mayúsculas.
 */
export function filterCourses(cursos, filters) {
  const f = { ...DEFAULT_FILTERS, ...filters };
  const tokens = normalizeText(f.q).split(/\s+/).filter(Boolean);
  const niveles = new Set(f.niveles);

  const out = cursos.filter((c) => {
    if (f.cat && categoriaSlug(c.categoria?.nombre) !== f.cat) return false;
    if (niveles.size && !niveles.has(levelId(c.nivel))) return false;
    if (f.largo && lengthBucket(lessonCount(c)) !== f.largo) return false;
    if (f.cert && c.emiteCertificado === false) return false;
    if (!tokens.length) return true;
    const hay = normalizeText([c.titulo, c.categoria?.nombre, c.creador?.username].filter(Boolean).join(' '));
    return tokens.every((t) => hay.includes(t));
  });
  return out.sort(SORTERS[f.orden] || byPopular);
}

/** Cantidad de filtros activos (sin contar la búsqueda ni el orden). */
export function activeFilterCount(filters) {
  const f = { ...DEFAULT_FILTERS, ...filters };
  return (f.cat ? 1 : 0) + f.niveles.length + (f.largo ? 1 : 0) + (f.cert ? 1 : 0);
}

export function hasActiveSearch(filters) {
  const f = { ...DEFAULT_FILTERS, ...filters };
  return Boolean(f.q.trim()) || activeFilterCount(f) > 0;
}

// ---- URL ⇄ filtros ----

/** Lee los filtros de `URLSearchParams`. Ignora valores desconocidos. */
export function filtersFromParams(params, categorias = []) {
  const niveles = (params.get('nivel') || '')
    .split(',')
    .filter((n) => LEVELS.some((l) => l.id === n));
  const largo = LENGTHS.some((l) => l.id === params.get('largo')) ? params.get('largo') : '';
  const orden = ORDERS.some((o) => o.id === params.get('orden')) ? params.get('orden') : 'populares';

  // `?categoria=<id>` es el enlace viejo (Mis cursos, Feed, Explore).
  let cat = params.get('cat') || '';
  const legacyId = params.get('categoria');
  if (!cat && legacyId) {
    const found = categorias.find((c) => c.id === legacyId);
    if (found) cat = categoriaSlug(found.nombre);
  }

  return {
    q: params.get('q') || '',
    cat,
    niveles,
    largo,
    orden,
    cert: params.get('cert') === '1',
  };
}

/** Escribe los filtros sobre una copia de `params` (conserva `curso` y otros). */
export function filtersToParams(filters, params) {
  const next = new URLSearchParams(params);
  const f = { ...DEFAULT_FILTERS, ...filters };
  const set = (key, value) => (value ? next.set(key, value) : next.delete(key));
  set('q', f.q.trim());
  set('cat', f.cat);
  set('nivel', f.niveles.join(','));
  set('largo', f.largo);
  set('orden', f.orden === 'populares' ? '' : f.orden);
  set('cert', f.cert ? '1' : '');
  next.delete('categoria');
  return next;
}

// ---- Filas curadas (R3) ----

const ROW_MAX = 10;
/** Con menos cursos, las filas temáticas repetirían el catálogo entero. */
export const THEMED_ROWS_MIN_CATALOG = 8;

/**
 * Arma las filas visibles. `enrolled` son inscripciones de /my/enrolled y
 * `recommended` lo de /recommended; los cursos de ambas se completan con los
 * del catálogo (que traen el conteo de lecciones).
 */
export function buildRows({ cursos, enrolled = [], recommended = [] }) {
  const byId = new Map(cursos.map((c) => [c.id, c]));
  const merge = (c) => ({ ...c, ...byId.get(c.id), _count: { ...c._count, ...byId.get(c.id)?._count } });

  const continua = enrolled
    .filter((i) => !i.completado && i.siguienteLeccionId && i.leccionesTotales > 0)
    .sort((a, b) => +new Date(b.ultimaActividad || 0) - +new Date(a.ultimaActividad || 0))
    .slice(0, ROW_MAX)
    .map((i) => ({ ...i, curso: merge(i.curso) }));

  const amigos = recommended.slice(0, ROW_MAX).map((r) => ({ ...r, curso: merge(r.curso) }));

  if (cursos.length < THEMED_ROWS_MIN_CATALOG) {
    return { continua, amigos, empezar: [], nuevos: [], populares: [] };
  }

  const empezar = cursos
    .filter((c) => levelId(c.nivel) === 'principiante')
    .sort(byPopular)
    .slice(0, ROW_MAX);
  const nuevos = [...cursos].sort(byNewest).slice(0, ROW_MAX);
  const populares = [...cursos].filter((c) => enrolledCount(c) > 0).sort(byPopular).slice(0, ROW_MAX);

  return { continua, amigos, empezar, nuevos, populares };
}

/** Mapa cursoId → { friendCount, sampleFriends } para marcar amigos en tarjetas. */
export function friendsByCourse(recommended = []) {
  return new Map(recommended.map((r) => [r.curso.id, { friendCount: r.friendCount, sampleFriends: r.sampleFriends }]));
}

// ---- Rutas de aprendizaje (R7) ----

/**
 * Resuelve cada ruta curada contra el catálogo (por título) y marca qué
 * cursos completó el usuario. `current` es el índice del siguiente paso.
 */
export function resolvePaths(paths, cursos, enrolled = []) {
  const byTitulo = new Map(cursos.map((c) => [c.titulo, c]));
  const done = new Set(enrolled.filter((i) => i.completado || i.avance === 100).map((i) => i.curso.id));
  return paths
    .map((p) => {
      const steps = p.cursos.map((t) => byTitulo.get(t)).filter(Boolean);
      const current = steps.findIndex((c) => !done.has(c.id));
      return {
        ...p,
        steps: steps.map((c) => ({ curso: c, done: done.has(c.id) })),
        current: current === -1 ? steps.length : current,
      };
    })
    .filter((p) => p.steps.length > 0);
}

/**
 * Rutas curadas a mano: secuencias ORDENADAS de cursos reales hacia un
 * objetivo. Se resuelven por título contra el catálogo (si falta uno, se omite).
 */
export const LEARNING_PATHS = [
  {
    title: 'De cero a Programador',
    objetivo: 'Empieza sin saber nada y termina creando apps completas.',
    cursos: ['Introducción a Python', 'Desarrollo Web con React', 'Desarrollo Back-End', 'Neo4j para Desarrolladores'],
  },
  {
    title: 'Camino a Data Science',
    objetivo: 'De los fundamentos al machine learning aplicado.',
    cursos: ['Introducción a Python', 'Álgebra Lineal Aplicada', 'Machine Learning con Python'],
  },
  {
    title: 'Front-End Moderno',
    objetivo: 'Diseña y construye interfaces web profesionales.',
    cursos: ['Diseño de Interfaces Modernas', 'Desarrollo Web con React', 'Inglés para Desarrolladores'],
  },
];
