---
name: titi-dual-db
description: Cuándo usar Neo4j vs PostgreSQL en Titi y cómo sincronizar los dos. Úsalo cuando estés diseñando un nuevo modelo, agregando una operación que toca a usuarios, o decidiendo en qué DB vive algo nuevo. Disparadores - "dónde guardo X", "Neo4j o Postgres", "sincronizar", "inscripción", "espejo de usuario", "neoId", o cualquier feature que pueda querer relacionar datos sociales con educativos.
---

# Dual DB — Neo4j + PostgreSQL en Titi

## Reglas de decisión

### Va a Neo4j si:
- Es un **grafo social**: usuarios, follows, likes, saves, comentarios sociales, hashtags, sonidos, ubicaciones, notificaciones.
- La consulta natural es de **caminos** ("amigos de amigos", "qué cursan los que sigo").
- Es una **interacción social efímera** (like, save, comentar post).

### Va a PostgreSQL si:
- Es **datos estructurados** con relaciones tabulares: cursos, módulos, lecciones, materiales, evaluaciones, preguntas, inscripciones, progreso, certificados, logros.
- Requiere **integridad fuerte**: unique constraints, foreign keys, transacciones.
- Es **rol/permisos**: `Usuario.rol`, `Usuario.verificado`, racha.
- Es algo que va a tener **muchas consultas tabulares** (filtros, ordenamiento, conteos).

### Va a **ambas** si:
- Aparece en queries sociales **Y** tiene estructura tabular. Ejemplo: **inscripción** vive en Postgres (fuente de verdad), pero se replica a Neo4j para "qué cursan mis amigos".

## Modelo del usuario

| Atributo | Neo4j | Postgres |
|---|---|---|
| `id` | ✅ canónico | ❌ |
| `neoId` (referencia al de Neo4j) | ❌ | ✅ |
| `username`, `email`, `password` | ✅ canónico | ✅ espejo |
| `bio`, `avatarUrl` | ✅ canónico | ❌ |
| `rol`, `verificado`, `racha`, `ultimaActividad` | ❌ | ✅ canónico |
| Relaciones sociales | ✅ | ❌ |
| Relaciones educativas | ❌ | ✅ |

**El JWT lleva el `id` de Neo4j.** Para acceder al `Usuario` de Postgres, traducir vía `Usuario.neoId`.

## El helper estándar

Todo route Postgres autenticado:

```js
async function loadCurrentUser(req, res) {
  if (req.dbUser) return req.dbUser;
  const usuario = await prisma.usuario.findUnique({ where: { neoId: req.user.id } });
  if (!usuario) {
    res.status(401).json({ success: false, message: 'Usuario no encontrado' });
    return null;
  }
  req.dbUser = usuario;
  return usuario;
}
```

Después usá `req.dbUser.id` (id Postgres) en tus queries Prisma. **NUNCA `req.user.id`** — ese es el id de Neo4j.

## Patrón de sincronización

### Caso 1: crear algo Neo4j-first (ej. registro)

`routes/auth.js`:

```js
// 1. Crear en Neo4j (fuente de verdad para identidad social)
const records = await runQuery(
  `CREATE (u:Usuario { id: $id, username: $username, email: $email, password: $password,
                      bio: '', avatarUrl: $avatarUrl, createdAt: datetime() }) RETURN u`,
  { id, username, email, password: hash, avatarUrl }
);

// 2. Replicar el espejo a Postgres — si falla, NO bloquear el registro
try {
  await prisma.usuario.create({
    data: { neoId: id, username, email },
  });
} catch (pgErr) {
  console.error('register: error replicando usuario en PostgreSQL', pgErr);
}
```

### Caso 2: crear algo Postgres-first con propagación social (ej. inscripción — Etapa 4)

```js
// 1. Postgres = fuente de verdad
const inscripcion = await prisma.inscripcion.create({ data: { usuarioId, cursoId } });

// 2. Propagar a Neo4j para recomendaciones — async-fire-and-forget
try {
  await runQuery(
    `MATCH (u:Usuario {id: $neoId})
     MERGE (u)-[r:INSCRITO_EN {cursoId: $cursoId}]->(c:CursoRef {cursoId: $cursoId})
     ON CREATE SET r.fechaInscripcion = datetime()`,
    { neoId: req.user.id, cursoId }
  );
} catch (err) {
  console.error('Neo4j sync inscripción falló', err);
  // No rompemos la respuesta — la próxima vez se reintenta o se reconcilia
}

// 3. Crear notificación a seguidores
await runQuery(
  `MATCH (u:Usuario {id: $neoId})<-[:SIGUIO]-(follower:Usuario)
   CREATE (follower)-[:RECIBIO]->(:Notificacion {
     id: $notifId, type: 'inscripcion_amigo', actorId: $neoId, cursoId: $cursoId,
     read: false, createdAt: datetime()
   })`,
  { neoId: req.user.id, notifId: randomUUID(), cursoId }
);

res.status(201).json({ success: true, data: { inscripcion } });
```

## Recomendaciones (Etapa 4)

```cypher
// Cursos que toman mis amigos y yo no
MATCH (yo:Usuario {id: $userId})-[:SIGUIO]->(amigo:Usuario)-[:INSCRITO_EN]->(curso:CursoRef)
WHERE NOT (yo)-[:INSCRITO_EN]->(curso)
RETURN curso.cursoId as cursoId, count(amigo) as amigosInscritos
ORDER BY amigosInscritos DESC
LIMIT 5
```

Después del query, hidratar los datos del curso con Prisma:

```js
const cursoIds = records.map(r => r.get('cursoId'));
const cursos = await prisma.curso.findMany({
  where: { id: { in: cursoIds }, publicado: true },
  include: { categoria: true },
});
```

## Eventos que deben propagar Neo4j → Postgres o viceversa

| Evento | Fuente | Destino | Cuándo |
|---|---|---|---|
| Registro | Neo4j | Postgres (espejo) | En `POST /api/auth/register` |
| Login | Postgres lee (rol, racha) | — | En `POST /api/auth/login`, fusiona y firma JWT |
| Cambio de rol | Postgres | — | No propagar a Neo4j |
| Inscripción | Postgres | Neo4j `:INSCRITO_EN` | Etapa 4 |
| Lección completada | Postgres | — | No propagar |
| Curso completado | Postgres | Neo4j `:COMPLETO_CURSO` | Etapa 4 |
| Logro desbloqueado | Postgres | Neo4j Notificación | Etapa 4 (para notificar amigos) |
| Follow / unfollow | Neo4j | — | No propagar |
| Post / like / save / comentario | Neo4j | — | No propagar |

## Cómo decidir cuando algo es ambiguo

Preguntás dos cosas:

1. **¿Lo va a leer alguna query social?** ("Mis amigos que…", "Quién sigue a…", "Posts con hashtag…")
   - Sí → Neo4j tiene que tener al menos una representación.
2. **¿Tiene estructura tabular fuerte o relaciones FK?** (tabla con muchas columnas, JOINs, índices únicos)
   - Sí → Postgres es fuente de verdad.

Si ambos son sí: Postgres es fuente de verdad y Neo4j tiene un nodo/relación minimalista (solo `cursoId` o el campo necesario para el query social).

## Antipatrones

- ❌ Guardar `Curso` en Neo4j como nodo completo. Solo cabe un `:CursoRef {cursoId}` para recomendaciones.
- ❌ Guardar `Post` en Postgres. Es 100% social.
- ❌ Usar `req.user.id` como `usuarioId` en Prisma. Ese id es de Neo4j.
- ❌ Bloquear una respuesta al usuario porque falló la replicación cross-DB. Loguear y seguir.
- ❌ Tener `Usuario.username` solo en Postgres. Debe estar en Neo4j también (es la identidad principal).
- ❌ Hacer una transaction que abarca las dos DBs. No existe esa primitiva — usamos compensación manual.

## Constraints que ya están aplicadas

**Neo4j** (en `db.js` `initConstraints`):
- `Usuario.id`, `Usuario.username`, `Usuario.email` únicos.
- `Post.id`, `Comentario.id`, `Notificacion.id`, `Sonido.id`, `Ubicacion.id` únicos.
- `Hashtag.name` único.

**Postgres** (en `schema.prisma`):
- `Usuario.neoId`, `Usuario.username`, `Usuario.email` únicos.
- `Inscripcion (usuarioId, cursoId)` único.
- `Progreso (usuarioId, leccionId)` único.
- `LogroUsuario (usuarioId, logroId)` PK compuesta.

## Skills hermanas

- `titi-orientation` — mapa general del repo.
- `titi-backend-patterns` — cómo escribir el código que toca estas DBs.
- `titi-frontend-patterns` — cómo se consume desde la UI.
