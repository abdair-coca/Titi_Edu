import { createHash } from 'crypto';
import { pathToFileURL } from 'url';
import prisma from '../src/prisma.js';

const HISTORICAL_SCORE = 100;

export function historicalAttemptToken(inscripcionId, recursoHtmlId) {
  return createHash('sha256')
    .update(`titi-historical-grade-repair:${inscripcionId}:${recursoHtmlId}`)
    .digest('base64url');
}

function repairSummary(plan, mode) {
  return {
    mode,
    completedEnrollments: plan.completedEnrollments,
    quizAttemptsCreated: plan.quizAttempts.length,
    htmlResultsCreated: plan.htmlResults.length,
  };
}

export async function buildRepairPlan(client) {
  const inscripciones = await client.inscripcion.findMany({
    where: { completado: true },
    select: {
      id: true,
      usuarioId: true,
      cursoId: true,
      curso: {
        select: {
          modulos: {
            select: {
              evaluacion: { select: { id: true } },
              lecciones: { select: { recursoHtml: { select: { id: true, evaluable: true } } } },
            },
          },
        },
      },
    },
  });
  if (inscripciones.length === 0) {
    return { completedEnrollments: 0, quizAttempts: [], htmlResults: [] };
  }

  const usuarioIds = [...new Set(inscripciones.map((inscripcion) => inscripcion.usuarioId))];
  const cursoIds = [...new Set(inscripciones.map((inscripcion) => inscripcion.cursoId))];
  const finales = await client.evaluacion.findMany({
    where: { cursoId: { in: cursoIds }, esFinal: true },
    select: { id: true, cursoId: true },
  });
  const finalesPorCurso = new Map();
  for (const evaluacion of finales) {
    const current = finalesPorCurso.get(evaluacion.cursoId) || [];
    current.push(evaluacion.id);
    finalesPorCurso.set(evaluacion.cursoId, current);
  }

  const quizTargets = inscripciones.flatMap((inscripcion) => [
    ...inscripcion.curso.modulos.flatMap((modulo) => modulo.evaluacion ? [modulo.evaluacion.id] : []),
    ...(finalesPorCurso.get(inscripcion.cursoId) || []),
  ].map((evaluacionId) => ({ inscripcion, evaluacionId })));
  const evaluacionIds = [...new Set(quizTargets.map((target) => target.evaluacionId))];
  const intentos = evaluacionIds.length > 0
    ? await client.intento.findMany({
        where: { usuarioId: { in: usuarioIds }, evaluacionId: { in: evaluacionIds } },
        select: { usuarioId: true, evaluacionId: true },
      })
    : [];
  const intentoKeys = new Set(intentos.map((intento) => `${intento.usuarioId}:${intento.evaluacionId}`));
  const quizAttempts = quizTargets
    .filter(({ inscripcion, evaluacionId }) => !intentoKeys.has(`${inscripcion.usuarioId}:${evaluacionId}`))
    .map(({ inscripcion, evaluacionId }) => ({
      usuarioId: inscripcion.usuarioId,
      evaluacionId,
      numero: 1,
      nota: HISTORICAL_SCORE,
      aprobado: true,
    }));

  const htmlTargets = inscripciones.flatMap((inscripcion) => inscripcion.curso.modulos
    .flatMap((modulo) => modulo.lecciones)
    .flatMap((leccion) => leccion.recursoHtml?.evaluable ? [{ inscripcion, recursoHtmlId: leccion.recursoHtml.id }] : []));
  const recursoHtmlIds = [...new Set(htmlTargets.map((target) => target.recursoHtmlId))];
  const resultados = recursoHtmlIds.length > 0
    ? await client.resultadoHtmlLeccion.findMany({
        where: { usuarioId: { in: usuarioIds }, recursoHtmlId: { in: recursoHtmlIds } },
        select: { usuarioId: true, recursoHtmlId: true },
      })
    : [];
  const resultadoKeys = new Set(resultados.map((resultado) => `${resultado.usuarioId}:${resultado.recursoHtmlId}`));
  const intentosHtml = recursoHtmlIds.length > 0
    ? await client.intentoHtmlLeccion.findMany({
        where: { usuarioId: { in: usuarioIds }, recursoHtmlId: { in: recursoHtmlIds } },
        select: { usuarioId: true, recursoHtmlId: true, numero: true },
      })
    : [];
  const nextNumeroPorResultado = new Map();
  for (const intento of intentosHtml) {
    const key = `${intento.usuarioId}:${intento.recursoHtmlId}`;
    nextNumeroPorResultado.set(key, Math.max(nextNumeroPorResultado.get(key) || 0, intento.numero));
  }
  const htmlResults = htmlTargets
    .filter(({ inscripcion, recursoHtmlId }) => !resultadoKeys.has(`${inscripcion.usuarioId}:${recursoHtmlId}`))
    .map(({ inscripcion, recursoHtmlId }) => {
      const key = `${inscripcion.usuarioId}:${recursoHtmlId}`;
      return {
        usuarioId: inscripcion.usuarioId,
        recursoHtmlId,
        numero: (nextNumeroPorResultado.get(key) || 0) + 1,
        token: historicalAttemptToken(inscripcion.id, recursoHtmlId),
      };
    });

  return { completedEnrollments: inscripciones.length, quizAttempts, htmlResults };
}

async function runSerializable(client, operation) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await client.$transaction(operation, {
        isolationLevel: 'Serializable',
        maxWait: 10_000,
        timeout: 30_000,
      });
    } catch (error) {
      lastError = error;
      if (error?.code !== 'P2034') throw error;
    }
  }
  throw lastError;
}

export async function runRepair({ apply = false, client = prisma } = {}) {
  if (!apply) {
    return repairSummary(await buildRepairPlan(client), 'dry-run');
  }

  return runSerializable(client, async (tx) => {
    const plan = await buildRepairPlan(tx);
    if (plan.quizAttempts.length > 0) {
      await tx.intento.createMany({ data: plan.quizAttempts });
    }
    for (const result of plan.htmlResults) {
      const intento = await tx.intentoHtmlLeccion.create({
        data: {
          token: result.token,
          numero: result.numero,
          puntaje: HISTORICAL_SCORE,
          resultadoAt: new Date(),
          usuarioId: result.usuarioId,
          recursoHtmlId: result.recursoHtmlId,
        },
      });
      await tx.resultadoHtmlLeccion.create({
        data: {
          usuarioId: result.usuarioId,
          recursoHtmlId: result.recursoHtmlId,
          mejorPuntaje: HISTORICAL_SCORE,
          intentoId: intento.id,
        },
      });
    }
    return repairSummary(plan, 'apply');
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--apply')) {
    throw new Error('Uso: node scripts/repair-completed-grades.js [--apply]');
  }
  const summary = await runRepair({ apply: args.includes('--apply') });
  console.log(JSON.stringify(summary));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .catch((error) => {
      console.error('Error reparando notas históricas:', error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
