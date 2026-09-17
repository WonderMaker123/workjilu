import http from '@/lib/http';

// 月报 key 形如 "2026-08"，周报 key 形如 "2026-W36"
export interface Report {
  id: number;
  userId: number;
  yearMonth: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export const reportsApi = {
  list: () => http.get<Pick<Report, 'id' | 'yearMonth' | 'createdAt' | 'updatedAt'>[]>('/reports'),
  get: (yearMonth: string) => http.get<Report>(`/reports/${yearMonth}`),
  save: (yearMonth: string, content: string) => http.put<Report>(`/reports/${yearMonth}`, { content }),
  delete: (yearMonth: string) => http.delete(`/reports/${yearMonth}`),
};
