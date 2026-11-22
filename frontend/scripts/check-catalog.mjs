// Lógica del catálogo de /courses (rediseno-catalogo-cursos R3, R4, R7).
import assert from 'node:assert/strict';
import {
  activeFilterCount,
  buildRows,
  categoriaSlug,
  filterCourses,
  filtersFromParams,
  filtersToParams,
  hasActiveSearch,
  lengthBucket,
  resolvePaths,
} from '../src/components/catalog/catalogData.js';

const cat = (nombre) => ({ id: `id-${categoriaSlug(nombre)}`, nombre });
const prog = cat('Programación');
const idiomas = cat('Idiomas');

const curso = (id, extra = {}) => ({
  id,
  titulo: id,
  nivel: 'Principiante',
  emiteCertificado: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  categoria: prog,
  creador: { username: 'ana' },
  _count: { inscripciones: 0, lecciones: 3 },
  ...extra,
});

const cursos = [
  curso('Python básico', { _count: { inscripciones: 9, lecciones: 4 } }),
  curso('React avanzado', { nivel: 'Avanzado', createdAt: '2026-06-01T00:00:00.000Z', _count: { inscripciones: 2, lecciones: 20 } }),
  curso('Inglés técnico', { categoria: idiomas, nivel: 'Intermedio', emiteCertificado: false, _count: { inscripciones: 5, lecciones: 8 } }),
  curso('Álgebra', { createdAt: '2026-03-01T00:00:00.000Z', creador: { username: 'luis' } }),
];
const titles = (list) => list.map((c) => c.titulo);

// Largo por lecciones
assert.equal(lengthBucket(0), 'corto');
assert.equal(lengthBucket(5), 'corto');
assert.equal(lengthBucket(6), 'medio');
assert.equal(lengthBucket(12), 'medio');
assert.equal(lengthBucket(13), 'largo');

// Orden por defecto: populares
assert.deepEqual(titles(filterCourses(cursos, {})), ['Python básico', 'Inglés técnico', 'React avanzado', 'Álgebra']);
assert.deepEqual(titles(filterCourses(cursos, { orden: 'nuevos' })), ['React avanzado', 'Álgebra', 'Python básico', 'Inglés técnico']);
assert.deepEqual(titles(filterCourses(cursos, { orden: 'az' })), ['Álgebra', 'Inglés técnico', 'Python básico', 'React avanzado']);

// Búsqueda sin acentos, por palabras, sobre título/categoría/profe
assert.deepEqual(titles(filterCourses(cursos, { q: 'INGLES' })), ['Inglés técnico']);
assert.deepEqual(titles(filterCourses(cursos, { q: 'programacion luis' })), ['Álgebra']);
assert.deepEqual(filterCourses(cursos, { q: 'nada que ver' }), []);

// Filtros combinados
assert.deepEqual(titles(filterCourses(cursos, { cat: 'idiomas' })), ['Inglés técnico']);
assert.deepEqual(titles(filterCourses(cursos, { niveles: ['avanzado', 'intermedio'] })), ['Inglés técnico', 'React avanzado']);
assert.deepEqual(titles(filterCourses(cursos, { largo: 'largo' })), ['React avanzado']);
assert.deepEqual(titles(filterCourses(cursos, { cert: true })), ['Python básico', 'React avanzado', 'Álgebra']);
assert.equal(activeFilterCount({ cat: 'idiomas', niveles: ['avanzado'], cert: true }), 3);
assert.equal(hasActiveSearch({ q: '  ' }), false);
assert.equal(hasActiveSearch({ orden: 'az' }), false);
assert.equal(hasActiveSearch({ largo: 'corto' }), true);

// URL ⇄ filtros (ida y vuelta; ignora valores raros; conserva ?curso=)
const params = new URLSearchParams('q=py&cat=programacion&nivel=avanzado,raro&largo=xl&orden=az&cert=1&curso=c1');
const parsed = filtersFromParams(params);
assert.deepEqual(parsed, { q: 'py', cat: 'programacion', niveles: ['avanzado'], largo: '', orden: 'az', cert: true });
const back = filtersToParams(parsed, params);
assert.equal(back.get('curso'), 'c1');
assert.equal(back.get('nivel'), 'avanzado');
assert.equal(back.has('largo'), false);
assert.equal(filtersToParams({ orden: 'populares' }, new URLSearchParams()).toString(), '');

// Enlace viejo ?categoria=<id> → slug
const legacy = filtersFromParams(new URLSearchParams(`categoria=${idiomas.id}`), [prog, idiomas]);
assert.equal(legacy.cat, 'idiomas');
assert.equal(filtersToParams(legacy, new URLSearchParams(`categoria=${idiomas.id}`)).has('categoria'), false);

// Filas curadas
const enrolled = [
  { curso: { id: 'Python básico', _count: {} }, completado: false, siguienteLeccionId: 'l2', leccionesTotales: 4, avance: 25, ultimaActividad: '2026-02-01' },
  { curso: { id: 'Álgebra', _count: {} }, completado: false, siguienteLeccionId: 'l9', leccionesTotales: 3, avance: 66, ultimaActividad: '2026-05-01' },
  { curso: { id: 'React avanzado', _count: {} }, completado: true, siguienteLeccionId: null, leccionesTotales: 20, avance: 100 },
];
const rows = buildRows({
  cursos,
  enrolled,
  recommended: [{ curso: { id: 'Inglés técnico', _count: {} }, friendCount: 2, sampleFriends: ['a', 'b'] }],
});
assert.deepEqual(rows.continua.map((i) => i.curso.id), ['Álgebra', 'Python básico']);
assert.equal(rows.continua[0].curso._count.lecciones, 3, 'completa el curso con el catálogo');
assert.equal(rows.amigos[0].curso._count.lecciones, 8);
assert.deepEqual(titles(rows.empezar), ['Python básico', 'Álgebra']);
assert.equal(rows.nuevos[0].titulo, 'React avanzado');
assert.deepEqual(titles(rows.populares), ['Python básico', 'Inglés técnico', 'React avanzado']);

// Rutas: pasos resueltos por título, siguiente paso tras lo completado
const paths = resolvePaths(
  [
    { title: 'Ruta', cursos: ['React avanzado', 'No existe', 'Python básico'] },
    { title: 'Vacía', cursos: ['Nada'] },
  ],
  cursos,
  enrolled,
);
assert.equal(paths.length, 1);
assert.deepEqual(paths[0].steps.map((s) => [s.curso.titulo, s.done]), [['React avanzado', true], ['Python básico', false]]);
assert.equal(paths[0].current, 1);

console.log('Catálogo de cursos: pass');
