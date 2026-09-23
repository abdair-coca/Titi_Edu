import client from '../api/client.js';

// Cache efímera: nunca se persiste en localStorage/sessionStorage. La clave
// incluye usuario, curso y lección para evitar reutilizar contenido entre
// sesiones o cursos distintos.
const lessonCache = new Map();
const pendingRequests = new Map();

function cacheKey({ userKey, courseId, lessonId }) {
  return [userKey || 'anonymous', courseId || 'unknown-course', lessonId].join(':');
}

export function requestLessonDetail({ userKey, courseId, lessonId }) {
  const key = cacheKey({ userKey, courseId, lessonId });
  const cached = lessonCache.get(key);
  if (cached) {
    return { promise: Promise.resolve(cached), release: () => {} };
  }

  let entry = pendingRequests.get(key);
  if (!entry) {
    const controller = new AbortController();
    entry = {
      controller,
      consumers: 0,
      settled: false,
      promise: null,
    };
    entry.promise = client
      .get(`/api/lessons/${lessonId}`, { signal: controller.signal })
      .then(({ data }) => {
        const lesson = data?.success ? data.data?.leccion : null;
        if (lesson) lessonCache.set(key, lesson);
        return lesson;
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

export function invalidateLessonDetail({ userKey, courseId, lessonId }) {
  lessonCache.delete(cacheKey({ userKey, courseId, lessonId }));
}

export function clearLessonDetailCache() {
  lessonCache.clear();
  for (const entry of pendingRequests.values()) entry.controller.abort();
  pendingRequests.clear();
}
