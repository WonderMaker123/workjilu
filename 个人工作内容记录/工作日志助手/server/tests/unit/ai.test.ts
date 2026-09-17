import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { chat } from '../../src/lib/ai';

describe('AI Lib Module', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('should call completion endpoint and return message content', async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: '这是 AI 润色后的工作日志',
          },
        },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    }) as any;

    const result = await chat(
      {
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'test-key',
        model: 'gpt-4o-mini',
      },
      [
        { role: 'system', content: 'You are an assistant.' },
        { role: 'user', content: '今天完成了单元测试编写。' },
      ]
    );

    expect(result).toBe('这是 AI 润色后的工作日志');
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    const [calledUrl, calledOptions] = (globalThis.fetch as any).mock.calls[0];
    expect(calledUrl).toBe('https://api.openai.com/v1/chat/completions');
    expect(calledOptions.method).toBe('POST');
    expect(calledOptions.headers['Authorization']).toBe('Bearer test-key');
  });

  it('should throw error when API returns non-ok status', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized Invalid API key',
    }) as any;

    await expect(
      chat(
        {
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'invalid-key',
          model: 'gpt-4o-mini',
        },
        [{ role: 'user', content: 'hello' }]
      )
    ).rejects.toThrow('AI 服务返回错误 (401)');
  });

  it('should throw error when choices content is empty', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [] }),
    }) as any;

    await expect(
      chat(
        {
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'test-key',
          model: 'gpt-4o-mini',
        },
        [{ role: 'user', content: 'hello' }]
      )
    ).rejects.toThrow('AI 服务未返回内容');
  });
});
