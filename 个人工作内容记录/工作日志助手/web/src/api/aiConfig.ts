import http from '@/lib/http';

// AI 配置回显（apiKey 只回是否已配置，永不下发明文）
export interface AiConfigView {
  configured: boolean;
  baseUrl?: string;
  hasApiKey?: boolean;
  model?: string;
  formality?: 'simple' | 'standard' | 'detailed';
}

export interface AiConfigInput {
  baseUrl: string;
  apiKey?: string;
  model: string;
  formality: 'simple' | 'standard' | 'detailed';
}

export const aiConfigApi = {
  get: () => http.get<AiConfigView>('/ai-config'),
  save: (data: AiConfigInput) => http.put<AiConfigView>('/ai-config', data),
  test: (data: Partial<{ baseUrl: string; apiKey: string; model: string }>) =>
    http.post<{ ok: boolean; reply: string }>('/ai-config/test', data),
  delete: () => http.delete('/ai-config'),
};
