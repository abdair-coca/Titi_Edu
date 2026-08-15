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

// Variante para rutas con optionalAuth: usuario de Postgres o null, sin tocar la respuesta.
export async function loadOptionalUser(req) {
  if (!req.user) return null;
  if (req.dbUser) return req.dbUser;
  const usuario = await prisma.usuario.findUnique({ where: { neoId: req.user.id } });
  req.dbUser = usuario || null;
  return req.dbUser;
}

// Acceso centralizado a contenido educativo. ADMIN y docentes del curso pueden
// previsualizar borradores; estudiantes requieren curso/módulo publicados e inscripción.
export async function ensureCourseContentAccess(req, res, cursoId, { moduleState = null } = {}) {
  const usuario = await loadCurrentUser(req, res);
  if (!usuario) return null;

  const curso = await prisma.curso.findUnique({
    where: { id: cursoId },
    select: {
      creadorId: true,
      publicado: true,
      profesores: { where: { profesorId: usuario.id }, select: { profesorId: true } },
    },
  });
  if (!curso) {
    res.status(404).json({ success: false, message: 'Curso no encontrado' });
    return null;
  }

  if (usuario.rol === 'ADMIN') {
    return { usuario, isOwner: false, isAdmin: true, enrolled: false, course: curso };
  }

  const isOwner = Boolean(curso) && (curso.creadorId === usuario.id || curso.profesores.length > 0);
  if (isOwner) {
    return { usuario, isOwner: true, isAdmin: false, enrolled: false, course: curso };
  }

  if (!curso.publicado || (moduleState !== null && moduleState !== 'PUBLICADO')) {
    res.status(404).json({ success: false, message: 'Contenido no encontrado' });
    return null;
  }

  const inscripcion = await prisma.inscripcion.findUnique({
    where: { usuarioId_cursoId: { usuarioId: usuario.id, cursoId } },
  });
  if (!inscripcion) {
    res.status(403).json({
      success: false,
      message: 'Necesitás inscribirte en el curso para ver este contenido',
    });
    return null;
  }
  return { usuario, isOwner: false, isAdmin: false, enrolled: true, course: curso };
}
