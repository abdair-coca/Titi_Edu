import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { runQuery } from '../db.js';
import prisma from '../prisma.js';

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Registros con el mismo email se procesan uno tras otro en este proceso, para que
// la comprobación de duplicados y la creación no se intercalen.
const registrosEnCurso = new Map();

function enExclusiva(clave, tarea) {
  const anterior = registrosEnCurso.get(clave) ?? Promise.resolve();
  const turno = anterior.then(tarea);
  const fin = turno.catch(() => {});
  registrosEnCurso.set(clave, fin);
  fin.then(() => {
    if (registrosEnCurso.get(clave) === fin) registrosEnCurso.delete(clave);
  });
  return turno;
}

// Login: 5 fallos seguidos del mismo email bloquean ese email durante 15 minutos.
const MAX_INTENTOS = 5;
const VENTANA_MS = 15 * 60 * 1000;
const intentosFallidos = new Map();

function estaBloqueado(email) {
  const registro = intentosFallidos.get(email);
  if (!registro) return false;
  if (Date.now() > registro.expira) {
    intentosFallidos.delete(email);
    return false;
  }
  return registro.cuenta >= MAX_INTENTOS;
}

function registrarFallo(email) {
  const registro = intentosFallidos.get(email);
  if (!registro || Date.now() > registro.expira) {
    intentosFallidos.set(email, { cuenta: 1, expira: Date.now() + VENTANA_MS });
  } else {
    registro.cuenta += 1;
  }
}

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
    bannerUrl: p.bannerUrl || null,
    createdAt: p.createdAt?.toString?.() ?? p.createdAt,
  };
}

router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body || {};
    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: 'username, email y password son requeridos' });
    }
    if (typeof username !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ success: false, message: 'username, email y password deben ser texto' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 6 caracteres' });
    }
    if (password.trim() === '') {
      return res.status(400).json({ success: false, message: 'La contraseña no puede estar formada solo por espacios' });
    }

    // Email y username se guardan sin espacios y en minúsculas, así la igualdad de Cypher
    // detecta como duplicados los que solo difieren en mayúsculas o espacios.
    const usuario = username.trim().toLowerCase();
    const correo = email.trim().toLowerCase();
    if (!usuario) {
      return res.status(400).json({ success: false, message: 'El username no puede estar vacío' });
    }
    if (!EMAIL_RE.test(correo)) {
      return res.status(400).json({ success: false, message: 'El email no es válido' });
    }

    const id = randomUUID();
    const hash = await bcrypt.hash(password, 10);
    const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(username)}`;

    const records = await enExclusiva(correo, async () => {
      const existing = await runQuery(
        'MATCH (u:Usuario) WHERE u.username = $username OR u.email = $email RETURN u LIMIT 1',
        { username: usuario, email: correo }
      );
      if (existing.length > 0) return null;

      return runQuery(
        `CREATE (u:Usuario {
           id: $id, username: $username, email: $email, password: $password,
           bio: '', avatarUrl: $avatarUrl, createdAt: datetime()
         }) RETURN u`,
        { id, username: usuario, email: correo, password: hash, avatarUrl }
      );
    });
    if (records === null) {
      return res.status(409).json({ success: false, message: 'Usuario o email ya registrado' });
    }

    // Espejo en PostgreSQL — no debe romper el registro si falla.
    let pgUser = null;
    try {
      pgUser = await prisma.usuario.create({
        data: {
          neoId: id,
          username: usuario,
          email: correo,
        },
        select: { rol: true, racha: true },
      });
    } catch (pgErr) {
      console.error('register: error replicando usuario en PostgreSQL', pgErr);
    }

    const user = publicUser(records[0].get('u'));
    user.rol = pgUser?.rol ?? 'ESTUDIANTE';
    user.racha = pgUser?.racha ?? 0;

    const token = signToken(user);
    res.status(201).json({ success: true, data: { user, token } });
  } catch (err) {
    // Otro proceso registró el mismo email a la vez: la restricción UNIQUE de Neo4j lo rechaza.
    if (err?.code === 'Neo.ClientError.Schema.ConstraintValidationFailed') {
      return res.status(409).json({ success: false, message: 'Usuario o email ya registrado' });
    }
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
    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ success: false, message: 'email y password deben ser texto' });
    }

    const correo = email.trim().toLowerCase();
    if (estaBloqueado(correo)) {
      return res.status(429).json({ success: false, message: 'Demasiados intentos fallidos. Inténtalo de nuevo más tarde' });
    }

    const records = await runQuery(
      'MATCH (u:Usuario {email: $email}) RETURN u LIMIT 1',
      { email: correo }
    );
    if (records.length === 0) {
      registrarFallo(correo);
      return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
    }

    const node = records[0].get('u');
    const ok = await bcrypt.compare(password, node.properties.password);
    if (!ok) {
      registrarFallo(correo);
      return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
    }
    intentosFallidos.delete(correo);

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

// El endpoint temporal POST /become-teacher (autoascenso a PROFESOR en dev) se
// eliminó en la Etapa 4: ahora un ADMIN asigna el rol vía PUT /api/admin/users/:id/role.

export default router;
