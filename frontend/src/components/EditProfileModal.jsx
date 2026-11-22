import { useEffect, useRef, useState } from 'react';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { resolveMediaUrl } from '../lib/format.js';
import { usePopIn } from '../lib/motion.js';
import { CheckIcon, CloseIcon, ImageIcon, PencilIcon, UserIcon } from './icons.jsx';
import { BTN_SECONDARY, BTN_SECONDARY_SM, RoleBadge } from './ui/v3.jsx';

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
        className="w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden bg-white rounded-2xl border-2 border-titi-dark shadow-[0_8px_0_#1A1A2E]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-profile-title"
      >
        {/* Cabecera del modal */}
        <div className="flex items-center gap-3 px-5 py-4 border-b-2 border-titi-dark shrink-0">
          <RoleBadge Icon={PencilIcon} solid="bg-titi-yellow" size="sm" />
          <h2 id="edit-profile-title" className="text-xl font-black text-titi-dark">
            Editar <span className="text-titi-streak">perfil</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="ml-auto w-9 h-9 grid place-items-center rounded-full text-gray-500 hover:text-titi-dark hover:bg-gray-100 active:scale-90 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-titi-yellow disabled:opacity-50"
            aria-label="Cerrar"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario scrolleable */}
        <form onSubmit={handleSave} className="flex-1 flex flex-col min-h-0">
          <div className="overflow-y-auto px-5 py-4 space-y-6 flex-1">
            {error && (
              <div role="alert" className="bg-red-50 border-2 border-red-500 rounded-2xl p-3 flex items-start gap-3">
                <span aria-hidden="true" className="w-8 h-8 rounded-full bg-red-500 grid place-items-center shrink-0 text-white text-sm font-black">
                  !
                </span>
                <p className="text-sm font-bold text-red-700 pt-1.5">{error}</p>
              </div>
            )}

            {/* Portada */}
            <fieldset>
              <legend className="flex items-center gap-2 text-base font-extrabold text-titi-dark mb-2">
                <ImageIcon className="w-5 h-5 text-titi-streak" />
                Portada
              </legend>
              <div className="relative w-full h-28 rounded-2xl overflow-hidden border-2 border-dashed border-gray-300 bg-titi-cream grid place-items-center mb-3">
                {bannerPreview ? (
                  <img src={resolveMediaUrl(bannerPreview)} alt="Vista previa de la portada" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm font-bold text-gray-500">Sin portada</span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 mb-3">
                <input
                  ref={bannerInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleBannerFileChange}
                  className="sr-only"
                  id="banner-file-input"
                />
                <label htmlFor="banner-file-input" className={`${BTN_SECONDARY_SM} cursor-pointer`}>
                  <ImageIcon className="w-4 h-4" />
                  Subir portada
                </label>
                <span className="text-xs font-semibold text-gray-500">JPG, PNG o WebP · máx. 3 MB</span>
                {bannerPreview && (
                  <button
                    type="button"
                    onClick={handleRemoveBanner}
                    className="ml-auto text-sm font-bold uppercase tracking-wide text-red-500 hover:text-red-600 active:scale-95 transition-all duration-150"
                  >
                    Quitar
                  </button>
                )}
              </div>

              <p className="text-sm font-bold text-gray-500 mb-2">O elegí un estilo:</p>
              <div className="grid grid-cols-5 gap-2">
                {BANNER_PRESETS.map((preset) => {
                  const active = bannerPreview === preset.url;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectBannerPreset(preset.url)}
                      aria-pressed={active}
                      aria-label={preset.name}
                      title={preset.name}
                      className={`relative h-11 rounded-xl overflow-hidden border-2 transition-all duration-150 active:translate-y-0.5 active:shadow-none focus:outline-none focus-visible:ring-4 focus-visible:ring-titi-yellow/60 ${
                        active ? 'border-titi-dark shadow-[0_3px_0_#1A1A2E]' : 'border-gray-200 shadow-[0_3px_0_#E5E7EB] hover:border-titi-dark'
                      }`}
                    >
                      <img src={preset.url} alt="" className="w-full h-full object-cover" />
                      {active && (
                        <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-titi-yellow border-2 border-titi-dark grid place-items-center">
                          <CheckIcon className="w-3 h-3" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* Avatar */}
            <fieldset>
              <legend className="flex items-center gap-2 text-base font-extrabold text-titi-dark mb-2">
                <UserIcon className="w-5 h-5 text-titi-streak" />
                Foto de perfil
              </legend>
              <div className="flex items-center gap-4 mb-3">
                <div className="w-20 h-20 rounded-full border-2 border-titi-dark bg-titi-yellow overflow-hidden shrink-0">
                  {avatarPreview ? (
                    <img src={resolveMediaUrl(avatarPreview)} alt="Vista previa del avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-3xl font-black text-titi-dark uppercase">
                      {user?.username?.[0] ?? '?'}
                    </div>
                  )}
                </div>
                <div>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleAvatarFileChange}
                    className="sr-only"
                    id="avatar-file-input"
                  />
                  <label htmlFor="avatar-file-input" className={`${BTN_SECONDARY_SM} cursor-pointer`}>
                    <ImageIcon className="w-4 h-4" />
                    Subir foto
                  </label>
                  <p className="text-xs font-semibold text-gray-500 mt-1.5">JPG, PNG o WebP · máx. 2 MB</p>
                </div>
              </div>

              <p className="text-sm font-bold text-gray-500 mb-2">O elegí un avatar:</p>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                {AVATAR_PRESETS.map((preset) => {
                  const active = avatarPreview === preset.url;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectAvatarPreset(preset.url)}
                      aria-pressed={active}
                      aria-label={preset.name}
                      title={preset.name}
                      className={`relative w-12 h-12 rounded-full border-2 bg-titi-cream transition-all duration-150 active:scale-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-titi-yellow/60 ${
                        active ? 'border-titi-dark ring-4 ring-titi-yellow' : 'border-gray-200 hover:border-titi-dark'
                      }`}
                    >
                      <img src={preset.url} alt="" className="w-full h-full rounded-full object-cover" />
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* Biografía */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="bio-input" className="flex items-center gap-2 text-base font-extrabold text-titi-dark">
                  <PencilIcon className="w-5 h-5 text-titi-streak" />
                  Biografía
                </label>
                <span className={`text-xs font-bold tabular-nums ${bio.length >= MAX_BIO ? 'text-red-500' : 'text-gray-500'}`}>
                  {bio.length} / {MAX_BIO}
                </span>
              </div>
              <textarea
                id="bio-input"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={MAX_BIO}
                rows={3}
                className="w-full bg-white border-2 border-gray-200 rounded-xl px-4 py-3 text-base font-medium text-titi-dark placeholder:text-gray-400 resize-none hover:border-gray-300 focus:outline-none focus:border-titi-dark focus:ring-4 focus:ring-titi-yellow/40 transition-all duration-150"
                placeholder="Contanos algo sobre vos: tu carrera, qué estás aprendiendo, qué te gusta…"
                disabled={saving}
              />
            </div>
          </div>

          {/* Acciones */}
          <div className="flex items-center justify-end gap-3 px-5 py-4 border-t-2 border-gray-100 shrink-0">
            <button type="button" onClick={onClose} disabled={saving} className={BTN_SECONDARY}>
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="titi-btn-primary text-sm">
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
