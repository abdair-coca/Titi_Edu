import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { runQuery } from '../db.js';
import prisma from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, email: user.email, rol: user.rol },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function publicUser(node) {
  const p = node.properties;
  return {
    id: p.id,
    username: p.username,
    email: p.email,
    bio: p.bio,
    avatarUrl: p.avatarUrl,
    createdAt: p.createdAt?.toString?.() ?? p.createdAt,
  };
}

router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body || {};
    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: 'username, email y password son requeridos' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 6 caracteres' });
    }

    const existing = await runQuery(
      'MATCH (u:Usuario) WHERE u.username = $username OR u.email = $email RETURN u LIMIT 1',
      { username, email }
    );
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Usuario o email ya registrado' });
    }

    const id = randomUUID();
    const hash = await bcrypt.hash(password, 10);
    const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(username)}`;

    const records = await runQuery(
      `CREATE (u:Usuario {
         id: $id, username: $username, email: $email, password: $password,
         bio: '', avatarUrl: $avatarUrl, createdAt: datetime()
       }) RETURN u`,
      { id, username, email, password: hash, avatarUrl }
    );

    // Espejo en PostgreSQL — no debe romper el registro si falla.
    try {
      await prisma.usuario.create({
        data: {
          neoId: id,
          username,
          email,
        },
      });
    } catch (pgErr) {
      console.error('register: error replicando usuario en PostgreSQL', pgErr);
    }

    const user = publicUser(records[0].get('u'));
    const token = signToken(user);
    res.status(201).json({ success: true, data: { user, token } });
  } catch (err) {
    console.error('register error', err);
    res.status(500).json({ success: false, message: 'Error al registrar usuario' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'email y password son requeridos' });
    }

    const records = await runQuery(
      'MATCH (u:Usuario {email: $email}) RETURN u LIMIT 1',
      { email }
    );
    if (records.length === 0) {
      return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
    }

    const node = records[0].get('u');
    const ok = await bcrypt.compare(password, node.properties.password);
    if (!ok) {
      return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
    }

    const user = publicUser(node);

    // Obtener rol desde PostgreSQL
    const pgUser = await prisma.usuario.findUnique({
      where: { neoId: user.id },
      select: { rol: true, racha: true }
    });

    user.rol = pgUser?.rol ?? 'ESTUDIANTE';
    user.racha = pgUser?.racha ?? 0;

    const token = signToken({ ...user, rol: user.rol });
    res.json({ success: true, data: { user, token } });
  } catch (err) {
    console.error('login error', err);
    res.status(500).json({ success: false, message: 'Error al iniciar sesión' });
  }
});

// ---- POST /become-teacher — endpoint temporal (TODO eliminar en Etapa 4 cuando exista admin) ----
// Permite auto-promoverse a PROFESOR verificado mientras no haya panel admin.
router.post('/become-teacher', requireAuth, async (req, res) => {
  try {
    const usuario = await prisma.usuario.findUnique({ where: { neoId: req.user.id } });
    if (!usuario) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    const updated = await prisma.usuario.update({
      where: { id: usuario.id },
      data: { rol: 'PROFESOR', verificado: true },
    });

    // Reemitir token con el nuevo rol para que el frontend lo refleje sin re-login
    const token = jwt.sign(
      { id: req.user.id, username: req.user.username, email: req.user.email, rol: updated.rol },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      data: {
        user: {
          id: req.user.id,
          username: updated.username,
          email: updated.email,
          rol: updated.rol,
          racha: updated.racha,
        },
        token,
      },
    });
  } catch (err) {
    console.error('POST /auth/become-teacher error', err);
    res.status(500).json({ success: false, message: 'Error promoviéndote a profesor' });
  }
});

export default router;
