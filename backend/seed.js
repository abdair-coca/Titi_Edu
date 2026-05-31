// seed.js — ejecutar con: node seed.js (o npm run seed)
// Reconstruye la base con los 7 nodos en español:
// Usuario, Post, Hashtag, Comentario, Notificacion, Sonido, Ubicacion

import 'dotenv/config';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import neo4j from 'neo4j-driver';

const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
);

async function run(cypher, params = {}) {
  const session = driver.session();
  try {
    return await session.run(cypher, params);
  } finally {
    await session.close();
  }
}

async function seed() {
  console.log('🌱 Iniciando seed...');

  await run('MATCH (n) DETACH DELETE n');
  console.log('🗑️  Base de datos limpia');

  const constraints = [
    'CREATE CONSTRAINT usuario_id IF NOT EXISTS FOR (u:Usuario) REQUIRE u.id IS UNIQUE',
    'CREATE CONSTRAINT usuario_username IF NOT EXISTS FOR (u:Usuario) REQUIRE u.username IS UNIQUE',
    'CREATE CONSTRAINT usuario_email IF NOT EXISTS FOR (u:Usuario) REQUIRE u.email IS UNIQUE',
    'CREATE CONSTRAINT post_id IF NOT EXISTS FOR (p:Post) REQUIRE p.id IS UNIQUE',
    'CREATE CONSTRAINT hashtag_name IF NOT EXISTS FOR (h:Hashtag) REQUIRE h.name IS UNIQUE',
    'CREATE CONSTRAINT comentario_id IF NOT EXISTS FOR (c:Comentario) REQUIRE c.id IS UNIQUE',
    'CREATE CONSTRAINT notificacion_id IF NOT EXISTS FOR (n:Notificacion) REQUIRE n.id IS UNIQUE',
    'CREATE CONSTRAINT sonido_id IF NOT EXISTS FOR (s:Sonido) REQUIRE s.id IS UNIQUE',
    'CREATE CONSTRAINT ubicacion_id IF NOT EXISTS FOR (u:Ubicacion) REQUIRE u.id IS UNIQUE',
  ];
  for (const c of constraints) await run(c);
  console.log('✅ Constraints creados');

  // ---- Ubicaciones ----
  const locations = [
    { id: randomUUID(), city: 'La Paz', country: 'Bolivia' },
    { id: randomUUID(), city: 'Cochabamba', country: 'Bolivia' },
    { id: randomUUID(), city: 'Santa Cruz de la Sierra', country: 'Bolivia' },
    { id: randomUUID(), city: 'Sucre', country: 'Bolivia' },
    { id: randomUUID(), city: 'Potosí', country: 'Bolivia' },
    { id: randomUUID(), city: 'Buenos Aires', country: 'Argentina' },
    { id: randomUUID(), city: 'Madrid', country: 'España' },
  ];
  for (const loc of locations) {
    await run('CREATE (:Ubicacion {id: $id, city: $city, country: $country})', loc);
  }
  console.log(`📍 ${locations.length} ubicaciones creadas`);

  // ---- Sonidos ----
  const sounds = [
    { id: randomUUID(), name: 'Original sound', artist: 'abdair' },
    { id: randomUUID(), name: 'Yellow', artist: 'Coldplay' },
    { id: randomUUID(), name: 'Music Sessions Vol. 53', artist: 'Bizarrap & Shakira' },
    { id: randomUUID(), name: 'Cruel Summer', artist: 'Taylor Swift' },
    { id: randomUUID(), name: 'Tití Me Preguntó', artist: 'Bad Bunny' },
    { id: randomUUID(), name: 'Get Lucky', artist: 'Daft Punk' },
    { id: randomUUID(), name: 'Blinding Lights', artist: 'The Weeknd' },
    { id: randomUUID(), name: 'One Dance', artist: 'Drake' },
    { id: randomUUID(), name: 'Trending viral sound', artist: 'NeoSocial' },
  ];
  for (const s of sounds) {
    await run('CREATE (:Sonido {id: $id, name: $name, artist: $artist})', s);
  }
  console.log(`🎵 ${sounds.length} sonidos creados`);

  // ---- Usuarios ----
  const password = await bcrypt.hash('password123', 10);
  const users = [
    { id: randomUUID(), username: 'abdair', email: 'abdair@demo.com', bio: 'Full stack dev 🚀 | Bolivia', city: 'La Paz' },
    { id: randomUUID(), username: 'maria_potosi', email: 'maria@demo.com', bio: 'Diseñadora UX/UI | Potosí 🇧🇴', city: 'Potosí' },
    { id: randomUUID(), username: 'dev_carlos', email: 'carlos@demo.com', bio: 'Backend engineer | Neo4j fan', city: 'Cochabamba' },
    { id: randomUUID(), username: 'lucia_tech', email: 'lucia@demo.com', bio: 'React developer | Open source', city: 'Santa Cruz de la Sierra' },
    { id: randomUUID(), username: 'neo4j_demo', email: 'demo@demo.com', bio: 'Cuenta demo de NeoSocial 📊', city: 'Sucre' },
  ];

  for (const u of users) {
    const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(u.username)}`;
    await run(
      `CREATE (:Usuario {id: $id, username: $username, email: $email, password: $password,
                        bio: $bio, avatarUrl: $avatarUrl, createdAt: datetime()})`,
      { ...u, password, avatarUrl }
    );
    if (u.city) {
      await run(
        `MATCH (usr:Usuario {id: $userId}), (loc:Ubicacion {city: $city})
         MERGE (usr)-[:VIVE_EN]->(loc)`,
        { userId: u.id, city: u.city }
      );
    }
  }
  console.log(`👥 ${users.length} usuarios creados (con VIVE_EN)`);

  // ---- Posts ----
  const posts = [
    { author: 'abdair', content: 'Implementando NeoSocial con #Neo4j y #React — las bases de grafos son una locura 🔥', soundIdx: 0, locCity: 'La Paz' },
    { author: 'abdair', content: 'Día 2 del proyecto: el feed trae posts con una sola query Cypher 🤯 #grafos #backend', soundIdx: 6, locCity: null },
    { author: 'maria_potosi', content: 'Diseñando la UI de #NeoSocial. Inspiración en TikTok pero con identidad propia 🎨 #uxdesign', soundIdx: 3, locCity: 'Potosí' },
    { author: 'dev_carlos', content: 'El modelo en grafos facilita las queries de recomendaciones. MATCH patterns son elegantes. #Neo4j', soundIdx: 5, locCity: 'Cochabamba' },
    { author: 'lucia_tech', content: 'Conectando React con la API de #NeoSocial. AuthContext listo ✅ #React #frontend', soundIdx: 7, locCity: 'Santa Cruz de la Sierra' },
    { author: 'neo4j_demo', content: 'Bienvenidos a NeoSocial — la primera red social boliviana basada en grafos 🇧🇴 #NeoSocial #Bolivia', soundIdx: 8, locCity: 'Sucre' },
    { author: 'dev_carlos', content: 'Pro tip: siempre cerrá la sesión de neo4j-driver en finally. Los leaks son silenciosos 🐛 #Neo4j', soundIdx: null, locCity: null },
    { author: 'maria_potosi', content: 'El tema oscuro quedó increíble. Fondo #0a0a0a, acento rojo, tipografía limpia. #UI', soundIdx: 1, locCity: null },
  ];

  const postIds = {};
  for (const p of posts) {
    const postId = randomUUID();
    if (!postIds[p.author]) postIds[p.author] = [];
    postIds[p.author].push(postId);

    await run(
      `MATCH (u:Usuario {username: $author})
       CREATE (u)-[:PUBLICO]->(p:Post {id: $id, content: $content, imageUrl: null, createdAt: datetime()})`,
      { author: p.author, id: postId, content: p.content }
    );

    const tags = [...p.content.matchAll(/#(\w+)/g)].map((m) => m[1].toLowerCase());
    for (const tag of tags) {
      await run(
        `MATCH (p:Post {id: $postId})
         MERGE (h:Hashtag {name: $tag})
         MERGE (p)-[:TIENE_HASHTAG]->(h)`,
        { postId, tag }
      );
    }

    if (p.soundIdx !== null) {
      await run(
        `MATCH (p:Post {id: $postId}), (s:Sonido {id: $soundId})
         MERGE (p)-[:USA_SONIDO]->(s)`,
        { postId, soundId: sounds[p.soundIdx].id }
      );
    }

    if (p.locCity) {
      await run(
        `MATCH (p:Post {id: $postId}), (loc:Ubicacion {city: $city})
         MERGE (p)-[:ETIQUETADO_EN]->(loc)`,
        { postId, city: p.locCity }
      );
    }
  }
  console.log(`📝 ${posts.length} posts creados (con USA_SONIDO y ETIQUETADO_EN)`);

  // ---- Follows ----
  const follows = [
    ['abdair', 'maria_potosi'], ['abdair', 'dev_carlos'], ['abdair', 'neo4j_demo'],
    ['maria_potosi', 'abdair'], ['maria_potosi', 'lucia_tech'],
    ['dev_carlos', 'abdair'], ['dev_carlos', 'neo4j_demo'],
    ['lucia_tech', 'abdair'], ['lucia_tech', 'dev_carlos'],
    ['neo4j_demo', 'abdair'],
  ];
  for (const [from, to] of follows) {
    await run(
      `MATCH (a:Usuario {username: $from}), (b:Usuario {username: $to})
       MERGE (a)-[r:SIGUIO]->(b)
       ON CREATE SET r.createdAt = datetime()`,
      { from, to }
    );
  }
  console.log(`🤝 ${follows.length} follows (SIGUIO) creados`);

  // ---- Likes ----
  const likes = [
    ['maria_potosi', 'abdair', 0], ['dev_carlos', 'abdair', 0], ['lucia_tech', 'abdair', 1],
    ['neo4j_demo', 'dev_carlos', 0], ['abdair', 'maria_potosi', 0], ['abdair', 'neo4j_demo', 0],
  ];
  for (const [liker, postAuthor, postIdx] of likes) {
    const postId = postIds[postAuthor]?.[postIdx];
    if (!postId) continue;
    await run(
      `MATCH (u:Usuario {username: $liker}), (p:Post {id: $postId})
       MERGE (u)-[:LE_GUSTO]->(p)`,
      { liker, postId }
    );
  }
  console.log(`❤️  ${likes.length} likes (LE_GUSTO) creados`);

  // ---- Comentarios como nodos ----
  const idOf = async (username) =>
    (await run('MATCH (u:Usuario {username: $u}) RETURN u.id as id', { u: username }))
      .records[0].get('id');

  const carlosId = await idOf('dev_carlos');
  const luciaId = await idOf('lucia_tech');
  const abdairId = await idOf('abdair');
  const mariaId = await idOf('maria_potosi');

  const c1Id = randomUUID();
  const c2Id = randomUUID();
  const c3Id = randomUUID();

  await run(
    `MATCH (u:Usuario {id: $userId}), (p:Post {id: $postId})
     CREATE (u)-[:ESCRIBIO]->(c:Comentario {
       id: $cid, text: 'Muy buen punto! Las queries Cypher son super legibles.',
       createdAt: datetime()
     })-[:EN]->(p)`,
    { userId: carlosId, postId: postIds['abdair'][0], cid: c1Id }
  );
  await run(
    `MATCH (u:Usuario {id: $userId}), (p:Post {id: $postId})
     CREATE (u)-[:ESCRIBIO]->(c:Comentario {
       id: $cid, text: 'Genial! Cuánto tiempo les tomó conectar el driver con Express?',
       createdAt: datetime()
     })-[:EN]->(p)`,
    { userId: luciaId, postId: postIds['abdair'][0], cid: c2Id }
  );
  // Respuesta (RESPONDE_A)
  await run(
    `MATCH (u:Usuario {id: $userId}), (p:Post {id: $postId}), (parent:Comentario {id: $parentId})
     CREATE (u)-[:ESCRIBIO]->(c:Comentario {
       id: $cid, text: 'Como 20 minutos, super directo.', createdAt: datetime()
     })-[:EN]->(p)
     CREATE (c)-[:RESPONDE_A]->(parent)`,
    { userId: abdairId, postId: postIds['abdair'][0], parentId: c2Id, cid: c3Id }
  );
  console.log('💬 3 comentarios (Comentario + RESPONDE_A) creados');

  // ---- Notificaciones de muestra ----
  await run(
    `MATCH (owner:Usuario {id: $ownerId}), (actor:Usuario {id: $actorId}), (p:Post {id: $postId})
     CREATE (owner)<-[:RECIBIO]-(n:Notificacion {
       id: $nid, type: 'like', read: false, createdAt: datetime(),
       actorId: $actorId, postId: $postId
     })
     CREATE (n)-[:SOBRE]->(p)`,
    { ownerId: abdairId, actorId: mariaId, postId: postIds['abdair'][0], nid: randomUUID() }
  );
  await run(
    `MATCH (owner:Usuario {id: $ownerId}), (actor:Usuario {id: $actorId}), (p:Post {id: $postId})
     CREATE (owner)<-[:RECIBIO]-(n:Notificacion {
       id: $nid, type: 'comment', read: false, createdAt: datetime(),
       actorId: $actorId, postId: $postId, commentId: $cid
     })
     CREATE (n)-[:SOBRE]->(p)`,
    { ownerId: abdairId, actorId: carlosId, postId: postIds['abdair'][0], cid: c1Id, nid: randomUUID() }
  );
  await run(
    `MATCH (target:Usuario {id: $targetId}), (actor:Usuario {id: $actorId})
     CREATE (target)<-[:RECIBIO]-(n:Notificacion {
       id: $nid, type: 'follow', read: false, createdAt: datetime(),
       actorId: $actorId, targetId: $targetId
     })
     CREATE (n)-[:SOBRE]->(actor)`,
    { targetId: abdairId, actorId: mariaId, nid: randomUUID() }
  );
  console.log('🔔 3 notificaciones de prueba creadas');

  console.log('\n✅ Seed completado!');
  console.log('📧 Login de prueba: abdair@demo.com / password123');
  console.log('⚠️  Si tenías constraints viejos (user_id, post_id de label User), deletealos manualmente en Neo4j Browser.');
  await driver.close();
}

seed().catch((err) => {
  console.error(err);
  driver.close();
  process.exit(1);
});
