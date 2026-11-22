import { useEffect, useId, useRef, useState } from 'react';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import Avatar from './social/Avatar.jsx';
import { CheckIcon, CloseIcon, ImageIcon, MusicIcon, PinIcon } from './icons.jsx';

// Composer v3 (rediseno-inicio-explorar R3): plegado parece el buscador del
// catálogo; al enfocarlo se despliega con imagen, sonido y ubicación.

const MAX_LEN = 500;
const MAX_BYTES = 5 * 1024 * 1024;

/** Selector con ícono en círculo sólido del rol (sin emojis en las opciones). */
function IconSelect({ Icon, solid, label, value, onChange, disabled, children }) {
  return (
    <label className="relative inline-flex items-center min-w-0">
      <span className="sr-only">{label}</span>
      <span aria-hidden="true" className={`absolute left-1.5 w-7 h-7 rounded-full grid place-items-center text-white pointer-events-none ${solid}`}>
        <Icon className="w-4 h-4" />
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={[
          'h-10 w-full max-w-[220px] rounded-xl border-2 bg-white pl-10 pr-8 text-sm font-bold text-titi-dark cursor-pointer truncate',
          'focus:outline-none focus:border-titi-dark focus:ring-4 focus:ring-titi-yellow/40 transition-colors duration-150',
          value ? 'border-titi-dark' : 'border-gray-200 hover:border-titi-dark',
        ].join(' ')}
      >
        {children}
      </select>
    </label>
  );
}

export default function CreatePost({ onCreated }) {
  const { user } = useAuth();
  const textId = useId();
  const fileId = useId();
  const [content, setContent] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [open, setOpen] = useState(false);
  const formRef = useRef(null);
  const textRef = useRef(null);
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
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const dirty = content.trim().length > 0 || Boolean(file) || Boolean(soundId) || Boolean(locationId);
  const expanded = open || dirty;

  function handleFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/^image\//.test(f.type)) {
      setError('Solo se permiten imágenes');
      return;
    }
    if (f.size > MAX_BYTES) {
      setError('La imagen debe pesar menos de 5 MB');
      return;
    }
    setError(null);
    setOpen(true);
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

  function collapse() {
    setOpen(false);
    setError(null);
  }

  function reset() {
    setContent('');
    clearFile();
    setSoundId('');
    setLocationId('');
    collapse();
  }

  // Al salir del composer (foco fuera del form) sin nada escrito, se pliega.
  function handleBlur(e) {
    if (!dirty && !formRef.current?.contains(e.relatedTarget)) setOpen(false);
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape' && !dirty) {
      collapse();
      textRef.current?.blur();
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit(e);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const value = content.trim();
    if (!value && !file) {
      setError('Escribí algo o agregá una imagen');
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      const fd = new FormData();
      fd.append('content', value);
      if (file) fd.append('image', file);
      if (soundId) fd.append('soundId', soundId);
      if (locationId) fd.append('locationId', locationId);
      const { data } = await client.post('/api/posts', fd);
      if (data?.success) {
        reset();
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2500);
        onCreated?.(data.data);
      } else {
        setError(data?.message || 'No se pudo publicar');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'No se pudo publicar');
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = (content.trim().length > 0 || file) && !submitting;
  const near = content.length >= MAX_LEN - 50;

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      aria-label="Crear post"
      className={[
        'bg-white rounded-2xl border-2 border-titi-dark p-3 sm:p-4 mb-5 transition-shadow duration-150',
        expanded ? 'shadow-[0_5px_0_#1A1A2E] ring-4 ring-titi-yellow/40' : 'shadow-[0_4px_0_#1A1A2E]',
      ].join(' ')}
    >
      {/* Fuera de la zona plegable: el botón de imagen del composer plegado también lo abre. */}
      <input
        id={fileId}
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={handleFile}
        disabled={submitting}
        tabIndex={-1}
        className="sr-only"
      />
      <div className="flex items-start gap-3">
        <div className="hidden sm:block mt-0.5">
          <Avatar username={user?.username} src={user?.avatarUrl} />
        </div>
        <div className="flex-1 min-w-0">
          <label htmlFor={textId} className="sr-only">
            Contenido del post
          </label>
          <div className="flex items-start gap-2">
            <textarea
              id={textId}
              ref={textRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onFocus={() => setOpen(true)}
              placeholder={`¿Qué estás aprendiendo hoy, @${user?.username ?? 'vos'}?`}
              rows={expanded ? 3 : 1}
              maxLength={MAX_LEN}
              disabled={submitting}
              className="flex-1 min-w-0 resize-none bg-transparent py-2.5 text-base font-semibold text-titi-dark placeholder:text-gray-400 focus:outline-none"
            />
            {!expanded && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Agregar imagen"
                className="group w-10 h-10 shrink-0 grid place-items-center rounded-xl border-2 border-gray-200 text-titi-dark hover:border-titi-dark hover:bg-titi-yellow active:scale-95 transition-all duration-150 focus:outline-none focus-visible:ring-4 focus-visible:ring-titi-yellow/60"
              >
                <ImageIcon className="w-5 h-5 transition-transform duration-200 group-hover:-rotate-12 motion-reduce:transition-none" />
              </button>
            )}
          </div>

          {/* Se despliega con alto animado (grid 0fr → 1fr), sin medir en JS. */}
          <div
            className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${
              expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
            }`}
          >
            <div className={`min-h-0 ${expanded ? '' : 'overflow-hidden'}`} inert={expanded ? undefined : ''}>
              {preview && (
                <div className="relative mt-2 inline-block">
                  <img src={preview} alt="Vista previa" className="max-h-64 rounded-xl border-2 border-titi-dark" />
                  <button
                    type="button"
                    onClick={clearFile}
                    aria-label="Quitar imagen"
                    className="absolute top-2 right-2 w-9 h-9 grid place-items-center rounded-full bg-white border-2 border-titi-dark text-titi-dark shadow-[0_3px_0_#1A1A2E] hover:bg-red-500 hover:text-white active:translate-y-0.5 active:shadow-none transition-all duration-150"
                  >
                    <CloseIcon className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t-2 border-gray-100">
                <label
                  htmlFor={fileId}
                  tabIndex={submitting ? -1 : 0}
                  role="button"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  className={[
                    'group inline-flex items-center gap-2 h-10 pl-1.5 pr-3.5 rounded-xl border-2 text-sm font-bold text-titi-dark cursor-pointer select-none',
                    'transition-all duration-150 active:translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-titi-yellow/60',
                    file ? 'border-titi-dark' : 'border-gray-200 hover:border-titi-dark',
                    submitting ? 'opacity-50 cursor-not-allowed' : '',
                  ].join(' ')}
                >
                  <span className="w-7 h-7 rounded-full bg-blue-500 text-white grid place-items-center">
                    <ImageIcon className="w-4 h-4 transition-transform duration-200 group-hover:-rotate-12 motion-reduce:transition-none" />
                  </span>
                  {file ? 'Cambiar imagen' : 'Imagen'}
                </label>
                {sounds.length > 0 && (
                  <IconSelect Icon={MusicIcon} solid="bg-titi-streak" label="Elegir sonido" value={soundId} onChange={setSoundId} disabled={submitting}>
                    <option value="">Sonido</option>
                    {sounds.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} — {s.artist}
                      </option>
                    ))}
                  </IconSelect>
                )}
                {locations.length > 0 && (
                  <IconSelect Icon={PinIcon} solid="bg-green-500" label="Elegir ubicación" value={locationId} onChange={setLocationId} disabled={submitting}>
                    <option value="">Ubicación</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.city}, {l.country}
                      </option>
                    ))}
                  </IconSelect>
                )}
              </div>

              {error && (
                <p className="mt-3 flex items-center gap-2 text-sm font-bold text-red-600" role="alert">
                  <span aria-hidden="true" className="w-6 h-6 rounded-full bg-red-500 text-white grid place-items-center text-xs font-black shrink-0">!</span>
                  {error}
                </p>
              )}

              <div className="flex items-center justify-end gap-3 mt-3">
                <span className={`mr-auto text-xs tabular-nums font-bold ${content.length >= MAX_LEN ? 'text-red-500' : near ? 'text-titi-streak' : 'text-gray-400'}`}>
                  {content.length}/{MAX_LEN}
                </span>
                <button
                  type="button"
                  onClick={reset}
                  disabled={submitting}
                  className="text-sm font-bold text-gray-500 hover:text-titi-dark px-2 py-2 rounded-lg active:scale-95 transition-all duration-150 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button type="submit" disabled={!canSubmit} className="titi-btn-primary px-6 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0">
                  {submitting ? 'Publicando…' : 'Publicar'}
                </button>
              </div>
            </div>
          </div>

          {success && (
            <p className="mt-2 flex items-center gap-2 text-sm font-bold text-green-700" role="status">
              <span aria-hidden="true" className="w-6 h-6 rounded-full bg-green-500 text-white grid place-items-center shrink-0">
                <CheckIcon className="w-3.5 h-3.5" />
              </span>
              ¡Listo! Tu post ya está publicado.
            </p>
          )}
        </div>
      </div>
    </form>
  );
}
