import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import neo4j from 'neo4j-driver';
import { randomUUID } from 'crypto';
import 'dotenv/config';

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

async function main() {
  try {
    const categorias = await seedCategorias();
    const profesor = await seedProfesorDemo();
    await seedCursoDemo(profesor, categorias);
    console.log('\n✓ Seed completado correctamente.');
    console.log('  Login del profesor demo:');
    console.log('    email:    profesor.demo@titi.local');
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
