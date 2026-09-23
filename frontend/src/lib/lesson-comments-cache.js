import client from '../api/client.js';

// Caché efímera y deduplicación por usuario/lección. El panel puede desmontarse
// al cerrar y reabrirse sin repetir la descarga durante esta sesión.
const commentsCache = new Map();
const pendingRequests = new Map();

function cacheKey({ userKey, lessonId }) {
  return `${userKey || 'anonymous'}:${lessonId}`;
}

async function fetchAllCommentPages({ lessonId, signal }) {
  const comments = [];
  let cursor = null;
  const seenCursors = new Set();

  do {
    const params = { limit: 100 };
    if (cursor) params.cursor = cursor;
    const { data } = await client.get(`/api/lessons/${lessonId}/comments`, {
      signal,
      params,
    });
    if (!data?.success) {
      throw new Error(data?.message || 'No se pudieron cargar los comentarios');
    }

    comments.push(...(data.data?.comentarios || []));
    const pagination = data.data?.pagination;
    const nextCursor = pagination?.hasMore ? pagination.nextCursor : null;
    if (!nextCursor || seenCursors.has(nextCursor)) break;
    seenCursors.add(nextCursor);
    cursor = nextCursor;
  } while (cursor);

  return comments;
}

export function requestLessonComments({ userKey, lessonId }) {
  const key = cacheKey({ userKey, lessonId });
  const cached = commentsCache.get(key);
  if (cached) return { promise: Promise.resolve(cached), release: () => {} };

  let entry = pendingRequests.get(key);
  if (!entry) {
    const controller = new AbortController();
    entry = { controller, consumers: 0, settled: false, promise: null };
    entry.promise = fetchAllCommentPages({ lessonId, signal: controller.signal })
      .then((comments) => {
        commentsCache.set(key, comments);
        return comments;
      })
      .finally(() => {
        entry.settled = true;
        if (pendingRequests.get(key) === entry) pendingRequests.delete(key);
      });
    pendingRequests.set(key, entry);
  }

  entry.consumers += 1;
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    entry.consumers -= 1;
    if (entry.consumers === 0 && !entry.settled) {
      entry.controller.abort();
      if (pendingRequests.get(key) === entry) pendingRequests.delete(key);
    }
  };
  return { promise: entry.promise, release };
}

export function invalidateLessonComments({ userKey, lessonId }) {
  commentsCache.delete(cacheKey({ userKey, lessonId }));
}

export function clearLessonCommentsCache() {
  commentsCache.clear();
  for (const entry of pendingRequests.values()) entry.controller.abort();
  pendingRequests.clear();
}
