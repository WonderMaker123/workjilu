import { Router } from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { pushLog } from './logs';
import { parsePhotos, photoPath } from '../lib/photos';

const router = Router();
router.use(authMiddleware);

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif',
};

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// 导出当前用户全部数据（含 AI 配置脱敏后的 apiKey 占位）
router.get('/export', async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const [entries, reports, aiCfg] = await Promise.all([
    prisma.entry.findMany({ where: { userId }, orderBy: { entryDate: 'asc' } }),
    prisma.report.findMany({ where: { userId }, orderBy: { yearMonth: 'asc' } }),
    prisma.aiConfig.findUnique({ where: { userId } }),
  ]);

  const aiConfigExport = aiCfg
    ? { baseUrl: aiCfg.baseUrl, model: aiCfg.model, formality: aiCfg.formality, hasApiKey: true, apiKeyCipher: aiCfg.apiKey }
    : null;

  // 照片随备份导出为 base64 dataURL
  const entriesExport = [];
  let photoCount = 0;
  for (const e of entries) {
    const metas = parsePhotos(e.photos);
    const photosOut = [];
    for (const p of metas) {
      try {
        const buf = await fs.readFile(photoPath(userId, e.id, p.id));
        const mime = MIME_BY_EXT[path.extname(p.id).toLowerCase()] || 'image/jpeg';
        photosOut.push({ id: p.id, name: p.name, data: `data:${mime};base64,${buf.toString('base64')}` });
        photoCount++;
      } catch {
        // 文件丢失则跳过
      }
    }
    entriesExport.push({
      entryDate: toISODate(e.entryDate),
      rawContent: e.rawContent,
      polishedContent: e.polishedContent,
      tags: e.tags,
      photos: JSON.stringify(photosOut.map(({ id, name }) => ({ id, name }))),
      photoFiles: photosOut,
      wordCount: e.wordCount,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    });
  }

  const payload = {
    version: 2,
    exportedAt: new Date().toISOString(),
    user: { id: userId, username: req.user!.username },
    entries: entriesExport,
    reports: reports.map((r) => ({
      yearMonth: r.yearMonth,
      content: r.content,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
    aiConfig: aiConfigExport,
  };

  pushLog('info', `数据导出 (用户: ${req.user!.username})`, `${entries.length} 条记录, ${photoCount} 张照片, ${reports.length} 份报告`);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="worklog-backup-${toISODate(new Date())}.json"`);
  res.json(payload);
});

// 导入：合并到当前用户。记录按 entryDate+rawContent 简单去重；报告按 yearMonth upsert；AI 配置按需更新
router.post('/import', async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const data = req.body;
  if (!data || typeof data !== 'object') return res.status(400).json({ error: '无效的备份数据' });

  const result = { entries: 0, reports: 0, photos: 0, aiConfig: false };
  try {
    if (Array.isArray(data.entries)) {
      for (const en of data.entries) {
        if (!en || typeof en.rawContent !== 'string') continue;
        const entryDate = en.entryDate ? new Date(en.entryDate) : new Date();
        // 按日期+原文去重
        const exists = await prisma.entry.findFirst({
          where: { userId, entryDate, rawContent: en.rawContent },
          select: { id: true },
        });
        if (exists) continue;

        const photosJson = typeof en.photos === 'string' ? en.photos : '[]';
        const created = await prisma.entry.create({
          data: {
            userId,
            entryDate,
            rawContent: en.rawContent,
            polishedContent: en.polishedContent || null,
            tags: typeof en.tags === 'string' ? en.tags : '[]',
            photos: photosJson,
            wordCount: typeof en.wordCount === 'number' ? en.wordCount : 0,
          },
        });

        // 恢复照片文件
        if (Array.isArray(en.photoFiles)) {
          for (const pf of en.photoFiles) {
            try {
              if (!pf || typeof pf.id !== 'string' || typeof pf.data !== 'string') continue;
              if (!/^[a-f0-9]{16,}\.(jpg|jpeg|png|webp|gif)$/i.test(pf.id)) continue;
              const mm = /^data:image\/(?:jpeg|png|webp|gif);base64,(.+)$/s.exec(pf.data);
              if (!mm) continue;
              const buf = Buffer.from(mm[1], 'base64');
              if (buf.length === 0 || buf.length > 8 * 1024 * 1024) continue;
              const filePath = photoPath(userId, created.id, pf.id);
              await fs.mkdir(path.dirname(filePath), { recursive: true });
              await fs.writeFile(filePath, buf);
              result.photos++;
            } catch {
              // 单张失败不影响整体
            }
          }
        }
        result.entries++;
      }
    }

    if (Array.isArray(data.reports)) {
      for (const r of data.reports) {
        if (!r || typeof r.yearMonth !== 'string' || typeof r.content !== 'string') continue;
        await prisma.report.upsert({
          where: { userId_yearMonth: { userId, yearMonth: r.yearMonth } },
          update: { content: r.content },
          create: { userId, yearMonth: r.yearMonth, content: r.content },
        });
        result.reports++;
      }
    }

    if (data.aiConfig && data.aiConfig.apiKeyCipher && data.aiConfig.baseUrl && data.aiConfig.model) {
      // 跨用户恢复时 apiKeyCipher 仍是密文，可以直接复用
      await prisma.aiConfig.upsert({
        where: { userId },
        update: {
          baseUrl: data.aiConfig.baseUrl,
          model: data.aiConfig.model,
          formality: data.aiConfig.formality || 'standard',
          apiKey: data.aiConfig.apiKeyCipher,
        },
        create: {
          userId,
          baseUrl: data.aiConfig.baseUrl,
          model: data.aiConfig.model,
          formality: data.aiConfig.formality || 'standard',
          apiKey: data.aiConfig.apiKeyCipher,
        },
      });
      result.aiConfig = true;
    }

    pushLog('info', `数据导入 (用户: ${req.user!.username})`, JSON.stringify(result));
    res.json({ ok: true, ...result });
  } catch (e: any) {
    pushLog('error', `数据导入失败 (用户: ${req.user!.username})`, e.message);
    res.status(500).json({ error: e.message || '导入失败' });
  }
});

export default router;
