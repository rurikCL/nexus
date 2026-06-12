import axios from 'axios';

/*
  Cliente HTTP hacia la API Laravel.
  Configura VITE_API_URL en un archivo .env (por defecto /api con proxy de Vite).
  Maneja token Sanctum/JWT desde localStorage si existe.
*/
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { Accept: 'application/json' },
  withCredentials: true, // Laravel Sanctum (cookies). Quitar si usas Bearer puro.
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('nx-token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
