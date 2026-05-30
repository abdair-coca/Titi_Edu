import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import client from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(false);

  // Sincroniza storage cuando cambian user/token
  useEffect(() => {
    if (token) localStorage.setItem('token', token);
    else localStorage.removeItem('token');
  }, [token]);

  useEffect(() => {
    if (user) localStorage.setItem('user', JSON.stringify(user));
    else localStorage.removeItem('user');
  }, [user]);

  const login = useCallback(async (email, password) => {
    setLoading(true);
    try {
      const { data } = await client.post('/api/auth/login', { email, password });
      if (!data?.success) throw new Error(data?.message || 'Error de login');
      setUser(data.data.user);
      setToken(data.data.token);
      return data.data.user;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (username, email, password) => {
    setLoading(true);
    try {
      const { data } = await client.post('/api/auth/register', { username, email, password });
      if (!data?.success) throw new Error(data?.message || 'Error de registro');
      setUser(data.data.user);
      setToken(data.data.token);
      return data.data.user;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }, []);

  // Refresca perfil propio desde /api/users/me (útil si user en localStorage está stale)
  const refreshMe = useCallback(async () => {
    if (!token) return null;
    try {
      const { data } = await client.get('/api/users/me');
      if (data?.success) {
        setUser((prev) => ({ ...(prev || {}), ...data.data.user }));
        return data.data.user;
      }
    } catch (err) {
      if (err.response?.status === 401) logout();
    }
    return null;
  }, [token, logout]);

  const value = {
    user,
    token,
    loading,
    isAuthenticated: Boolean(token && user),
    login,
    register,
    logout,
    refreshMe,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}

export default AuthContext;
