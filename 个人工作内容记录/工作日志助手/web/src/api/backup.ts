import http from '@/lib/http';

export interface BackupPayload {
  version: number;
  exportedAt: string;
  user: { id: number; username: string };
  entries: Array<{
    entryDate: string;
    rawContent: string;
    polishedContent?: string | null;
    tags: string;
    wordCount: number;
  }>;
  reports: Array<{ yearMonth: string; content: string }>;
  aiConfig?: { baseUrl: string; model: string; formality: string; hasApiKey: boolean; apiKeyCipher: string } | null;
}

export const backupApi = {
  export: () => http.get<BackupPayload>('/backup/export', { responseType: 'json' }),
  // 以文件流方式下载备份
  download: () => http.get<Blob>('/backup/export', { responseType: 'blob' }),
  import: (data: unknown) => http.post<{ ok: boolean; entries: number; reports: number; aiConfig: boolean }>('/backup/import', data),
};
