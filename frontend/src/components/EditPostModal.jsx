import { useEffect, useRef, useState } from 'react';
import client from '../api/client.js';
import { usePopIn } from '../lib/motion.js';

const MAX_LEN = 500;

export default function EditPostModal({ open, post, onSaved, onClose }) {
  const [content, setContent] = useState(post?.content ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const textareaRef = useRef(null);
  const panelRef = usePopIn([open]);

  // Pre-llena cuando se abre o cambia el post objetivo
  useEffect(() => {
    if (open) {
      setContent(post?.content ?? '');
      setError(null);
    }
  }, [open, post]);

  // Focus + caret al final al abrir
  useEffect(() => {
    if (open && textareaRef.current) {
      const ta = textareaRef.current;
      ta.focus();
      const end = ta.value.length;
      ta.setSelectionRange(end, end);
    }
  }, [open]);

  // Escape cierra
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape' && !saving) onClose?.();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, saving, onClose]);

  if (!open) return null;

  async function handleSave() {
    const value = content.trim();
    if (!value) {
      setError('El contenido no puede estar vacío');
      return;
    }
    // Si no cambió nada, cerrar sin pegarle al server
    if (value === (post?.content ?? '').trim()) {
      onClose?.();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { data } = await client.put(`/api/posts/${post.id}`, { content: value });
      if (data?.success) {
        onSaved?.(data.data.post);
        onClose?.();
      } else {
        setError(data?.message || 'No se pudo guardar');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error al editar');
    } finally {
      setSaving(false);
    }
  }

  const unchanged = content.trim() === (post?.content ?? '').trim();

  return (
    <div
      className="titi-backdrop-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={() => !saving && onClose?.()}
      role="presentation"
    >
      <div
        ref={panelRef}
        className="titi-card w-full max-w-lg p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ep-title"
      >
        <h2 id="ep-title" className="text-xl font-bold mb-4">
          Editar post
        </h2>

        <label htmlFor="ep-content" className="sr-only">
          Contenido del post
        </label>
        <textarea
          id="ep-content"
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={5}
          maxLength={MAX_LEN}
          className="titi-input resize-none"
          disabled={saving}
          placeholder="Escribí algo…"
        />

        <div className="flex items-center justify-between mt-2 gap-3">
          <span
            className={`text-xs tabular-nums ${
              content.length >= MAX_LEN ? 'text-titi-yellow-dark' : 'text-gray-500'
            }`}
          >
            {content.length}/{MAX_LEN}
          </span>
          {error && (
            <span className="text-sm text-titi-yellow-dark" role="alert">
              {error}
            </span>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="titi-btn-ghost disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !content.trim() || unchanged}
            className="titi-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
