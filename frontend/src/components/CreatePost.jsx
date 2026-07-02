import { useEffect, useRef, useState } from 'react';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

const MAX_LEN = 500;
const MAX_BYTES = 5 * 1024 * 1024;

const CameraIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
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
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef(null);

  const [sounds, setSounds] = useState([]);
  const [locations, setLocations] = useState([]);
  const [soundId, setSoundId] = useState('');
  const [locationId, setLocationId] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      client.get('/api/sounds').catch(() => ({ data: null })),
      client.get('/api/locations').catch(() => ({ data: null })),
    ]).then(([s, l]) => {
      if (cancelled) return;
      if (s?.data?.success) setSounds(s.data.data.sounds || []);
      if (l?.data?.success) setLocations(l.data.data.locations || []);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview); };
  }, [preview]);

  function handleFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/^image\//.test(f.type)) { setError('Solo se permiten imágenes'); return; }
    if (f.size > MAX_BYTES) { setError('La imagen debe pesar menos de 5MB'); return; }
    setError(null);
    setFile(f);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(f);
    });
  }

  function clearFile() {
    setFile(null);
    setPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const value = content.trim();
    if (!value && !file) { setError('El post debe tener contenido o imagen'); return; }
    setSubmitting(true); setError(null); setSuccess(false);
    try {
      const fd = new FormData();
      fd.append('content', value);
      if (file) fd.append('image', file);
      if (soundId) fd.append('soundId', soundId);
      if (locationId) fd.append('locationId', locationId);
      const { data } = await client.post('/api/posts', fd);
      if (data?.success) {
        setContent(''); clearFile(); setSoundId(''); setLocationId('');
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2500);
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
    <form
      onSubmit={handleSubmit}
      aria-label="Crear post"
      className="bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-gray-100 border-t-4 border-t-titi-yellow p-5 mb-6"
    >
      <div className="flex gap-3">
        {user?.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt=""
            className="hidden sm:block w-11 h-11 rounded-full bg-titi-cream border-2 border-titi-yellow shrink-0 mt-1"
          />
        ) : (
          <div className="hidden sm:grid w-11 h-11 rounded-full bg-titi-yellow text-titi-dark place-items-center font-extrabold shrink-0 mt-1 border-2 border-titi-yellow">
            {user?.username?.[0]?.toUpperCase() ?? '?'}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <label htmlFor="cp-content" className="sr-only">Contenido del post</label>
          <textarea
            id="cp-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={`¿Qué quieres compartir hoy, @${user?.username ?? 'vos'}? 🌟`}
            rows={3}
            maxLength={MAX_LEN}
            className="titi-input resize-none"
            disabled={submitting}
          />

          {preview && (
            <div className="relative mt-3 inline-block">
              <img src={preview} alt="Vista previa" className="max-h-64 rounded-xl border-2 border-titi-yellow" />
              <button
                type="button"
                onClick={clearFile}
                aria-label="Quitar imagen"
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-titi-dark/80 hover:bg-red-500 text-white grid place-items-center transition-colors font-bold"
              >
                ×
              </button>
            </div>
          )}

          {(sounds.length > 0 || locations.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
              {sounds.length > 0 && (
                <select
                  value={soundId}
                  onChange={(e) => setSoundId(e.target.value)}
                  disabled={submitting}
                  aria-label="Elegir sonido"
                  className="titi-input text-sm"
                >
                  <option value="">🎵 Sin sonido</option>
                  {sounds.map((s) => (
                    <option key={s.id} value={s.id}>🎵 {s.name} — {s.artist}</option>
                  ))}
                </select>
              )}
              {locations.length > 0 && (
                <select
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                  disabled={submitting}
                  aria-label="Elegir ubicación"
                  className="titi-input text-sm"
                >
                  <option value="">📍 Sin ubicación</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>📍 {l.city}, {l.country}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {error && (
            <p className="text-sm text-red-500 font-bold mt-2" role="alert">{error}</p>
          )}
          {success && (
            <p className="text-sm text-green-600 font-bold mt-2" role="status">
              ¡Genial! Tu post está en vivo 🚀
            </p>
          )}

          <div className="flex items-center justify-between mt-3 gap-3 flex-wrap">
            <label className={`titi-btn-ghost text-sm cursor-pointer ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}>
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
              <span className={`text-xs tabular-nums font-bold ${content.length >= MAX_LEN ? 'text-red-500' : 'text-gray-500'}`}>
                {content.length}/{MAX_LEN}
              </span>
              <button
                type="submit"
                disabled={!canSubmit}
                className="titi-btn-primary disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
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
