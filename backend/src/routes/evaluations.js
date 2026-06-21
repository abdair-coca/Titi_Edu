import { Router } from 'express';
import prisma from '../prisma.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { actualizarRacha, checkCursoCompletado } from '../services/progress.service.js';
import { checkLogrosEvaluacion } from '../services/achievement.service.js';
import { otorgarGotas } from '../services/gotas.service.js';
import { avanzarMisiones } from '../services/mision.service.js';

const router = Router();

const TIPOS_VALIDOS = ['OPCION_MULTIPLE', 'VERDADERO_FALSO', 'RESPUESTA_CORTA'];

// --- Helpers (mismo patrón que routes/courses.js) ---

// El JWT actual lleva el id de Neo4j. En Postgres ese id vive en `Usuario.neoId`.
async function loadCurrentUser(req, res) {
  if (req.dbUser) return req.dbUser;
  const usuario = await prisma.usuario.findUnique({
    where: { neoId: req.user.id },
  });
  if (!usuario) {
    res.status(401).json({ success: false, message: 'Usuario no encontrado' });
    return null;
  }
  req.dbUser = usuario;
  return usuario;
}

/** Normaliza texto para comparar respuestas cortas: trim, minúsculas, sin tildes, espacios colapsados. */
const DIACRITICS_RE = new RegExp('[\\u0300-\\u036f]', 'g');
function normalizeAnswer(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(DIACRITICS_RE, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Valida el array de preguntas del payload de creación/edición.
 * @returns string con el error, o null si es válido.
 */
function validatePreguntas(preguntas) {
  if (!Array.isArray(preguntas) || preguntas.length === 0) {
    return 'La evaluación debe tener al menos una pregunta';
  }
  for (let i = 0; i < preguntas.length; i++) {
    const p = preguntas[i];
    const n = i + 1;
    if (!p?.texto || !String(p.texto).trim()) {
      return `La pregunta ${n} no tiene texto`;
    }
    if (!TIPOS_VALIDOS.includes(p.tipo)) {
      return `La pregunta ${n} tiene un tipo inválido`;
    }
    const opciones = Array.isArray(p.opciones) ? p.opciones : [];
    if (opciones.some((o) => !o?.texto || !String(o.texto).trim())) {
      return `La pregunta ${n} tiene opciones sin texto`;
    }
    const correctas = opciones.filter((o) => o.esCorrecta).length;

    if (p.tipo === 'OPCION_MULTIPLE') {
      if (opciones.length < 2) return `La pregunta ${n} necesita al menos 2 opciones`;
      if (correctas !== 1) return `La pregunta ${n} debe tener exactamente una opción correcta`;
    } else if (p.tipo === 'VERDADERO_FALSO') {
      if (opciones.length !== 2) return `La pregunta ${n} (V/F) debe tener exactamente 2 opciones`;
      if (correctas !== 1) return `La pregunta ${n} (V/F) debe tener una opción correcta`;
    } else if (p.tipo === 'RESPUESTA_CORTA') {
      if (opciones.length < 1) return `La pregunta ${n} necesita al menos una respuesta aceptada`;
    }
  }
  return null;
}

/** Arma el `data.preguntas.create` anidado de Prisma desde el payload. */
function buildPreguntasCreate(preguntas) {
  return preguntas.map((p, i) => ({
    texto: String(p.texto).trim(),
    tipo: p.tipo,
    orden: i + 1,
    opciones: {
      create: p.opciones.map((o) => ({
        texto: String(o.texto).trim(),
        // En RESPUESTA_CORTA todas las opciones son respuestas aceptadas
        esCorrecta: p.tipo === 'RESPUESTA_CORTA' ? true : Boolean(o.esCorrecta),
      })),
    },
  }));
}

/** Parsea intentosMax / notaMinima opcionales del body. @returns {error} o {data} */
function parseEvalConfig(body) {
  const data = {};
  if (body.intentosMax !== undefined) {
    const n = Number(body.intentosMax);
    if (!Number.isInteger(n) || n < 1 || n > 10) {
      return { error: 'intentosMax debe ser un entero entre 1 y 10' };
    }
    data.intentosMax = n;
  }
  if (body.notaMinima !== undefined) {
    const n = Number(body.notaMinima);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      return { error: 'notaMinima debe ser un número entre 0 y 100' };
    }
    data.notaMinima = n;
  }
  return { data };
}

const EVAL_INCLUDE = {
  preguntas: {
    orderBy: { orden: 'asc' },
    include: { opciones: true },
  },
};

/** Carga una evaluación con curso asociado (vía módulo o cursoId directo). */
async function loadEvaluacion(id) {
  const ev = await prisma.evaluacion.findUnique({
    where: { id },
    include: {
      ...EVAL_INCLUDE,
      modulo: { select: { id: true, titulo: true, cursoId: true } },
    },
  });
  if (!ev) return null;
  const cursoId = ev.modulo ? ev.modulo.cursoId : ev.cursoId;
  const curso = cursoId
    ? await prisma.curso.findUnique({
        where: { id: cursoId },
        select: { id: true, titulo: true, creadorId: true },
      })
    : null;
  return { ev, curso };
}

/** Serializa la evaluación para el estudiante: sin esCorrecta, sin opciones en RESPUESTA_CORTA. */
function publicEvaluacion(ev) {
  return {
    id: ev.id,
    titulo: ev.titulo,
    esFinal: ev.esFinal,
    intentosMax: ev.intentosMax,
    notaMinima: ev.notaMinima,
    moduloId: ev.moduloId,
    cursoId: ev.cursoId,
    modulo: ev.modulo ? { id: ev.modulo.id, titulo: ev.modulo.titulo } : null,
    preguntas: ev.preguntas.map((p) => ({
      id: p.id,
      texto: p.texto,
      tipo: p.tipo,
      orden: p.orden,
      opciones:
        p.tipo === 'RESPUESTA_CORTA'
          ? []
          : p.opciones.map((o) => ({ id: o.id, texto: o.texto })),
    })),
  };
}

// ---- POST /api/modules/:id/evaluation — crear evaluación de módulo (autor) ----
router.post('/modules/:id/evaluation', requireAuth, async (req, res) => {
  try {
    const usuario = await loadCurrentUser(req, res);
    if (!usuario) return;

    const modulo = await prisma.modulo.findUnique({
      where: { id: req.params.id },
      include: {
        curso: { select: { creadorId: true } },
        evaluacion: { select: { id: true } },
      },
    });
    if (!modulo) {
      return res.status(404).json({ success: false, message: 'Módulo no encontrado' });
    }
    if (modulo.curso.creadorId !== usuario.id) {
      return res.status(403).json({
        success: false,
        message: 'Solo el autor del curso puede crear la evaluación',
      });
    }
    if (modulo.evaluacion) {
      return res.status(409).json({
        success: false,
        message: 'Este módulo ya tiene una evaluación. Editala o borrala primero.',
      });
    }

    const { titulo, preguntas } = req.body || {};
    if (!titulo || !String(titulo).trim()) {
      return res.status(400).json({ success: false, message: 'titulo es requerido' });
    }
    const pregError = validatePreguntas(preguntas);
    if (pregError) {
      return res.status(400).json({ success: false, message: pregError });
    }
    const cfg = parseEvalConfig(req.body);
    if (cfg.error) {
      return res.status(400).json({ success: false, message: cfg.error });
    }

    const evaluacion = await prisma.evaluacion.create({
      data: {
        titulo: String(titulo).trim(),
        moduloId: modulo.id,
        esFinal: false,
        ...cfg.data,
        preguntas: { create: buildPreguntasCreate(preguntas) },
      },
      include: EVAL_INCLUDE,
    });

    res.status(201).json({ success: true, data: { evaluacion } });
  } catch (err) {
    console.error('POST /modules/:id/evaluation error', err);
    res.status(500).json({ success: false, message: 'Error creando evaluación' });
  }
});

// ---- POST /api/courses/:id/final-evaluation — crear evaluación final (autor) ----
router.post('/courses/:id/final-evaluation', requireAuth, async (req, res) => {
  try {
    const usuario = await loadCurrentUser(req, res);
    if (!usuario) return;

    const curso = await prisma.curso.findUnique({
      where: { id: req.params.id },
      select: { id: true, creadorId: true },
    });
    if (!curso) {
      return res.status(404).json({ success: false, message: 'Curso no encontrado' });
    }
    if (curso.creadorId !== usuario.id) {
      return res.status(403).json({
        success: false,
        message: 'Solo el autor del curso puede crear la evaluación final',
      });
    }

    const existente = await prisma.evaluacion.findFirst({
      where: { cursoId: curso.id, esFinal: true },
      select: { id: true },
    });
    if (existente) {
      return res.status(409).json({
        success: false,
        message: 'Este curso ya tiene evaluación final. Editala o borrala primero.',
      });
    }

    const { titulo, preguntas } = req.body || {};
    if (!titulo || !String(titulo).trim()) {
      return res.status(400).json({ success: false, message: 'titulo es requerido' });
    }
    const pregError = validatePreguntas(preguntas);
    if (pregError) {
      return res.status(400).json({ success: false, message: pregError });
    }
    const cfg = parseEvalConfig(req.body);
    if (cfg.error) {
      return res.status(400).json({ success: false, message: cfg.error });
    }

    const evaluacion = await prisma.evaluacion.create({
      data: {
        titulo: String(titulo).trim(),
        cursoId: curso.id,
        esFinal: true,
        ...cfg.data,
        preguntas: { create: buildPreguntasCreate(preguntas) },
      },
      include: EVAL_INCLUDE,
    });

    res.status(201).json({ success: true, data: { evaluacion } });
  } catch (err) {
    console.error('POST /courses/:id/final-evaluation error', err);
    res.status(500).json({ success: false, message: 'Error creando evaluación final' });
  }
});

// ---- GET /api/modules/:id/evaluation — evaluación del módulo (completa si sos el autor) ----
router.get('/modules/:id/evaluation', optionalAuth, async (req, res) => {
  try {
    const modulo = await prisma.modulo.findUnique({
      where: { id: req.params.id },
      include: {
        curso: { select: { creadorId: true } },
        evaluacion: { include: EVAL_INCLUDE },
      },
    });
    if (!modulo) {
      return res.status(404).json({ success: false, message: 'Módulo no encontrado' });
    }
    if (!modulo.evaluacion) {
      return res.status(404).json({ success: false, message: 'Este módulo no tiene evaluación' });
    }

    let esAutor = false;
    if (req.user) {
      const usuario = await prisma.usuario.findUnique({ where: { neoId: req.user.id } });
      esAutor = Boolean(usuario && usuario.id === modulo.curso.creadorId);
    }

    res.json({
      success: true,
      data: { evaluacion: esAutor ? modulo.evaluacion : publicEvaluacion(modulo.evaluacion) },
    });
  } catch (err) {
    console.error('GET /modules/:id/evaluation error', err);
    res.status(500).json({ success: false, message: 'Error obteniendo evaluación' });
  }
});

// ---- GET /api/courses/:id/final-evaluation — evaluación final del curso ----
router.get('/courses/:id/final-evaluation', optionalAuth, async (req, res) => {
  try {
    const curso = await prisma.curso.findUnique({
      where: { id: req.params.id },
      select: { id: true, creadorId: true },
    });
    if (!curso) {
      return res.status(404).json({ success: false, message: 'Curso no encontrado' });
    }

    const evaluacion = await prisma.evaluacion.findFirst({
      where: { cursoId: curso.id, esFinal: true },
      include: EVAL_INCLUDE,
    });
    if (!evaluacion) {
      return res.status(404).json({ success: false, message: 'Este curso no tiene evaluación final' });
    }

    let esAutor = false;
    if (req.user) {
      const usuario = await prisma.usuario.findUnique({ where: { neoId: req.user.id } });
      esAutor = Boolean(usuario && usuario.id === curso.creadorId);
    }

    res.json({
      success: true,
      data: { evaluacion: esAutor ? evaluacion : publicEvaluacion(evaluacion) },
    });
  } catch (err) {
    console.error('GET /courses/:id/final-evaluation error', err);
    res.status(500).json({ success: false, message: 'Error obteniendo evaluación final' });
  }
});

// ---- GET /api/evaluations/:id — detalle (sin respuestas correctas para estudiantes) ----
router.get('/evaluations/:id', optionalAuth, async (req, res) => {
  try {
    const loaded = await loadEvaluacion(req.params.id);
    if (!loaded) {
      return res.status(404).json({ success: false, message: 'Evaluación no encontrada' });
    }
    const { ev, curso } = loaded;

    let esAutor = false;
    if (req.user && curso) {
      const usuario = await prisma.usuario.findUnique({ where: { neoId: req.user.id } });
      esAutor = Boolean(usuario && usuario.id === curso.creadorId);
    }

    res.json({
      success: true,
      data: {
        evaluacion: esAutor ? ev : publicEvaluacion(ev),
        curso: curso ? { id: curso.id, titulo: curso.titulo } : null,
      },
    });
  } catch (err) {
    console.error('GET /evaluations/:id error', err);
    res.status(500).json({ success: false, message: 'Error obteniendo evaluación' });
  }
});

// ---- PUT /api/evaluations/:id — editar (autor; reemplaza las preguntas) ----
router.put('/evaluations/:id', requireAuth, async (req, res) => {
  try {
    const usuario = await loadCurrentUser(req, res);
    if (!usuario) return;

    const loaded = await loadEvaluacion(req.params.id);
    if (!loaded) {
      return res.status(404).json({ success: false, message: 'Evaluación no encontrada' });
    }
    const { ev, curso } = loaded;
    if (!curso || curso.creadorId !== usuario.id) {
      return res.status(403).json({
        success: false,
        message: 'Solo el autor del curso puede editar la evaluación',
      });
    }

    const { titulo, preguntas } = req.body || {};
    if (!titulo || !String(titulo).trim()) {
      return res.status(400).json({ success: false, message: 'titulo es requerido' });
    }
    const pregError = validatePreguntas(preguntas);
    if (pregError) {
      return res.status(400).json({ success: false, message: pregError });
    }
    const cfg = parseEvalConfig(req.body);
    if (cfg.error) {
      return res.status(400).json({ success: false, message: cfg.error });
    }

    const evaluacion = await prisma.$transaction(async (tx) => {
      await tx.opcion.deleteMany({ where: { pregunta: { evaluacionId: ev.id } } });
      await tx.pregunta.deleteMany({ where: { evaluacionId: ev.id } });
      return tx.evaluacion.update({
        where: { id: ev.id },
        data: {
          titulo: String(titulo).trim(),
          ...cfg.data,
          preguntas: { create: buildPreguntasCreate(preguntas) },
        },
        include: EVAL_INCLUDE,
      });
    });

    res.json({ success: true, data: { evaluacion } });
  } catch (err) {
    console.error('PUT /evaluations/:id error', err);
    res.status(500).json({ success: false, message: 'Error editando evaluación' });
  }
});

// ---- DELETE /api/evaluations/:id — borrar + cascada (autor) ----
router.delete('/evaluations/:id', requireAuth, async (req, res) => {
  try {
    const usuario = await loadCurrentUser(req, res);
    if (!usuario) return;

    const loaded = await loadEvaluacion(req.params.id);
    if (!loaded) {
      return res.status(404).json({ success: false, message: 'Evaluación no encontrada' });
    }
    const { ev, curso } = loaded;
    if (!curso || curso.creadorId !== usuario.id) {
      return res.status(403).json({
        success: false,
        message: 'Solo el autor del curso puede borrar la evaluación',
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.intento.deleteMany({ where: { evaluacionId: ev.id } });
      await tx.opcion.deleteMany({ where: { pregunta: { evaluacionId: ev.id } } });
      await tx.pregunta.deleteMany({ where: { evaluacionId: ev.id } });
      await tx.evaluacion.delete({ where: { id: ev.id } });
    });

    res.json({ success: true, data: { deleted: ev.id } });
  } catch (err) {
    console.error('DELETE /evaluations/:id error', err);
    res.status(500).json({ success: false, message: 'Error borrando evaluación' });
  }
});

// ---- POST /api/evaluations/:id/attempt — responder un intento (inscriptos) ----
router.post('/evaluations/:id/attempt', requireAuth, async (req, res) => {
  try {
    const usuario = await loadCurrentUser(req, res);
    if (!usuario) return;

    const loaded = await loadEvaluacion(req.params.id);
    if (!loaded) {
      return res.status(404).json({ success: false, message: 'Evaluación no encontrada' });
    }
    const { ev, curso } = loaded;
    if (!curso) {
      return res.status(404).json({ success: false, message: 'Curso de la evaluación no encontrado' });
    }

    const inscripcion = await prisma.inscripcion.findUnique({
      where: { usuarioId_cursoId: { usuarioId: usuario.id, cursoId: curso.id } },
    });
    if (!inscripcion) {
      return res.status(403).json({
        success: false,
        message: 'Debes estar inscrito en el curso para rendir esta evaluación',
      });
    }

    const intentosPrevios = await prisma.intento.findMany({
      where: { usuarioId: usuario.id, evaluacionId: ev.id },
    });
    if (intentosPrevios.some((i) => i.aprobado)) {
      return res.status(409).json({
        success: false,
        message: 'Ya aprobaste esta evaluación',
      });
    }
    if (intentosPrevios.length >= ev.intentosMax) {
      return res.status(403).json({
        success: false,
        message: `Alcanzaste el máximo de ${ev.intentosMax} intentos. Contactá a tu profesor.`,
      });
    }

    const respuestas = Array.isArray(req.body?.respuestas) ? req.body.respuestas : [];
    const respuestaPorPregunta = new Map(
      respuestas.filter((r) => r?.preguntaId).map((r) => [r.preguntaId, r]),
    );

    // Calificación server-side
    let correctas = 0;
    const detalle = ev.preguntas.map((p) => {
      const r = respuestaPorPregunta.get(p.id);
      let correcta = false;
      if (r) {
        if (p.tipo === 'RESPUESTA_CORTA') {
          const texto = normalizeAnswer(r.texto);
          correcta =
            texto.length > 0 &&
            p.opciones.some((o) => o.esCorrecta && normalizeAnswer(o.texto) === texto);
        } else {
          const opcion = p.opciones.find((o) => o.id === r.opcionId);
          correcta = Boolean(opcion?.esCorrecta);
        }
      }
      if (correcta) correctas += 1;
      return { preguntaId: p.id, correcta };
    });

    const total = ev.preguntas.length;
    const nota = total === 0 ? 0 : Math.round((correctas / total) * 100);
    const aprobado = nota >= ev.notaMinima;

    const intento = await prisma.intento.create({
      data: {
        usuarioId: usuario.id,
        evaluacionId: ev.id,
        numero: intentosPrevios.length + 1,
        nota,
        aprobado,
      },
    });

    const intentosRestantes = Math.max(0, ev.intentosMax - intento.numero);

    let racha = null;
    let logros = [];
    let cursoCompletado = null;
    let gotas = 0;

    if (aprobado) {
      racha = await actualizarRacha(usuario.id);
      logros = await checkLogrosEvaluacion(usuario.id, {
        nota,
        racha: racha?.racha ?? 0,
      });
      cursoCompletado = await checkCursoCompletado(usuario.id, curso.id);
      if (cursoCompletado?.logros?.length) {
        logros.push(...cursoCompletado.logros);
      }
      // Gotas: +20 por la evaluación (idempotente por evaluacionId) y +50 si recién completó el curso.
      gotas += (await otorgarGotas(usuario.id, 'evaluacion', { refId: ev.id })).otorgadas;
      if (cursoCompletado?.nuevo) {
        gotas += (await otorgarGotas(usuario.id, 'curso', { refId: curso.id })).otorgadas;
      }
      await avanzarMisiones(usuario.id, 'evaluacion');
    }

    res.status(201).json({
      success: true,
      data: {
        intento: {
          id: intento.id,
          numero: intento.numero,
          nota: intento.nota,
          aprobado: intento.aprobado,
        },
        correctas,
        total,
        detalle,
        intentosRestantes,
        bloqueado: !aprobado && intentosRestantes === 0,
        racha,
        logros,
        gotas,
        cursoCompletado: cursoCompletado?.completado
          ? {
              nuevo: Boolean(cursoCompletado.nuevo),
              certificado: cursoCompletado.certificado
                ? {
                    id: cursoCompletado.certificado.id,
                    codigoVerif: cursoCompletado.certificado.codigoVerif,
                  }
                : null,
            }
          : null,
      },
    });
  } catch (err) {
    console.error('POST /evaluations/:id/attempt error', err);
    res.status(500).json({ success: false, message: 'Error registrando el intento' });
  }
});

// ---- GET /api/evaluations/:id/my-attempts — mis intentos ----
router.get('/evaluations/:id/my-attempts', requireAuth, async (req, res) => {
  try {
    const usuario = await loadCurrentUser(req, res);
    if (!usuario) return;

    const ev = await prisma.evaluacion.findUnique({
      where: { id: req.params.id },
      select: { id: true, intentosMax: true, notaMinima: true },
    });
    if (!ev) {
      return res.status(404).json({ success: false, message: 'Evaluación no encontrada' });
    }

    const intentos = await prisma.intento.findMany({
      where: { usuarioId: usuario.id, evaluacionId: ev.id },
      orderBy: { numero: 'asc' },
      select: { id: true, numero: true, nota: true, aprobado: true, fechaIntento: true },
    });

    const aprobado = intentos.some((i) => i.aprobado);
    const intentosRestantes = Math.max(0, ev.intentosMax - intentos.length);

    res.json({
      success: true,
      data: {
        intentos,
        aprobado,
        intentosRestantes,
        bloqueado: !aprobado && intentosRestantes === 0,
        intentosMax: ev.intentosMax,
        notaMinima: ev.notaMinima,
      },
    });
  } catch (err) {
    console.error('GET /evaluations/:id/my-attempts error', err);
    res.status(500).json({ success: false, message: 'Error obteniendo intentos' });
  }
});

export default router;
