import { defineStore } from 'pinia';
import { authApi, type UserInfo } from '@/api/auth';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: (localStorage.getItem('worklog_token') as string) || '',
    user: undefined as UserInfo | undefined,
  }),
  getters: {
    isLogin: (s) => !!s.token && !!s.user,
  },
  actions: {
    async login(username: string, password: string) {
      const { data } = await authApi.login({ username, password });
      this.token = data.token;
      this.user = data.user;
      localStorage.setItem('worklog_token', data.token);
      localStorage.setItem('worklog_user', JSON.stringify(data.user));
    },
    async register(username: string, password: string) {
      const { data } = await authApi.register({ username, password });
      this.token = data.token;
      this.user = data.user;
      localStorage.setItem('worklog_token', data.token);
      localStorage.setItem('worklog_user', JSON.stringify(data.user));
    },
    async me() {
      if (!this.token) return null;
      try {
        const { data } = await authApi.me();
        this.user = data;
        return data;
      } catch {
        this.logout();
        return null;
      }
    },
    logout() {
      this.token = '';
      this.user = undefined;
      localStorage.removeItem('worklog_token');
      localStorage.removeItem('worklog_user');
    },
  },
});
