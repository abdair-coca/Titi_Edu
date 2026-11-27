import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { resolveMediaUrl, relativeTime } from '../lib/format.js';
import CommentSection from './CommentSection.jsx';
import OptionsPosts from './OptionsPosts.jsx';
import Avatar from './social/Avatar.jsx';
import { BookmarkIcon, CommentIcon, HeartIcon, MusicIcon, PinIcon } from './icons.jsx';

// Post v3 (rediseno-inicio-explorar R4): superficie con borde oscuro; lo que
// reacciona son las acciones de adentro. Doble toque en la imagen = like.

const DOUBLE_TAP_MS = 300;

function ContentWithHashtags({ text }) {
  if (!text) return null;
  const parts = [];
  const regex = /#(\w+)/g;
  let lastIndex = 0;
  let match;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const tag = match[1];
    parts.push(
      <Link key={`h-${key++}`} to={`/hashtag/${tag.toLowerCase()}`} className="text-blue-500 font-bold hover:underline">
        #{tag}
      </Link>,
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return <p className="whitespace-pre-wrap break-words text-base font-medium leading-relaxed text-titi-dark">{parts}</p>;
}

/** Botón pastilla de acción: blanco en reposo, color sólido del rol al activarse. */
function ActionPill({ active, activeClass, onClick, disabled, label, pressed, expanded, children, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={pressed}
      aria-expanded={expanded}
      className={[
        'group inline-flex items-center gap-1.5 h-10 px-3 rounded-xl border-2 text-sm font-extrabold select-none',
        'transition-all duration-150 active:translate-y-0.5 active:shadow-none motion-reduce:transition-none',
        'focus:outline-none focus-visible:ring-4 focus-visible:ring-titi-yellow/60',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:translate-y-0',
        active
          ? `${activeClass} border-titi-dark shadow-[0_3px_0_#1A1A2E]`
          : 'bg-white border-gray-200 text-titi-dark shadow-[0_3px_0_#E5E7EB] hover:border-titi-dark',
        className,
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function MetaChip({ Icon, solid, children }) {
  return (
    <span className="inline-flex items-center gap-1.5 h-8 pl-1 pr-3 max-w-full rounded-full bg-titi-cream border-2 border-gray-200 text-xs font-bold text-titi-dark">
      <span className={`w-6 h-6 rounded-full grid place-items-center text-white shrink-0 ${solid}`}>
        <Icon className="w-3.5 h-3.5" />
      </span>
      <span className="truncate">{children}</span>
    </span>
  );
}

export default function PostCard({ post, onChange, onDelete, onEdit }) {
  const { user, isAuthenticated } = useAuth();
  const [likes, setLikes] = useState(post.likes ?? 0);
  const [likedByMe, setLikedByMe] = useState(Boolean(post.likedByMe));
  const [liking, setLiking] = useState(false);
  const [savedByMe, setSavedByMe] = useState(Boolean(post.savedByMe));
  const [saving, setSaving] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentCount, setCommentCount] = useState(post.comments ?? 0);
  // Cambia en cada like para re-disparar las animaciones (corazón que late / estalla).
  const [beat, setBeat] = useState(0);
  const [burst, setBurst] = useState(0);
  const lastTap = useRef(0);

  const imageUrl = resolveMediaUrl(post.imageUrl);

  async function toggleLike() {
    if (!isAuthenticated || liking) return;
    const prevLiked = likedByMe;
    const prevLikes = likes;
    setLikedByMe(!prevLiked);
    setLikes(prevLikes + (prevLiked ? -1 : 1));
    if (!prevLiked) setBeat((b) => b + 1);
    setLiking(true);
    try {
      const { data } = await client.post(`/api/posts/${post.id}/like`);
      if (data?.success) {
        setLikedByMe(Boolean(data.data.liked));
        setLikes(Number(data.data.likes ?? 0));
        onChange?.({ id: post.id, liked: data.data.liked, likes: data.data.likes });
      } else {
        setLikedByMe(prevLiked);
        setLikes(prevLikes);
      }
    } catch {
      setLikedByMe(prevLiked);
      setLikes(prevLikes);
    } finally {
      setLiking(false);
    }
  }

  async function toggleSave() {
    if (!isAuthenticated || saving) return;
    const prevSaved = savedByMe;
    setSavedByMe(!prevSaved);
    setSaving(true);
    try {
      const { data } = await client.post(`/api/posts/${post.id}/save`);
      if (data?.success) {
        setSavedByMe(Boolean(data.data.saved));
        onChange?.({ id: post.id, saved: data.data.saved });
      } else {
        setSavedByMe(prevSaved);
      }
    } catch {
      setSavedByMe(prevSaved);
    } finally {
      setSaving(false);
    }
  }

  // Doble toque/clic en la imagen: da like (nunca lo quita) y el corazón estalla.
  function likeFromImage() {
    setBurst((b) => b + 1);
    if (!likedByMe) toggleLike();
  }
  function onImagePointerUp(e) {
    if (e.pointerType === 'mouse') return; // el mouse usa onDoubleClick
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0;
      likeFromImage();
    } else {
      lastTap.current = now;
    }
  }

  return (
    <article className="bg-white rounded-2xl border-2 border-titi-dark shadow-[0_2px_8px_rgba(0,0,0,0.06)] mb-5">
      <header className="flex items-center gap-3 px-4 sm:px-5 pt-4 pb-3">
        <Link to={`/profile/${post.author}`} className="shrink-0 rounded-full focus:outline-none focus-visible:ring-4 focus-visible:ring-titi-yellow/60">
          <Avatar username={post.author} src={post.authorAvatar} />
        </Link>
        <div className="min-w-0">
          <Link to={`/profile/${post.author}`} className="block font-extrabold text-titi-dark hover:text-blue-500 transition-colors truncate">
            @{post.author}
          </Link>
          <p className="text-xs text-gray-400 font-semibold">{relativeTime(post.createdAt)}</p>
        </div>
        <OptionsPosts user={user} post={post} onDelete={onDelete} onEdit={onEdit} />
      </header>

      {post.content && (
        <div className="px-4 sm:px-5 pb-3">
          <ContentWithHashtags text={post.content} />
        </div>
      )}

      {imageUrl && (
        <div
          className="relative bg-titi-cream border-y-2 border-titi-dark select-none touch-manipulation"
          onDoubleClick={isAuthenticated ? likeFromImage : undefined}
          onPointerUp={isAuthenticated ? onImagePointerUp : undefined}
        >
          <img src={imageUrl} alt="" className="w-full max-h-[560px] object-cover" loading="lazy" draggable={false} />
          {burst > 0 && (
            <span key={burst} aria-hidden="true" className="titi-heart-burst absolute inset-0 grid place-items-center pointer-events-none">
              <HeartIcon filled className="w-24 h-24 text-red-500 drop-shadow-[0_4px_0_#1A1A2E]" />
            </span>
          )}
        </div>
      )}

      {(post.sound || post.location || post.hashtags?.length > 0) && (
        <div className="px-4 sm:px-5 pt-3 flex flex-wrap gap-2">
          {post.sound && (
            <MetaChip Icon={MusicIcon} solid="bg-titi-streak">
              {post.sound.name}
              {post.sound.artist && <span className="font-semibold text-gray-500"> · {post.sound.artist}</span>}
            </MetaChip>
          )}
          {post.location && (
            <MetaChip Icon={PinIcon} solid="bg-green-500">
              {post.location.city}, {post.location.country}
            </MetaChip>
          )}
          {post.hashtags?.map((tag) => (
            <Link
              key={tag}
              to={`/hashtag/${tag.toLowerCase()}`}
              className="inline-flex items-center h-8 px-3 rounded-full bg-white border-2 border-gray-200 text-xs font-extrabold text-titi-dark hover:border-titi-dark hover:bg-titi-yellow-light active:scale-95 transition-all duration-150"
            >
              #{tag}
            </Link>
          ))}
        </div>
      )}

      <footer className="px-4 sm:px-5 pt-3 pb-4 flex items-center gap-2">
        <ActionPill
          active={likedByMe}
          activeClass="bg-red-500 text-white"
          onClick={toggleLike}
          disabled={!isAuthenticated || liking}
          pressed={likedByMe}
          label={likedByMe ? 'Quitar like' : 'Dar like'}
        >
          <span key={beat} className={beat > 0 && likedByMe ? 'titi-heart-beat inline-grid' : 'inline-grid'}>
            <HeartIcon filled={likedByMe} className={`w-5 h-5 ${likedByMe ? '' : 'group-hover:text-red-500'}`} />
          </span>
          <span className="tabular-nums">{likes}</span>
        </ActionPill>

        <ActionPill
          active={showComments}
          activeClass="bg-blue-500 text-white"
          onClick={() => setShowComments((v) => !v)}
          expanded={showComments}
          label={`Comentarios (${commentCount})`}
        >
          <CommentIcon className="w-5 h-5" />
          <span className="tabular-nums">{commentCount}</span>
        </ActionPill>

        <ActionPill
          active={savedByMe}
          activeClass="bg-titi-yellow text-titi-dark"
          onClick={toggleSave}
          disabled={!isAuthenticated || saving}
          pressed={savedByMe}
          label={savedByMe ? 'Quitar de guardados' : 'Guardar post'}
          className="ml-auto"
        >
          <BookmarkIcon filled={savedByMe} className="w-5 h-5" />
          <span className="hidden sm:inline">{savedByMe ? 'Guardado' : 'Guardar'}</span>
        </ActionPill>
      </footer>

      {showComments && (
        <div className="border-t-2 border-gray-100">
          <CommentSection postId={post.id} initialCount={commentCount} onCountChange={setCommentCount} />
        </div>
      )}
    </article>
  );
}

/** Silueta del post v3 para la carga. */
export function PostCardSkeleton({ withImage = false }) {
  return (
    <div className="bg-white rounded-2xl border-2 border-gray-200 mb-5 animate-pulse motion-reduce:animate-none">
      <div className="flex items-center gap-3 px-5 pt-4 pb-3">
        <div className="w-11 h-11 rounded-full bg-gray-100" />
        <div className="space-y-2">
          <div className="h-3 w-28 bg-gray-100 rounded-full" />
          <div className="h-3 w-16 bg-gray-100 rounded-full" />
        </div>
      </div>
      <div className="px-5 pb-3 space-y-2">
        <div className="h-3 w-full bg-gray-100 rounded-full" />
        <div className="h-3 w-4/5 bg-gray-100 rounded-full" />
      </div>
      {withImage && <div className="h-56 bg-gray-100 border-y-2 border-gray-200" />}
      <div className="px-5 pt-3 pb-4 flex gap-2">
        <div className="h-10 w-16 bg-gray-100 rounded-xl" />
        <div className="h-10 w-16 bg-gray-100 rounded-xl" />
        <div className="h-10 w-24 bg-gray-100 rounded-xl ml-auto" />
      </div>
    </div>
  );
}
