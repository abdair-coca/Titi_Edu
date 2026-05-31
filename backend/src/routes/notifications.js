import { Router } from 'express';
import { runQuery, toNumber } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// ---- Listar notificaciones del usuario actual ----
router.get('/', requireAuth, async (req, res) => {
  try {
    const records = await runQuery(
      `MATCH (me:Usuario {id: $userId})<-[:RECIBIO]-(n:Notificacion)
       OPTIONAL MATCH (actor:Usuario {id: n.actorId})
       OPTIONAL MATCH (n)-[:SOBRE]->(target)
       RETURN n,
              actor.username as actorUsername,
              actor.avatarUrl as actorAvatar,
              target,
              labels(target) as targetLabels
       ORDER BY n.createdAt DESC
       LIMIT 50`,
      { userId: req.user.id }
    );

    const notifications = records.map((r) => {
      const n = r.get('n').properties;
      const target = r.get('target');
      const labels = r.get('targetLabels') || [];
      const out = {
        id: n.id,
        type: n.type,
        read: Boolean(n.read),
        createdAt: n.createdAt?.toString?.() ?? n.createdAt,
        actor: r.get('actorUsername')
          ? { username: r.get('actorUsername'), avatarUrl: r.get('actorAvatar') }
          : null,
        post: null,
        user: null,
      };
      if (target && labels.includes('Post')) {
        const p = target.properties;
        out.post = { id: p.id, content: p.content, imageUrl: p.imageUrl };
      } else if (target && labels.includes('Usuario')) {
        const u = target.properties;
        out.user = { username: u.username, avatarUrl: u.avatarUrl };
      }
      return out;
    });

    const unreadRec = await runQuery(
      `MATCH (me:Usuario {id: $userId})<-[:RECIBIO]-(n:Notificacion)
       WHERE n.read = false
       RETURN count(n) as unread`,
      { userId: req.user.id }
    );
    const unreadCount = toNumber(unreadRec[0].get('unread'));

    res.json({ success: true, data: { notifications, unreadCount } });
  } catch (err) {
    console.error('GET /notifications error', err);
    res.status(500).json({ success: false, message: 'Error obteniendo notificaciones' });
  }
});

// ---- Marcar una notificación como leída ----
router.post('/:id/read', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const records = await runQuery(
      `MATCH (me:Usuario {id: $userId})<-[:RECIBIO]-(n:Notificacion {id: $id})
       SET n.read = true
       RETURN n.id as id`,
      { userId: req.user.id, id }
    );
    if (records.length === 0) {
      return res.status(404).json({ success: false, message: 'Notificación no encontrada' });
    }
    res.json({ success: true, data: { id } });
  } catch (err) {
    console.error('POST /notifications/:id/read error', err);
    res.status(500).json({ success: false, message: 'Error marcando notificación' });
  }
});

// ---- Marcar todas como leídas ----
router.post('/read-all', requireAuth, async (req, res) => {
  try {
    await runQuery(
      `MATCH (me:Usuario {id: $userId})<-[:RECIBIO]-(n:Notificacion)
       WHERE n.read = false
       SET n.read = true`,
      { userId: req.user.id }
    );
    res.json({ success: true, data: { ok: true } });
  } catch (err) {
    console.error('POST /notifications/read-all error', err);
    res.status(500).json({ success: false, message: 'Error marcando notificaciones' });
  }
});

// ---- Contador unread (endpoint barato para polling del badge) ----
router.get('/unread/count', requireAuth, async (req, res) => {
  try {
    const rec = await runQuery(
      `MATCH (me:Usuario {id: $userId})<-[:RECIBIO]-(n:Notificacion)
       WHERE n.read = false
       RETURN count(n) as unread`,
      { userId: req.user.id }
    );
    res.json({ success: true, data: { unreadCount: toNumber(rec[0].get('unread')) } });
  } catch (err) {
    console.error('GET /notifications/unread/count error', err);
    res.status(500).json({ success: false, message: 'Error obteniendo contador' });
  }
});

export default router;
