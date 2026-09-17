import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// 总览：本月统计、连续天数、总数、最近 7 天活动、标签分布
router.get('/overview', async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  // 当月所有记录
  const monthEntries = await prisma.entry.findMany({
    where: { userId, entryDate: { gte: monthStart, lte: monthEnd } },
    orderBy: { entryDate: 'asc' },
    select: { entryDate: true, wordCount: true, tags: true },
  });

  // 全部记录（用来计算总数和连续天数，只取日期）
  const allEntries = await prisma.entry.findMany({
    where: { userId },
    orderBy: { entryDate: 'desc' },
    select: { entryDate: true },
  });

  const totalEntries = allEntries.length;
  const monthCount = monthEntries.length;
  const monthWords = monthEntries.reduce((s, e) => s + e.wordCount, 0);

  // 连续记录天数（从今天往前数，只要当天有记录就算）
  const dateSet = new Set<string>();
  for (const e of allEntries) dateSet.add(toISODate(e.entryDate));
  let streak = 0;
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // 如果今天没有记录，从昨天开始数（保持激励：今天还没写不算断）
  if (!dateSet.has(toISODate(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (dateSet.has(toISODate(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  // 最近 7 天每日条数
  const sevenDays: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    sevenDays.push({ date: toISODate(d), count: 0 });
  }
  const sevenIdx = new Map(sevenDays.map((s, i) => [s.date, i]));
  const sevenStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  const sevenEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  const recentEntries = await prisma.entry.findMany({
    where: { userId, entryDate: { gte: sevenStart, lte: sevenEnd } },
    select: { entryDate: true },
  });
  for (const e of recentEntries) {
    const k = toISODate(e.entryDate);
    if (sevenIdx.has(k)) sevenDays[sevenIdx.get(k)!].count++;
  }

  // 标签分布：聚合当月所有 tags JSON
  const tagCount = new Map<string, number>();
  for (const e of monthEntries) {
    try {
      const arr = JSON.parse(e.tags || '[]') as string[];
      for (const t of arr) tagCount.set(t, (tagCount.get(t) || 0) + 1);
    } catch { /* ignore */ }
  }
  const tags = [...tagCount.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

  // 月报数
  const monthReportKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthReport = await prisma.report.findUnique({
    where: { userId_yearMonth: { userId, yearMonth: monthReportKey } },
    select: { id: true },
  });

  res.json({
    totalEntries,
    monthCount,
    monthWords,
    streak,
    sevenDays,
    tags,
    hasMonthReport: !!monthReport,
  });
});

export default router;
