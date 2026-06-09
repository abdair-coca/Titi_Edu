---
name: titi-backend-patterns
description: Patrones obligatorios para agregar o modificar código backend en Titi (rutas Express, auth, Prisma, Cypher, multer). Úsalo antes de crear un endpoint nuevo o modificar uno existente. Disparadores - "agregar endpoint", "nueva ruta", "POST /api/...", "subir archivo", "query Neo4j", "query Prisma", o cuando estés por escribir código dentro de backend/src/routes/.
---

# Patrones backend — Titi

## 1. Estructura de un archivo de ruta

Todo `routes/*.js` sigue este esqueleto:

```js
import { Router } from 'express';
import prisma from '../prisma.js';                // si toca Postgres
import { runQuery } from '../db.js';              // si toca Neo4j
import { requireAuth, optionalAuth } from '../middleware/auth.js';

const router = Router();

// (helpers locales: loadCurrentUser, requireRole, serializeX, etc.)

// ---- Handlers ----
router.get('/', async (req, res) => { ... });

export default router;
```

Y se monta en `src/index.js`:
```js
import xxxRoutes from './routes/xxx.js';
app.use('/api/xxx', xxxRoutes);
```

## 2. Auth

| Middleware | Cuándo |
|---|---|
| `requireAuth` | Rutas que exigen JWT válido. Pone `req.user` |
| `optionalAuth` | Rutas públicas que enriquecen si hay JWT (ej. `likedByMe`). `req.user` puede ser `undefined` |

`req.user` contiene `{ id, username, email, rol }` desde el JWT. **El `id` es de Neo4j.**

Para Postgres, traduce con el helper estándar:

```js
async function loadCurrentUser(req, res) {
  if (req.dbUser) return req.dbUser;
  const usuario = await prisma.usuario.findUnique({ where: { neoId: req.user.id } });
  if (!usuario) { res.status(401).json({ success: false, message: 'Usuario no encontrado' }); return null; }
  req.dbUser = usuario;
  return usuario;
}
```

Y para roles:

```js
function requireRole(...roles) {
  return async (req, res, next) => {
    const usuario = await loadCurrentUser(req, res);
    if (!usuario) return;
    if (!roles.includes(usuario.rol)) {
      return res.status(403).json({ success: false, message: 'No tienes permiso para esta acción' });
    }
    next();
  };
}
```

Uso: `router.post('/', requireAuth, requireRole('PROFESOR'), handler)`.

## 3. Respuestas estándar

```js
// Éxito (200 o 201)
res.json({ success: true, data: { ... } });
res.status(201).json({ success: true, data: { ... } });

// Error
res.status(400).json({ success: false, message: 'Validación: titulo requerido' });
res.status(401).json({ success: false, message: 'No autorizado' });
res.status(403).json({ success: false, message: 'No puedes editar posts ajenos' });
res.status(404).json({ success: false, message: 'Curso no encontrado' });
res.status(409).json({ success: false, message: 'Ya estás inscrito en este curso' });
res.status(500).json({ success: false, message: 'Error obteniendo X' });
```

**Mensajes legibles en español.** No expongas detalles internos del error en el `message`.

## 4. Manejo de errores

Patrón obligatorio:

```js
router.get('/', async (req, res) => {
  try {
    // ...
  } catch (err) {
    console.error('GET /endpoint error', err);
    res.status(500).json({ success: false, message: 'Error haciendo X' });
  }
});
```

Para errores Prisma conocidos:
- `err.code === 'P2002'` → constraint único violado → responde 409.
- `err.code === 'P2025'` → record not found en update/delete → responde 404.
- `err.code === 'P2003'` → FK no encontrada → responde 400 con mensaje específico.

## 5. Validación de input

Al inicio del handler, antes de tocar la DB:

```js
const { titulo, nivel, categoriaId } = req.body || {};
if (!titulo || !nivel || !categoriaId) {
  return res.status(400).json({ success: false, message: 'titulo, nivel y categoriaId son requeridos' });
}
const ordenNum = Number(orden);
if (!Number.isInteger(ordenNum)) {
  return res.status(400).json({ success: false, message: 'orden debe ser un número entero' });
}
```

Sanitizar strings: `String(x).trim()`.

## 6. Cypher (Neo4j)

**Patrón de query con métricas + flags personales:**

Ver `POST_QUERY_TAIL` en `routes/posts.js`. La idea:

```cypher
MATCH (u:Usuario)-[:PUBLICO]->(p:Post)
OPTIONAL MATCH (p)<-[:LE_GUSTO]-(liker:Usuario)
OPTIONAL MATCH (c:Comentario)-[:EN]->(p)
WITH p, u, count(DISTINCT liker) as likes, count(DISTINCT c) as comments
// "Flags" del usuario actual con nodo ANÓNIMO para evitar conflicto de variable
OPTIONAL MATCH (p)<-[myLike:LE_GUSTO]-(:Usuario {id: $userId})
OPTIONAL MATCH (p)<-[mySaved:GUARDO]-(:Usuario {id: $userId})
RETURN p, u.username as author, likes, comments,
       myLike IS NOT NULL as likedByMe,
       mySaved IS NOT NULL as savedByMe
ORDER BY p.createdAt DESC
LIMIT 50
```

**Reglas clave:**
- En OPTIONAL MATCHes para flags del usuario actual, usá **nodo anónimo `(:Usuario {id: $userId})`** — nunca reuses una variable `me` entre dos OPTIONAL MATCHes (causa bug silencioso).
- `IS NOT NULL` sobre la relación opcional → boolean limpio.
- Para ordenar por timestamp de relación (ej. cuándo guardó algo), pasalo en el `WITH`: `WITH p, u, s.savedAt as savedAt ...`
- Para crear con timestamp: `MERGE (u)-[r:GUARDO]->(p) ON CREATE SET r.savedAt = datetime() ON MATCH SET r.savedAt = coalesce(r.savedAt, datetime())`.

**IDs Neo4j:**
- Generar con `randomUUID()` en JS antes del query.
- Constraints en `db.js` `initConstraints` garantizan unicidad.

**Conversión de números:**
```js
import { toNumber } from '../db.js';
const likes = toNumber(record.get('likes'));  // maneja neo4j.Integer
```

## 7. Prisma (Postgres)

**Imports:**
```js
import prisma from '../prisma.js';   // SIEMPRE el singleton — no instanciar PrismaClient
```

**Patrones útiles:**

```js
// Detalle con relaciones anidadas
const curso = await prisma.curso.findUnique({
  where: { id: req.params.id },
  include: {
    categoria: true,
    creador: { select: { id: true, username: true } },
    modulos: {
      orderBy: { orden: 'asc' },
      include: { lecciones: { orderBy: { orden: 'asc' } } },
    },
    _count: { select: { inscripciones: true, modulos: true } },
  },
});

// Upsert (ideal para progreso, save, like)
await prisma.progreso.upsert({
  where: { usuarioId_leccionId: { usuarioId, leccionId } },
  update: { completada: true, fechaCompletado: new Date() },
  create: { usuarioId, leccionId, completada: true, fechaCompletado: new Date() },
});

// Filtro con OR
where: {
  OR: [
    { titulo: { contains: q, mode: 'insensitive' } },
    { descripcion: { contains: q, mode: 'insensitive' } },
  ],
}
```

**Cascadas:** Prisma no las hace automáticas. Si borrás un `Curso` que tiene módulos/lecciones, hacelo en transaction y borrá en orden correcto, o configurá `onDelete: Cascade` en el schema.

## 8. Subida de archivos (multer)

Patrón de `routes/posts.js`:

```js
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '..', 'uploads', 'materials');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /image\/|application\/pdf|application\/(msword|vnd.openxmlformats)/.test(file.mimetype);
    if (!ok) return cb(new Error('Tipo de archivo no permitido'));
    cb(null, true);
  },
});

router.post('/lessons/:lessonId/materials', requireAuth, requireRole('PROFESOR'), upload.single('file'), async (req, res) => {
  const url = `/uploads/materials/${req.file.filename}`;
  // ...
});
```

**Al borrar:** `fs.promises.unlink(filePath).catch(() => {})` ANTES de borrar el row.

## 9. Sincronización con Neo4j

Cuando una operación Postgres debe propagarse a Neo4j (ej. inscripción), patrón:

```js
// 1. Postgres = fuente de verdad
const inscripcion = await prisma.inscripcion.create({ data: { usuarioId, cursoId } });

// 2. Replicar a Neo4j para queries sociales — NO debe bloquear la respuesta
try {
  await runQuery(
    `MATCH (u:Usuario {id: $neoId})
     MERGE (u)-[r:INSCRITO_EN {cursoId: $cursoId}]->(virt:CursoRef {cursoId: $cursoId})
     ON CREATE SET r.fechaInscripcion = datetime()`,
    { neoId: req.user.id, cursoId }
  );
} catch (err) {
  console.error('No se pudo replicar inscripción a Neo4j:', err);
  // Seguimos — no se rompe la respuesta al usuario
}

res.status(201).json({ success: true, data: { inscripcion } });
```

## 10. Antipatrones a evitar

- ❌ Usar `req.user.id` directo en `prisma.xxx.findUnique({ where: { id: req.user.id } })` — ese id es de Neo4j.
- ❌ Crear una instancia nueva de `PrismaClient` en cada archivo. Usar el singleton de `prisma.js`.
- ❌ Reusar la variable `me` entre dos OPTIONAL MATCH en Cypher.
- ❌ Devolver el password hasheado en cualquier respuesta. Usar `serializeUser` que lo omita.
- ❌ Exponer mensajes de error crudos al cliente. Loguear con `console.error` y mandar mensaje legible.
- ❌ Mezclar inglés y español en mensajes de error de la misma ruta.
- ❌ Olvidar registrar la nueva ruta en `src/index.js` (síntoma: 404 en todo).

## Skills hermanas

- `titi-orientation` — mapa general del repo.
- `titi-frontend-patterns` — cómo consume la UI.
- `titi-dual-db` — cuándo Neo4j vs Postgres.
