import http from '@/lib/http';

// AI 能力接口：单条整理、月/周汇总、续写追问
// 报告的 CRUD 在 ./reports，AI 配置在 ./aiConfig
export const aiApi = {
  polish: (data: { text: string; formality?: 'simple' | 'standard' | 'detailed' }) =>
    http.post<{ polished: string }>('/ai/polish', data),
  monthly: (data: { yearMonth: string }) => http.post<{ report: import('./reports').Report }>('/ai/monthly', data),
  weekly: (data: { yearWeek?: string; date?: string }) =>
    http.post<{ report: import('./reports').Report }>('/ai/weekly', data),
  continue: (data: { text: string; instruction?: string }) =>
    http.post<{ result: string }>('/ai/continue', data),
};
