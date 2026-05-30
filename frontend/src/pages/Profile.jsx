import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { formatDate } from '../lib/format.js';

export default function Profile() {
  const { username } = useParams();
  const { isAuthenticated } = useAuth();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [following, setFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followBusy, setFollowBusy] = useState(false);
  const [isSelf, setIsSelf] = useState(false);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await client.get(`/api/users/${username}`);
      if (data?.success) {
        const { user, stats, isFollowing, isSelf } = data.data;
        setProfile({ user, stats });
        setFollowing(Boolean(isFollowing));
        setFollowerCount(stats?.followerCount ?? 0);
        setIsSelf(Boolean(isSelf));
      } else {
        setError(data?.message || 'Usuario no encontrado');
      }
    } catch (err) {
      const status = err.response?.status;
      const msg =
        status === 404
          ? 'Usuario no encontrado'
          : err.response?.data?.message || err.message || 'Error de red';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  async function toggleFollow() {
    if (!isAuthenticated || isSelf || followBusy) return;
    const wasFollowing = following;
    // Optimistic
    setFollowing(!wasFollowing);
    setFollowerCount((c) => c + (wasFollowing ? -1 : 1));
    setFollowBusy(true);
    try {
      const url = wasFollowing
        ? `/api/users/${username}/unfollow`
        : `/api/users/${username}/follow`;
      const { data } = await client.post(url);
      if (!data?.success) {
        // Revert
        setFollowing(wasFollowing);
        setFollowerCount((c) => c + (wasFollowing ? 1 : -1));
      }
    } catch {
      setFollowing(wasFollowing);
      setFollowerCount((c) => c + (wasFollowing ? 1 : -1));
    } finally {
      setFollowBusy(false);
    }
  }

  if (loading) return <ProfileSkeleton />;

  if (error) {
    return (
      <div className="neo-card p-8 text-center">
        <h2 className="text-xl font-bold mb-2 text-neo-accent">Ups…</h2>
        <p className="text-neo-muted mb-4">{error}</p>
        <button onClick={fetchProfile} className="neo-btn-primary">
          Reintentar
        </button>
      </div>
    );
  }

  if (!profile) return null;

  const { user, stats } = profile;

  return (
    <div>
      {/* Header del perfil */}
      <div className="neo-card p-6 mb-6">
        <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start text-center sm:text-left">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.username}
              className="w-28 h-28 rounded-full bg-neo-bg border border-neo-border shrink-0"
            />
          ) : (
            <div className="w-28 h-28 rounded-full bg-neo-accent/20 text-neo-accent grid place-items-center text-4xl font-bold shrink-0">
              {user.username?.[0]?.toUpperCase() ?? '?'}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mb-2">
              <h1 className="text-2xl font-extrabold">@{user.username}</h1>
              {!isSelf && isAuthenticated && (
                <button
                  type="button"
                  onClick={toggleFollow}
                  disabled={followBusy}
                  className={
                    following
                      ? 'neo-btn-ghost text-sm disabled:opacity-50'
                      : 'neo-btn-primary text-sm disabled:opacity-50'
                  }
                >
                  {followBusy ? '…' : following ? 'Siguiendo' : 'Seguir'}
                </button>
              )}
              {isSelf && (
                <span className="neo-chip">Vos</span>
              )}
            </div>

            {user.bio ? (
              <p className="text-white/90 whitespace-pre-wrap mb-2">{user.bio}</p>
            ) : (
              <p className="text-neo-muted italic mb-2">Sin biografía.</p>
            )}

            {user.createdAt && (
              <p className="text-xs text-neo-muted">
                Se unió el {formatDate(user.createdAt)}
              </p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-neo-border">
          <Stat label="Posts" value={stats.postCount} />
          <Stat label="Seguidores" value={followerCount} />
          <Stat label="Seguidos" value={stats.followingCount} />
        </div>
      </div>

      {/* Espacio para futura lista de posts del usuario */}
      <div className="neo-card p-6 text-center">
        <h3 className="text-lg font-bold mb-1">Posts de @{user.username}</h3>
        <p className="text-sm text-neo-muted">
          La línea de tiempo del usuario aparecerá acá próximamente.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="text-center">
      <p className="text-2xl font-extrabold tabular-nums">{value ?? 0}</p>
      <p className="text-xs uppercase tracking-wide text-neo-muted">{label}</p>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="neo-card p-6 animate-pulse">
      <div className="flex gap-6">
        <div className="w-28 h-28 rounded-full bg-neo-border shrink-0" />
        <div className="flex-1 space-y-3 pt-3">
          <div className="h-5 w-40 bg-neo-border rounded" />
          <div className="h-3 w-3/4 bg-neo-border rounded" />
          <div className="h-3 w-1/2 bg-neo-border rounded" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-neo-border">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-2 text-center">
            <div className="h-6 w-12 bg-neo-border rounded mx-auto" />
            <div className="h-2 w-16 bg-neo-border rounded mx-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
