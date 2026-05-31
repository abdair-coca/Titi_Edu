import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { runQuery, toNumber } from '../db.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';

const router = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '..', 'uploads');
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
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /image\/(jpeg|jpg|png|gif|webp)/.test(file.mimetype);
    if (!ok) return cb(new Error('Solo se permiten imágenes (jpeg, png, gif, webp)'));
    cb(null, true);
  },
});

function extractHashtags(content) {
  return [...(content || '').matchAll(/#(\w+)/g)].map(m => m[1].toLowerCase());
}

function serializePost(record) {
  const p = record.get('p').properties;
  const hasNullable = (key) => record.has?.(key);
  const soundNode = hasNullable('sound') ? record.get('sound') : null;
  const locNode = hasNullable('location') ? record.get('location') : null;
  return {
    id: p.id,
    content: p.content,
    imageUrl: p.imageUrl,
    createdAt: p.createdAt?.toString?.() ?? p.createdAt,
    author: record.get('author'),
    authorAvatar: hasNullable('authorAvatar') ? record.get('authorAvatar') : null,
    hashtags: hasNullable('hashtags') ? record.get('hashtags') : [],
    likes: toNumber(record.get('likes')),
    comments: hasNullable('comments') ? toNumber(record.get('comments')) : 0,
    likedByMe: hasNullable('likedByMe') ? Boolean(record.get('likedByMe')) : false,
    sound: soundNode
      ? { id: soundNode.properties.id, name: soundNode.properties.name, artist: soundNode.properties.artist }
      : null,
    location: locNode
      ? { id: locNode.properties.id, city: locNode.properties.city, country: locNode.properties.country }
      : null,
  };
}

const POST_QUERY_TAIL = `
  OPTIONAL MATCH (p)<-[:LE_GUSTO]-(liker:Usuario)
  OPTIONAL MATCH (c:Comentario)-[:EN]->(p)
  OPTIONAL MATCH (p)-[:TIENE_HASHTAG]->(h:Hashtag)
  OPTIONAL MATCH (p)-[:USA_SONIDO]->(sound:Sonido)
  OPTIONAL MATCH (p)-[:ETIQUETADO_EN]->(location:Ubicacion)
  WITH p, u, sound, location,
       collect(DISTINCT h.name) as hashtags,
       count(DISTINCT liker) as likes,
       count(DISTINCT c) as comments
  OPTIONAL MATCH (p)<-[myLike:LE_GUSTO]-(me:Usuario {id: $userId})
  RETURN p,
         u.username as author,
         u.avatarUrl as authorAvatar,
         hashtags, likes, comments,
         myLike IS NOT NULL as likedByMe,
         sound, location
`;

// ---- Feed ----
router.get('/feed', requireAuth, async (req, res) => {
  try {
    const records = await runQuery(
      `MATCH (me:Usuario {id: $userId})-[:SIGUIO]->(u:Usuario)-[:PUBLICO]->(p:Post)
       ${POST_QUERY_TAIL}
       ORDER BY p.createdAt DESC
       LIMIT 50`,
      { userId: req.user.id }
    );
    res.json({ success: true, data: { posts: records.map(serializePost) } });
  } catch (err) {
    console.error('GET /feed error', err);
    res.status(500).json({ success: false, message: 'Error obteniendo feed' });
  }
});

// ---- Explore ----
router.get('/explore', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?.id ?? null;
    const records = await runQuery(
      `MATCH (u:Usuario)-[:PUBLICO]->(p:Post)
       ${POST_QUERY_TAIL}
       ORDER BY p.createdAt DESC
       LIMIT 50`,
      { userId }
    );
    res.json({ success: true, data: { posts: records.map(serializePost) } });
  } catch (err) {
    console.error('GET /explore error', err);
    res.status(500).json({ success: false, message: 'Error obteniendo explore' });
  }
});

// ---- Crear post ----
router.post('/', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const content = (req.body?.content ?? '').toString().trim();
    const soundId = (req.body?.soundId ?? '').toString().trim() || null;
    const locationId = (req.body?.locationId ?? '').toString().trim() || null;

    if (!content && !req.file) {
      return res.status(400).json({ success: false, message: 'El post debe tener contenido o imagen' });
    }

    const id = randomUUID();
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    await runQuery(
      `MATCH (u:Usuario {id: $userId})
       CREATE (u)-[:PUBLICO]->(p:Post {
         id: $id, content: $content, imageUrl: $imageUrl, createdAt: datetime()
       })`,
      { userId: req.user.id, id, content, imageUrl }
    );

    // Hashtags
    const hashtags = extractHashtags(content);
    for (const tag of hashtags) {
      await runQuery(
        `MATCH (p:Post {id: $postId})
         MERGE (h:Hashtag {name: $tag})
         MERGE (p)-[:TIENE_HASHTAG]->(h)`,
        { postId: id, tag }
      );
    }

    // Sonido
    if (soundId) {
      await runQuery(
        `MATCH (p:Post {id: $postId}), (s:Sonido {id: $soundId})
         MERGE (p)-[:USA_SONIDO]->(s)`,
        { postId: id, soundId }
      );
    }

    // Ubicación
    if (locationId) {
      await runQuery(
        `MATCH (p:Post {id: $postId}), (loc:Ubicacion {id: $locationId})
         MERGE (p)-[:ETIQUETADO_EN]->(loc)`,
        { postId: id, locationId }
      );
    }

    res.status(201).json({ success: true, data: { id, content, imageUrl, hashtags } });
  } catch (err) {
    console.error('POST /posts error', err);
    res.status(500).json({ success: false, message: 'Error creando post' });
  }
});

// ---- Post individual ----
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id ?? null;
    const records = await runQuery(
      `MATCH (u:Usuario)-[:PUBLICO]->(p:Post {id: $id})
       ${POST_QUERY_TAIL}`,
      { id, userId }
    );
    if (records.length === 0) {
      return res.status(404).json({ success: false, message: 'Post no encontrado' });
    }
    res.json({ success: true, data: { post: serializePost(records[0]) } });
  } catch (err) {
    console.error('GET /:id error', err);
    res.status(500).json({ success: false, message: 'Error obteniendo post' });
  }
});

// ---- Like toggle ----
router.post('/:id/like', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const exists = await runQuery(
      'MATCH (u:Usuario)-[:PUBLICO]->(p:Post {id: $id}) RETURN u.id as ownerId LIMIT 1',
      { id }
    );
    if (exists.length === 0) {
      return res.status(404).json({ success: false, message: 'Post no encontrado' });
    }
    const ownerId = exists[0].get('ownerId');

    const existing = await runQuery(
      'MATCH (u:Usuario {id: $userId})-[r:LE_GUSTO]->(p:Post {id: $id}) RETURN r LIMIT 1',
      { userId: req.user.id, id }
    );

    let liked;
    if (existing.length > 0) {
      await runQuery(
        'MATCH (u:Usuario {id: $userId})-[r:LE_GUSTO]->(p:Post {id: $id}) DELETE r',
        { userId: req.user.id, id }
      );
      liked = false;
    } else {
      await runQuery(
        `MATCH (u:Usuario {id: $userId}), (p:Post {id: $id})
         MERGE (u)-[:LE_GUSTO]->(p)`,
        { userId: req.user.id, id }
      );
      liked = true;

      // Notificación al owner (excepto si es self-like)
      if (ownerId && ownerId !== req.user.id) {
        const notifId = randomUUID();
        await runQuery(
          `MATCH (owner:Usuario {id: $ownerId}), (actor:Usuario {id: $actorId}), (p:Post {id: $postId})
           MERGE (owner)<-[:RECIBIO]-(n:Notificacion {
             type: 'like', actorId: $actorId, postId: $postId
           })
           ON CREATE SET n.id = $notifId, n.read = false, n.createdAt = datetime()
           ON MATCH SET n.read = false, n.createdAt = datetime()
           MERGE (n)-[:SOBRE]->(p)`,
          { ownerId, actorId: req.user.id, postId: id, notifId }
        );
      }
    }

    const countRecords = await runQuery(
      'MATCH (p:Post {id: $id})<-[r:LE_GUSTO]-(:Usuario) RETURN count(r) as likes',
      { id }
    );
    const likes = toNumber(countRecords[0].get('likes'));

    res.json({ success: true, data: { liked, likes } });
  } catch (err) {
    console.error('POST /like error', err);
    res.status(500).json({ success: false, message: 'Error al dar like' });
  }
});

// ---- Editar post ----
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const content = (req.body?.content ?? '').toString().trim();
    if (!content) {
      return res.status(400).json({ success: false, message: 'El contenido no puede estar vacío' });
    }

    const owner = await runQuery(
      'MATCH (u:Usuario)-[:PUBLICO]->(p:Post {id: $id}) RETURN u.id as ownerId',
      { id }
    );
    if (owner.length === 0) {
      return res.status(404).json({ success: false, message: 'Post no encontrado' });
    }
    if (owner[0].get('ownerId') !== req.user.id) {
      return res.status(403).json({ success: false, message: 'No puedes editar posts ajenos' });
    }

    await runQuery(
      `MATCH (p:Post {id: $id})
       SET p.content = $content
       WITH p
       OPTIONAL MATCH (p)-[r:TIENE_HASHTAG]->()
       DELETE r`,
      { id, content }
    );

    const hashtags = extractHashtags(content);
    for (const tag of hashtags) {
      await runQuery(
        `MATCH (p:Post {id: $postId})
         MERGE (h:Hashtag {name: $tag})
         MERGE (p)-[:TIENE_HASHTAG]->(h)`,
        { postId: id, tag }
      );
    }

    const records = await runQuery(
      `MATCH (u:Usuario)-[:PUBLICO]->(p:Post {id: $id})
       ${POST_QUERY_TAIL}`,
      { id, userId: req.user.id }
    );

    res.json({ success: true, data: { post: serializePost(records[0]) } });
  } catch (err) {
    console.error('PUT /:id error', err);
    res.status(500).json({ success: false, message: 'Error editando post' });
  }
});

// ---- Eliminar post ----
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const records = await runQuery(
      'MATCH (u:Usuario)-[:PUBLICO]->(p:Post {id: $id}) RETURN u.id as ownerId, p.imageUrl as imageUrl',
      { id }
    );
    if (records.length === 0) {
      return res.status(404).json({ success: false, message: 'Post no encontrado' });
    }
    if (records[0].get('ownerId') !== req.user.id) {
      return res.status(403).json({ success: false, message: 'No puedes eliminar posts ajenos' });
    }

    // Borra el post + sus Comentario nodes asociados + notificaciones SOBRE este post
    await runQuery(
      `MATCH (p:Post {id: $id})
       OPTIONAL MATCH (c:Comentario)-[:EN]->(p)
       OPTIONAL MATCH (n:Notificacion)-[:SOBRE]->(p)
       DETACH DELETE c, n, p`,
      { id }
    );

    const imageUrl = records[0].get('imageUrl');
    if (imageUrl && imageUrl.startsWith('/uploads/')) {
      const filePath = path.join(uploadsDir, path.basename(imageUrl));
      fs.promises.unlink(filePath).catch(() => {});
    }

    res.json({ success: true, data: { deleted: id } });
  } catch (err) {
    console.error('DELETE /:id error', err);
    res.status(500).json({ success: false, message: 'Error eliminando post' });
  }
});

export default router;
