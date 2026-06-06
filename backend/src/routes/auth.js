import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { runQuery } from '../db.js';
import prisma from '../prisma.js';

const router = Router();

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, email: user.email },
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
    const token = signToken(user);
    res.json({ success: true, data: { user, token } });
  } catch (err) {
    console.error('login error', err);
    res.status(500).json({ success: false, message: 'Error al iniciar sesión' });
  }
});

export default router;
