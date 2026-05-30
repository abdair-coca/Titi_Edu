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
  return {
    id: p.id,
    content: p.content,
    imageUrl: p.imageUrl,
    createdAt: p.createdAt?.toString?.() ?? p.createdAt,
    author: record.get('author'),
    authorAvatar: record.has?.('authorAvatar') ? record.get('authorAvatar') : null,
    hashtags: record.has?.('hashtags') ? record.get('hashtags') : [],
    likes: toNumber(record.get('likes')),
    comments: record.has?.('comments') ? toNumber(record.get('comments')) : 0,
    likedByMe: record.has?.('likedByMe') ? Boolean(record.get('likedByMe')) : false,
  };
}

router.get('/feed', requireAuth, async (req, res) => {
  try {
    const records = await runQuery(
      `MATCH (me:User {id: $userId})-[:FOLLOWS]->(followed:User)-[:PUBLISHED]->(p:Post)
       OPTIONAL MATCH (p)<-[:LIKED]-(liker:User)
       OPTIONAL MATCH (p)<-[:COMMENTED]-(commenter:User)
       OPTIONAL MATCH (p)-[:HAS_HASHTAG]->(h:Hashtag)
       WITH p, followed, me,
            collect(DISTINCT h.name) as hashtags,
            count(DISTINCT liker) as likes,
            count(DISTINCT commenter) as comments
       OPTIONAL MATCH (p)<-[myLike:LIKED]-(me)
       RETURN p,
              followed.username as author,
              followed.avatarUrl as authorAvatar,
              hashtags, likes, comments,
              myLike IS NOT NULL as likedByMe
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

router.get('/explore', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?.id ?? null;
    const records = await runQuery(
      `MATCH (u:User)-[:PUBLISHED]->(p:Post)
       OPTIONAL MATCH (p)<-[:LIKED]-(liker:User)
       OPTIONAL MATCH (p)<-[:COMMENTED]-(commenter:User)
       OPTIONAL MATCH (p)-[:HAS_HASHTAG]->(h:Hashtag)
       WITH p, u,
            collect(DISTINCT h.name) as hashtags,
            count(DISTINCT liker) as likes,
            count(DISTINCT commenter) as comments
       OPTIONAL MATCH (p)<-[myLike:LIKED]-(me:User {id: $userId})
       RETURN p,
              u.username as author,
              u.avatarUrl as authorAvatar,
              hashtags, likes, comments,
              myLike IS NOT NULL as likedByMe
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

router.post('/', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const content = (req.body?.content ?? '').toString().trim();
    if (!content && !req.file) {
      return res.status(400).json({ success: false, message: 'El post debe tener contenido o imagen' });
    }

    const id = randomUUID();
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    await runQuery(
      `MATCH (u:User {id: $userId})
       CREATE (u)-[:PUBLISHED]->(p:Post {
         id: $id, content: $content, imageUrl: $imageUrl, createdAt: datetime()
       })`,
      { userId: req.user.id, id, content, imageUrl }
    );

    const hashtags = extractHashtags(content);
    for (const tag of hashtags) {
      await runQuery(
        `MATCH (p:Post {id: $postId})
         MERGE (h:Hashtag {name: $tag})
         MERGE (p)-[:HAS_HASHTAG]->(h)`,
        { postId: id, tag }
      );
    }

    res.status(201).json({ success: true, data: { id, content, imageUrl, hashtags } });
  } catch (err) {
    console.error('POST /posts error', err);
    res.status(500).json({ success: false, message: 'Error creando post' });
  }
});

router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id ?? null;
    const records = await runQuery(
      `MATCH (u:User)-[:PUBLISHED]->(p:Post {id: $id})
       OPTIONAL MATCH (p)<-[:LIKED]-(liker:User)
       OPTIONAL MATCH (p)-[:HAS_HASHTAG]->(h:Hashtag)
       WITH p, u,
            collect(DISTINCT h.name) as hashtags,
            count(DISTINCT liker) as likes
       OPTIONAL MATCH (p)<-[myLike:LIKED]-(me:User {id: $userId})
       RETURN p,
              u.username as author,
              u.avatarUrl as authorAvatar,
              hashtags, likes,
              myLike IS NOT NULL as likedByMe`,
      { id, userId }
    );
    if (records.length === 0) {
      return res.status(404).json({ success: false, message: 'Post no encontrado' });
    }

    const commentRecords = await runQuery(
      `MATCH (u:User)-[c:COMMENTED]->(p:Post {id: $id})
       RETURN c.id as id, c.text as text, c.createdAt as createdAt,
              u.username as author, u.avatarUrl as authorAvatar
       ORDER BY c.createdAt ASC`,
      { id }
    );

    const comments = commentRecords.map(r => ({
      id: r.get('id'),
      text: r.get('text'),
      createdAt: r.get('createdAt')?.toString?.() ?? r.get('createdAt'),
      author: r.get('author'),
      authorAvatar: r.get('authorAvatar'),
    }));

    const post = serializePost(records[0]);
    post.comments = comments.length;
    res.json({ success: true, data: { post, comments } });
  } catch (err) {
    console.error('GET /:id error', err);
    res.status(500).json({ success: false, message: 'Error obteniendo post' });
  }
});

router.post('/:id/like', requireAuth, async (req, res) => {
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
      'MATCH (u:User {id: $userId})-[r:LIKED]->(p:Post {id: $id}) RETURN r LIMIT 1',
      { userId: req.user.id, id }
    );

    let liked;
    if (existing.length > 0) {
      await runQuery(
        'MATCH (u:User {id: $userId})-[r:LIKED]->(p:Post {id: $id}) DELETE r',
        { userId: req.user.id, id }
      );
      liked = false;
    } else {
      await runQuery(
        `MATCH (u:User {id: $userId}), (p:Post {id: $id})
         MERGE (u)-[:LIKED]->(p)`,
        { userId: req.user.id, id }
      );
      liked = true;
    }

    const countRecords = await runQuery(
      'MATCH (p:Post {id: $id})<-[r:LIKED]-(:User) RETURN count(r) as likes',
      { id }
    );
    const likes = toNumber(countRecords[0].get('likes'));

    res.json({ success: true, data: { liked, likes } });
  } catch (err) {
    console.error('POST /like error', err);
    res.status(500).json({ success: false, message: 'Error al dar like' });
  }
});

router.post('/:id/comment', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const text = (req.body?.text ?? '').toString().trim();
    if (!text) {
      return res.status(400).json({ success: false, message: 'El comentario no puede estar vacío' });
    }

    const exists = await runQuery(
      'MATCH (p:Post {id: $id}) RETURN p LIMIT 1',
      { id }
    );
    if (exists.length === 0) {
      return res.status(404).json({ success: false, message: 'Post no encontrado' });
    }

    const commentId = randomUUID();
    const records = await runQuery(
      `MATCH (u:User {id: $userId}), (p:Post {id: $id})
       CREATE (u)-[c:COMMENTED {id: $commentId, text: $text, createdAt: datetime()}]->(p)
       RETURN c.id as id, c.text as text, c.createdAt as createdAt,
              u.username as author, u.avatarUrl as authorAvatar`,
      { userId: req.user.id, id, commentId, text }
    );
    const r = records[0];
    res.status(201).json({
      success: true,
      data: {
        comment: {
          id: r.get('id'),
          text: r.get('text'),
          createdAt: r.get('createdAt')?.toString?.() ?? r.get('createdAt'),
          author: r.get('author'),
          authorAvatar: r.get('authorAvatar'),
        },
      },
    });
  } catch (err) {
    console.error('POST /comment error', err);
    res.status(500).json({ success: false, message: 'Error creando comentario' });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const records = await runQuery(
      'MATCH (u:User)-[:PUBLISHED]->(p:Post {id: $id}) RETURN u.id as ownerId, p.imageUrl as imageUrl',
      { id }
    );
    if (records.length === 0) {
      return res.status(404).json({ success: false, message: 'Post no encontrado' });
    }
    if (records[0].get('ownerId') !== req.user.id) {
      return res.status(403).json({ success: false, message: 'No puedes eliminar posts ajenos' });
    }

    await runQuery(
      'MATCH (p:Post {id: $id}) DETACH DELETE p',
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
