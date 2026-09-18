export const PRACTICE_AWAITING_ANSWER = 'awaiting_answer';

export function resolveTutorIntent(explicitIntent, practiceState) {
  if (explicitIntent) return explicitIntent;
  return practiceState?.phase === PRACTICE_AWAITING_ANSWER ? 'RETROALIMENTAR' : 'DUDA';
}

export function practiceStateAfterResponse(intent, citationCount) {
  if (intent === 'PRACTICA') {
    return Number(citationCount) > 0 ? { phase: PRACTICE_AWAITING_ANSWER } : null;
  }
  if (intent === 'RETROALIMENTAR') return null;
  return undefined;
}
