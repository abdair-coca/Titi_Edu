import { z } from 'zod';

const id = z.string().trim().min(1).max(200);
const fingerprint = z.string().regex(/^[a-f0-9]{64}$/i, 'Expected a SHA-256 fingerprint');
const idempotencyKey = z.string().uuid().optional().describe('UUID. Reuse the same value after a timeout.');
const title = z.string().trim().min(1).max(300);
const description = z.string().trim().min(1).max(50_000);
const nullableDescription = z.string().trim().max(50_000).nullable();
const order = z.number().int();
const url = z.string().url().max(2_000).nullable();

export const emptySchema = z.object({}).strict();
export const courseIdSchema = z.object({ courseId: id }).strict();
export const moduleIdSchema = z.object({ moduleId: id }).strict();
export const evaluationIdSchema = z.object({ evaluationId: id }).strict();

export const createCourseSchema = z.object({
  titulo: title,
  descripcion: description,
  nivel: z.string().trim().min(1).max(100),
  categoriaId: id,
  portadaUrl: url.optional(),
  emiteCertificado: z.boolean().optional(),
  idempotencyKey,
}).strict();

export const updateCourseSchema = z.object({
  courseId: id,
  expectedFingerprint: fingerprint,
  titulo: title.optional(),
  descripcion: description.optional(),
  nivel: z.string().trim().min(1).max(100).optional(),
  categoriaId: id.optional(),
  portadaUrl: url.optional(),
  emiteCertificado: z.boolean().optional(),
  idempotencyKey,
}).strict().refine(
  (value) => ['titulo', 'descripcion', 'nivel', 'categoriaId', 'portadaUrl', 'emiteCertificado'].some((key) => key in value),
  { message: 'At least one editable course field is required' },
);

export const createModuleSchema = z.object({
  courseId: id,
  titulo: title,
  descripcion: nullableDescription.optional(),
  orden: order,
  idempotencyKey,
}).strict();

export const updateModuleSchema = z.object({
  moduleId: id,
  expectedFingerprint: fingerprint,
  titulo: title.optional(),
  descripcion: nullableDescription.optional(),
  orden: order.optional(),
  idempotencyKey,
}).strict().refine(
  (value) => ['titulo', 'descripcion', 'orden'].some((key) => key in value),
  { message: 'At least one editable module field is required' },
);

export const createLessonSchema = z.object({
  moduleId: id,
  titulo: title,
  contenido: z.string().max(500_000),
  videoUrl: url.optional(),
  orden: order,
  idempotencyKey,
}).strict();

export const updateLessonSchema = z.object({
  lessonId: id,
  expectedFingerprint: fingerprint,
  titulo: title.optional(),
  contenido: z.string().max(500_000).optional(),
  videoUrl: url.optional(),
  orden: order.optional(),
  idempotencyKey,
}).strict().refine(
  (value) => ['titulo', 'contenido', 'videoUrl', 'orden'].some((key) => key in value),
  { message: 'At least one editable lesson field is required' },
);

const quizOptionSchema = z.object({
  texto: z.string().trim().min(1).max(5_000),
  esCorrecta: z.boolean(),
}).strict();

const quizQuestionSchema = z.object({
  texto: z.string().trim().min(1).max(20_000),
  tipo: z.enum(['OPCION_MULTIPLE', 'VERDADERO_FALSO', 'RESPUESTA_CORTA']),
  orden: order.optional(),
  options: z.array(quizOptionSchema).min(1).max(100),
}).strict().refine((question) => question.options.some((option) => option.esCorrecta), {
  message: 'Each question needs at least one correct option',
});

export const upsertQuizSchema = z.object({
  moduleId: id,
  expectedFingerprint: fingerprint,
  titulo: title,
  intentosMax: z.number().int().min(1).max(10).optional(),
  notaMinima: z.number().min(0).max(100).optional(),
  questions: z.array(quizQuestionSchema).min(1).max(200),
  idempotencyKey,
}).strict();

export const attachMaterialSchema = z.object({
  lessonId: id,
  filePath: z.string().trim().min(1).max(4_096).describe('Explicit local file path. Directories are never scanned.'),
  nombre: z.string().trim().min(1).max(200).optional(),
  idempotencyKey,
}).strict();

export const deleteResourceSchema = z.object({
  resourceType: z.enum(['course', 'module', 'lesson', 'material']),
  resourceId: id,
  expectedFingerprint: fingerprint,
  idempotencyKey,
}).strict();

export const publishSchema = z.object({
  resourceId: id,
  expectedFingerprint: fingerprint,
  confirmationToken: z.string().min(20).max(4_096),
  phrase: z.string().min(1).max(500),
  idempotencyKey,
}).strict();

export const unpublishSchema = z.object({
  moduleId: id,
  expectedFingerprint: fingerprint,
  idempotencyKey,
}).strict();

export const schemaRegistry = Object.freeze({
  emptySchema,
  courseIdSchema,
  moduleIdSchema,
  evaluationIdSchema,
  createCourseSchema,
  updateCourseSchema,
  createModuleSchema,
  updateModuleSchema,
  createLessonSchema,
  updateLessonSchema,
  upsertQuizSchema,
  attachMaterialSchema,
  deleteResourceSchema,
  publishSchema,
  unpublishSchema,
});
