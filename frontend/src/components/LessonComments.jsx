import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { relativeTime } from '../lib/format.js';

export default function LessonComments({ lessonId, hideHeader = false, onCount }) {
  const { isAuthenticated, user } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  async function handleSubmit(e) {
    e.preventDefault();
    const value = text.trim();
    if (!value || submitting) return;
    setSubmitting(true);
    setError(null);

    // Optimistic
    const optimistic = {
      id: `tmp-${Date.now()}`,
      texto: value,
      usuarioId: user?.id,
      username: user?.username,
      createdAt: new Date().toISOString(),
      _optimistic: true,
    };
    setComments((prev) => [optimistic, ...prev]);
    setText('');

    try {
      const { data } = await client.post(`/api/lessons/${lessonId}/comments`, { texto: value });
      if (data?.success) {
        setComments((prev) => prev.map((c) => (c.id === optimistic.id ? data.data.comentario : c)));
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
                className="hidden sm:block w-10 h-10 rounded-full bg-titi-bg border-2 border-titi-yellow shrink-0"
              />
            ) : (
              <div className="hidden sm:grid w-10 h-10 rounded-full bg-titi-yellow text-titi-dark place-items-center font-extrabold shrink-0">
                {user?.username?.[0]?.toUpperCase() ?? '?'}
              </div>
            )}
            <div className="flex-1 flex flex-col gap-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Compartí tu duda o aporte…"
                rows={3}
                maxLength={500}
                disabled={submitting}
                className="w-full bg-titi-cream border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-titi-dark placeholder:text-gray-300 focus:outline-none focus:border-titi-yellow focus:ring-2 focus:ring-titi-yellow/20 transition-all duration-150 resize-none"
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-gray-400 tabular-nums">{text.length} / 500</span>
                <button
                  type="submit"
                  disabled={submitting || !text.trim()}
                  className="bg-titi-yellow text-titi-dark font-bold text-sm px-5 py-2.5 rounded-xl shadow-[0_4px_0px_#E6B800] hover:shadow-[0_2px_0px_#E6B800] hover:-translate-y-0.5 active:shadow-none active:translate-y-0 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Publicando…' : 'Publicar'}
                </button>
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

      {/* Lista */}
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
      ) : comments.length === 0 ? (
        <div className="flex flex-col items-center text-center py-10 px-6 bg-titi-cream rounded-2xl border border-titi-border">
          <img
            src="/Titi.png"
            alt="Titi"
            className="w-20 h-20 mb-3 object-contain drop-shadow-sm select-none"
            draggable={false}
          />
          <h3 className="text-base font-bold text-titi-dark mb-1">Sé el primero en comentar</h3>
          <p className="text-sm text-gray-500 max-w-xs">
            Tu duda puede ser la duda de otro. ¡Animate!
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li
              key={c.id}
              className={`flex gap-3 p-4 rounded-2xl bg-white border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] ${
                c._optimistic ? 'opacity-60' : ''
              }`}
            >
              <Link to={c.username ? `/profile/${c.username}` : '#'} className="shrink-0">
                <div className="w-10 h-10 rounded-full bg-titi-yellow text-titi-dark grid place-items-center text-sm font-extrabold border-2 border-titi-yellow">
                  {(c.username?.[0] ?? '?').toUpperCase()}
                </div>
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2 flex-wrap">
                  {c.username ? (
                    <Link
                      to={`/profile/${c.username}`}
                      className="font-bold text-sm text-titi-dark hover:text-titi-yellow-dark transition-colors"
                    >
                      @{c.username}
                    </Link>
                  ) : (
                    <span className="font-bold text-sm text-gray-400">@usuario</span>
                  )}
                  <span className="text-xs text-gray-400 font-semibold">
                    {relativeTime(c.createdAt)}
                  </span>
                </div>
                <p className="text-sm text-titi-dark whitespace-pre-wrap break-words mt-1 leading-relaxed">
                  {c.texto}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
