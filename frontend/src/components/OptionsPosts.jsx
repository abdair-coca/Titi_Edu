import { useEffect, useRef, useState } from 'react';
import client from '../api/client.js';
import ConfirmModal from './ConfirmModal.jsx';
import EditPostModal from './EditPostModal.jsx';

// ---- Iconos inline (sin dependencias) ----
const DotsIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...p}>
    <circle cx="12" cy="5" r="1.6" />
    <circle cx="12" cy="12" r="1.6" />
    <circle cx="12" cy="19" r="1.6" />
  </svg>
);
const EditIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
  </svg>
);
const TrashIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
    <polyline points="3 6 5 6 21 6" />
    <path d="m19 6-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);
const LinkIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);
const CopyIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

export default function OptionsPosts({
  user,
  post,
  onDelete,
  onEdit,
  titleModal,
  messageModal,
  confirmText,
  cancelText,
}) {
  const isOwner = Boolean(user && user.username === post?.author);

  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);

  const wrapperRef = useRef(null);
  const buttonRef = useRef(null);

  // Cerrar al clickear fuera o presionar Escape
  useEffect(() => {
    if (!showMenu) return;
    function onMouseDown(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    }
    function onKey(e) {
      if (e.key === 'Escape') {
        setShowMenu(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [showMenu]);

  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const { data } = await client.delete(`/api/posts/${post.id}`);
      if (data?.success) {
        onDelete?.(post.id);
        setShowDeleteModal(false);
        setShowMenu(false);
      } else {
        setDeleteError(data?.message || 'No se pudo eliminar');
      }
    } catch (err) {
      setDeleteError(err.response?.data?.message || err.message || 'Error al eliminar');
    } finally {
      setDeleting(false);
    }
  }

  function handleEdited(updated) {
    onEdit?.(updated);
    setShowEditModal(false);
  }

  async function copyToClipboard(text, key) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback navegadores antiguos
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1200);
      setTimeout(() => setShowMenu(false), 900);
    } catch {
      window.prompt('Copiá manualmente:', text);
    }
  }

  function handleCopyLink() {
    const url = `${window.location.origin}/profile/${post.author}`;
    copyToClipboard(url, 'link');
  }
  function handleCopyContent() {
    copyToClipboard(post.content || '', 'content');
  }

  // No mostrar el botón si no hay nada útil para ofrecer (post sin autor, etc.)
  if (!post?.id || !post?.author) return null;

  return (
    <div className="relative ml-auto" ref={wrapperRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setShowMenu((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={showMenu}
        aria-label="Opciones del post"
        className="w-9 h-9 grid place-items-center rounded-xl border-2 border-transparent text-gray-500 hover:border-titi-dark hover:bg-titi-yellow hover:text-titi-dark active:scale-95 transition-all duration-150 focus:outline-none focus-visible:ring-4 focus-visible:ring-titi-yellow/60"
      >
        <DotsIcon className="w-5 h-5" />
      </button>

      {showMenu && (
        <div
          role="menu"
          aria-label="Acciones del post"
          className="absolute right-0 top-full mt-2 w-56 bg-white border-2 border-titi-dark rounded-2xl shadow-[0_5px_0_#1A1A2E] overflow-hidden z-30 py-1"
        >
          {isOwner ? (
            <>
              <MenuItem
                icon={<EditIcon className="w-4 h-4" />}
                onClick={() => {
                  setShowEditModal(true);
                  setShowMenu(false);
                }}
              >
                Editar
              </MenuItem>
              <MenuItem
                icon={<TrashIcon className="w-4 h-4" />}
                danger
                onClick={() => {
                  setDeleteError(null);
                  setShowDeleteModal(true);
                  setShowMenu(false);
                }}
              >
                Eliminar
              </MenuItem>
              <Divider />
            </>
          ) : null}

          <MenuItem
            icon={<LinkIcon className="w-4 h-4" />}
            onClick={handleCopyLink}
            copied={copiedKey === 'link'}
          >
            {copiedKey === 'link' ? '¡Copiado!' : 'Copiar enlace al perfil'}
          </MenuItem>

          {post.content && (
            <MenuItem
              icon={<CopyIcon className="w-4 h-4" />}
              onClick={handleCopyContent}
              copied={copiedKey === 'content'}
            >
              {copiedKey === 'content' ? '¡Copiado!' : 'Copiar texto del post'}
            </MenuItem>
          )}

          {!isOwner && (
            <>
              <Divider />
              <div className="px-4 py-2 text-xs font-medium text-gray-500">
                Solo el autor puede editar o eliminar este post.
              </div>
            </>
          )}
        </div>
      )}

      <ConfirmModal
        open={showDeleteModal}
        title={titleModal || 'Eliminar post'}
        message={
          deleteError ||
          messageModal ||
          '¿Seguro que querés eliminar este post? Esta acción no se puede deshacer.'
        }
        confirmText={deleting ? 'Eliminando…' : confirmText || 'Eliminar'}
        cancelText={cancelText || 'Cancelar'}
        onConfirm={handleDelete}
        onCancel={() => {
          if (!deleting) {
            setShowDeleteModal(false);
            setDeleteError(null);
          }
        }}
        danger
      />

      <EditPostModal
        open={showEditModal}
        post={post}
        onSaved={handleEdited}
        onClose={() => setShowEditModal(false)}
      />
    </div>
  );
}

function MenuItem({ icon, children, onClick, danger = false, copied = false }) {
  // Per design.md sección 2:
  //   danger  → rojo (#EF4444 / red-500 + red-50 hover)
  //   copied  → verde de éxito (#22C55E / green-600 + green-50)
  //   normal  → texto oscuro sobre crema en hover
  return (
    <button
      role="menuitem"
      type="button"
      onClick={onClick}
      className={`w-full text-left px-4 py-2 flex items-center gap-3 text-sm font-semibold transition-colors focus:outline-none ${
        danger
          ? 'text-red-500 hover:bg-red-50 focus:bg-red-50'
          : copied
          ? 'text-green-600 bg-green-50'
          : 'text-titi-dark hover:bg-titi-cream focus:bg-titi-cream'
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{children}</span>
    </button>
  );
}

function Divider() {
  return <div className="h-px bg-gray-100 my-1" aria-hidden="true" />;
}
