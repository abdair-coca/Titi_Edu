import { Router } from 'express';
import { runQuery, toNumber } from '../db.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const q = (req.query.q ?? '').toString().trim();
    if (!q) {
      return res.json({ success: true, data: { users: [], posts: [], hashtags: [] } });
    }

    const cleanQ = q.startsWith('#') ? q.slice(1) : q;

    const [userRecords, postRecords, hashtagRecords] = await Promise.all([
      runQuery(
        `MATCH (u:Usuario)
         WHERE toLower(u.username) CONTAINS toLower($q) OR toLower(u.bio) CONTAINS toLower($q)
         RETURN u LIMIT 10`,
        { q: cleanQ }
      ),
      runQuery(
        `MATCH (u:Usuario)-[:PUBLICO]->(p:Post)
         WHERE toLower(p.content) CONTAINS toLower($q)
         RETURN p, u.username as author, u.avatarUrl as authorAvatar
         ORDER BY p.createdAt DESC LIMIT 10`,
        { q: cleanQ }
      ),
      runQuery(
        `MATCH (h:Hashtag)<-[:TIENE_HASHTAG]-(p:Post)
         WHERE toLower(h.name) CONTAINS toLower($q)
         RETURN h.name as name, count(p) as postCount
         ORDER BY postCount DESC LIMIT 10`,
        { q: cleanQ }
      ),
    ]);

    const users = userRecords.map(r => {
      const p = r.get('u').properties;
      return { id: p.id, username: p.username, bio: p.bio, avatarUrl: p.avatarUrl };
    });

    const posts = postRecords.map(r => {
      const p = r.get('p').properties;
      return {
        id: p.id,
        content: p.content,
        imageUrl: p.imageUrl,
        createdAt: p.createdAt?.toString?.() ?? p.createdAt,
        author: r.get('author'),
        authorAvatar: r.get('authorAvatar'),
      };
    });

    const hashtags = hashtagRecords.map(r => ({
      name: r.get('name'),
      postCount: toNumber(r.get('postCount')),
    }));

    res.json({ success: true, data: { users, posts, hashtags } });
  } catch (err) {
    console.error('GET /search error', err);
    res.status(500).json({ success: false, message: 'Error en búsqueda' });
  }
});

export default router;
