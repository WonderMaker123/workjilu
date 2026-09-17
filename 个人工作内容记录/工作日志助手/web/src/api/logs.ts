import http from '@/lib/http';

export interface LogEntry {
  time: string;
  level: 'info' | 'error' | 'warn';
  message: string;
  detail?: string;
}

export const logsApi = {
  list: () => http.get<{ logs: LogEntry[] }>('/logs'),
  clear: () => http.delete('/logs'),
};
