export function buildTutorHistory(conversation, currentQuestion) {
  const turns = (Array.isArray(conversation) ? conversation : [])
    .filter((msg) => msg?.role === 'user' || msg?.role === 'tutor')
    .map((msg) => {
      const turn = {
        role: msg.role === 'tutor' ? 'assistant' : 'user',
        content: String(msg.content || '').trim(),
      };
      if (msg.role === 'tutor' && Array.isArray(msg.citations)) {
        const citations = msg.citations
          .map((citation) => ({ number: citation?.number, chunkId: citation?.chunkId }))
          .filter((citation) => Number.isInteger(Number(citation.number)) && typeof citation.chunkId === 'string' && citation.chunkId.trim());
        if (citations.length) turn.citations = citations;
      }
      return turn;
    })
    .filter((msg) => msg.content);

  const question = String(currentQuestion || '').trim();
  const lastTurn = turns.at(-1);
  if (lastTurn?.role === 'user' && lastTurn.content === question) turns.pop();

  return turns;
}
