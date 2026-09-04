import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Router } from 'express';
import { randomUUID } from 'crypto';
import multer from 'multer';
import { runQuery, toNumber } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import prisma from '../prisma.js';
import { cloudinaryEnabled, uploadBuffer } from '../services/upload.service.js';
import { checkLogroSocial } from '../services/achievement.service.js';
import { otorgarGotasPorNeoId } from '../services/gotas.service.js';
import { avanzarMisionesPorNeoId } from '../services/mision.service.js';

const router = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const uploadAvatar = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /image\/(jpeg|jpg|png|webp)/.test(file.mimetype);
    if (!ok) return cb(new Error('Solo se permiten imágenes (jpeg, png, webp)'));
    cb(null, true);
  },
});

const uploadBanner = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /image\/(jpeg|jpg|png|webp)/.test(file.mimetype);
    if (!ok) return cb(new Error('Solo se permiten imágenes (jpeg, png, webp)'));
    cb(null, true);
  },
});

async function storeAvatarImage(file) {
  if (cloudinaryEnabled) {
    const { url, publicId } = await uploadBuffer(file.buffer, 'titi/avatars', 'image');
    return { avatarUrl: url, publicId };
  }
  const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
  const filename = `avatar-${randomUUID()}${ext}`;
  await fs.promises.writeFile(path.join(uploadsDir, filename), file.buffer);
  return { avatarUrl: `/uploads/${filename}`, publicId: null };
}

async function storeBannerImage(file) {
  if (cloudinaryEnabled) {
    const { url, publicId } = await uploadBuffer(file.buffer, 'titi/banners', 'image');
    return { bannerUrl: url, publicId };
  }
  const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
  const filename = `banner-${randomUUID()}${ext}`;
  await fs.promises.writeFile(path.join(uploadsDir, filename), file.buffer);
  return { bannerUrl: `/uploads/${filename}`, publicId: null };
}

function publicUser(node) {
  if (!node) return null;
  const p = node.properties;
  return {
    id: p.id,
    username: p.username,
    bio: p.bio,
    avatarUrl: p.avatarUrl,
    bannerUrl: p.bannerUrl || null,
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

// ---- Actualizar perfil propio ----
router.put('/me', requireAuth, async (req, res) => {
  try {
    const { bio, avatarUrl, bannerUrl } = req.body || {};

    if (typeof bio === 'string' && bio.length > 280) {
      return res.status(400).json({
        success: false,
        message: 'La biografía no puede superar los 280 caracteres',
      });
    }

    const sets = [];
    const params = { id: req.user.id };

    if (bio !== undefined) {
      sets.push('u.bio = $bio');
      params.bio = typeof bio === 'string' ? bio.trim() : '';
    }
    if (avatarUrl !== undefined) {
      sets.push('u.avatarUrl = $avatarUrl');
      params.avatarUrl = avatarUrl;
    }
    if (bannerUrl !== undefined) {
      if (bannerUrl === null || bannerUrl === '') {
        sets.push('u.bannerUrl = null');
      } else {
        sets.push('u.bannerUrl = $bannerUrl');
        params.bannerUrl = bannerUrl;
      }
    }

    if (sets.length === 0) {
      return res.status(400).json({ success: false, message: 'No se enviaron campos para actualizar' });
    }

    const query = `
      MATCH (u:Usuario {id: $id})
      SET ${sets.join(', ')}
      RETURN u
    `;
    const records = await runQuery(query, params);
    if (records.length === 0) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    const node = records[0].get('u');
    res.json({
      success: true,
      data: {
        user: { ...publicUser(node), email: node.properties.email },
      },
    });
  } catch (err) {
    console.error('PUT /me error', err);
    res.status(500).json({ success: false, message: 'Error actualizando perfil' });
  }
});

// ---- Subir avatar propio ----
router.post('/me/avatar', requireAuth, (req, res, next) => {
  uploadAvatar.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: 'El avatar no puede superar los 2MB' });
      }
      return res.status(400).json({ success: false, message: err.message || 'Error al procesar archivo' });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No se envió ningún archivo' });
    }
    const { avatarUrl } = await storeAvatarImage(req.file);
    const records = await runQuery(
      `MATCH (u:Usuario {id: $id})
       SET u.avatarUrl = $avatarUrl
       RETURN u`,
      { id: req.user.id, avatarUrl }
    );
    if (records.length === 0) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }
    const node = records[0].get('u');
    res.json({
      success: true,
      data: {
        avatarUrl,
        user: { ...publicUser(node), email: node.properties.email },
      },
    });
  } catch (err) {
    console.error('POST /me/avatar error', err);
    res.status(500).json({ success: false, message: 'Error subiendo avatar' });
  }
});

// ---- Subir portada/banner propio ----
router.post('/me/banner', requireAuth, (req, res, next) => {
  uploadBanner.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: 'La portada no puede superar los 3MB' });
      }
      return res.status(400).json({ success: false, message: err.message || 'Error al procesar archivo' });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No se envió ningún archivo' });
    }
    const { bannerUrl } = await storeBannerImage(req.file);
    const records = await runQuery(
      `MATCH (u:Usuario {id: $id})
       SET u.bannerUrl = $bannerUrl
       RETURN u`,
      { id: req.user.id, bannerUrl }
    );
    if (records.length === 0) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }
    const node = records[0].get('u');
    res.json({
      success: true,
      data: {
        bannerUrl,
        user: { ...publicUser(node), email: node.properties.email },
      },
    });
  } catch (err) {
    console.error('POST /me/banner error', err);
    res.status(500).json({ success: false, message: 'Error subiendo portada' });
  }
});

// ---- Perfil público (requiere login) ----
router.get('/:username', requireAuth, async (req, res) => {
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
      await avanzarMisionesPorNeoId(req.user.id, 'follow');
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
router.get('/:username/followers', requireAuth, async (req, res) => {
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
router.get('/:username/following', requireAuth, async (req, res) => {
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
