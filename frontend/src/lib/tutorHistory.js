export function buildTutorHistory(conversation, currentQuestion) {
  const turns = (Array.isArray(conversation) ? conversation : [])
    .filter((msg) => msg?.role === 'user' || msg?.role === 'tutor')
    .map((msg) => ({
      role: msg.role === 'tutor' ? 'assistant' : 'user',
      content: String(msg.content || '').trim(),
    }))
    .filter((msg) => msg.content);

  const question = String(currentQuestion || '').trim();
  const lastTurn = turns.at(-1);
  if (lastTurn?.role === 'user' && lastTurn.content === question) turns.pop();

  return turns;
}
