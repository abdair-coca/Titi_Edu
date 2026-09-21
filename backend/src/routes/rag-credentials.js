import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { loadCurrentUser } from '../middleware/permissions.js';
import { groqCredentialMetadata, saveValidatedGroqCredential, deleteGroqCredential } from '../services/ai-credentials.js';
import { RagError } from '../services/rag.errors.js';

const router = Router();
router.use(requireAuth);
for (const [method, operation] of [
  ['get', (id) => groqCredentialMetadata(id)],
  ['put', (id, body) => saveValidatedGroqCredential(id, body?.apiKey)],
  ['delete', (id) => deleteGroqCredential(id)],
]) {
  router[method]('/', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const usuario = await loadCurrentUser(req, res);
      if (!usuario) return;
      const data = await operation(usuario.id, req.body);
      return res.json({ success: true, data });
    } catch (error) {
      // Neither provider responses nor request/error objects may contain logs.
      return res.status(error instanceof RagError ? error.status : 500).json({
        success: false, message: error instanceof RagError ? error.message : 'Error procesando la credencial IA',
      });
    }
  });
}
export default router;
