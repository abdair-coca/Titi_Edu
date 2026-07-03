import prisma from '../prisma.js';

// El JWT lleva el id de Neo4j. En Postgres ese id vive en `Usuario.neoId`.
// Nunca usar req.user.id como usuarioId en queries Prisma.
export async function loadCurrentUser(req, res) {
  if (req.dbUser) return req.dbUser;
  const usuario = await prisma.usuario.findUnique({ where: { neoId: req.user.id } });
  if (!usuario) {
    res.status(401).json({ success: false, message: 'Usuario no encontrado' });
    return null;
  }
  req.dbUser = usuario;
  return usuario;
}

export function requireRole(...roles) {
  return async (req, res, next) => {
    try {
      const usuario = await loadCurrentUser(req, res);
      if (!usuario) return;
      if (!roles.includes(usuario.rol)) {
        return res.status(403).json({ success: false, message: 'No tienes permiso para esta acción' });
      }
      next();
    } catch (err) {
      console.error('requireRole error', err);
      res.status(500).json({ success: false, message: 'Error verificando permisos' });
    }
  };
}

export function isOwnerOrAdmin(usuario, creadorId) {
  return usuario.rol === 'ADMIN' || usuario.id === creadorId;
}
