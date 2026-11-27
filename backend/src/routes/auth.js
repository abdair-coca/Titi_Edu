import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { runQuery } from '../db.js';
import prisma from '../prisma.js';

const router = Router();

// El dominio no admite partes vacías: rechaza "a@gmail..com", "a@.com" y "a@gmail.com.".
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

// Cuenta caracteres como se ven: un emoji o una letra con tilde valen 1, no sus unidades UTF-16.
const grafemas = new Intl.Segmenter('es', { granularity: 'grapheme' });
const contarCaracteres = (texto) => [...grafemas.segment(texto)].length;

// Quita de los bordes los espacios y también los invisibles (ancho cero, BOM) que se cuelan
// al copiar y pegar, y pasa a minúsculas: así "Ana\u200B" y " ana " son el mismo username.
const BORDES_RE = /^[\s\u200B-\u200D\uFEFF]+|[\s\u200B-\u200D\uFEFF]+$/g;
const normalizar = (texto) => texto.replace(BORDES_RE, '').toLowerCase();

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

// Login: 5 intentos seguidos del mismo email o desde la misma IP bloquean 15 minutos.
// Cada intento cuenta al llegar, así una ráfaga en paralelo no supera el límite.
// Un login correcto borra los fallos de su email y libera su intento de la IP.
const MAX_INTENTOS = 5;
const VENTANA_MS = 15 * 60 * 1000;
const contadores = new Map(); // "email:x" | "ip:y" -> { cuenta, expira }

function contadorVigente(clave) {
  const registro = contadores.get(clave);
  if (!registro) return null;
  if (Date.now() > registro.expira) {
    contadores.delete(clave);
    return null;
  }
  return registro;
}

function estaBloqueado(...claves) {
  return claves.some((clave) => (contadorVigente(clave)?.cuenta ?? 0) >= MAX_INTENTOS);
}

function contarIntento(clave) {
  const registro = contadorVigente(clave);
  if (registro) {
    registro.cuenta += 1;
  } else {
    contadores.set(clave, { cuenta: 1, expira: Date.now() + VENTANA_MS });
  }
}

function liberarIntento(clave) {
  const registro = contadorVigente(clave);
  if (registro) registro.cuenta = Math.max(0, registro.cuenta - 1);
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
    if (contarCaracteres(password) < 6) {
      return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 6 caracteres' });
    }
    if (password.trim() === '') {
      return res.status(400).json({ success: false, message: 'La contraseña no puede estar formada solo por espacios' });
    }
    // bcrypt solo usa los primeros 72 bytes: una password más larga no se puede guardar bien.
    if (Buffer.byteLength(password, 'utf8') > 72) {
      return res.status(400).json({ success: false, message: 'La contraseña no puede superar 72 bytes' });
    }

    // Email y username se guardan sin espacios y en minúsculas, así la igualdad de Cypher
    // detecta como duplicados los que solo difieren en mayúsculas o espacios.
    const usuario = normalizar(username);
    const correo = normalizar(email);
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

    const correo = normalizar(email);
    const claveEmail = `email:${correo}`;
    const claveIp = `ip:${req.ip}`;
    if (estaBloqueado(claveEmail, claveIp)) {
      return res.status(429).json({ success: false, message: 'Demasiados intentos fallidos. Inténtalo de nuevo más tarde' });
    }
    contarIntento(claveEmail);
    contarIntento(claveIp);

    const records = await runQuery(
      'MATCH (u:Usuario {email: $email}) RETURN u LIMIT 1',
      { email: correo }
    );
    if (records.length === 0) {
      return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
    }

    const node = records[0].get('u');
    const ok = await bcrypt.compare(password, node.properties.password);
    if (!ok) {
      return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
    }
    contadores.delete(claveEmail);
    liberarIntento(claveIp);

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
