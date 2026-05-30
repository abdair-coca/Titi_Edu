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

export async function initConstraints() {
  const constraints = [
    'CREATE CONSTRAINT user_id IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE',
    'CREATE CONSTRAINT user_username IF NOT EXISTS FOR (u:User) REQUIRE u.username IS UNIQUE',
    'CREATE CONSTRAINT user_email IF NOT EXISTS FOR (u:User) REQUIRE u.email IS UNIQUE',
    'CREATE CONSTRAINT post_id IF NOT EXISTS FOR (p:Post) REQUIRE p.id IS UNIQUE',
    'CREATE CONSTRAINT hashtag_name IF NOT EXISTS FOR (h:Hashtag) REQUIRE h.name IS UNIQUE',
  ];
  for (const c of constraints) await runQuery(c);
}

export async function closeDriver() {
  await driver.close();
}

export default driver;
