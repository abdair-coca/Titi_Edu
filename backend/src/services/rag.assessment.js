import prisma from '../prisma.js';
import { securityEvent } from './rag.security.js';

export const ASSESSMENT_GUIDANCE_ANSWER = 'Esta pregunta se parece a una de tu evaluación, así que no voy a darte la respuesta. Repasá el material de la lección y contame qué parte te genera dudas para darte una pista.';

const MIN_QUESTION_TERMS = 3;
const MIN_SHARED_TERMS_RATIO = 0.8;
const MIN_LITERAL_QUESTION_LENGTH = 12;
const MIN_OPTION_LENGTH = 3;

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function terms(normalized) {
  return new Set(normalized.split(' ').filter((word) => word.length >= MIN_OPTION_LENGTH));
}

export function messageMatchesQuestion(message, question) {
  const normalizedMessage = normalize(message);
  const normalizedQuestion = normalize(question);
  if (normalizedQuestion.length >= MIN_LITERAL_QUESTION_LENGTH && normalizedMessage.includes(normalizedQuestion)) return true;
  const questionTerms = terms(normalizedQuestion);
  if (questionTerms.size < MIN_QUESTION_TERMS) return false;
  const messageTerms = terms(normalizedMessage);
  const shared = [...questionTerms].filter((term) => messageTerms.has(term)).length;
  return shared / questionTerms.size >= MIN_SHARED_TERMS_RATIO;
}

// Correct options stay in this process: they are compared against the answer and
// never reach the provider. A paraphrase can evade the match; this only stops copy-paste.
export async function findPendingAssessmentMatch({ courseId, usuarioId, candidates }) {
  if (!prisma.evaluacion?.findMany) return null;
  try {
    const evaluations = await prisma.evaluacion.findMany({
      where: { OR: [{ cursoId: courseId }, { modulo: { cursoId: courseId } }] },
      select: {
        intentos: { where: { usuarioId, aprobado: true }, select: { id: true }, take: 1 },
        preguntas: {
          select: {
            texto: true,
            opciones: { where: { esCorrecta: true }, select: { texto: true } },
          },
        },
      },
    });
    const questions = evaluations
      .filter((evaluation) => !evaluation.intentos.length)
      .flatMap((evaluation) => evaluation.preguntas);
    const matched = questions.filter((question) => candidates.some((candidate) => messageMatchesQuestion(candidate, question.texto)));
    if (!matched.length) return null;
    return { correctOptions: matched.flatMap((question) => question.opciones.map((option) => option.texto)) };
  } catch (error) {
    securityEvent('assessment_guard_failed', { courseId, reason: error?.name || 'unknown_error' });
    return null;
  }
}

export function answerRevealsOption(answer, correctOptions) {
  const normalizedAnswer = ` ${normalize(answer)} `;
  return correctOptions
    .map(normalize)
    .filter((option) => option.length >= MIN_OPTION_LENGTH)
    .some((option) => normalizedAnswer.includes(` ${option} `));
}
