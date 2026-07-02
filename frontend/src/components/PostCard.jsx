import { useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { resolveMediaUrl, relativeTime } from '../lib/format.js';
import CommentSection from './CommentSection.jsx';
import OptionsPosts from './OptionsPosts.jsx';

// ---- Iconos ----
const HeartIcon = ({ filled, className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

const CommentIcon = ({ className }) => (
  <svg
    className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
  >
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </svg>
);

const MusicIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
);

const PinIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const BookmarkIcon = ({ filled, className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </svg>
);

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
      </Link>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return <p className="whitespace-pre-wrap leading-relaxed text-titi-dark">{parts}</p>;
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

  const imageUrl = resolveMediaUrl(post.imageUrl);

  async function toggleLike() {
    if (!isAuthenticated || liking) return;
    const prevLiked = likedByMe;
    const prevLikes = likes;
    setLikedByMe(!prevLiked);
    setLikes(prevLikes + (prevLiked ? -1 : 1));
    setLiking(true);
    try {
      const { data } = await client.post(`/api/posts/${post.id}/like`);
      if (data?.success) {
        setLikedByMe(Boolean(data.data.liked));
        setLikes(Number(data.data.likes ?? 0));
        onChange?.({ id: post.id, liked: data.data.liked, likes: data.data.likes });
      } else {
        setLikedByMe(prevLiked); setLikes(prevLikes);
      }
    } catch {
      setLikedByMe(prevLiked); setLikes(prevLikes);
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

  return (
    <article className="bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-gray-100 overflow-hidden mb-6 hover:shadow-lg transition-shadow">
      {/* Header */}
      <header className="flex items-center gap-3 px-5 py-4">
        <Link to={`/profile/${post.author}`} className="shrink-0">
          {post.authorAvatar ? (
            <img
              src={post.authorAvatar}
              alt={post.author}
              className="w-11 h-11 rounded-full bg-titi-cream border-2 border-titi-yellow"
            />
          ) : (
            <div className="w-11 h-11 rounded-full bg-titi-yellow text-titi-dark grid place-items-center font-extrabold border-2 border-titi-yellow">
              {post.author?.[0]?.toUpperCase() ?? '?'}
            </div>
          )}
        </Link>
        <div className="min-w-0">
          <Link to={`/profile/${post.author}`} className="font-extrabold text-titi-dark hover:text-blue-500 transition-colors">
            @{post.author}
          </Link>
          <p className="text-xs text-gray-500 font-semibold">{relativeTime(post.createdAt)}</p>
        </div>
        <OptionsPosts user={user} post={post} onDelete={onDelete} onEdit={onEdit} />
      </header>

      {/* Imagen */}
      {imageUrl && (
        <div className="bg-titi-cream">
          <img src={imageUrl} alt="" className="w-full max-h-[600px] object-cover" loading="lazy" />
        </div>
      )}

      {/* Contenido */}
      {post.content && (
        <div className="px-5 pt-4">
          <ContentWithHashtags text={post.content} />
        </div>
      )}

      {/* Sonido + Ubicación */}
      {(post.sound || post.location) && (
        <div className="px-5 pt-3 flex flex-wrap gap-3 text-xs text-gray-500">
          {post.sound && (
            <span className="inline-flex items-center gap-1.5 max-w-full">
              <MusicIcon className="w-3.5 h-3.5 text-titi-streak shrink-0" />
              <span className="truncate">
                <span className="text-titi-dark font-bold">{post.sound.name}</span>
                {post.sound.artist && <span> — {post.sound.artist}</span>}
              </span>
            </span>
          )}
          {post.location && (
            <span className="inline-flex items-center gap-1.5">
              <PinIcon className="w-3.5 h-3.5 text-green-600 shrink-0" />
              <span className="font-semibold">{post.location.city}, {post.location.country}</span>
            </span>
          )}
        </div>
      )}

      {/* Hashtags chips amarillos */}
      {post.hashtags?.length > 0 && (
        <div className="px-5 pt-3 flex flex-wrap gap-2">
          {post.hashtags.map((tag) => (
            <Link
              key={tag}
              to={`/hashtag/${tag.toLowerCase()}`}
              className="inline-block text-xs font-extrabold text-titi-dark bg-titi-yellow/40 hover:bg-titi-yellow/70 px-3 py-1 rounded-full transition-colors"
            >
              #{tag}
            </Link>
          ))}
        </div>
      )}

      {/* Footer acciones */}
      <footer className="px-5 py-4 mt-2 border-t border-gray-100 flex items-center gap-2">
        <button
          type="button"
          onClick={toggleLike}
          disabled={!isAuthenticated || liking}
          aria-pressed={likedByMe}
          aria-label={likedByMe ? 'Quitar like' : 'Dar like'}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full font-bold transition-all ${
            likedByMe
              ? 'text-red-500 bg-red-500/10 scale-105'
              : 'text-gray-500 hover:bg-titi-cream hover:text-red-500'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <HeartIcon filled={likedByMe} className="w-5 h-5" />
          <span className="text-sm tabular-nums">{likes}</span>
        </button>

        <button
          type="button"
          onClick={() => setShowComments((v) => !v)}
          aria-expanded={showComments}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full font-bold text-gray-500 hover:bg-titi-cream hover:text-blue-500 transition-colors"
        >
          <CommentIcon className="w-5 h-5" />
          <span className="text-sm tabular-nums">{commentCount}</span>
        </button>

        <button
          type="button"
          onClick={toggleSave}
          disabled={!isAuthenticated || saving}
          aria-pressed={savedByMe}
          aria-label={savedByMe ? 'Quitar de guardados' : 'Guardar post'}
          className={`ml-auto flex items-center gap-2 px-3 py-1.5 rounded-full font-bold transition-all ${
            savedByMe
              ? 'text-titi-yellow-dark bg-titi-yellow-light scale-105'
              : 'text-gray-500 hover:bg-titi-cream hover:text-titi-yellow-dark'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <BookmarkIcon filled={savedByMe} className="w-5 h-5" />
          <span className="text-sm">{savedByMe ? 'Guardado' : 'Guardar'}</span>
        </button>
      </footer>

      {showComments && (
        <CommentSection
          postId={post.id}
          initialCount={commentCount}
          onCountChange={setCommentCount}
        />
      )}
    </article>
  );
}
