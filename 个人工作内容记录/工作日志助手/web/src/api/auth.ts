import http from '@/lib/http';

export interface UserInfo {
  id: number;
  username: string;
}

export const authApi = {
  register: (data: { username: string; password: string }) =>
    http.post<{ token: string; user: UserInfo }>('/auth/register', data),
  login: (data: { username: string; password: string }) =>
    http.post<{ token: string; user: UserInfo }>('/auth/login', data),
  me: () => http.get<UserInfo>('/auth/me'),
  changePassword: (data: { oldPassword: string; newPassword: string }) =>
    http.post('/auth/change-password', data),
};
