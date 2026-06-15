import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { runQuery, toNumber } from '../db.js';
import prisma from '../prisma.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { cloudinaryEnabled, uploadBuffer, destroyAsset } from '../services/upload.service.js';

const router = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// memoryStorage: el buffer va a Cloudinary; si no hay credenciales cae a disco.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /image\/(jpeg|jpg|png|gif|webp)/.test(file.mimetype);
    if (!ok) return cb(new Error('Solo se permiten imágenes (jpeg, png, gif, webp)'));
    cb(null, true);
  },
});

// Sube la imagen del post: Cloudinary si hay credenciales, disco si no.
// Devuelve { imageUrl, imagePublicId } (publicId null en modo disco).
async function storePostImage(file) {
  if (cloudinaryEnabled) {
    const { url, publicId } = await uploadBuffer(file.buffer, 'titi/posts', 'image');
    return { imageUrl: url, imagePublicId: publicId };
  }
  const ext = path.extname(file.originalname).toLowerCase();
  const filename = `${randomUUID()}${ext}`;
  await fs.promises.writeFile(path.join(uploadsDir, filename), file.buffer);
  return { imageUrl: `/uploads/${filename}`, imagePublicId: null };
}

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
    savedByMe: hasNullable('savedByMe') ? Boolean(record.get('savedByMe')) : false,
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
  OPTIONAL MATCH (p)<-[myLike:LE_GUSTO]-(:Usuario {id: $userId})
  OPTIONAL MATCH (p)<-[mySaved:GUARDO]-(:Usuario {id: $userId})
  RETURN p,
         u.username as author,
         u.avatarUrl as authorAvatar,
         hashtags, likes, comments,
         myLike IS NOT NULL as likedByMe,
         mySaved IS NOT NULL as savedByMe,
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

// ---- Feed académico — actividad de cursos/logros de gente que sigo ----
router.get('/feed/academic', requireAuth, async (req, res) => {
  try {
    // Para 'logro' se matchea vía RECIBIO (mi notificación), no vía SOBRE+SIGUIO:
    // las notificaciones se crean una por seguidor, así que SOBRE duplicaría.
    const records = await runQuery(
      `MATCH (me:Usuario {id: $userId})-[:SIGUIO]->(amigo:Usuario)-[r:INSCRITO_EN]->(ref:CursoRef)
       RETURN amigo.username AS actorUsername, amigo.avatarUrl AS actorAvatarUrl,
              'inscripcion' AS type, ref.cursoId AS cursoId, null AS logroNombre,
              r.fechaInscripcion AS createdAt
       UNION
       MATCH (me:Usuario {id: $userId})-[:SIGUIO]->(amigo:Usuario)-[r:COMPLETO_CURSO]->(ref:CursoRef)
       RETURN amigo.username AS actorUsername, amigo.avatarUrl AS actorAvatarUrl,
              'curso_completado' AS type, ref.cursoId AS cursoId, null AS logroNombre,
              r.fechaCompletado AS createdAt
       UNION
       MATCH (me:Usuario {id: $userId})<-[:RECIBIO]-(n:Notificacion {type: 'logro'})-[:SOBRE]->(amigo:Usuario)
       RETURN amigo.username AS actorUsername, amigo.avatarUrl AS actorAvatarUrl,
              'logro' AS type, null AS cursoId, n.logroNombre AS logroNombre,
              n.createdAt AS createdAt`,
      { userId: req.user.id }
    );

    let activity = records.map((r) => ({
      actorUsername: r.get('actorUsername'),
      actorAvatarUrl: r.get('actorAvatarUrl'),
      type: r.get('type'),
      cursoId: r.get('cursoId'),
      logroNombre: r.get('logroNombre'),
      createdAt: r.get('createdAt')?.toString?.() ?? r.get('createdAt'),
    }));

    // Hidratar los cursos referenciados desde Postgres
    const cursoIds = [...new Set(activity.filter((a) => a.cursoId).map((a) => a.cursoId))];
    if (cursoIds.length > 0) {
      const cursos = await prisma.curso.findMany({
        where: { id: { in: cursoIds } },
        select: { id: true, titulo: true, categoria: { select: { nombre: true, icono: true } } },
      });
      const byId = new Map(cursos.map((c) => [c.id, c]));
      activity = activity.map((a) =>
        a.cursoId && byId.has(a.cursoId)
          ? { ...a, curso: { id: a.cursoId, titulo: byId.get(a.cursoId).titulo, categoria: byId.get(a.cursoId).categoria } }
          : a
      );
    }

    // Ordenar por fecha DESC y limitar (sin paginación pesada — Etapa 5)
    activity.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    activity = activity.slice(0, 50);

    res.json({ success: true, data: { activity } });
  } catch (err) {
    console.error('GET /feed/academic error', err);
    res.status(500).json({ success: false, message: 'Error obteniendo feed académico' });
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

// ---- Posts guardados por mí (orden: cuándo los guardé) ----
router.get('/me/saved', requireAuth, async (req, res) => {
  try {
    const records = await runQuery(
      `MATCH (:Usuario {id: $userId})-[s:GUARDO]->(p:Post)<-[:PUBLICO]-(u:Usuario)
       WITH p, u, s.savedAt as savedAt
       OPTIONAL MATCH (p)<-[:LE_GUSTO]-(liker:Usuario)
       OPTIONAL MATCH (c:Comentario)-[:EN]->(p)
       OPTIONAL MATCH (p)-[:TIENE_HASHTAG]->(h:Hashtag)
       OPTIONAL MATCH (p)-[:USA_SONIDO]->(sound:Sonido)
       OPTIONAL MATCH (p)-[:ETIQUETADO_EN]->(location:Ubicacion)
       WITH p, u, sound, location, savedAt,
            collect(DISTINCT h.name) as hashtags,
            count(DISTINCT liker) as likes,
            count(DISTINCT c) as comments
       OPTIONAL MATCH (p)<-[myLike:LE_GUSTO]-(:Usuario {id: $userId})
       OPTIONAL MATCH (p)<-[mySaved:GUARDO]-(:Usuario {id: $userId})
       RETURN p,
              u.username as author,
              u.avatarUrl as authorAvatar,
              hashtags, likes, comments,
              myLike IS NOT NULL as likedByMe,
              mySaved IS NOT NULL as savedByMe,
              sound, location
       ORDER BY savedAt DESC, p.createdAt DESC
       LIMIT 50`,
      { userId: req.user.id }
    );
    res.json({ success: true, data: { posts: records.map(serializePost) } });
  } catch (err) {
    console.error('GET /me/saved error', err);
    res.status(500).json({ success: false, message: 'Error obteniendo posts guardados' });
  }
});

// ---- Posts a los que di like (orden: cuándo di like) ----
router.get('/me/liked', requireAuth, async (req, res) => {
  try {
    const records = await runQuery(
      `MATCH (:Usuario {id: $userId})-[l:LE_GUSTO]->(p:Post)<-[:PUBLICO]-(u:Usuario)
       WITH p, u, l.likedAt as likedAt
       OPTIONAL MATCH (p)<-[:LE_GUSTO]-(liker:Usuario)
       OPTIONAL MATCH (c:Comentario)-[:EN]->(p)
       OPTIONAL MATCH (p)-[:TIENE_HASHTAG]->(h:Hashtag)
       OPTIONAL MATCH (p)-[:USA_SONIDO]->(sound:Sonido)
       OPTIONAL MATCH (p)-[:ETIQUETADO_EN]->(location:Ubicacion)
       WITH p, u, sound, location, likedAt,
            collect(DISTINCT h.name) as hashtags,
            count(DISTINCT liker) as likes,
            count(DISTINCT c) as comments
       OPTIONAL MATCH (p)<-[myLike:LE_GUSTO]-(:Usuario {id: $userId})
       OPTIONAL MATCH (p)<-[mySaved:GUARDO]-(:Usuario {id: $userId})
       RETURN p,
              u.username as author,
              u.avatarUrl as authorAvatar,
              hashtags, likes, comments,
              myLike IS NOT NULL as likedByMe,
              mySaved IS NOT NULL as savedByMe,
              sound, location
       ORDER BY likedAt DESC, p.createdAt DESC
       LIMIT 50`,
      { userId: req.user.id }
    );
    res.json({ success: true, data: { posts: records.map(serializePost) } });
  } catch (err) {
    console.error('GET /me/liked error', err);
    res.status(500).json({ success: false, message: 'Error obteniendo posts con like' });
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
    let imageUrl = null;
    let imagePublicId = null;
    if (req.file) {
      ({ imageUrl, imagePublicId } = await storePostImage(req.file));
    }

    await runQuery(
      `MATCH (u:Usuario {id: $userId})
       CREATE (u)-[:PUBLICO]->(p:Post {
         id: $id, content: $content, imageUrl: $imageUrl, imagePublicId: $imagePublicId, createdAt: datetime()
       })`,
      { userId: req.user.id, id, content, imageUrl, imagePublicId }
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
         MERGE (u)-[r:LE_GUSTO]->(p)
         ON CREATE SET r.likedAt = datetime()
         ON MATCH SET r.likedAt = coalesce(r.likedAt, datetime())`,
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
// ---- Guardar post (toggle) ----
router.post('/:id/save', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const exists = await runQuery(
      'MATCH (p:Post {id: $id}) RETURN p LIMIT 1',
      { id }
    );
    if (exists.length === 0) {
      return res.status(404).json({ success: false, message: 'Post no encontrado' });
    }

    const existing = await runQuery(
      `MATCH (:Usuario {id: $userId})-[r:GUARDO]->(:Post {id: $id}) RETURN r LIMIT 1`,
      { userId: req.user.id, id }
    );

    let saved;
    if (existing.length > 0) {
      await runQuery(
        `MATCH (:Usuario {id: $userId})-[r:GUARDO]->(:Post {id: $id}) DELETE r`,
        { userId: req.user.id, id }
      );
      saved = false;
    } else {
      await runQuery(
        `MATCH (u:Usuario {id: $userId}), (p:Post {id: $id})
         MERGE (u)-[r:GUARDO]->(p)
         ON CREATE SET r.savedAt = datetime()
         ON MATCH SET r.savedAt = coalesce(r.savedAt, datetime())`,
        { userId: req.user.id, id }
      );
      saved = true;
    }

    return res.json({ success: true, data: { saved } });
  } catch (err) {
    console.error('POST /save error', err);
    res.status(500).json({ success: false, message: 'Error al guardar post' });
  }
});

// ---- Eliminar post ----
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const records = await runQuery(
      'MATCH (u:Usuario)-[:PUBLICO]->(p:Post {id: $id}) RETURN u.id as ownerId, p.imageUrl as imageUrl, p.imagePublicId as imagePublicId',
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

    // Borra el asset: Cloudinary si hay publicId, disco si es legacy /uploads/
    const imagePublicId = records[0].get('imagePublicId');
    const imageUrl = records[0].get('imageUrl');
    if (imagePublicId) {
      await destroyAsset(imagePublicId, 'image');
    } else if (imageUrl && imageUrl.startsWith('/uploads/')) {
      const filePath = path.join(uploadsDir, path.basename(imageUrl));
      fs.promises.unlink(filePath).catch(() => { });
    }

    res.json({ success: true, data: { deleted: id } });
  } catch (err) {
    console.error('DELETE /:id error', err);
    res.status(500).json({ success: false, message: 'Error eliminando post' });
  }
});

export default router;
