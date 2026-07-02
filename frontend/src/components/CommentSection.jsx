import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { relativeTime } from '../lib/format.js';

export default function CommentSection({ postId, onCountChange }) {
  const { isAuthenticated, user } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null); // { id, author }
  const [submitting, setSubmitting] = useState(false);

  const fetchComments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await client.get(`/api/comments/${postId}`);
      if (data?.success) {
        setComments(data.data.comments || []);
      } else {
        setError(data?.message || 'No se pudieron cargar los comentarios');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error de red');
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Agrupa por replyTo para mostrar threading básico
  const tree = useMemo(() => {
    const byParent = new Map();
    const roots = [];
    for (const c of comments) {
      if (c.replyTo) {
        if (!byParent.has(c.replyTo)) byParent.set(c.replyTo, []);
        byParent.get(c.replyTo).push(c);
      } else {
        roots.push(c);
      }
    }
    return { roots, byParent };
  }, [comments]);

  async function handleSubmit(e) {
    e.preventDefault();
    const value = text.trim();
    if (!value || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const body = { text: value };
      if (replyTo?.id) body.replyTo = replyTo.id;
      const { data } = await client.post(`/api/comments/${postId}`, body);
      if (data?.success) {
        const next = [...comments, data.data.comment];
        setComments(next);
        setText('');
        setReplyTo(null);
        onCountChange?.(next.length);
      } else {
        setError(data?.message || 'Error al comentar');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error al comentar');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      aria-label="Comentarios"
      className="px-5 py-4 border-t border-gray-100 bg-titi-cream/60"
    >
      {/* Form */}
      {isAuthenticated ? (
        <form onSubmit={handleSubmit} className="mb-4">
          {replyTo && (
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
              <span>
                Respondiendo a{' '}
                <span className="text-titi-dark font-bold">@{replyTo.author}</span>
              </span>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="text-gray-500 hover:text-titi-dark transition-colors font-semibold"
              >
                cancelar
              </button>
            </div>
          )}
          <div className="flex gap-2">
            {user?.avatarUrl && (
              <img
                src={user.avatarUrl}
                alt=""
                className="hidden sm:block w-8 h-8 rounded-full bg-titi-cream border border-gray-100 shrink-0 mt-1"
              />
            )}
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={replyTo ? `Respondé a @${replyTo.author}…` : 'Escribí un comentario…'}
              className="titi-input flex-1 min-w-0"
              disabled={submitting}
              maxLength={500}
            />
            <button
              type="submit"
              disabled={submitting || !text.trim()}
              className="titi-btn-primary shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? '…' : 'Publicar'}
            </button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-gray-500 mb-4 font-medium">
          <Link to="/login" className="text-titi-dark font-bold hover:text-titi-yellow-dark transition-colors">
            Iniciá sesión
          </Link>{' '}
          para comentar.
        </p>
      )}

      {error && (
        <p className="text-sm text-red-500 font-semibold mb-3" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1].map((i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="w-8 h-8 rounded-full bg-gray-100 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-2 w-24 bg-gray-100 rounded" />
                <div className="h-2 w-full bg-gray-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : tree.roots.length === 0 ? (
        <p className="text-sm text-gray-500 font-medium">Sé el primero en comentar.</p>
      ) : (
        <ul className="space-y-3">
          {tree.roots.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              replies={tree.byParent.get(c.id) || []}
              onReply={(target) => setReplyTo(target)}
              canReply={isAuthenticated}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function CommentItem({ comment: c, replies, onReply, canReply, depth = 0 }) {
  // Las respuestas (depth > 0) van con fondo crema más sutil para diferenciar
  // visualmente la jerarquía, manteniendo la legibilidad sobre el card padre.
  const bubbleClass =
    depth > 0
      ? 'bg-titi-cream border border-gray-100'
      : 'bg-white border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.06)]';

  return (
    <li className={depth > 0 ? 'ml-8 sm:ml-11' : ''}>
      <div className={`flex gap-3 p-3 rounded-2xl ${bubbleClass}`}>
        <Link to={`/profile/${c.author}`} className="shrink-0">
          {c.authorAvatar ? (
            <img
              src={c.authorAvatar}
              alt={c.author}
              className="w-8 h-8 rounded-full bg-titi-cream border border-gray-100"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-titi-yellow/30 text-titi-dark grid place-items-center text-sm font-extrabold">
              {c.author?.[0]?.toUpperCase() ?? '?'}
            </div>
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <Link
              to={`/profile/${c.author}`}
              className="font-bold text-sm text-titi-dark hover:text-titi-yellow-dark transition-colors"
            >
              @{c.author}
            </Link>
            <span className="text-xs text-gray-500 font-semibold">
              {relativeTime(c.createdAt)}
            </span>
          </div>
          <p className="text-sm text-titi-dark whitespace-pre-wrap break-words mt-0.5">
            {c.text}
          </p>
          {canReply && depth === 0 && (
            <button
              type="button"
              onClick={() => onReply({ id: c.id, author: c.author })}
              className="text-xs font-bold text-gray-500 hover:text-titi-yellow-dark mt-1.5 transition-colors"
            >
              Responder
            </button>
          )}
        </div>
      </div>
      {replies.length > 0 && (
        <ul className="mt-2 space-y-2">
          {replies.map((r) => (
            <CommentItem
              key={r.id}
              comment={r}
              replies={[]}
              onReply={onReply}
              canReply={canReply}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
