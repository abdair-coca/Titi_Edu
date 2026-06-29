import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import neo4j from 'neo4j-driver';
import { randomUUID } from 'crypto';
import 'dotenv/config';
import { LOGROS_CATALOGO } from '../src/services/achievement.service.js';

const prisma = new PrismaClient();
const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
);

async function runQuery(cypher, params = {}) {
  const session = driver.session();
  try {
    const result = await session.run(cypher, params);
    return result.records;
  } finally {
    await session.close();
  }
}

const CATEGORIAS = [
  { nombre: 'Programación',  icono: '💻' },
  { nombre: 'Matemáticas',   icono: '🧮' },
  { nombre: 'Idiomas',       icono: '🌍' },
  { nombre: 'Ciencias',      icono: '🔬' },
  { nombre: 'Diseño',        icono: '🎨' },
  { nombre: 'Negocios',      icono: '📈' },
  { nombre: 'Humanidades',   icono: '📖' },
  { nombre: 'Música',        icono: '🎵' },
];

async function seedCategorias() {
  console.log('→ Sembrando categorías...');
  const result = [];
  for (const c of CATEGORIAS) {
    const cat = await prisma.categoria.upsert({
      where: { nombre: c.nombre },
      update: { icono: c.icono },
      create: { nombre: c.nombre, icono: c.icono },
    });
    result.push(cat);
  }
  console.log(`  ✓ ${result.length} categorías listas`);
  return result;
}

async function seedProfesorDemo() {
  console.log('→ Sembrando profesor_demo...');
  const username = 'profesor_demo';
  const email = 'profesor.demo@titi.local';
  const password = process.env.SEED_PASSWORD || 'titi1234';

  // Existe en Postgres?
  let pgUser = await prisma.usuario.findUnique({ where: { email } });

  // Espejo en Neo4j
  const existing = await runQuery(
    'MATCH (u:Usuario {email: $email}) RETURN u LIMIT 1',
    { email }
  );

  let neoId;
  if (existing.length === 0) {
    neoId = randomUUID();
    const hash = await bcrypt.hash(password, 10);
    const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(username)}`;
    await runQuery(
      `CREATE (u:Usuario {
         id: $id, username: $username, email: $email, password: $password,
         bio: 'Profesor demo de Titi — soy una cuenta de prueba',
         avatarUrl: $avatarUrl, createdAt: datetime()
       }) RETURN u`,
      { id: neoId, username, email, password: hash, avatarUrl }
    );
  } else {
    neoId = existing[0].get('u').properties.id;
  }

  if (!pgUser) {
    pgUser = await prisma.usuario.create({
      data: {
        neoId,
        username,
        email,
        rol: 'PROFESOR',
        verificado: true,
      },
    });
  } else {
    pgUser = await prisma.usuario.update({
      where: { id: pgUser.id },
      data: { rol: 'PROFESOR', verificado: true, neoId },
    });
  }
  console.log(`  ✓ profesor_demo listo (Postgres id=${pgUser.id})`);
  return pgUser;
}

async function seedAdminDemo() {
  console.log('→ Sembrando admin_demo...');
  const username = 'admin_demo';
  const email = 'admin_demo@titi.local';
  const password = process.env.SEED_PASSWORD || 'titi1234';

  // Existe en Postgres?
  let pgUser = await prisma.usuario.findUnique({ where: { email } });

  // Espejo en Neo4j
  const existing = await runQuery(
    'MATCH (u:Usuario {email: $email}) RETURN u LIMIT 1',
    { email }
  );

  let neoId;
  if (existing.length === 0) {
    neoId = randomUUID();
    const hash = await bcrypt.hash(password, 10);
    const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(username)}`;
    await runQuery(
      `CREATE (u:Usuario {
         id: $id, username: $username, email: $email, password: $password,
         bio: 'Admin demo de Titi — cuenta de prueba',
         avatarUrl: $avatarUrl, createdAt: datetime()
       }) RETURN u`,
      { id: neoId, username, email, password: hash, avatarUrl }
    );
  } else {
    neoId = existing[0].get('u').properties.id;
  }

  if (!pgUser) {
    pgUser = await prisma.usuario.create({
      data: { neoId, username, email, rol: 'ADMIN', verificado: true },
    });
  } else {
    pgUser = await prisma.usuario.update({
      where: { id: pgUser.id },
      data: { rol: 'ADMIN', verificado: true, neoId },
    });
  }
  console.log(`  ✓ admin_demo listo (Postgres id=${pgUser.id})`);
  return pgUser;
}

async function seedCursoDemo(profesor, categorias) {
  console.log('→ Sembrando curso demo...');
  const programacion = categorias.find((c) => c.nombre === 'Programación');
  const tituloDemo = 'Introducción a Python';

  let curso = await prisma.curso.findFirst({
    where: { titulo: tituloDemo, creadorId: profesor.id },
    include: { modulos: { include: { lecciones: { include: { materiales: true } } } } },
  });

  if (!curso) {
    curso = await prisma.curso.create({
      data: {
        titulo: tituloDemo,
        descripcion:
          'Aprende Python desde cero con la comunidad Titi. Cubrimos variables, ' +
          'estructuras de control, funciones y un proyecto final divertido.\n\n' +
          'Curso ideal para quienes nunca han programado.',
        nivel: 'principiante',
        publicado: true,
        portadaUrl: null,
        categoriaId: programacion.id,
        creadorId: profesor.id,
        modulos: {
          create: [
            {
              titulo: 'Fundamentos del lenguaje',
              descripcion: 'Las piezas básicas: variables, tipos y operaciones.',
              orden: 1,
              lecciones: {
                create: [
                  {
                    titulo: '¡Hola, Python!',
                    contenido:
                      'En esta primera lección instalamos Python y escribimos nuestro ' +
                      'primer programa: `print("Hola, Titi")`. Vamos a usar el REPL ' +
                      'para experimentar.',
                    videoUrl: 'https://www.youtube.com/watch?v=Kp4Mvapo5kc',
                    orden: 1,
                    materiales: {
                      create: [
                        {
                          nombre: 'Guía de instalación (PDF)',
                          url: 'https://docs.python.org/3/using/index.html',
                          tipo: 'pdf',
                        },
                      ],
                    },
                  },
                  {
                    titulo: 'Variables y tipos',
                    contenido:
                      'Cubrimos enteros, floats, strings y booleanos. Aprendemos a ' +
                      'inspeccionar un valor con `type()` y a convertirlo con `int()`, ' +
                      '`str()`, etc.',
                    videoUrl: 'https://www.youtube.com/watch?v=cQT33yu9pY8',
                    orden: 2,
                    materiales: { create: [] },
                  },
                  {
                    titulo: 'Operadores y expresiones',
                    contenido:
                      'Suma, resta, módulo, comparaciones y operadores lógicos. ' +
                      'Ejercicio: calculadora de propinas.',
                    videoUrl: null,
                    orden: 3,
                    materiales: { create: [] },
                  },
                ],
              },
            },
            {
              titulo: 'Control de flujo',
              descripcion: 'Toma decisiones y repite acciones.',
              orden: 2,
              lecciones: {
                create: [
                  {
                    titulo: 'if / elif / else',
                    contenido:
                      'Estructura tu lógica con condicionales. Vemos truthy/falsy ' +
                      'y por qué `0`, `""` y `None` son falsy.',
                    videoUrl: 'https://www.youtube.com/watch?v=DZwmZ8Usvnk',
                    orden: 1,
                    materiales: { create: [] },
                  },
                  {
                    titulo: 'Bucles for y while',
                    contenido:
                      'Iteramos sobre listas y rangos. Ejercicio: imprimir la tabla ' +
                      'de multiplicar del 7.',
                    videoUrl: 'https://www.youtube.com/watch?v=6iF8Xb7Z3wQ',
                    orden: 2,
                    materiales: { create: [] },
                  },
                  {
                    titulo: 'Funciones',
                    contenido:
                      'Definir funciones con `def`, parámetros, retorno y alcance de ' +
                      'variables. Cerramos con un mini-proyecto: un conversor de ' +
                      'unidades.',
                    videoUrl: null,
                    orden: 3,
                    materiales: { create: [] },
                  },
                ],
              },
            },
          ],
        },
      },
      include: { modulos: { include: { lecciones: { include: { materiales: true } } } } },
    });
  }
  console.log(`  ✓ curso "${curso.titulo}" listo (id=${curso.id})`);
  return curso;
}

async function seedLogros() {
  console.log('→ Sembrando catálogo de logros...');
  for (const l of LOGROS_CATALOGO) {
    await prisma.logro.upsert({
      where: { nombre: l.nombre },
      update: { descripcion: l.descripcion, icono: l.icono, tipo: l.tipo, condicion: l.condicion },
      create: l,
    });
  }
  console.log(`  ✓ ${LOGROS_CATALOGO.length} logros listos`);
}

// Etapa 6 — pool de misiones diarias. Idempotente por `codigo`.
const MISIONES_CATALOGO = [
  { codigo: 'completar_2_lecciones', titulo: 'Estudiá dos lecciones', descripcion: 'Completá 2 lecciones hoy', evento: 'leccion', meta: 2, recompensa: 15 },
  { codigo: 'aprobar_1_evaluacion', titulo: 'Aprobá una evaluación', descripcion: 'Aprobá 1 evaluación hoy', evento: 'evaluacion', meta: 1, recompensa: 20 },
  { codigo: 'publicar_1_post', titulo: 'Compartí algo', descripcion: 'Publicá 1 post hoy', evento: 'post', meta: 1, recompensa: 10 },
  { codigo: 'comentar_1_vez', titulo: 'Sumate a la charla', descripcion: 'Dejá 1 comentario hoy', evento: 'comentario', meta: 1, recompensa: 10 },
  { codigo: 'seguir_1_persona', titulo: 'Hacé un amigo', descripcion: 'Seguí a 1 persona hoy', evento: 'follow', meta: 1, recompensa: 10 },
];

async function seedMisiones() {
  console.log('→ Sembrando pool de misiones...');
  for (const m of MISIONES_CATALOGO) {
    await prisma.mision.upsert({
      where: { codigo: m.codigo },
      update: { titulo: m.titulo, descripcion: m.descripcion, evento: m.evento, meta: m.meta, recompensa: m.recompensa, activa: true },
      create: m,
    });
  }
  console.log(`  ✓ ${MISIONES_CATALOGO.length} misiones listas`);
}

// Etapa 7 — catálogo de ítems consumibles de la tienda. Idempotente por `codigo`.
const ITEMS_TIENDA = [
  { codigo: 'congelar_racha', nombre: 'Congelar racha', descripcion: 'Protegé tu racha: si un día no estudiás, no se rompe.', precio: 50, efecto: 'congelar_racha', icono: '🧊', limiteStack: 3 },
  { codigo: 'intento_extra', nombre: 'Intento extra', descripcion: 'Un intento más en una evaluación que ya agotaste.', precio: 80, efecto: 'intento_extra', icono: '🔁', limiteStack: 5 },
  { codigo: 'multiplicador_gotas', nombre: 'Multiplicador x2', descripcion: 'Duplicá las gotas que ganes durante 1 hora.', precio: 100, efecto: 'multiplicador_gotas', icono: '⚡', limiteStack: 3 },
];

async function seedItemsTienda() {
  console.log('→ Sembrando ítems de la tienda...');
  for (const it of ITEMS_TIENDA) {
    await prisma.itemTienda.upsert({
      where: { codigo: it.codigo },
      update: { nombre: it.nombre, descripcion: it.descripcion, precio: it.precio, efecto: it.efecto, icono: it.icono, limiteStack: it.limiteStack, activo: true },
      create: it,
    });
  }
  console.log(`  ✓ ${ITEMS_TIENDA.length} ítems de tienda listos`);
}

async function seedEvaluacionDemo(curso) {
  console.log('→ Sembrando evaluación final demo...');
  const existente = await prisma.evaluacion.findFirst({
    where: { cursoId: curso.id, esFinal: true },
  });
  if (existente) {
    console.log('  ✓ ya existía, no se toca');
    return existente;
  }

  const evaluacion = await prisma.evaluacion.create({
    data: {
      titulo: 'Evaluación final — Introducción a Python',
      cursoId: curso.id,
      esFinal: true,
      intentosMax: 3,
      notaMinima: 70,
      preguntas: {
        create: [
          {
            texto: '¿Qué función se usa para imprimir texto en la consola?',
            tipo: 'OPCION_MULTIPLE',
            orden: 1,
            opciones: {
              create: [
                { texto: 'print()', esCorrecta: true },
                { texto: 'echo()', esCorrecta: false },
                { texto: 'console.log()', esCorrecta: false },
                { texto: 'write()', esCorrecta: false },
              ],
            },
          },
          {
            texto: 'En Python, el valor `0` se evalúa como falsy.',
            tipo: 'VERDADERO_FALSO',
            orden: 2,
            opciones: {
              create: [
                { texto: 'Verdadero', esCorrecta: true },
                { texto: 'Falso', esCorrecta: false },
              ],
            },
          },
          {
            texto: '¿Con qué palabra clave se define una función en Python?',
            tipo: 'RESPUESTA_CORTA',
            orden: 3,
            opciones: {
              create: [{ texto: 'def', esCorrecta: true }],
            },
          },
        ],
      },
    },
  });
  console.log(`  ✓ evaluación final demo lista (id=${evaluacion.id})`);
  return evaluacion;
}

// Datos demo del feed académico (saldando deuda Etapa 4 §10.3: antes se
// sembraban a mano). Todo con MERGE → idempotente: correr el seed N veces no
// duplica relaciones. admin_demo sigue a profesor_demo y ve su actividad
// (inscripción, curso completado, logro) en /api/posts/feed/academic.
async function seedFeedAcademicoDemo(profesor, admin, curso) {
  console.log('→ Sembrando feed académico demo...');
  const profNeo = profesor.neoId;
  const adminNeo = admin.neoId;
  const cursoId = curso.id;

  // admin_demo SIGUIO profesor_demo
  await runQuery(
    `MATCH (a:Usuario {id: $adminNeo}), (p:Usuario {id: $profNeo})
     MERGE (a)-[:SIGUIO]->(p)`,
    { adminNeo, profNeo },
  );

  // profesor_demo INSCRITO_EN + COMPLETO_CURSO sobre el CursoRef del curso demo
  await runQuery(
    `MATCH (p:Usuario {id: $profNeo})
     MERGE (cref:CursoRef {cursoId: $cursoId})
     MERGE (p)-[ri:INSCRITO_EN]->(cref)
       ON CREATE SET ri.fechaInscripcion = datetime()
     MERGE (p)-[rc:COMPLETO_CURSO]->(cref)
       ON CREATE SET rc.fechaCompletado = datetime()`,
    { profNeo, cursoId },
  );

  // Notificación de logro de profesor_demo que recibe admin_demo (id fijo → idempotente)
  await runQuery(
    `MATCH (a:Usuario {id: $adminNeo}), (p:Usuario {id: $profNeo})
     MERGE (a)<-[:RECIBIO]-(n:Notificacion {id: 'seed-logro-profesor-demo'})
       ON CREATE SET n.type = 'logro', n.logroNombre = 'Primer curso',
                     n.read = false, n.createdAt = datetime()
     MERGE (n)-[:SOBRE]->(p)`,
    { adminNeo, profNeo },
  );

  console.log('  ✓ feed académico demo listo');
}

async function main() {
  try {
    const categorias = await seedCategorias();
    const profesor = await seedProfesorDemo();
    const admin = await seedAdminDemo();
    const curso = await seedCursoDemo(profesor, categorias);
    await seedLogros();
    await seedMisiones();
    await seedItemsTienda();
    await seedEvaluacionDemo(curso);
    await seedFeedAcademicoDemo(profesor, admin, curso);
    console.log('\n✓ Seed completado correctamente.');
    console.log('  Login del profesor demo:');
    console.log('    email:    profesor.demo@titi.local');
    console.log(`    password: ${process.env.SEED_PASSWORD || 'titi1234'}`);
    console.log('  Login del admin demo:');
    console.log('    email:    admin_demo@titi.local');
    console.log(`    password: ${process.env.SEED_PASSWORD || 'titi1234'}`);
  } catch (err) {
    console.error('Error en seed:', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
    await driver.close();
  }
}

main();
