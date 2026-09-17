import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

// 图片文件存储：uploads/<userId>/<entryId>/<photoId>
export interface PhotoMeta {
  id: string; // 文件名（随机）
  name: string; // 原始文件名
  size: number; // 字节
}

const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads');
const MAX_BYTES = 8 * 1024 * 1024; // 单张 8MB（前端会先压缩）

const MIME_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

export function parsePhotos(json: string | null | undefined): PhotoMeta[] {
  try {
    const arr = JSON.parse(json || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function entryDir(userId: number, entryId: number) {
  return path.join(UPLOAD_ROOT, String(userId), String(entryId));
}

export function photoPath(userId: number, entryId: number, photoId: string) {
  // 防路径穿越
  const safe = path.basename(photoId);
  return path.join(entryDir(userId, entryId), safe);
}

// 解析 dataURL，校验并落盘，返回照片元数据
export async function savePhoto(
  userId: number,
  entryId: number,
  dataUrl: string,
  originalName: string
): Promise<PhotoMeta> {
  const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/s.exec(dataUrl || '');
  if (!m) throw new Error('图片格式不支持，仅支持 JPG / PNG / WEBP / GIF');
  const mime = m[1];
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length === 0) throw new Error('图片内容为空');
  if (buf.length > MAX_BYTES) throw new Error('图片过大，请压缩到 8MB 以内');

  const dir = entryDir(userId, entryId);
  await fs.mkdir(dir, { recursive: true });
  const id = `${crypto.randomBytes(12).toString('hex')}${MIME_EXT[mime]}`;
  await fs.writeFile(path.join(dir, id), buf);
  const name = (originalName || '照片').slice(0, 100);
  return { id, name, size: buf.length };
}

export async function deletePhotoFile(userId: number, entryId: number, photoId: string) {
  try {
    await fs.unlink(photoPath(userId, entryId, photoId));
  } catch {
    // 文件已不存在时忽略
  }
}

// 删除整条记录时清理目录
export async function deleteEntryDir(userId: number, entryId: number) {
  try {
    await fs.rm(entryDir(userId, entryId), { recursive: true, force: true });
  } catch {
    // 忽略
  }
}
