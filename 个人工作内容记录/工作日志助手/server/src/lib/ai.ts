// 通用 OpenAI 兼容客户端：兼容 OpenAI / DeepSeek / 通义 / Kimi / Ollama 等
// 通过 baseUrl(base 为 /v1)、apiKey、model 三个参数即可切换任何服务商。

interface ChatConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

export async function chat(config: ChatConfig, messages: ChatMessage[], timeoutMs = 60000): Promise<string> {
  const base = config.baseUrl.replace(/\/+$/, '');
  const url = `${base}/chat/completions`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: 0.7,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`AI 服务返回错误 (${res.status}): ${body.slice(0, 300)}`);
    }

    const data: any = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error('AI 服务未返回内容');
    return content.trim();
  } finally {
    clearTimeout(timer);
  }
}
