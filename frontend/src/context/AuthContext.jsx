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
  // Solo arranca en true si había token guardado: valida la sesión contra el
  // server antes del primer render protegido. Guests: false desde el inicio.
  const [initializing, setInitializing] = useState(() => Boolean(localStorage.getItem('token')));

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

  // Merge parcial al usuario (útil para actualizar racha sin re-fetch)
  const updateUser = useCallback((partial) => {
    if (!partial) return;
    setUser((prev) => (prev ? { ...prev, ...partial } : prev));
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

  // Sesión invalidada por el server (401 con token presente, ver client.js):
  // solo limpia estado, el redirect lo hacen los guards del router al re-renderizar.
  useEffect(() => {
    function handleUnauthorized() {
      logout();
    }
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [logout]);

  // Valida el token guardado contra el server antes del primer render
  // protegido: evita un flash de UI logueada con un token ya vencido.
  useEffect(() => {
    if (!localStorage.getItem('token')) {
      setInitializing(false);
      return;
    }
    refreshMe().finally(() => setInitializing(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const value = {
    user,
    token,
    loading,
    initializing,
    isAuthenticated: Boolean(token && user),
    login,
    register,
    logout,
    refreshMe,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}

export default AuthContext;
