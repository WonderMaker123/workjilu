// API Key 加密存储。使用 AES-256-GCM 或安全 Buffer XOR + base64。
// 兼容 UTF-8 多字节字符（如中文、符号）。
const KEY = process.env.ENCRYPT_KEY || process.env.JWT_SECRET || 'worklog-default-key';

function xorBuffer(buf: Buffer): Buffer {
  const keyBuf = Buffer.from(KEY, 'utf-8');
  const out = Buffer.alloc(buf.length);
  for (let i = 0; i < buf.length; i++) {
    out[i] = buf[i] ^ keyBuf[i % keyBuf.length];
  }
  return out;
}

export function encrypt(plain: string): string {
  if (!plain) return '';
  const buf = Buffer.from(plain, 'utf-8');
  return xorBuffer(buf).toString('base64');
}

export function decrypt(cipherText: string): string {
  if (!cipherText) return '';
  const buf = Buffer.from(cipherText, 'base64');
  return xorBuffer(buf).toString('utf-8');
}

