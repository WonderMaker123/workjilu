import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { parsePhotos, photoPath } from '../lib/photos';

const router = Router();

router.use(authMiddleware);

// 鉴权后读取照片：校验该照片确实属于当前用户的记录
router.get('/:entryId/:photoId', async (req: AuthRequest, res) => {
  const entryId = Number(req.params.entryId);
  const photoId = req.params.photoId;
  if (!Number.isInteger(entryId)) return res.status(400).json({ error: '参数错误' });

  const entry = await prisma.entry.findFirst({
    where: { id: entryId, userId: req.user!.id },
    select: { photos: true },
  });
  if (!entry) return res.status(404).json({ error: '记录不存在' });

  const photos = parsePhotos(entry.photos);
  if (!photos.some((p) => p.id === photoId)) return res.status(404).json({ error: '照片不存在' });

  res.sendFile(photoPath(req.user!.id, entryId, photoId), { maxAge: '7d' }, (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: '照片文件不存在' });
  });
});

export default router;
