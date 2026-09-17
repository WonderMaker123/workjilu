import http from '@/lib/http';

export interface PhotoMeta {
  id: string;
  name: string;
  size?: number;
}

export interface Entry {
  id: number;
  userId: number;
  entryDate: string; // yyyy-mm-dd
  rawContent: string;
  polishedContent: string | null;
  polishedAt: string | null;
  tags: string; // JSON array string
  photos: string; // JSON array string of PhotoMeta
  wordCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface EntryListQuery {
  month?: string;
  keyword?: string;
  tag?: string;
}

export function parsePhotos(json?: string | null): PhotoMeta[] {
  try {
    const a = JSON.parse(json || '[]');
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}

export const entriesApi = {
  list: (params: EntryListQuery = {}) => http.get<Entry[]>('/entries', { params }),
  today: () => http.get<Entry[]>('/entries/today'),
  create: (data: { rawContent: string; entryDate?: string; tags?: string[] }) =>
    http.post<Entry>('/entries', data),
  update: (id: number, data: Partial<{ rawContent: string; tags: string[]; polishedContent: string; entryDate: string }>) =>
    http.put<Entry>(`/entries/${id}`, data),
  delete: (id: number) => http.delete(`/entries/${id}`),

  uploadPhoto: (id: number, data: string, name: string) =>
    http.post<Entry>(`/entries/${id}/photos`, { data, name }),
  deletePhoto: (id: number, photoId: string) =>
    http.delete<Entry>(`/entries/${id}/photos/${encodeURIComponent(photoId)}`),

  renameTag: (oldTag: string, newTag: string) =>
    http.post<{ ok: boolean; updated: number }>('/entries/tags/rename', { oldTag, newTag }),
  deleteTag: (tag: string) =>
    http.post<{ ok: boolean; updated: number }>('/entries/tags/delete', { tag }),
};
