import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { relativeTime } from '../lib/format.js';

export default function CommentSection({ postId, initialCount = 0, onCountChange }) {
  const { isAuthenticated, user } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchComments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await client.get(`/api/posts/${postId}`);
      if (data?.success) {
        setComments(data.data.comments || []);
      } else {
        setError(data?.message || 'No se pudieron cargar los comentarios');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Error de red';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  async function handleSubmit(e) {
    e.preventDefault();
    const value = text.trim();
    if (!value || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const { data } = await client.post(`/api/posts/${postId}/comment`, { text: value });
      if (data?.success) {
        const next = [...comments, data.data.comment];
        setComments(next);
        setText('');
        onCountChange?.(next.length);
      } else {
        setError(data?.message || 'Error al comentar');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Error al comentar';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      aria-label="Comentarios"
      className="px-5 py-4 border-t border-neo-border bg-neo-bg/40"
    >
      {/* Form (solo si hay sesión) */}
      {isAuthenticated ? (
        <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
          {user?.avatarUrl && (
            <img
              src={user.avatarUrl}
              alt=""
              className="w-8 h-8 rounded-full bg-neo-bg border border-neo-border shrink-0 mt-1"
            />
          )}
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Escribí un comentario…"
            className="neo-input flex-1"
            disabled={submitting}
            maxLength={500}
          />
          <button
            type="submit"
            disabled={submitting || !text.trim()}
            className="neo-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? '…' : 'Publicar'}
          </button>
        </form>
      ) : (
        <p className="text-sm text-neo-muted mb-4">
          <Link to="/login" className="text-neo-accent hover:underline">
            Iniciá sesión
          </Link>{' '}
          para comentar.
        </p>
      )}

      {error && (
        <p className="text-sm text-neo-accent mb-3" role="alert">
          {error}
        </p>
      )}

      {/* Lista */}
      {loading ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1].map((i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="w-8 h-8 rounded-full bg-neo-border shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-2 w-24 bg-neo-border rounded" />
                <div className="h-2 w-full bg-neo-border rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-neo-muted">Sé el primero en comentar.</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-3">
              <Link to={`/profile/${c.author}`} className="shrink-0">
                {c.authorAvatar ? (
                  <img
                    src={c.authorAvatar}
                    alt={c.author}
                    className="w-8 h-8 rounded-full bg-neo-bg border border-neo-border"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-neo-accent/20 text-neo-accent grid place-items-center text-sm font-bold">
                    {c.author?.[0]?.toUpperCase() ?? '?'}
                  </div>
                )}
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <Link
                    to={`/profile/${c.author}`}
                    className="font-semibold text-sm hover:text-neo-accent"
                  >
                    @{c.author}
                  </Link>
                  <span className="text-xs text-neo-muted">{relativeTime(c.createdAt)}</span>
                </div>
                <p className="text-sm text-white/90 whitespace-pre-wrap break-words">
                  {c.text}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
