import { Router } from 'express';
import { randomUUID } from 'crypto';
import { runQuery, toNumber } from '../db.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import prisma from '../prisma.js';
import { checkLogroSocial } from '../services/achievement.service.js';
import { otorgarGotasPorNeoId } from '../services/gotas.service.js';

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

function locationFromRecord(record, key = 'location') {
  if (!record.has?.(key)) return null;
  const node = record.get(key);
  if (!node) return null;
  const p = node.properties;
  return { id: p.id, city: p.city, country: p.country };
}

// ---- Perfil propio ----
router.get('/me', requireAuth, async (req, res) => {
  try {
    const records = await runQuery(
      `MATCH (u:Usuario {id: $id})
       OPTIONAL MATCH (u)-[:PUBLICO]->(p:Post)
       OPTIONAL MATCH (u)<-[:SIGUIO]-(follower:Usuario)
       OPTIONAL MATCH (u)-[:SIGUIO]->(following:Usuario)
       OPTIONAL MATCH (u)-[:VIVE_EN]->(loc:Ubicacion)
       RETURN u,
              count(DISTINCT p) as postCount,
              count(DISTINCT follower) as followerCount,
              count(DISTINCT following) as followingCount,
              loc as location`,
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
        location: locationFromRecord(r),
      },
    });
  } catch (err) {
    console.error('GET /me error', err);
    res.status(500).json({ success: false, message: 'Error obteniendo perfil' });
  }
});

// ---- Perfil público ----
router.get('/:username', optionalAuth, async (req, res) => {
  try {
    const { username } = req.params;
    const records = await runQuery(
      `MATCH (u:Usuario {username: $username})
       OPTIONAL MATCH (u)-[:PUBLICO]->(p:Post)
       OPTIONAL MATCH (u)<-[:SIGUIO]-(follower:Usuario)
       OPTIONAL MATCH (u)-[:SIGUIO]->(following:Usuario)
       OPTIONAL MATCH (u)-[:VIVE_EN]->(loc:Ubicacion)
       RETURN u,
              count(DISTINCT p) as postCount,
              count(DISTINCT follower) as followerCount,
              count(DISTINCT following) as followingCount,
              loc as location`,
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
        'MATCH (me:Usuario {id: $meId})-[r:SIGUIO]->(u:Usuario {username: $username}) RETURN r LIMIT 1',
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
        location: locationFromRecord(r),
        isFollowing,
        isSelf: req.user?.username === username,
      },
    });
  } catch (err) {
    console.error('GET /:username error', err);
    res.status(500).json({ success: false, message: 'Error obteniendo perfil' });
  }
});

// ---- Follow ----
router.post('/:username/follow', requireAuth, async (req, res) => {
  try {
    const { username } = req.params;
    if (username === req.user.username) {
      return res.status(400).json({ success: false, message: 'No puedes seguirte a ti mismo' });
    }
    const records = await runQuery(
      `MATCH (a:Usuario {id: $followerId}), (b:Usuario {username: $targetUsername})
       MERGE (a)-[r:SIGUIO]->(b)
       ON CREATE SET r.createdAt = datetime()
       RETURN b.id as targetId, b.username as username,
              CASE WHEN r.createdAt = datetime() THEN true ELSE false END as fresh`,
      { followerId: req.user.id, targetUsername: username }
    );
    if (records.length === 0) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    // Crear notificación para el seguido (solo si la relación es nueva, evita duplicados)
    const targetId = records[0].get('targetId');
    const notifId = randomUUID();
    await runQuery(
      `MATCH (target:Usuario {id: $targetId}), (actor:Usuario {id: $actorId})
       MERGE (target)<-[:RECIBIO]-(n:Notificacion {
         type: 'follow', actorId: $actorId, targetId: $targetId
       })
       ON CREATE SET n.id = $notifId, n.read = false, n.createdAt = datetime()
       MERGE (n)-[:SOBRE]->(actor)`,
      { targetId, actorId: req.user.id, notifId }
    );

    // Logro "Social" (seguir a 10 personas) — nunca debe romper el follow.
    let logros = [];
    try {
      const countRecords = await runQuery(
        'MATCH (a:Usuario {id: $id})-[:SIGUIO]->(b:Usuario) RETURN count(b) as c',
        { id: req.user.id },
      );
      const followingCount = toNumber(countRecords[0].get('c'));
      if (followingCount >= 10) {
        const pgUser = await prisma.usuario.findUnique({ where: { neoId: req.user.id } });
        if (pgUser) {
          logros = await checkLogroSocial(pgUser.id, followingCount);
        }
      }
    } catch (logroErr) {
      console.error('follow: error chequeando logro social', logroErr);
    }

    // Gotas: +3 por seguir a alguien nuevo (tope 3/día). No bloquea la respuesta.
    if (records[0].get('fresh')) {
      await otorgarGotasPorNeoId(req.user.id, 'social_follow');
    }

    res.json({ success: true, data: { following: records[0].get('username'), logros } });
  } catch (err) {
    console.error('POST /follow error', err);
    res.status(500).json({ success: false, message: 'Error al seguir usuario' });
  }
});

// ---- Unfollow ----
router.post('/:username/unfollow', requireAuth, async (req, res) => {
  try {
    const { username } = req.params;
    await runQuery(
      `MATCH (a:Usuario {id: $followerId})-[r:SIGUIO]->(b:Usuario {username: $targetUsername})
       DELETE r`,
      { followerId: req.user.id, targetUsername: username }
    );
    res.json({ success: true, data: { unfollowed: username } });
  } catch (err) {
    console.error('POST /unfollow error', err);
    res.status(500).json({ success: false, message: 'Error al dejar de seguir' });
  }
});

// ---- Followers ----
router.get('/:username/followers', async (req, res) => {
  try {
    const { username } = req.params;
    const records = await runQuery(
      `MATCH (u:Usuario {username: $username})<-[:SIGUIO]-(f:Usuario)
       RETURN f ORDER BY f.username`,
      { username }
    );
    res.json({ success: true, data: { followers: records.map(r => publicUser(r.get('f'))) } });
  } catch (err) {
    console.error('GET /followers error', err);
    res.status(500).json({ success: false, message: 'Error obteniendo seguidores' });
  }
});

// ---- Following ----
router.get('/:username/following', async (req, res) => {
  try {
    const { username } = req.params;
    const records = await runQuery(
      `MATCH (u:Usuario {username: $username})-[:SIGUIO]->(f:Usuario)
       RETURN f ORDER BY f.username`,
      { username }
    );
    res.json({ success: true, data: { following: records.map(r => publicUser(r.get('f'))) } });
  } catch (err) {
    console.error('GET /following error', err);
    res.status(500).json({ success: false, message: 'Error obteniendo seguidos' });
  }
});

// ---- Actualizar ubicación del usuario propio ----
router.put('/me/location', requireAuth, async (req, res) => {
  try {
    const { locationId } = req.body || {};
    if (locationId === null || locationId === '') {
      // Quitar ubicación
      await runQuery(
        'MATCH (u:Usuario {id: $userId})-[r:VIVE_EN]->() DELETE r',
        { userId: req.user.id }
      );
      return res.json({ success: true, data: { location: null } });
    }
    const records = await runQuery(
      `MATCH (u:Usuario {id: $userId}), (loc:Ubicacion {id: $locationId})
       OPTIONAL MATCH (u)-[oldRel:VIVE_EN]->()
       DELETE oldRel
       WITH u, loc
       MERGE (u)-[:VIVE_EN]->(loc)
       RETURN loc`,
      { userId: req.user.id, locationId }
    );
    if (records.length === 0) {
      return res.status(404).json({ success: false, message: 'Ubicación no encontrada' });
    }
    const loc = records[0].get('loc').properties;
    res.json({
      success: true,
      data: { location: { id: loc.id, city: loc.city, country: loc.country } },
    });
  } catch (err) {
    console.error('PUT /me/location error', err);
    res.status(500).json({ success: false, message: 'Error actualizando ubicación' });
  }
});

export default router;
