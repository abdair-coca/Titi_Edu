import { Router } from 'express';
import { randomUUID } from 'crypto';
import { runQuery } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

function serializeComment(record) {
  return {
    id: record.get('id'),
    text: record.get('text'),
    createdAt: record.get('createdAt')?.toString?.() ?? record.get('createdAt'),
    author: record.get('author'),
    authorAvatar: record.get('authorAvatar'),
    replyTo: record.has?.('replyTo') ? record.get('replyTo') : null,
  };
}

// ---- Listar comentarios de un post ----
// Devuelve flat con replyTo: id-del-padre (o null si es raíz).
router.get('/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    const postExists = await runQuery(
      'MATCH (p:Post {id: $postId}) RETURN p LIMIT 1',
      { postId }
    );
    if (postExists.length === 0) {
      return res.status(404).json({ success: false, message: 'Post no encontrado' });
    }

    const records = await runQuery(
      `MATCH (autor:Usuario)-[:ESCRIBIO]->(c:Comentario)-[:EN]->(p:Post {id: $postId})
       OPTIONAL MATCH (c)-[:RESPONDE_A]->(parent:Comentario)
       RETURN c.id as id, c.text as text, c.createdAt as createdAt,
              autor.username as author, autor.avatarUrl as authorAvatar,
              parent.id as replyTo
       ORDER BY c.createdAt ASC`,
      { postId }
    );
    const comments = records.map(serializeComment);
    res.json({ success: true, data: { comments } });
  } catch (err) {
    console.error('GET /comments error', err);
    res.status(500).json({ success: false, message: 'Error obteniendo comentarios' });
  }
});

// ---- Crear comentario (root o reply) ----
router.post('/:postId', requireAuth, async (req, res) => {
  try {
    const { postId } = req.params;
    const text = (req.body?.text ?? '').toString().trim();
    const replyTo = (req.body?.replyTo ?? '').toString().trim() || null;

    if (!text) {
      return res.status(400).json({ success: false, message: 'El comentario no puede estar vacío' });
    }

    const postRec = await runQuery(
      'MATCH (u:Usuario)-[:PUBLICO]->(p:Post {id: $postId}) RETURN u.id as ownerId LIMIT 1',
      { postId }
    );
    if (postRec.length === 0) {
      return res.status(404).json({ success: false, message: 'Post no encontrado' });
    }
    const ownerId = postRec[0].get('ownerId');

    // Si es respuesta, valida que el comentario padre exista y pertenezca al mismo post
    if (replyTo) {
      const parentRec = await runQuery(
        `MATCH (c:Comentario {id: $replyTo})-[:EN]->(p:Post {id: $postId})
         RETURN c LIMIT 1`,
        { replyTo, postId }
      );
      if (parentRec.length === 0) {
        return res.status(400).json({ success: false, message: 'Comentario padre inválido' });
      }
    }

    const commentId = randomUUID();
    const createParams = { userId: req.user.id, postId, commentId, text };

    if (replyTo) {
      await runQuery(
        `MATCH (autor:Usuario {id: $userId}), (p:Post {id: $postId}), (parent:Comentario {id: $replyTo})
         CREATE (autor)-[:ESCRIBIO]->(c:Comentario {
           id: $commentId, text: $text, createdAt: datetime()
         })-[:EN]->(p)
         CREATE (c)-[:RESPONDE_A]->(parent)`,
        { ...createParams, replyTo }
      );
    } else {
      await runQuery(
        `MATCH (autor:Usuario {id: $userId}), (p:Post {id: $postId})
         CREATE (autor)-[:ESCRIBIO]->(c:Comentario {
           id: $commentId, text: $text, createdAt: datetime()
         })-[:EN]->(p)`,
        createParams
      );
    }

    // Recupera el comentario con author info
    const records = await runQuery(
      `MATCH (autor:Usuario)-[:ESCRIBIO]->(c:Comentario {id: $commentId})
       OPTIONAL MATCH (c)-[:RESPONDE_A]->(parent:Comentario)
       RETURN c.id as id, c.text as text, c.createdAt as createdAt,
              autor.username as author, autor.avatarUrl as authorAvatar,
              parent.id as replyTo`,
      { commentId }
    );

    // Notificación al dueño del post (no a uno mismo)
    if (ownerId && ownerId !== req.user.id) {
      const notifId = randomUUID();
      await runQuery(
        `MATCH (owner:Usuario {id: $ownerId}), (actor:Usuario {id: $actorId}), (p:Post {id: $postId})
         CREATE (owner)<-[:RECIBIO]-(n:Notificacion {
           id: $notifId, type: 'comment', read: false,
           createdAt: datetime(),
           actorId: $actorId, postId: $postId, commentId: $commentId
         })
         CREATE (n)-[:SOBRE]->(p)`,
        { ownerId, actorId: req.user.id, postId, commentId, notifId }
      );
    }

    res.status(201).json({ success: true, data: { comment: serializeComment(records[0]) } });
  } catch (err) {
    console.error('POST /comments error', err);
    res.status(500).json({ success: false, message: 'Error creando comentario' });
  }
});

// ---- Eliminar comentario propio ----
router.delete('/:commentId', requireAuth, async (req, res) => {
  try {
    const { commentId } = req.params;
    const owner = await runQuery(
      `MATCH (autor:Usuario)-[:ESCRIBIO]->(c:Comentario {id: $commentId})
       RETURN autor.id as ownerId LIMIT 1`,
      { commentId }
    );
    if (owner.length === 0) {
      return res.status(404).json({ success: false, message: 'Comentario no encontrado' });
    }
    if (owner[0].get('ownerId') !== req.user.id) {
      return res.status(403).json({ success: false, message: 'No puedes eliminar comentarios ajenos' });
    }
    await runQuery(
      'MATCH (c:Comentario {id: $commentId}) DETACH DELETE c',
      { commentId }
    );
    res.json({ success: true, data: { deleted: commentId } });
  } catch (err) {
    console.error('DELETE /comments error', err);
    res.status(500).json({ success: false, message: 'Error eliminando comentario' });
  }
});

export default router;
