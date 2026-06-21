import axios from 'axios';

const API_BASE_URL = 'http://127.0.0.1:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to catch unauthorized errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user_role');
      localStorage.removeItem('roll_no');
      // Optionally redirect or handle logout
    }
    return Promise.reject(error);
  }
);

export default api;
export { API_BASE_URL };

export const getWebSocketUrl = (path) => {
  const baseURL = api.defaults?.baseURL || API_BASE_URL;
  let baseWsUrl;
  if (baseURL.startsWith('http')) {
    baseWsUrl = baseURL.replace(/^http/, 'ws');
  } else {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    baseWsUrl = `${protocol}://${window.location.host}${baseURL}`;
  }
  return `${baseWsUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
};
