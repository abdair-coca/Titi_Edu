import { Router } from 'express';
import { runQuery, toNumber } from '../db.js';

const router = Router();

// ---- Lista de sonidos disponibles ----
router.get('/', async (req, res) => {
  try {
    const records = await runQuery(
      `MATCH (s:Sonido)
       OPTIONAL MATCH (s)<-[:USA_SONIDO]-(p:Post)
       RETURN s, count(p) as usageCount
       ORDER BY usageCount DESC, s.name ASC`
    );
    const sounds = records.map((r) => {
      const p = r.get('s').properties;
      return {
        id: p.id,
        name: p.name,
        artist: p.artist,
        usageCount: toNumber(r.get('usageCount')),
      };
    });
    res.json({ success: true, data: { sounds } });
  } catch (err) {
    console.error('GET /sounds error', err);
    res.status(500).json({ success: false, message: 'Error obteniendo sonidos' });
  }
});

// ---- Detalle de un sonido + posts que lo usan ----
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const records = await runQuery(
      `MATCH (s:Sonido {id: $id})
       OPTIONAL MATCH (s)<-[:USA_SONIDO]-(p:Post)<-[:PUBLICO]-(u:Usuario)
       RETURN s, collect({
         id: p.id, content: p.content, imageUrl: p.imageUrl,
         createdAt: p.createdAt, author: u.username, authorAvatar: u.avatarUrl
       }) as posts`,
      { id }
    );
    if (records.length === 0) {
      return res.status(404).json({ success: false, message: 'Sonido no encontrado' });
    }
    const r = records[0];
    const s = r.get('s').properties;
    const posts = (r.get('posts') || [])
      .filter((p) => p && p.id)
      .map((p) => ({
        ...p,
        createdAt: p.createdAt?.toString?.() ?? p.createdAt,
      }));
    res.json({
      success: true,
      data: {
        sound: { id: s.id, name: s.name, artist: s.artist },
        posts,
      },
    });
  } catch (err) {
    console.error('GET /sounds/:id error', err);
    res.status(500).json({ success: false, message: 'Error obteniendo sonido' });
  }
});

export default router;
