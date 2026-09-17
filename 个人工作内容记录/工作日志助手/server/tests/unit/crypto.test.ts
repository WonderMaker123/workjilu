import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '../../src/lib/crypto';

describe('Crypto Module', () => {
  it('should encrypt and decrypt string accurately', () => {
    const raw = 'sk-proj-1234567890abcdef!@#$%^&*()';
    const encrypted = encrypt(raw);

    expect(encrypted).toBeTypeOf('string');
    expect(encrypted).not.toBe(raw);

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(raw);
  });

  it('should handle unicode characters properly', () => {
    const raw = '深度求索-DeepSeek密钥-测试123';
    const encrypted = encrypt(raw);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(raw);
  });

  it('should handle empty string', () => {
    const raw = '';
    const encrypted = encrypt(raw);
    expect(decrypt(encrypted)).toBe(raw);
  });
});
