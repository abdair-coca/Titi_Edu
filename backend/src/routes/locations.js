import { Router } from 'express';
import { runQuery, toNumber } from '../db.js';

const router = Router();

// ---- Lista de ubicaciones ----
router.get('/', async (req, res) => {
  try {
    const records = await runQuery(
      `MATCH (loc:Ubicacion)
       OPTIONAL MATCH (loc)<-[:VIVE_EN]-(u:Usuario)
       OPTIONAL MATCH (loc)<-[:ETIQUETADO_EN]-(p:Post)
       RETURN loc, count(DISTINCT u) as residents, count(DISTINCT p) as posts
       ORDER BY loc.country ASC, loc.city ASC`
    );
    const locations = records.map((r) => {
      const p = r.get('loc').properties;
      return {
        id: p.id,
        city: p.city,
        country: p.country,
        residents: toNumber(r.get('residents')),
        posts: toNumber(r.get('posts')),
      };
    });
    res.json({ success: true, data: { locations } });
  } catch (err) {
    console.error('GET /locations error', err);
    res.status(500).json({ success: false, message: 'Error obteniendo ubicaciones' });
  }
});

export default router;
