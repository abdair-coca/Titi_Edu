import axios from 'axios';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    // Solo si había token: evita disparar esto ante un login/registro con
    // credenciales incorrectas (esos 401 no significan sesión invalidada).
    if (error.response?.status === 401 && localStorage.getItem('token')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // AuthContext escucha esto para limpiar su estado; los guards del
      // router hacen el redirect al re-renderizar (sin loops: /login y
      // /register no hacen requests autenticados).
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
    return Promise.reject(error);
  }
);

export default client;
