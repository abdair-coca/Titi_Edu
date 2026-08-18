import { randomUUID } from 'node:crypto';
import { createHttpClient } from './http-client.js';
import { loadMaterialFile } from './files.js';
import { TitiApiError, safeError } from './errors.js';
import {
  attachMaterialSchema,
  courseIdSchema,
  createCourseSchema,
  createLessonSchema,
  createModuleSchema,
  deleteResourceSchema,
  emptySchema,
  evaluationIdSchema,
  moduleIdSchema,
  publishSchema,
  unpublishSchema,
  updateCourseSchema,
  updateLessonSchema,
  updateModuleSchema,
  upsertLessonHtmlSchema,
  upsertQuizSchema,
} from './schemas.js';

export const READ_ANNOTATIONS = Object.freeze({
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
});
export const DRAFT_WRITE_ANNOTATIONS = Object.freeze({
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
});
export const DESTRUCTIVE_WRITE_ANNOTATIONS = Object.freeze({
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: true,
});

function encoded(value) {
  return encodeURIComponent(value);
}

function without(value, keys) {
  return Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));
}

function successResult(data, meta = {}) {
  const result = { ...data, ...meta };
  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    structuredContent: result,
  };
}

function errorResult(error, idempotencyKey = null) {
  const safe = safeError(error, idempotencyKey).toSafeObject();
  return {
    isError: true,
    content: [{ type: 'text', text: JSON.stringify(safe, null, 2) }],
    structuredContent: safe,
  };
}

async function read(client, request, transform = (value) => value) {
  try {
    const { data } = await client.request({ ...request, safeRead: true });
    return successResult(transform(data));
  } catch (error) {
    return errorResult(error);
  }
}

async function write(client, args, requestFactory) {
  const idempotencyKey = args.idempotencyKey ?? randomUUID();
  try {
    const request = await requestFactory(idempotencyKey);
    const { data, idempotencyReplayed } = await client.request({
      ...request,
      idempotencyKey,
      safeRead: false,
    });
    return successResult(data, { idempotencyKey, idempotencyReplayed });
  } catch (error) {
    return errorResult(error, idempotencyKey);
  }
}

function assertPublicationPreview(data) {
  if (
    typeof data?.phrase !== 'string' || !data.phrase ||
    typeof data?.confirmationToken !== 'string' || !data.confirmationToken ||
    !/^[a-f0-9]{64}$/i.test(data?.fingerprint || '') ||
    !data?.summary || typeof data.summary !== 'object' ||
    typeof data?.expiresAt !== 'string' || !Number.isFinite(Date.parse(data.expiresAt))
  ) {
    throw new TitiApiError('Publication preview did not return summary, phrase, expiry, confirmationToken, and fingerprint', {
      code: 'INVALID_API_RESPONSE',
    });
  }
  return data;
}

function tool(name, description, inputSchema, annotations, run) {
  return Object.freeze({ name, description, inputSchema, annotations, run });
}

export function createToolDefinitions(client = createHttpClient()) {
  return Object.freeze([
    tool('list_categories', 'List available Titi course categories.', emptySchema, READ_ANNOTATIONS,
      () => read(client, { method: 'GET', path: '/api/authoring/categories' })),
    tool('list_courses', 'List courses owned by the service-token author.', emptySchema, READ_ANNOTATIONS,
      () => read(client, { method: 'GET', path: '/api/authoring/courses' })),
    tool('get_course', 'Get a full course authoring snapshot and resource fingerprints.', courseIdSchema, READ_ANNOTATIONS,
      ({ courseId }) => read(client, { method: 'GET', path: `/api/authoring/courses/${encoded(courseId)}` })),
    tool('get_course_fingerprints', 'Get a course authoring fingerprint only (no snapshot). Use before writes to re-read the current fingerprint.', courseIdSchema, READ_ANNOTATIONS,
      ({ courseId }) => read(client, { method: 'GET', path: `/api/authoring/courses/${encoded(courseId)}?view=fingerprints` })),
    tool('get_module_fingerprints', 'Get a module authoring fingerprint only (no snapshot). Use before writes to re-read the current fingerprint.', moduleIdSchema, READ_ANNOTATIONS,
      ({ moduleId }) => read(client, { method: 'GET', path: `/api/authoring/modules/${encoded(moduleId)}?view=fingerprints` })),

    tool('create_course_draft', 'Create a course draft. Never publishes it.', createCourseSchema, DRAFT_WRITE_ANNOTATIONS,
      (args) => write(client, args, async (idempotencyKey) => ({
        method: 'POST', path: '/api/authoring/courses',
        body: without(args, ['idempotencyKey']), idempotencyKey,
      }))),
    tool('update_course_draft', 'Update a course draft using its latest fingerprint.', updateCourseSchema, DRAFT_WRITE_ANNOTATIONS,
      (args) => write(client, args, async () => ({
        method: 'PUT', path: `/api/authoring/courses/${encoded(args.courseId)}`,
        body: without(args, ['courseId', 'idempotencyKey']),
      }))),
    tool('create_module_draft', 'Create a draft module inside a course.', createModuleSchema, DRAFT_WRITE_ANNOTATIONS,
      (args) => write(client, args, async () => ({
        method: 'POST', path: `/api/authoring/courses/${encoded(args.courseId)}/modules`,
        body: without(args, ['courseId', 'idempotencyKey']),
      }))),
    tool('update_module_draft', 'Update a draft module using its latest fingerprint.', updateModuleSchema, DRAFT_WRITE_ANNOTATIONS,
      (args) => write(client, args, async () => ({
        method: 'PUT', path: `/api/authoring/modules/${encoded(args.moduleId)}`,
        body: without(args, ['moduleId', 'idempotencyKey']),
      }))),
    tool('create_lesson_draft', 'Create a lesson in a draft module. Defaults to Markdown; use formatoContenido HTML for presentations.', createLessonSchema, DRAFT_WRITE_ANNOTATIONS,
      (args) => write(client, args, async () => ({
        method: 'POST', path: `/api/authoring/modules/${encoded(args.moduleId)}/lessons`,
        body: { ...without(args, ['moduleId', 'idempotencyKey']), formatoContenido: args.formatoContenido ?? 'MARKDOWN' },
      }))),
    tool('update_lesson_draft', 'Update a lesson in a draft module using its latest fingerprint.', updateLessonSchema, DRAFT_WRITE_ANNOTATIONS,
      (args) => write(client, args, async () => ({
        method: 'PUT', path: `/api/authoring/lessons/${encoded(args.lessonId)}`,
        body: without(args, ['lessonId', 'idempotencyKey']),
      }))),
    tool('upsert_lesson_html', 'Create or replace an HTML presentation resource for an HTML lesson using its latest fingerprint. Evaluable HTML reports a score to Titi.', upsertLessonHtmlSchema, DRAFT_WRITE_ANNOTATIONS,
      (args) => write(client, args, async () => ({
        method: 'POST', path: `/api/authoring/lessons/${encoded(args.lessonId)}/html`,
        body: without(args, ['lessonId', 'idempotencyKey']),
      }))),
    tool('upsert_quiz_draft', 'Create or replace a module quiz while the module is a draft.', upsertQuizSchema, DRAFT_WRITE_ANNOTATIONS,
      (args) => write(client, args, async () => ({
        method: 'PUT', path: `/api/authoring/modules/${encoded(args.moduleId)}/quiz`,
        body: without(args, ['moduleId', 'idempotencyKey']),
      }))),
    tool('attach_material', 'Attach one explicit local file to a lesson. Never scans directories or executes files.', attachMaterialSchema, DRAFT_WRITE_ANNOTATIONS,
      (args) => write(client, args, async () => {
        const file = await loadMaterialFile(args.filePath);
        const form = new FormData();
        form.append('file', new Blob([file.bytes], { type: file.mimeType }), file.filename);
        if (args.nombre) form.append('nombre', args.nombre);
        form.append('expectedFingerprint', args.expectedFingerprint);
        return { method: 'POST', path: `/api/authoring/lessons/${encoded(args.lessonId)}/materials`, form };
      })),
    tool('delete_draft_resource', 'Delete one eligible draft course, module, lesson, or material using its latest fingerprint.', deleteResourceSchema, DESTRUCTIVE_WRITE_ANNOTATIONS,
      (args) => write(client, args, async () => ({
        method: 'DELETE', path: `/api/authoring/${args.resourceType}s/${encoded(args.resourceId)}`,
        body: { expectedFingerprint: args.expectedFingerprint },
      }))),

    tool('preview_course_publication', 'Preview course publication. Returns the human confirmation phrase, signed token, and content fingerprint. Does not publish.', courseIdSchema, READ_ANNOTATIONS,
      ({ courseId }) => read(client, {
        method: 'POST', path: `/api/authoring/courses/${encoded(courseId)}/preview-publication`, body: {},
      }, assertPublicationPreview)),
    tool('publish_course', 'Publish a course only with phrase, confirmation token, and fingerprint from a recent separate preview.', publishSchema, DRAFT_WRITE_ANNOTATIONS,
      (args) => write(client, args, async () => ({
        method: 'POST', path: `/api/authoring/courses/${encoded(args.resourceId)}/publish`,
        body: without(args, ['resourceId', 'idempotencyKey']),
      }))),
    tool('preview_module_publication', 'Preview module publication. Returns the human confirmation phrase, signed token, and content fingerprint. Does not publish.', moduleIdSchema, READ_ANNOTATIONS,
      ({ moduleId }) => read(client, {
        method: 'POST', path: `/api/authoring/modules/${encoded(moduleId)}/preview-publication`, body: {},
      }, assertPublicationPreview)),
    tool('publish_module', 'Publish a module only with phrase, confirmation token, and fingerprint from a recent separate preview.', publishSchema, DRAFT_WRITE_ANNOTATIONS,
      (args) => write(client, args, async () => ({
        method: 'POST', path: `/api/authoring/modules/${encoded(args.resourceId)}/publish`,
        body: without(args, ['resourceId', 'idempotencyKey']),
      }))),
    tool('preview_module_unpublish', 'Preview module unpublish. Returns a signed phrase, token, summary, expiry, and fingerprint. Does not mutate.', moduleIdSchema, READ_ANNOTATIONS,
      ({ moduleId }) => read(client, { method: 'POST', path: `/api/authoring/modules/${encoded(moduleId)}/preview-unpublish`, body: {} }, assertPublicationPreview)),
    tool('unpublish_module', 'Move a published module back to draft only with phrase, confirmation token, and fingerprint from a recent separate preview.', unpublishSchema, DESTRUCTIVE_WRITE_ANNOTATIONS,
      (args) => write(client, args, async () => ({
        method: 'POST', path: `/api/authoring/modules/${encoded(args.moduleId)}/unpublish`,
        body: without(args, ['moduleId', 'idempotencyKey']),
      }))),
    tool('get_quiz_analytics', 'Get privacy-preserving aggregate analytics for a quiz.', evaluationIdSchema, READ_ANNOTATIONS,
      ({ evaluationId }) => read(client, { method: 'GET', path: `/api/authoring/evaluations/${encoded(evaluationId)}/analytics` })),
  ]);
}

export const TOOL_NAMES = Object.freeze(createToolDefinitions({ request: async () => ({ data: {} }) }).map((definition) => definition.name));
