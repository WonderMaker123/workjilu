import http from '@/lib/http';

export interface StatsTag { name: string; count: number; }
export interface StatsOverview {
  totalEntries: number;
  monthCount: number;
  monthWords: number;
  streak: number;
  sevenDays: { date: string; count: number }[];
  tags: StatsTag[];
  hasMonthReport: boolean;
}

export const statsApi = {
  overview: () => http.get<StatsOverview>('/stats/overview'),
};
