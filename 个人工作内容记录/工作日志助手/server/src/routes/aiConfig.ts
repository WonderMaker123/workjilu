import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { encrypt, decrypt } from '../lib/crypto';
import { chat } from '../lib/ai';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { pushLog } from './logs';

const router = Router();
router.use(authMiddleware);

const configSchema = z.object({
  baseUrl: z
    .string()
    .url('接口地址必须是合法 URL')
    .refine((v) => /\/v1\/?$/.test(v), { message: '接口地址必须以 /v1 结尾' }),
  apiKey: z.string().min(1, 'API Key 不能为空').optional(),
  model: z.string().min(1, '模型名不能为空'),
  formality: z.enum(['simple', 'standard', 'detailed']).default('standard'),
});

// 读取当前配置（不含 apiKey，只返回是否有 key 的布尔）
router.get('/', async (req: AuthRequest, res) => {
  const cfg = await prisma.aiConfig.findUnique({ where: { userId: req.user!.id } });
  if (!cfg) return res.json({ configured: false });
  res.json({
    configured: true,
    baseUrl: cfg.baseUrl,
    hasApiKey: !!cfg.apiKey,
    model: cfg.model,
    formality: cfg.formality,
  });
});

// 保存配置（apiKey 为空则保留旧值）
router.put('/', async (req: AuthRequest, res) => {
  const parsed = configSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { baseUrl, apiKey, model, formality } = parsed.data;
  const existing = await prisma.aiConfig.findUnique({ where: { userId: req.user!.id } });
  if (!existing && !apiKey) return res.status(400).json({ error: '请提供 API Key' });

  const data: any = {};
  if (baseUrl) data.baseUrl = baseUrl;
  if (model) data.model = model;
  if (formality) data.formality = formality;
  if (apiKey) data.apiKey = encrypt(apiKey);

  // upsert 的 create 分支要求 apiKey 必填，所以已有配置时用 update，新配置时用 create
  let cfg;
  try {
    if (existing) {
      cfg = await prisma.aiConfig.update({ where: { userId: req.user!.id }, data });
      pushLog('info', `AI 配置已更新 (用户: ${req.user!.username})`, `baseUrl=${baseUrl}, model=${model}`);
    } else {
      cfg = await prisma.aiConfig.create({
        data: { userId: req.user!.id, baseUrl, model, formality, apiKey: encrypt(apiKey!) },
      });
      pushLog('info', `AI 配置已创建 (用户: ${req.user!.username})`, `baseUrl=${baseUrl}, model=${model}`);
    }
  } catch (e: any) {
    pushLog('error', 'AI 配置保存失败', e?.message);
    throw e;
  }

  res.json({
    configured: true,
    baseUrl: cfg.baseUrl,
    hasApiKey: !!cfg.apiKey,
    model: cfg.model,
    formality: cfg.formality,
  });
});

// 连接测试
router.post('/test', async (req: AuthRequest, res) => {
  const { baseUrl, apiKey, model } = req.body || {};
  const cfg = await prisma.aiConfig.findUnique({ where: { userId: req.user!.id } });
  const final = {
    baseUrl: baseUrl || cfg?.baseUrl,
    apiKey: apiKey ? apiKey : cfg ? decrypt(cfg.apiKey) : '',
    model: model || cfg?.model,
  };
  if (!final.baseUrl || !final.apiKey || !final.model) {
    return res.status(400).json({ error: '请先在设置中配置 AI' });
  }
  try {
    const text = await chat(final, [
      { role: 'system', content: '你是接口连通性检查助手，只回复"OK"两个字母。' },
      { role: 'user', content: 'ping' },
    ]);
    pushLog('info', 'AI 连接测试成功', `model=${final.model}, reply=${text.slice(0, 30)}`);
    res.json({ ok: true, reply: text.slice(0, 50) });
  } catch (e: any) {
    pushLog('error', 'AI 连接测试失败', `model=${final.model}, error=${e.message}`);
    res.status(502).json({ error: e.message || '连接失败' });
  }
});

// 删除配置
router.delete('/', async (req: AuthRequest, res) => {
  await prisma.aiConfig.deleteMany({ where: { userId: req.user!.id } });
  res.json({ ok: true });
});

export default router;
