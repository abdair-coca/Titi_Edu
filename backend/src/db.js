import neo4j from 'neo4j-driver';

const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
);

export async function runQuery(cypher, params = {}) {
  const session = driver.session();
  try {
    const result = await session.run(cypher, params);
    return result.records;
  } finally {
    await session.close();
  }
}

export function toNumber(val) {
  if (val == null) return 0;
  if (typeof val === 'number') return val;
  if (neo4j.isInt(val)) return val.toNumber();
  if (typeof val === 'object' && 'low' in val) return neo4j.integer.toNumber(val);
  return Number(val);
}

/**
 * Modelo de datos NeoSocial — todos los nombres en español.
 * Nodos: Usuario, Post, Hashtag, Comentario, Notificacion, Sonido, Ubicacion
 * Relaciones: SIGUIO, PUBLICO, LE_GUSTO, ESCRIBIO, EN, RESPONDE_A,
 *             RECIBIO, SOBRE, USA_SONIDO, TIENE_HASHTAG, VIVE_EN, ETIQUETADO_EN
 */
export async function initConstraints() {
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
  for (const c of constraints) await runQuery(c);
}

export async function closeDriver() {
  await driver.close();
}

export default driver;
