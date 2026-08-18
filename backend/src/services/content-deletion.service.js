import { fingerprint } from './authoring.service.js';

function ids(values) {
  return values.map((value) => value.id);
}

function emptyImpact() {
  return {
    modulos: 0,
    lecciones: 0,
    materiales: 0,
    recursosHtml: 0,
    intentosHtml: 0,
    resultadosHtml: 0,
    revisionesLeccion: 0,
    progresos: 0,
    notasLeccion: 0,
    comentariosLeccion: 0,
    evaluaciones: 0,
    preguntas: 0,
    opciones: 0,
    intentosEvaluacion: 0,
    inscripciones: 0,
    certificadosPreservados: 0,
    profesoresAsignados: 0,
  };
}

export async function collectDeletionDependencies(client, { kind, resourceId }) {
  const moduleWhere = kind === 'course'
    ? { cursoId: resourceId }
    : kind === 'module'
      ? { id: resourceId }
      : { lecciones: { some: { id: resourceId } } };
  const modules = await client.modulo.findMany({
    where: moduleWhere,
    select: { id: true, evaluacion: { select: { id: true } }, lecciones: { select: { id: true } } },
  });
  const moduleIds = ids(modules);
  const lessonIds = kind === 'lesson'
    ? [resourceId]
    : modules.flatMap((module) => ids(module.lecciones));
  const moduleEvaluationIds = modules.flatMap((module) => module.evaluacion ? [module.evaluacion.id] : []);
  const finalEvaluations = kind === 'course'
    ? await client.evaluacion.findMany({ where: { cursoId: resourceId }, select: { id: true } })
    : [];
  const evaluationIds = [...moduleEvaluationIds, ...ids(finalEvaluations)];
  const htmlResources = lessonIds.length
    ? await client.recursoHtmlLeccion.findMany({ where: { leccionId: { in: lessonIds } }, select: { id: true } })
    : [];
  const htmlResourceIds = ids(htmlResources);
  const questions = evaluationIds.length
    ? await client.pregunta.findMany({ where: { evaluacionId: { in: evaluationIds } }, select: { id: true } })
    : [];
  const questionIds = ids(questions);
  const [
    materiales, intentosHtml, resultadosHtml, revisionesLeccion, progresos, notasLeccion,
    comentariosLeccion, opciones, intentosEvaluacion, inscripciones, certificados, profesoresAsignados,
  ] = await Promise.all([
    lessonIds.length ? client.material.count({ where: { leccionId: { in: lessonIds } } }) : 0,
    htmlResourceIds.length ? client.intentoHtmlLeccion.count({ where: { recursoHtmlId: { in: htmlResourceIds } } }) : 0,
    htmlResourceIds.length ? client.resultadoHtmlLeccion.count({ where: { recursoHtmlId: { in: htmlResourceIds } } }) : 0,
    lessonIds.length ? client.revisionLeccion.count({ where: { leccionId: { in: lessonIds } } }) : 0,
    lessonIds.length ? client.progreso.count({ where: { leccionId: { in: lessonIds } } }) : 0,
    lessonIds.length ? client.notaLeccion.count({ where: { leccionId: { in: lessonIds } } }) : 0,
    lessonIds.length ? client.comentarioLeccion.count({ where: { leccionId: { in: lessonIds } } }) : 0,
    questionIds.length ? client.opcion.count({ where: { preguntaId: { in: questionIds } } }) : 0,
    evaluationIds.length ? client.intento.count({ where: { evaluacionId: { in: evaluationIds } } }) : 0,
    kind === 'course' ? client.inscripcion.count({ where: { cursoId: resourceId } }) : 0,
    kind === 'course' ? client.certificado.count({ where: { cursoId: resourceId } }) : 0,
    kind === 'course' ? client.cursoProfesor.count({ where: { cursoId: resourceId } }) : 0,
  ]);

  return {
    kind,
    resourceId,
    moduleIds,
    lessonIds,
    evaluationIds,
    questionIds,
    htmlResourceIds,
    impact: {
      ...emptyImpact(),
      modulos: kind === 'course' ? moduleIds.length : kind === 'module' ? 1 : 0,
      lecciones: lessonIds.length,
      materiales,
      recursosHtml: htmlResourceIds.length,
      intentosHtml,
      resultadosHtml,
      revisionesLeccion,
      progresos,
      notasLeccion,
      comentariosLeccion,
      evaluaciones: evaluationIds.length,
      preguntas: questionIds.length,
      opciones,
      intentosEvaluacion,
      inscripciones,
      certificadosPreservados: certificados,
      profesoresAsignados,
    },
  };
}

export function deletionFingerprint(kind, resourceFingerprint, impact) {
  return fingerprint({ kind, resource: resourceFingerprint, impact });
}

export async function deleteDeletionDependencies(tx, dependencies) {
  const { kind, resourceId, moduleIds, lessonIds, evaluationIds, questionIds, htmlResourceIds } = dependencies;

  if (htmlResourceIds.length) {
    await tx.resultadoHtmlLeccion.deleteMany({ where: { recursoHtmlId: { in: htmlResourceIds } } });
    await tx.intentoHtmlLeccion.deleteMany({ where: { recursoHtmlId: { in: htmlResourceIds } } });
    await tx.recursoHtmlLeccion.deleteMany({ where: { id: { in: htmlResourceIds } } });
  }
  if (lessonIds.length) {
    await tx.material.deleteMany({ where: { leccionId: { in: lessonIds } } });
    await tx.revisionLeccion.deleteMany({ where: { leccionId: { in: lessonIds } } });
    await tx.progreso.deleteMany({ where: { leccionId: { in: lessonIds } } });
    await tx.notaLeccion.deleteMany({ where: { leccionId: { in: lessonIds } } });
    await tx.comentarioLeccion.deleteMany({ where: { leccionId: { in: lessonIds } } });
  }
  if (questionIds.length) await tx.opcion.deleteMany({ where: { preguntaId: { in: questionIds } } });
  if (evaluationIds.length) {
    await tx.intento.deleteMany({ where: { evaluacionId: { in: evaluationIds } } });
    await tx.pregunta.deleteMany({ where: { evaluacionId: { in: evaluationIds } } });
    await tx.evaluacion.deleteMany({ where: { id: { in: evaluationIds } } });
  }
  if (lessonIds.length) await tx.leccion.deleteMany({ where: { id: { in: lessonIds } } });
  if (kind === 'module') await tx.modulo.delete({ where: { id: resourceId } });
  if (kind === 'course') {
    if (moduleIds.length) await tx.modulo.deleteMany({ where: { id: { in: moduleIds } } });
    await tx.inscripcion.deleteMany({ where: { cursoId: resourceId } });
    await tx.certificado.updateMany({ where: { cursoId: resourceId }, data: { cursoId: null } });
    await tx.cursoProfesor.deleteMany({ where: { cursoId: resourceId } });
    await tx.operacionAutoria.updateMany({ where: { cursoId: resourceId }, data: { cursoId: null } });
    await tx.curso.delete({ where: { id: resourceId } });
  }
}

export async function cleanupDeletedCourseInNeo4j(runQuery, courseId) {
  try {
    await runQuery('MATCH (curso:CursoRef {cursoId: $courseId}) DETACH DELETE curso', { courseId });
  } catch (err) {
    console.error('Course deletion Neo4j cleanup failed', { courseId, message: err.message });
  }
}
