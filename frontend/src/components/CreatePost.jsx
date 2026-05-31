import { useEffect, useRef, useState } from 'react';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

const MAX_LEN = 500;
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB (igual al límite del multer en backend)

const CameraIcon = (p) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...p}
  >
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

export default function CreatePost({ onCreated }) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  // Limpia el object URL del preview cuando cambia o al desmontar
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function handleFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/^image\//.test(f.type)) {
      setError('Solo se permiten imágenes (jpeg, png, gif, webp)');
      return;
    }
    if (f.size > MAX_BYTES) {
      setError('La imagen debe pesar menos de 5MB');
      return;
    }
    setError(null);
    setFile(f);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(f);
    });
  }

  function clearFile() {
    setFile(null);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const value = content.trim();
    if (!value && !file) {
      setError('El post debe tener contenido o imagen');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('content', value);
      if (file) fd.append('image', file);
      // axios pone automáticamente Content-Type: multipart/form-data con el boundary
      const { data } = await client.post('/api/posts', fd);
      if (data?.success) {
        setContent('');
        clearFile();
        onCreated?.(data.data);
      } else {
        setError(data?.message || 'Error al publicar');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error al publicar');
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = (content.trim().length > 0 || file) && !submitting;

  return (
    <form onSubmit={handleSubmit} className="neo-card p-5 mb-6" aria-label="Crear post">
      <div className="flex gap-3">
        {user?.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt=""
            className="hidden sm:block w-10 h-10 rounded-full bg-neo-bg border border-neo-border shrink-0 mt-1"
          />
        ) : (
          <div className="hidden sm:grid w-10 h-10 rounded-full bg-neo-accent/20 text-neo-accent place-items-center font-bold shrink-0 mt-1">
            {user?.username?.[0]?.toUpperCase() ?? '?'}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <label htmlFor="cp-content" className="sr-only">
            Contenido del post
          </label>
          <textarea
            id="cp-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={`¿Qué estás pensando, @${user?.username ?? 'vos'}?`}
            rows={3}
            maxLength={MAX_LEN}
            className="neo-input resize-none"
            disabled={submitting}
          />

          {preview && (
            <div className="relative mt-3 inline-block">
              <img
                src={preview}
                alt="Vista previa"
                className="max-h-64 rounded-xl border border-neo-border"
              />
              <button
                type="button"
                onClick={clearFile}
                aria-label="Quitar imagen"
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/70 hover:bg-neo-accent text-white grid place-items-center transition-colors"
              >
                ×
              </button>
            </div>
          )}

          {error && (
            <p className="text-sm text-neo-accent mt-2" role="alert">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between mt-3 gap-3 flex-wrap">
            <label
              className={`neo-btn-ghost text-sm cursor-pointer ${
                submitting ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <CameraIcon className="w-4 h-4" />
              <span>{file ? 'Cambiar imagen' : 'Agregar imagen'}</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleFile}
                disabled={submitting}
                className="hidden"
              />
            </label>

            <div className="flex items-center gap-3">
              <span
                className={`text-xs tabular-nums ${
                  content.length >= MAX_LEN ? 'text-neo-accent' : 'text-neo-muted'
                }`}
              >
                {content.length}/{MAX_LEN}
              </span>
              <button
                type="submit"
                disabled={!canSubmit}
                className="neo-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Publicando…' : 'Publicar'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
