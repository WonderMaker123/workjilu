import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { parsePhotos, savePhoto, deletePhotoFile, deleteEntryDir } from '../lib/photos';

const router = Router();

function toISO(date: Date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function wordCount(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  // 中文字符 + 英文单词数
  const zh = (trimmed.match(/[一-龥]/g) || []).length;
  const en = (trimmed.replace(/[一-龥]/g, ' ').match(/[a-zA-Z0-9]+/g) || []).length;
  return zh + en;
}

const entrySchema = z.object({
  entryDate: z.string().optional(), // yyyy-mm-dd
  rawContent: z.string().min(1, '内容不能为空').max(5000),
  tags: z.array(z.string().max(20)).optional(),
});

router.use(authMiddleware);

// 列表：支持 month=2026-08、keyword、日期范围、tag
router.get('/', async (req: AuthRequest, res) => {
  const { month, start, end, keyword, tag } = req.query as Record<string, string>;
  const where: any = { userId: req.user!.id };
  const orderBy: any = [{ entryDate: 'desc' }, { createdAt: 'desc' }];

  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split('-').map(Number);
    const s = new Date(y, m - 1, 1);
    const e = new Date(y, m, 0, 23, 59, 59);
    where.entryDate = { gte: s, lte: e };
  }
  if (start || end) {
    where.entryDate = where.entryDate || {};
    if (start) where.entryDate.gte = new Date(start);
    if (end) where.entryDate.lte = new Date(end + 'T23:59:59');
  }
  if (keyword) {
    where.OR = [
      { rawContent: { contains: keyword } },
      { polishedContent: { contains: keyword } },
    ];
  }
  if (tag) {
    // tags 以 JSON 字符串存储，匹配 "标签名" 形式避免部分命中
    where.tags = { contains: `"${tag}"` };
  }

  const entries = await prisma.entry.findMany({ where, orderBy });
  res.json(entries.map((e) => ({ ...e, entryDate: toISO(e.entryDate) })));
});

// 今日
router.get('/today', async (req: AuthRequest, res) => {
  const today = new Date();
  const s = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const e = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
  const entries = await prisma.entry.findMany({
    where: { userId: req.user!.id, entryDate: { gte: s, lte: e } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(entries.map((it) => ({ ...it, entryDate: toISO(it.entryDate) })));
});

// 新增
router.post('/', async (req: AuthRequest, res) => {
  const parsed = entrySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const { rawContent, tags } = parsed.data;
  const entryDate = parsed.data.entryDate ? new Date(parsed.data.entryDate) : new Date();

  const entry = await prisma.entry.create({
    data: {
      userId: req.user!.id,
      entryDate,
      rawContent,
      tags: JSON.stringify(tags || []),
      wordCount: wordCount(rawContent),
    },
  });
  res.status(201).json({ ...entry, entryDate: toISO(entryDate) });
});

// 更新
router.put('/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.entry.findFirst({ where: { id, userId: req.user!.id } });
  if (!existing) return res.status(404).json({ error: '记录不存在' });

  const data: any = {};
  if (req.body.rawContent !== undefined) {
    data.rawContent = req.body.rawContent;
    data.wordCount = wordCount(req.body.rawContent);
  }
  if (req.body.tags !== undefined) data.tags = JSON.stringify(req.body.tags || []);
  if (req.body.polishedContent !== undefined) {
    data.polishedContent = req.body.polishedContent;
    data.polishedAt = new Date();
  }
  if (req.body.entryDate !== undefined) data.entryDate = new Date(req.body.entryDate);

  const updated = await prisma.entry.update({ where: { id }, data });
  res.json({ ...updated, entryDate: toISO(updated.entryDate) });
});

// 删除
router.delete('/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.entry.findFirst({ where: { id, userId: req.user!.id } });
  if (!existing) return res.status(404).json({ error: '记录不存在' });
  await prisma.entry.delete({ where: { id } });
  await deleteEntryDir(req.user!.id, id);
  res.json({ ok: true });
});

// 上传照片（base64 dataURL，前端已压缩）
router.post('/:id/photos', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const entry = await prisma.entry.findFirst({ where: { id, userId: req.user!.id } });
  if (!entry) return res.status(404).json({ error: '记录不存在' });

  const { data, name } = req.body || {};
  if (typeof data !== 'string' || !data.startsWith('data:image/')) {
    return res.status(400).json({ error: '图片数据格式错误' });
  }
  const photos = parsePhotos(entry.photos);
  if (photos.length >= 9) return res.status(400).json({ error: '每条记录最多上传 9 张照片' });

  try {
    const meta = await savePhoto(req.user!.id, id, data, name || '照片');
    photos.push(meta);
    const updated = await prisma.entry.update({
      where: { id },
      data: { photos: JSON.stringify(photos) },
    });
    res.status(201).json({ ...updated, entryDate: toISO(updated.entryDate) });
  } catch (e: any) {
    res.status(400).json({ error: e.message || '图片保存失败' });
  }
});

// 删除照片
router.delete('/:id/photos/:photoId', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const photoId = req.params.photoId;
  const entry = await prisma.entry.findFirst({ where: { id, userId: req.user!.id } });
  if (!entry) return res.status(404).json({ error: '记录不存在' });

  const photos = parsePhotos(entry.photos);
  const target = photos.find((p) => p.id === photoId);
  if (!target) return res.status(404).json({ error: '照片不存在' });

  await deletePhotoFile(req.user!.id, id, photoId);
  const next = photos.filter((p) => p.id !== photoId);
  const updated = await prisma.entry.update({
    where: { id },
    data: { photos: JSON.stringify(next) },
  });
  res.json({ ...updated, entryDate: toISO(updated.entryDate) });
});

// 批量重命名标签（当前用户全部记录）
router.post('/tags/rename', async (req: AuthRequest, res) => {
  const { oldTag, newTag } = req.body || {};
  if (typeof oldTag !== 'string' || typeof newTag !== 'string') {
    return res.status(400).json({ error: '标签名错误' });
  }
  const oldT = oldTag.trim();
  const newT = newTag.trim();
  if (!oldT || !newT) return res.status(400).json({ error: '标签名不能为空' });
  if (newT.length > 20) return res.status(400).json({ error: '标签名最多 20 字' });

  const entries = await prisma.entry.findMany({
    where: { userId: req.user!.id, tags: { contains: `"${oldT}"` } },
    select: { id: true, tags: true },
  });
  let count = 0;
  for (const e of entries) {
    const arr: string[] = parseList(e.tags);
    if (!arr.includes(oldT)) continue;
    const nextArr = arr.includes(newT) ? arr.filter((t) => t !== oldT) : arr.map((t) => (t === oldT ? newT : t));
    await prisma.entry.update({ where: { id: e.id }, data: { tags: JSON.stringify(nextArr) } });
    count++;
  }
  res.json({ ok: true, updated: count });
});

// 批量删除标签（当前用户全部记录）
router.post('/tags/delete', async (req: AuthRequest, res) => {
  const { tag } = req.body || {};
  if (typeof tag !== 'string' || !tag.trim()) return res.status(400).json({ error: '标签名错误' });
  const t = tag.trim();

  const entries = await prisma.entry.findMany({
    where: { userId: req.user!.id, tags: { contains: `"${t}"` } },
    select: { id: true, tags: true },
  });
  let count = 0;
  for (const e of entries) {
    const arr: string[] = parseList(e.tags);
    if (!arr.includes(t)) continue;
    await prisma.entry.update({ where: { id: e.id }, data: { tags: JSON.stringify(arr.filter((x) => x !== t)) } });
    count++;
  }
  res.json({ ok: true, updated: count });
});

function parseList(json: string): string[] {
  try { const a = JSON.parse(json || '[]'); return Array.isArray(a) ? a : []; } catch { return []; }
}

export default router;
