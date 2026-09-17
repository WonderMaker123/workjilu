import axios, { AxiosError, type AxiosInstance } from 'axios';
import { ElMessage } from 'element-plus';
import { useAuthStore } from '@/stores/auth';

const baseURL = import.meta.env.VITE_API_BASE || '/api';

const http: AxiosInstance = axios.create({
  baseURL,
  timeout: 90000,
});

http.interceptors.request.use((config) => {
  const auth = useAuthStore();
  if (auth.token) config.headers.Authorization = `Bearer ${auth.token}`;
  return config;
});

http.interceptors.response.use(
  (res) => res,
  (err: AxiosError<{ error?: string }>) => {
    const status = err.response?.status;
    const msg = err.response?.data?.error || err.message || '请求失败';
    if (status === 401) {
      const auth = useAuthStore();
      auth.logout();
    }
    if (!err.config?.url?.includes('/ai-config/test')) {
      ElMessage.error(msg);
    }
    return Promise.reject(err);
  }
);

export default http;
