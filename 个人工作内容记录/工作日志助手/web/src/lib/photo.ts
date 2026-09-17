import http from './http';

// 客户端压缩：最长边压到 1600px，JPEG 0.82，显著减小上传体积（手机原图常 3-5MB）
export function compressImage(file: File, maxEdge = 1600, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('请选择图片文件'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('图片读取失败'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('图片解析失败'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxEdge || height > maxEdge) {
          if (width >= height) {
            height = Math.round((height * maxEdge) / width);
            width = maxEdge;
          } else {
            width = Math.round((width * maxEdge) / height);
            height = maxEdge;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('浏览器不支持图片压缩')); return; }
        ctx.drawImage(img, 0, 0, width, height);
        // PNG 截图保留透明通道，其余统一 JPEG
        const keepPng = file.type === 'image/png' && /\.png$/i.test(file.name);
        const mime = keepPng ? 'image/png' : 'image/jpeg';
        resolve(canvas.toDataURL(mime, quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// 鉴权图片：<img> 无法带 Authorization 头，通过 axios 拉 blob 再转 objectURL
const urlCache = new Map<string, string>();
const pending = new Map<string, Promise<string>>();

export function photoKey(entryId: number, photoId: string) {
  return `${entryId}/${photoId}`;
}

export function getPhotoUrl(entryId: number, photoId: string): Promise<string> {
  const key = photoKey(entryId, photoId);
  const cached = urlCache.get(key);
  if (cached) return Promise.resolve(cached);
  const inflight = pending.get(key);
  if (inflight) return inflight;

  const p = http
    .get<Blob>(`/photos/${entryId}/${encodeURIComponent(photoId)}`, { responseType: 'blob' })
    .then(({ data }) => {
      const url = URL.createObjectURL(data);
      urlCache.set(key, url);
      pending.delete(key);
      return url;
    })
    .catch((e) => {
      pending.delete(key);
      throw e;
    });
  pending.set(key, p);
  return p;
}

export function revokePhotoUrl(entryId: number, photoId: string) {
  const key = photoKey(entryId, photoId);
  const url = urlCache.get(key);
  if (url) {
    URL.revokeObjectURL(url);
    urlCache.delete(key);
  }
}
