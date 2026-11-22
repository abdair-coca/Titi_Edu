import { Router } from 'express';
import { runQuery, toNumber } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
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
         OPTIONAL MATCH (u)<-[:SIGUIO]-(fol:Usuario)
         WITH u, count(DISTINCT fol) AS followerCount
         OPTIONAL MATCH (:Usuario {id: $userId})-[f:SIGUIO]->(u)
         RETURN u, followerCount, f IS NOT NULL AS isFollowing
         ORDER BY followerCount DESC, u.username ASC
         LIMIT 10`,
        { q: cleanQ, userId: req.user.id }
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
      return {
        id: p.id,
        username: p.username,
        bio: p.bio,
        avatarUrl: p.avatarUrl,
        followerCount: r.has?.('followerCount') ? toNumber(r.get('followerCount')) : 0,
        isFollowing: r.has?.('isFollowing') ? Boolean(r.get('isFollowing')) : false,
      };
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

// ---- Tendencias (rediseno-inicio-explorar R8) ----
// Hashtags con más posts de los últimos 14 días; si no hay recientes, los de
// más posts de siempre.
const TRENDING_DAYS = 14;
const TRENDING_DEFAULT = 8;
const TRENDING_MAX = 20;

router.get('/trending', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(TRENDING_MAX, Math.max(1, Number(req.query.limit) || TRENDING_DEFAULT));
    const query = (recent) =>
      runQuery(
        `MATCH (h:Hashtag)<-[:TIENE_HASHTAG]-(p:Post)
         ${recent ? 'WHERE p.createdAt >= datetime() - duration({days: toInteger($days)})' : ''}
         RETURN h.name AS name, count(DISTINCT p) AS postCount
         ORDER BY postCount DESC, name ASC
         LIMIT toInteger($limit)`,
        { days: TRENDING_DAYS, limit },
      );

    let records = await query(true);
    let recent = true;
    if (records.length === 0) {
      records = await query(false);
      recent = false;
    }

    const hashtags = records.map((r) => ({
      name: r.get('name'),
      postCount: toNumber(r.get('postCount')),
    }));
    res.json({ success: true, data: { hashtags, recent } });
  } catch (err) {
    console.error('GET /search/trending error', err);
    res.status(500).json({ success: false, message: 'Error obteniendo tendencias' });
  }
});

export default router;
