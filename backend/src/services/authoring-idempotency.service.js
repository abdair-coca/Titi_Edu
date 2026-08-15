import prisma from '../prisma.js';
import { requestFingerprint } from './authoring.service.js';

const jsonValue = (value) => JSON.parse(JSON.stringify(value));

function sendStored(res, operation) {
  res.set('Idempotency-Replayed', 'true');
  return res.status(operation.httpStatus || 200).json(operation.response);
}

async function resolveExisting(req, res, fingerprint) {
  const actorKey = req.authoringPrincipal.actorKey;
  const idempotencyKey = req.get('Idempotency-Key');
  const existing = await prisma.operacionAutoria.findUnique({
    where: { actorKey_idempotencyKey: { actorKey, idempotencyKey } },
  });
  if (!existing) return false;
  if (existing.requestFingerprint !== fingerprint) {
    res.status(409).json({ success: false, message: 'Idempotency-Key ya fue usada con otra solicitud' });
    return true;
  }
  if (existing.estado === 'COMPLETADA' || existing.estado === 'FALLIDA') {
    sendStored(res, existing);
    return true;
  }
  res.status(409).json({ success: false, message: 'La operación idempotente sigue en curso' });
  return true;
}

export async function executeIdempotent(req, res, {
  accion,
  cursoId = null,
  contexto = null,
  fingerprintExtra = {},
}, mutation) {
  const idempotencyKey = req.get('Idempotency-Key');
  if (!idempotencyKey || idempotencyKey.length > 200) {
    return res.status(400).json({ success: false, message: 'Idempotency-Key es requerida y debe tener hasta 200 caracteres' });
  }
  const requestHash = requestFingerprint(req, fingerprintExtra);
  if (await resolveExisting(req, res, requestHash)) return;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const operation = await tx.operacionAutoria.create({
        data: {
          actorKey: req.authoringPrincipal.actorKey,
          idempotencyKey,
          accion,
          requestFingerprint: requestHash,
          contexto,
          usuarioId: req.authoringPrincipal.usuario.id,
          cursoId,
          tokenServicioId: req.authoringPrincipal.tokenServicio?.id || null,
        },
      });
      const outcome = await mutation(tx);
      const body = { success: true, data: outcome.data };
      const persistedBody = {
        success: true,
        data: outcome.persistedData === undefined ? outcome.data : outcome.persistedData,
      };
      await tx.operacionAutoria.update({
        where: { id: operation.id },
        data: { estado: 'COMPLETADA', httpStatus: outcome.status || 200, response: jsonValue(persistedBody) },
      });
      return { status: outcome.status || 200, body };
    });
    return res.status(result.status).json(result.body);
  } catch (err) {
    if (err?.code === 'P2002' && await resolveExisting(req, res, requestHash)) return;
    throw err;
  }
}

export function requireExpectedFingerprint(req, res, actualFingerprint) {
  const expected = req.body?.expectedFingerprint || req.get('If-Match');
  if (!expected) {
    res.status(428).json({ success: false, message: 'expectedFingerprint es requerido' });
    return false;
  }
  if (expected !== actualFingerprint) {
    res.status(412).json({ success: false, message: 'El recurso cambió desde la última lectura' });
    return false;
  }
  return true;
}
