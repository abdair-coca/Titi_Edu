import { Router } from 'express';
import { runQuery, toNumber } from '../db.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';

const router = Router();

function publicUser(node) {
  if (!node) return null;
  const p = node.properties;
  return {
    id: p.id,
    username: p.username,
    bio: p.bio,
    avatarUrl: p.avatarUrl,
    createdAt: p.createdAt?.toString?.() ?? p.createdAt,
  };
}

router.get('/me', requireAuth, async (req, res) => {
  try {
    const records = await runQuery(
      `MATCH (u:User {id: $id})
       OPTIONAL MATCH (u)-[:PUBLISHED]->(p:Post)
       OPTIONAL MATCH (u)<-[:FOLLOWS]-(follower:User)
       OPTIONAL MATCH (u)-[:FOLLOWS]->(following:User)
       RETURN u,
              count(DISTINCT p) as postCount,
              count(DISTINCT follower) as followerCount,
              count(DISTINCT following) as followingCount`,
      { id: req.user.id }
    );
    if (records.length === 0) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }
    const r = records[0];
    const node = r.get('u');
    res.json({
      success: true,
      data: {
        user: { ...publicUser(node), email: node.properties.email },
        stats: {
          postCount: toNumber(r.get('postCount')),
          followerCount: toNumber(r.get('followerCount')),
          followingCount: toNumber(r.get('followingCount')),
        },
      },
    });
  } catch (err) {
    console.error('GET /me error', err);
    res.status(500).json({ success: false, message: 'Error obteniendo perfil' });
  }
});

router.get('/:username', optionalAuth, async (req, res) => {
  try {
    const { username } = req.params;
    const records = await runQuery(
      `MATCH (u:User {username: $username})
       OPTIONAL MATCH (u)-[:PUBLISHED]->(p:Post)
       OPTIONAL MATCH (u)<-[:FOLLOWS]-(follower:User)
       OPTIONAL MATCH (u)-[:FOLLOWS]->(following:User)
       RETURN u,
              count(DISTINCT p) as postCount,
              count(DISTINCT follower) as followerCount,
              count(DISTINCT following) as followingCount`,
      { username }
    );
    if (records.length === 0) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }
    const r = records[0];
    const node = r.get('u');

    let isFollowing = false;
    if (req.user && req.user.username !== username) {
      const rel = await runQuery(
        'MATCH (me:User {id: $meId})-[r:FOLLOWS]->(u:User {username: $username}) RETURN r LIMIT 1',
        { meId: req.user.id, username }
      );
      isFollowing = rel.length > 0;
    }

    res.json({
      success: true,
      data: {
        user: publicUser(node),
        stats: {
          postCount: toNumber(r.get('postCount')),
          followerCount: toNumber(r.get('followerCount')),
          followingCount: toNumber(r.get('followingCount')),
        },
        isFollowing,
        isSelf: req.user?.username === username,
      },
    });
  } catch (err) {
    console.error('GET /:username error', err);
    res.status(500).json({ success: false, message: 'Error obteniendo perfil' });
  }
});

router.post('/:username/follow', requireAuth, async (req, res) => {
  try {
    const { username } = req.params;
    if (username === req.user.username) {
      return res.status(400).json({ success: false, message: 'No puedes seguirte a ti mismo' });
    }
    const records = await runQuery(
      `MATCH (a:User {id: $followerId}), (b:User {username: $targetUsername})
       MERGE (a)-[:FOLLOWS]->(b)
       RETURN b.username as username`,
      { followerId: req.user.id, targetUsername: username }
    );
    if (records.length === 0) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }
    res.json({ success: true, data: { following: records[0].get('username') } });
  } catch (err) {
    console.error('POST /follow error', err);
    res.status(500).json({ success: false, message: 'Error al seguir usuario' });
  }
});

router.post('/:username/unfollow', requireAuth, async (req, res) => {
  try {
    const { username } = req.params;
    await runQuery(
      `MATCH (a:User {id: $followerId})-[r:FOLLOWS]->(b:User {username: $targetUsername})
       DELETE r`,
      { followerId: req.user.id, targetUsername: username }
    );
    res.json({ success: true, data: { unfollowed: username } });
  } catch (err) {
    console.error('POST /unfollow error', err);
    res.status(500).json({ success: false, message: 'Error al dejar de seguir' });
  }
});

router.get('/:username/followers', async (req, res) => {
  try {
    const { username } = req.params;
    const records = await runQuery(
      `MATCH (u:User {username: $username})<-[:FOLLOWS]-(f:User)
       RETURN f ORDER BY f.username`,
      { username }
    );
    const followers = records.map(r => publicUser(r.get('f')));
    res.json({ success: true, data: { followers } });
  } catch (err) {
    console.error('GET /followers error', err);
    res.status(500).json({ success: false, message: 'Error obteniendo seguidores' });
  }
});

router.get('/:username/following', async (req, res) => {
  try {
    const { username } = req.params;
    const records = await runQuery(
      `MATCH (u:User {username: $username})-[:FOLLOWS]->(f:User)
       RETURN f ORDER BY f.username`,
      { username }
    );
    const following = records.map(r => publicUser(r.get('f')));
    res.json({ success: true, data: { following } });
  } catch (err) {
    console.error('GET /following error', err);
    res.status(500).json({ success: false, message: 'Error obteniendo seguidos' });
  }
});

export default router;
