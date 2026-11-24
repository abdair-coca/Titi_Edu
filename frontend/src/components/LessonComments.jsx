import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { relativeTime } from '../lib/format.js';
import { invalidateLessonComments, requestLessonComments } from '../lib/lesson-comments-cache.js';
import { markPerformance } from '../lib/performance.js';
import Avatar from './social/Avatar.jsx';
import { ErrorBox } from './social/StateBlocks.jsx';
import { CloseIcon, SendIcon } from './icons.jsx';
import { EmptyState, INPUT } from './ui/v3.jsx';

export default function LessonComments({ lessonId, hideHeader = false, onCount }) {
  const { isAuthenticated, user } = useAuth();
  const userKey = user?.id || user?.neoId || user?.email || 'anonymous';
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null); // { id, username, rootId }
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef(null);

  // Reporta la cantidad de comentarios al padre (para el título "Comentarios (N)").
  useEffect(() => {
    onCount?.(comments.length);
  }, [comments.length, onCount]);

  useEffect(() => {
    if (!lessonId) return undefined;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const request = requestLessonComments({ userKey, lessonId });
    request.promise
      .then((nextComments) => {
        if (!cancelled) setComments(nextComments || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.message || err.message || 'Error de red');
      })
      .finally(() => {
        request.release();
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      request.release();
    };
  }, [lessonId, userKey]);

  useEffect(() => {
    if (!loading) markPerformance('learn:comments-ready', lessonId);
  }, [lessonId, loading]);

  // Agrupa en comentarios raíz (parentId == null) y respuestas por rootId
  const { rootComments, repliesByParentId } = useMemo(() => {
    const roots = [];
    const replies = {};
    for (const c of comments) {
      if (!c.parentId) {
        roots.push(c);
      } else {
        if (!replies[c.parentId]) replies[c.parentId] = [];
        replies[c.parentId].push(c);
      }
    }
    return { rootComments: roots, repliesByParentId: replies };
  }, [comments]);

  function handleReplyClick(targetComment, rootId) {
    setReplyTo({
      id: targetComment.id,
      username: targetComment.username || 'usuario',
      rootId: rootId || targetComment.id,
    });
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const value = text.trim();
    if (!value || submitting) return;
    setSubmitting(true);
    setError(null);

    const activeReply = replyTo;
    const parentIdToSend = activeReply ? activeReply.id : null;

    // Optimistic item
    const optimistic = {
      id: `tmp-${Date.now()}`,
      texto: value,
      usuarioId: user?.id,
      username: user?.username,
      avatarUrl: user?.avatarUrl,
      parentId: activeReply ? activeReply.rootId : null,
      replyToUsername: activeReply ? activeReply.username : null,
      createdAt: new Date().toISOString(),
      _optimistic: true,
    };

    setComments((prev) => [...prev, optimistic]);
    setText('');
    setReplyTo(null);

    try {
      const { data } = await client.post(`/api/lessons/${lessonId}/comments`, {
        texto: value,
        parentId: parentIdToSend,
      });
      if (data?.success) {
        setComments((prev) =>
          prev.map((c) => (c.id === optimistic.id ? data.data.comentario : c))
        );
        invalidateLessonComments({ userKey, lessonId });
      } else {
        setComments((prev) => prev.filter((c) => c.id !== optimistic.id));
        setError(data?.message || 'Error al comentar');
      }
    } catch (err) {
      setComments((prev) => prev.filter((c) => c.id !== optimistic.id));
      setError(err.response?.data?.message || err.message || 'Error al comentar');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section aria-label="Comentarios de la lección" className={hideHeader ? '' : 'mt-8'}>
      {!hideHeader && (
        <h2 className="text-xl font-extrabold text-titi-dark mb-4">
          Comentarios{' '}
          <span className="text-sm font-bold text-gray-500 tabular-nums">
            ({comments.length})
          </span>
        </h2>
      )}

      {/* Form */}
      {isAuthenticated ? (
        <form onSubmit={handleSubmit} className="mb-5">
          <div className="flex flex-col sm:flex-row gap-2.5 sm:items-start">
            <Avatar username={user?.username} src={user?.avatarUrl} size="sm" className="hidden sm:grid" />
            <div className="flex-1 min-w-0 flex flex-col gap-2">
              {/* Chip fijo indicando si se está respondiendo a alguien */}
              {replyTo && (
                <div className="flex items-center justify-between gap-2 bg-titi-yellow-light border-2 border-titi-dark pl-3 pr-1 py-1 rounded-xl text-sm text-titi-dark">
                  <span className="font-semibold min-w-0 truncate">
                    Respondiendo a <strong className="font-black text-titi-dark">@{replyTo.username}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => setReplyTo(null)}
                    className="w-7 h-7 shrink-0 grid place-items-center rounded-full text-titi-dark hover:bg-titi-yellow active:translate-y-0.5 transition-all duration-150"
                    aria-label="Cancelar respuesta"
                  >
                    <CloseIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={
                  replyTo
                    ? `Escribí tu respuesta a @${replyTo.username}…`
                    : 'Compartí tu duda o aporte…'
                }
                rows={3}
                maxLength={500}
                disabled={submitting}
                aria-label={replyTo ? `Respuesta a @${replyTo.username}` : 'Tu comentario'}
                className={`${INPUT} resize-none`}
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-gray-500 tabular-nums">{text.length} / 500</span>
                <div className="flex items-center gap-2">
                  {replyTo && (
                    <button
                      type="button"
                      onClick={() => setReplyTo(null)}
                      className="text-sm font-bold text-gray-500 hover:text-titi-dark px-3 py-2 rounded-xl active:scale-95 transition-all duration-150"
                    >
                      Cancelar
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={submitting || !text.trim()}
                    className="titi-btn-primary text-sm px-4 py-2"
                  >
                    <SendIcon className="w-4 h-4" />
                    {submitting ? 'Publicando…' : replyTo ? 'Responder' : 'Publicar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>
      ) : (
        <p className="text-sm text-gray-500 font-medium mb-5">
          <Link to="/login" className="text-titi-dark font-extrabold underline decoration-titi-yellow decoration-2 underline-offset-2 hover:decoration-titi-dark transition-colors">
            Iniciá sesión
          </Link>{' '}
          para dejar un comentario.
        </p>
      )}

      {error && <ErrorBox title="No pudimos con los comentarios" message={error} />}

      {/* Lista de comentarios */}
      {loading ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1].map((i) => (
            <div key={i} className="flex gap-3 p-3.5 rounded-2xl border-2 border-gray-100 animate-pulse">
              <div className="w-9 h-9 rounded-full bg-gray-100 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-32 bg-gray-100 rounded-full" />
                <div className="h-3 w-full bg-gray-100 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : rootComments.length === 0 ? (
        <EmptyState
          compact
          state="saludo"
          title="Sé el primero en"
          accent="comentar"
          text="Tu duda puede ser la duda de otro. ¡Animate!"
          className="rounded-2xl bg-titi-cream border-2 border-gray-200"
        />
      ) : (
        <ul className="space-y-4">
          {rootComments.map((root) => {
            const replies = repliesByParentId[root.id] || [];
            return (
              <li key={root.id} className="space-y-2">
                {/* Comentario Raíz */}
                <CommentCard
                  comment={root}
                  rootId={root.id}
                  onReply={handleReplyClick}
                  isAuthenticated={isAuthenticated}
                />

                {/* Hilo de Respuestas (Nivel 1 estricto con borde a la izquierda) */}
                {replies.length > 0 && (
                  <ul className="ml-4 sm:ml-6 pl-3 sm:pl-4 border-l-2 border-titi-yellow space-y-2.5">
                    {replies.map((reply) => (
                      <li key={reply.id}>
                        <CommentCard
                          comment={reply}
                          rootId={root.id}
                          onReply={handleReplyClick}
                          isReply
                          isAuthenticated={isAuthenticated}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function CommentCard({ comment, rootId, onReply, isReply = false, isAuthenticated = false }) {
  return (
    <div
      className={`flex gap-3 p-3.5 sm:p-4 rounded-2xl bg-white border-2 border-gray-200 ${
        comment._optimistic ? 'opacity-60' : ''
      }`}
    >
      <Link
        to={comment.username ? `/profile/${comment.username}` : '#'}
        aria-label={comment.username ? `Perfil de @${comment.username}` : undefined}
        className="shrink-0 rounded-full focus:outline-none focus-visible:ring-4 focus-visible:ring-titi-yellow/60"
      >
        <Avatar username={comment.username} src={comment.avatarUrl} size="sm" />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          {comment.username ? (
            <Link
              to={`/profile/${comment.username}`}
              className="font-extrabold text-sm text-titi-dark hover:underline decoration-titi-yellow decoration-2 underline-offset-2"
            >
              @{comment.username}
            </Link>
          ) : (
            <span className="font-bold text-sm text-gray-500">@usuario</span>
          )}

          {isReply && comment.replyToUsername && (
            <span className="text-xs text-gray-500 font-medium">
              respondiendo a{' '}
              <span className="font-bold text-titi-dark">@{comment.replyToUsername}</span>
            </span>
          )}

          <span className="text-xs text-gray-500 font-semibold">
            {relativeTime(comment.createdAt)}
          </span>
        </div>

        <p className="text-sm text-titi-dark whitespace-pre-wrap break-words mt-1 leading-relaxed">
          {comment.texto}
        </p>

        {isAuthenticated && !comment._optimistic && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => onReply(comment, rootId)}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 -ml-2.5 rounded-full text-xs font-bold text-gray-500 hover:text-titi-dark hover:bg-titi-cream active:scale-95 transition-all duration-150"
            >
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="9 17 4 12 9 7" />
                <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
              </svg>
              Responder
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
