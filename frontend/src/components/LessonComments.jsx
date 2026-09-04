import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { relativeTime } from '../lib/format.js';
import TitiMascot from './TitiMascot.jsx';

export default function LessonComments({ lessonId, hideHeader = false, onCount }) {
  const { isAuthenticated, user } = useAuth();
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

  const fetchComments = useCallback(async () => {
    if (!lessonId) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await client.get(`/api/lessons/${lessonId}/comments`);
      if (data?.success) {
        setComments(data.data.comentarios || []);
      } else {
        setError(data?.message || 'No se pudieron cargar los comentarios');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error de red');
    } finally {
      setLoading(false);
    }
  }, [lessonId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

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
        <h2 className="text-xl font-bold text-titi-dark mb-4">
          Comentarios{' '}
          <span className="text-sm font-semibold text-gray-400 tabular-nums">
            ({comments.length})
          </span>
        </h2>
      )}

      {/* Form */}
      {isAuthenticated ? (
        <form onSubmit={handleSubmit} className="mb-5">
          <div className="flex flex-col sm:flex-row gap-2 sm:items-start">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt=""
                loading="lazy"
                className="hidden sm:block w-10 h-10 rounded-full bg-titi-cream border-2 border-titi-yellow shrink-0"
              />
            ) : (
              <div className="hidden sm:grid w-10 h-10 rounded-full bg-titi-yellow text-titi-dark place-items-center font-extrabold shrink-0">
                {user?.username?.[0]?.toUpperCase() ?? '?'}
              </div>
            )}
            <div className="flex-1 flex flex-col gap-2">
              {/* Chip fijo indicando si se está respondiendo a alguien */}
              {replyTo && (
                <div className="flex items-center justify-between bg-titi-yellow/20 border border-titi-yellow px-3 py-1.5 rounded-xl text-xs text-titi-dark">
                  <span className="font-semibold">
                    Respondiendo a <strong className="font-black text-titi-dark">@{replyTo.username}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => setReplyTo(null)}
                    className="text-gray-500 hover:text-red-500 font-bold ml-2 p-0.5 rounded transition-colors"
                    aria-label="Cancelar respuesta"
                  >
                    ✕
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
                className="w-full bg-titi-cream border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-titi-dark placeholder:text-gray-400 focus:outline-none focus:border-titi-yellow focus:ring-2 focus:ring-titi-yellow/20 transition-all duration-150 resize-none"
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-gray-400 tabular-nums">{text.length} / 500</span>
                <div className="flex items-center gap-2">
                  {replyTo && (
                    <button
                      type="button"
                      onClick={() => setReplyTo(null)}
                      className="text-xs font-bold text-gray-500 hover:text-titi-dark px-3 py-2 rounded-xl transition-colors"
                    >
                      Cancelar
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={submitting || !text.trim()}
                    className="bg-titi-yellow text-titi-dark font-bold text-sm px-5 py-2.5 rounded-xl shadow-[0_4px_0px_#E6B800] hover:shadow-[0_2px_0px_#E6B800] hover:-translate-y-0.5 active:shadow-none active:translate-y-0 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Publicando…' : replyTo ? 'Responder' : 'Publicar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>
      ) : (
        <p className="text-sm text-gray-500 font-medium mb-5">
          <Link to="/login" className="text-titi-dark font-bold hover:text-titi-yellow-dark transition-colors">
            Iniciá sesión
          </Link>{' '}
          para dejar un comentario.
        </p>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
          <p className="text-sm font-semibold text-red-700">{error}</p>
        </div>
      )}

      {/* Lista de comentarios */}
      {loading ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1].map((i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="w-10 h-10 rounded-full bg-gray-100 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-32 bg-gray-100 rounded" />
                <div className="h-3 w-full bg-gray-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : rootComments.length === 0 ? (
        <div className="flex flex-col items-center text-center py-10 px-6 bg-titi-cream rounded-2xl border border-gray-100">
          <TitiMascot mood="idle" size="sm" />
          <h3 className="text-base font-bold text-titi-dark mt-2 mb-1">Sé el primero en comentar</h3>
          <p className="text-sm text-gray-500 max-w-xs">
            Tu duda puede ser la duda de otro. ¡Animate!
          </p>
        </div>
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
                  <ul className="ml-5 sm:ml-7 pl-3 sm:pl-4 border-l-2 border-titi-yellow/40 space-y-2.5">
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
      className={`flex gap-3 p-3.5 sm:p-4 rounded-2xl bg-white border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] ${
        comment._optimistic ? 'opacity-60' : ''
      }`}
    >
      <Link to={comment.username ? `/profile/${comment.username}` : '#'} className="shrink-0">
        {comment.avatarUrl ? (
          <img
            src={comment.avatarUrl}
            alt=""
            loading="lazy"
            className="w-9 h-9 rounded-full bg-titi-cream border-2 border-titi-yellow shrink-0 object-cover"
          />
        ) : (
          <div className="w-9 h-9 rounded-full bg-titi-yellow text-titi-dark grid place-items-center text-xs font-extrabold border-2 border-titi-yellow">
            {(comment.username?.[0] ?? '?').toUpperCase()}
          </div>
        )}
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          {comment.username ? (
            <Link
              to={`/profile/${comment.username}`}
              className="font-bold text-sm text-titi-dark hover:text-titi-yellow-dark transition-colors"
            >
              @{comment.username}
            </Link>
          ) : (
            <span className="font-bold text-sm text-gray-400">@usuario</span>
          )}

          {isReply && comment.replyToUsername && (
            <span className="text-xs text-gray-400 font-medium">
              respondiendo a{' '}
              <span className="font-bold text-gray-600">@{comment.replyToUsername}</span>
            </span>
          )}

          <span className="text-xs text-gray-400 font-semibold">
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
              className="text-xs font-bold text-gray-500 hover:text-titi-dark transition-colors inline-flex items-center gap-1.5"
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
