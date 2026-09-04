import { useEffect, useRef, useState } from 'react';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { resolveMediaUrl } from '../lib/format.js';
import { usePopIn } from '../lib/motion.js';

const MAX_BIO = 280;

const AVATAR_PRESETS = [
  { id: 'titi-1', name: 'Titi Clásico', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Titi' },
  { id: 'estudiante-1', name: 'Académico', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix' },
  { id: 'estudiante-2', name: 'Curiosa', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka' },
  { id: 'estudiante-3', name: 'Innovador', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jasper' },
  { id: 'estudiante-4', name: 'Creativa', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Zoe' },
  { id: 'estudiante-5', name: 'Explorador', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Milo' },
  { id: 'estudiante-6', name: 'Líder', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sara' },
  { id: 'estudiante-7', name: 'Analista', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Leo' },
];

const BANNER_PRESETS = [
  {
    id: 'yellow',
    name: 'Amarillo Titi',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="300" viewBox="0 0 1200 300"><rect width="1200" height="300" fill="%23FFD93D"/><circle cx="1100" cy="50" r="180" fill="%23FFE57F" opacity="0.6"/><circle cx="100" cy="250" r="120" fill="%23F6C90E" opacity="0.4"/></svg>',
  },
  {
    id: 'dark',
    name: 'Noche Universitaria',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="300" viewBox="0 0 1200 300"><rect width="1200" height="300" fill="%231A1A2E"/><rect x="1000" y="-50" width="300" height="400" transform="rotate(25 1000 -50)" fill="%2316213E" opacity="0.8"/><circle cx="200" cy="80" r="100" fill="%230F3460" opacity="0.5"/></svg>',
  },
  {
    id: 'cream',
    name: 'Crema Minimal',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="300" viewBox="0 0 1200 300"><rect width="1200" height="300" fill="%23FFFBF0"/><circle cx="950" cy="150" r="150" fill="%23FFE57F" opacity="0.4"/><circle cx="150" cy="50" r="80" fill="%23FFD93D" opacity="0.3"/></svg>',
  },
  {
    id: 'emerald',
    name: 'Selva Boliviana',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="300" viewBox="0 0 1200 300"><rect width="1200" height="300" fill="%23065F46"/><circle cx="1050" cy="80" r="160" fill="%23047857" opacity="0.6"/><rect x="50" y="120" width="200" height="200" transform="rotate(45 50 120)" fill="%23059669" opacity="0.3"/></svg>',
  },
  {
    id: 'ocean',
    name: 'Azul Académico',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="300" viewBox="0 0 1200 300"><rect width="1200" height="300" fill="%231E3A8A"/><circle cx="1150" cy="200" r="180" fill="%232563EB" opacity="0.5"/><circle cx="150" cy="100" r="120" fill="%233B82F6" opacity="0.35"/></svg>',
  },
];

export default function EditProfileModal({ open, user, onSaved, onClose }) {
  const { updateUser } = useAuth();
  const panelRef = usePopIn([open]);

  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');

  const [bannerUrl, setBannerUrl] = useState('');
  const [bannerFile, setBannerFile] = useState(null);
  const [bannerPreview, setBannerPreview] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const avatarInputRef = useRef(null);
  const bannerInputRef = useRef(null);

  useEffect(() => {
    if (open && user) {
      setBio(user.bio || '');
      setAvatarUrl(user.avatarUrl || '');
      setAvatarFile(null);
      setAvatarPreview(user.avatarUrl || '');

      setBannerUrl(user.bannerUrl || '');
      setBannerFile(null);
      setBannerPreview(user.bannerUrl || '');

      setError(null);
    }
  }, [open, user]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e) {
      if (e.key === 'Escape' && !saving) onClose?.();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, saving, onClose]);

  if (!open) return null;

  function handleAvatarFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError('La imagen de avatar no debe superar 2 MB');
      return;
    }
    setError(null);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  function handleSelectAvatarPreset(presetUrl) {
    setAvatarFile(null);
    setAvatarUrl(presetUrl);
    setAvatarPreview(presetUrl);
    setError(null);
  }

  function handleBannerFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      setError('La imagen de portada no debe superar 3 MB');
      return;
    }
    setError(null);
    setBannerFile(file);
    setBannerPreview(URL.createObjectURL(file));
  }

  function handleSelectBannerPreset(presetUrl) {
    setBannerFile(null);
    setBannerUrl(presetUrl);
    setBannerPreview(presetUrl);
    setError(null);
  }

  function handleRemoveBanner() {
    setBannerFile(null);
    setBannerUrl('');
    setBannerPreview('');
    if (bannerInputRef.current) bannerInputRef.current.value = '';
  }

  async function handleSave(e) {
    e.preventDefault();
    if (saving) return;

    if (bio.length > MAX_BIO) {
      setError(`La biografía no puede superar los ${MAX_BIO} caracteres`);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      let finalAvatarUrl = avatarUrl;
      let finalBannerUrl = bannerUrl;

      // 1. Subir avatar si se eligió archivo
      if (avatarFile) {
        const formData = new FormData();
        formData.append('file', avatarFile);
        const { data: avRes } = await client.post('/api/users/me/avatar', formData);
        if (!avRes?.success) {
          throw new Error(avRes?.message || 'Error al subir el avatar');
        }
        finalAvatarUrl = avRes.data.avatarUrl;
      }

      // 2. Subir banner si se eligió archivo
      if (bannerFile) {
        const formData = new FormData();
        formData.append('file', bannerFile);
        const { data: bnRes } = await client.post('/api/users/me/banner', formData);
        if (!bnRes?.success) {
          throw new Error(bnRes?.message || 'Error al subir la portada');
        }
        finalBannerUrl = bnRes.data.bannerUrl;
      }

      // 3. Actualizar campos en PUT /api/users/me
      const { data: putRes } = await client.put('/api/users/me', {
        bio: bio.trim(),
        avatarUrl: finalAvatarUrl,
        bannerUrl: finalBannerUrl || null,
      });

      if (!putRes?.success) {
        throw new Error(putRes?.message || 'Error al actualizar perfil');
      }

      const updatedUser = putRes.data.user;
      updateUser(updatedUser);
      onSaved?.(updatedUser);
      onClose?.();
    } catch (err) {
      console.error('Error guardando perfil:', err);
      setError(err.response?.data?.message || err.message || 'Error de conexión');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="titi-backdrop-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={() => !saving && onClose?.()}
      role="presentation"
    >
      <div
        ref={panelRef}
        className="titi-card w-full max-w-xl max-h-[90vh] flex flex-col p-6 overflow-hidden bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-profile-title"
      >
        {/* Cabecera del modal */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 shrink-0">
          <h2 id="edit-profile-title" className="text-xl font-black text-titi-dark">
            Editar perfil
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="text-gray-400 hover:text-titi-dark text-2xl font-bold leading-none p-1 rounded-lg transition-colors"
            aria-label="Cerrar modal"
          >
            ×
          </button>
        </div>

        {/* Formulario scrolleable */}
        <form onSubmit={handleSave} className="overflow-y-auto py-4 space-y-6 flex-1 pr-1">
          {error && (
            <div className="p-3 bg-red-50 border-2 border-red-500/30 rounded-xl text-red-600 text-sm font-semibold">
              {error}
            </div>
          )}

          {/* Sección Portada / Banner */}
          <div>
            <label className="block text-sm font-bold text-titi-dark mb-2">
              Foto de portada / Banner
            </label>
            <div className="relative w-full h-28 rounded-2xl overflow-hidden border-2 border-dashed border-gray-200 bg-titi-cream/50 flex items-center justify-center mb-3">
              {bannerPreview ? (
                <img
                  src={resolveMediaUrl(bannerPreview)}
                  alt="Vista previa de portada"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xs text-gray-400 font-semibold">Sin portada seleccionada</span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-3">
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleBannerFileChange}
                className="hidden"
                id="banner-file-input"
              />
              <label
                htmlFor="banner-file-input"
                className="titi-btn-ghost text-xs cursor-pointer py-1.5 px-3"
              >
                Subir portada (máx 3MB)
              </label>
              {bannerPreview && (
                <button
                  type="button"
                  onClick={handleRemoveBanner}
                  className="text-xs font-bold text-red-500 hover:underline py-1.5 px-2"
                >
                  Quitar portada
                </button>
              )}
            </div>

            {/* Presets de Banner */}
            <div>
              <span className="text-xs font-bold text-gray-500 block mb-2">O elegí un estilo temático:</span>
              <div className="grid grid-cols-5 gap-2">
                {BANNER_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectBannerPreset(preset.url)}
                    className={`h-10 rounded-xl overflow-hidden border-2 transition-all ${
                      bannerPreview === preset.url
                        ? 'border-titi-yellow ring-2 ring-titi-yellow/40 scale-95'
                        : 'border-transparent hover:border-gray-300'
                    }`}
                    title={preset.name}
                  >
                    <img src={preset.url} alt={preset.name} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Sección Avatar */}
          <div>
            <label className="block text-sm font-bold text-titi-dark mb-2">
              Foto de perfil / Avatar
            </label>
            <div className="flex items-center gap-4 mb-3">
              <div className="w-20 h-20 rounded-full border-4 border-titi-yellow bg-titi-cream overflow-hidden shrink-0 shadow-sm">
                {avatarPreview ? (
                  <img
                    src={resolveMediaUrl(avatarPreview)}
                    alt="Vista previa de avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full grid place-items-center text-2xl font-black text-titi-dark">
                    {user?.username?.[0]?.toUpperCase() ?? '?'}
                  </div>
                )}
              </div>

              <div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleAvatarFileChange}
                  className="hidden"
                  id="avatar-file-input"
                />
                <label
                  htmlFor="avatar-file-input"
                  className="titi-btn-ghost text-xs cursor-pointer py-1.5 px-3 inline-block"
                >
                  Subir foto propia (máx 2MB)
                </label>
                <p className="text-xs text-gray-400 mt-1">Formatos: JPG, PNG, WebP</p>
              </div>
            </div>

            {/* Presets de Avatar */}
            <div>
              <span className="text-xs font-bold text-gray-500 block mb-2">O seleccioná un avatar predefinido:</span>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                {AVATAR_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectAvatarPreset(preset.url)}
                    className={`w-12 h-12 rounded-full overflow-hidden border-2 bg-titi-cream/50 transition-all ${
                      avatarPreview === preset.url
                        ? 'border-titi-yellow ring-2 ring-titi-yellow/40 scale-105'
                        : 'border-gray-200 hover:border-gray-400'
                    }`}
                    title={preset.name}
                  >
                    <img src={preset.url} alt={preset.name} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Sección Biografía */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="bio-input" className="text-sm font-bold text-titi-dark">
                Biografía
              </label>
              <span
                className={`text-xs font-bold tabular-nums ${
                  bio.length >= MAX_BIO ? 'text-red-500' : 'text-gray-400'
                }`}
              >
                {bio.length} / {MAX_BIO}
              </span>
            </div>
            <textarea
              id="bio-input"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={MAX_BIO}
              rows={3}
              className="titi-input resize-none text-sm font-medium"
              placeholder="Contanos algo sobre vos, tus carreras, intereses o pasatiempos…"
              disabled={saving}
            />
          </div>

          {/* Botones de acción */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="titi-btn-ghost text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="titi-btn-primary text-sm disabled:opacity-50"
            >
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
