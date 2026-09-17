import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// 报告 key 支持月报 "2026-08" 与周报 "2026-W36"
const KEY_RE = /^(\d{4}-\d{2}|\d{4}-W\d{1,2})$/;
function validKey(k: string) { return KEY_RE.test(k); }

// 列出该用户所有报告
router.get('/', async (req: AuthRequest, res) => {
  const reports = await prisma.report.findMany({
    where: { userId: req.user!.id },
    orderBy: { yearMonth: 'desc' },
    select: { id: true, yearMonth: true, createdAt: true, updatedAt: true },
  });
  res.json(reports);
});

// 读取某月/某周的报告
router.get('/:yearMonth', async (req: AuthRequest, res) => {
  const { yearMonth } = req.params;
  if (!validKey(yearMonth)) return res.status(400).json({ error: '报告标识格式错误' });
  const report = await prisma.report.findUnique({
    where: { userId_yearMonth: { userId: req.user!.id, yearMonth } },
  });
  if (!report) return res.status(404).json({ error: '该报告不存在' });
  res.json(report);
});

// 手动编辑保存（覆盖报告内容）
router.put('/:yearMonth', async (req: AuthRequest, res) => {
  const { yearMonth } = req.params;
  if (!validKey(yearMonth)) return res.status(400).json({ error: '报告标识格式错误' });
  const { content } = req.body || {};
  if (typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ error: '内容不能为空' });
  }
  const report = await prisma.report.upsert({
    where: { userId_yearMonth: { userId: req.user!.id, yearMonth } },
    update: { content },
    create: { userId: req.user!.id, yearMonth, content },
  });
  res.json(report);
});

// 删除
router.delete('/:yearMonth', async (req: AuthRequest, res) => {
  const { yearMonth } = req.params;
  if (!validKey(yearMonth)) return res.status(400).json({ error: '报告标识格式错误' });
  await prisma.report.deleteMany({
    where: { userId: req.user!.id, yearMonth },
  });
  res.json({ ok: true });
});

export default router;
