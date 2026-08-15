import jwt from 'jsonwebtoken';
import prisma from '../prisma.js';
import { matchesTokenHash, parseServiceToken } from '../services/authoring.service.js';

function bearerToken(req) {
  const value = req.headers.authorization;
  if (!value || !value.startsWith('Bearer ')) return null;
  return value.slice(7);
}

function authorCanWrite(usuario) {
  return usuario?.rol === 'ADMIN' || (usuario?.rol === 'PROFESOR' && usuario.verificado);
}

async function authenticateJwt(token) {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const usuario = await prisma.usuario.findUnique({ where: { neoId: decoded.id } });
  if (!usuario) return null;
  return { kind: 'jwt', actorKey: `user:${usuario.id}`, usuario, tokenServicio: null };
}

async function authenticateServiceToken(token, scope) {
  if (process.env.AUTHORING_API_ENABLED !== 'true') return null;
  const parsed = parseServiceToken(token);
  if (!parsed) return null;
  const tokenServicio = await prisma.tokenServicio.findUnique({
    where: { prefijo: parsed.prefijo },
    include: { usuario: true },
  });
  if (!tokenServicio || !matchesTokenHash(token, tokenServicio.tokenHash)) return null;
  if (tokenServicio.revokedAt || tokenServicio.expiresAt.getTime() <= Date.now()) return null;
  if (scope && !tokenServicio.scopes.includes(scope)) return { forbidden: true };
  if (!authorCanWrite(tokenServicio.usuario)) return { forbidden: true };
  await prisma.tokenServicio.update({
    where: { id: tokenServicio.id },
    data: { lastUsedAt: new Date() },
  });
  return {
    kind: 'service',
    actorKey: `service:${tokenServicio.id}`,
    usuario: tokenServicio.usuario,
    tokenServicio,
  };
}

export function requireAuthoringPrincipal(scope) {
  return async (req, res, next) => {
    const token = bearerToken(req);
    if (!token) return res.status(401).json({ success: false, message: 'No autorizado' });
    try {
      const principal = token.startsWith('titi_svc_')
        ? await authenticateServiceToken(token, scope)
        : await authenticateJwt(token);
      if (principal?.forbidden) {
        return res.status(403).json({ success: false, message: 'El principal no tiene el scope o rol requerido' });
      }
      if (!principal) return res.status(401).json({ success: false, message: 'Token inválido o inactivo' });
      if (!authorCanWrite(principal.usuario)) {
        return res.status(403).json({ success: false, message: 'Solo autores verificados o administradores pueden usar autoría' });
      }
      req.authoringPrincipal = principal;
      req.dbUser = principal.usuario;
      next();
    } catch {
      return res.status(401).json({ success: false, message: 'Token inválido o inactivo' });
    }
  };
}

export function requireAuthoringJwt(req, res, next) {
  if (req.authoringPrincipal?.kind !== 'jwt') {
    return res.status(403).json({ success: false, message: 'Esta operación requiere una sesión de usuario' });
  }
  next();
}
