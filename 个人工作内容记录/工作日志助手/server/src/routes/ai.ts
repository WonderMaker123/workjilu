import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { decrypt } from '../lib/crypto';
import { chat } from '../lib/ai';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { pushLog } from './logs';

const router = Router();

router.use(authMiddleware);

const FORMALITY_PROMPT: Record<string, string> = {
  simple: '表达简洁精炼，一句话说清一件事，不展开细节。',
  standard: '表达书面、正式，条理清晰，突出动作与结果。',
  detailed: '表达详细、充实，尽量完整呈现过程、动作、结果与后续。',
};

// 单条整理
router.post('/polish', async (req: AuthRequest, res) => {
  const { text, formality } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: '内容不能为空' });

  try {
    const cfg = await prisma.aiConfig.findUnique({ where: { userId: req.user!.id } });
    if (!cfg) return res.status(400).json({ error: '请先在「设置 - AI 配置」里填写接口与模型' });
    const ai = { baseUrl: cfg.baseUrl, apiKey: decrypt(cfg.apiKey), model: cfg.model };
    const formalityText =
      FORMALITY_PROMPT[formality] || FORMALITY_PROMPT[cfg.formality] || FORMALITY_PROMPT.standard;
    const system = `你是运维实施岗位的工作汇报助手。请把用户口语化的运维实施工作记录（可能涉及现场实施、设备调试、巡检维护、故障处理、客户沟通等）改写为书面化的工作条目。
要求：
1. 保留事实，不虚构、不夸大；
2. 突出做了什么事、处理了什么问题、结果如何；
3. 多条时用「1. 2. 3.」分行列出；
4. ${formalityText}
只输出整理后的内容，不要解释。`;

    const result = await chat(ai, [
      { role: 'system', content: system },
      { role: 'user', content: text },
    ]);
    pushLog('info', `AI 整理成功 (用户: ${req.user!.username})`, `${text.slice(0, 40)}...`);
    res.json({ polished: result });
  } catch (e: any) {
    pushLog('error', `AI 整理失败 (用户: ${req.user!.username})`, e.message);
    res.status(502).json({ error: e.message || 'AI 调用失败' });
  }
});

// 月度汇总
router.post('/monthly', async (req: AuthRequest, res) => {
  const { yearMonth } = req.body; // "2026-08"
  if (!/^\d{4}-\d{2}$/.test(yearMonth || '')) {
    return res.status(400).json({ error: '月份格式错误，应为 yyyy-mm' });
  }

  const [y, m] = yearMonth.split('-').map(Number);
  const s = new Date(y, m - 1, 1);
  const e = new Date(y, m, 0, 23, 59, 59);

  const entries = await prisma.entry.findMany({
    where: { userId: req.user!.id, entryDate: { gte: s, lte: e } },
    orderBy: { entryDate: 'asc' },
  });

  if (entries.length === 0) {
    return res.status(400).json({ error: '该月份暂无记录' });
  }

  const raw = entries
    .map((en) => {
      const txt = en.polishedContent || en.rawContent;
    const date = `${en.entryDate.getFullYear()}-${String(en.entryDate.getMonth() + 1).padStart(2, '0')}-${String(en.entryDate.getDate()).padStart(2, '0')}`;
      return `【${date}】${txt}`;
    })
    .join('\n');

  try {
    const cfg = await prisma.aiConfig.findUnique({ where: { userId: req.user!.id } });
    if (!cfg) return res.status(400).json({ error: '请先在「设置 - AI 配置」里填写接口与模型' });
    const ai = { baseUrl: cfg.baseUrl, apiKey: decrypt(cfg.apiKey), model: cfg.model };
    const system = `你是运维实施岗位的月度工作汇报助手。请根据用户某月的工作记录（可能涉及现场实施、设备调试、巡检维护、故障处理、客户沟通、内部协作等），生成一份书面化的月度汇报初稿。
要求：
1. 只依据提供的记录，不虚构、不夸大；
2. 同类工作归并汇总，按工作类型条理化呈现，突出完成的项目/站点、处理的问题与结果、支持的客户等事实；
3. 结构为四段：
   ## 一、本月主要工作
   ## 二、重点成果
   ## 三、问题与改进
   ## 四、下月计划
4. 语言书面、正式、清晰，把"做了什么事、结果如何"写清楚；
5. 用 Markdown 列表输出。
只输出汇报正文。`;

    const result = await chat(ai, [
      { role: 'system', content: system },
      { role: 'user', content: raw },
    ]);

    // upsert 报告
    const content = `# ${yearMonth} 月运维实施工作汇报\n\n> 部门：卡调事业部 · 运维实施组\n\n${result}`;
    const report = await prisma.report.upsert({
      where: { userId_yearMonth: { userId: req.user!.id, yearMonth } },
      update: { content },
      create: { userId: req.user!.id, yearMonth, content },
    });
    pushLog('info', `月报生成成功 (用户: ${req.user!.username}, 月份: ${yearMonth})`);
    res.json({ report });
  } catch (e: any) {
    pushLog('error', `月报生成失败 (用户: ${req.user!.username}, 月份: ${yearMonth})`, e.message);
    res.status(502).json({ error: e.message || 'AI 汇总失败' });
  }
});

// 工具：把日期归到所在周的周一（以周一起算）
function mondayOf(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (date.getDay() + 6) % 7; // 0 = Monday
  date.setDate(date.getDate() - day);
  return date;
}
function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function isoWeekNumber(d: Date): number {
  // ISO 周算法
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / (7 * 24 * 3600 * 1000));
}

// 周度汇总：入参可为 yearWeek(如 "2026-W36") 或 date(如 "2026-09-11")
router.post('/weekly', async (req: AuthRequest, res) => {
  const { yearWeek, date } = req.body || {};
  let weekStart: Date;
  let weekKey: string;

  if (yearWeek && /^\d{4}-W\d{1,2}$/.test(yearWeek)) {
    const [yStr, wStr] = yearWeek.split('-W');
    const y = Number(yStr); const w = Number(wStr);
    // 从该年第一天推算
    const jan1 = new Date(y, 0, 1);
    weekStart = mondayOf(jan1);
    weekStart.setDate(weekStart.getDate() + (w - 1) * 7);
    weekKey = yearWeek;
  } else if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [yy, mm, dd] = date.split('-').map(Number);
    weekStart = mondayOf(new Date(yy, mm - 1, dd));
    weekKey = `${weekStart.getFullYear()}-W${String(isoWeekNumber(weekStart)).padStart(2, '0')}`;
  } else {
    return res.status(400).json({ error: '请传 yearWeek(如 2026-W36) 或 date(如 2026-09-11)' });
  }

  const s = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
  const e = new Date(s.getFullYear(), s.getMonth(), s.getDate() + 6, 23, 59, 59);

  const entries = await prisma.entry.findMany({
    where: { userId: req.user!.id, entryDate: { gte: s, lte: e } },
    orderBy: { entryDate: 'asc' },
  });

  if (entries.length === 0) {
    return res.status(400).json({ error: '该周暂无记录' });
  }

  const raw = entries.map((en) => {
    const txt = en.polishedContent || en.rawContent;
    return `【${toISODate(en.entryDate)}】${txt}`;
  }).join('\n');

  try {
    const cfg = await prisma.aiConfig.findUnique({ where: { userId: req.user!.id } });
    if (!cfg) return res.status(400).json({ error: '请先在「设置 - AI 配置」里填写接口与模型' });
    const ai = { baseUrl: cfg.baseUrl, apiKey: decrypt(cfg.apiKey), model: cfg.model };
    const range = `${toISODate(s)} ~ ${toISODate(e)}`;
    const system = `你是运维实施岗位的周度工作汇报助手。请根据用户本周（${range}）的工作记录（可能涉及现场实施、设备调试、巡检维护、故障处理、客户沟通等），生成一份书面化的周度汇报初稿。
要求：
1. 只依据提供的记录，不虚构、不夸大；
2. 同类工作归并汇总，突出完成的事项、处理的故障与结果；
3. 结构为三段：
   ## 一、本周主要工作
   ## 二、重点成果
   ## 三、下周计划
4. 语言书面、正式、清晰；
5. 用 Markdown 列表输出。
只输出汇报正文。`;

    const result = await chat(ai, [
      { role: 'system', content: system },
      { role: 'user', content: raw },
    ]);

    const content = `# ${weekKey} 周运维实施工作汇报（${range}）\n\n> 部门：卡调事业部 · 运维实施组\n\n${result}`;
    const report = await prisma.report.upsert({
      where: { userId_yearMonth: { userId: req.user!.id, yearMonth: weekKey } },
      update: { content },
      create: { userId: req.user!.id, yearMonth: weekKey, content },
    });
    pushLog('info', `周报生成成功 (用户: ${req.user!.username}, 周: ${weekKey})`);
    res.json({ report });
  } catch (e: any) {
    pushLog('error', `周报生成失败 (用户: ${req.user!.username}, 周: ${weekKey})`, e.message);
    res.status(502).json({ error: e.message || 'AI 汇总失败' });
  }
});

// AI 续写/追问：基于给定文本进行续写、扩展或回答追问
router.post('/continue', async (req: AuthRequest, res) => {
  const { text, instruction } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: '内容不能为空' });

  try {
    const cfg = await prisma.aiConfig.findUnique({ where: { userId: req.user!.id } });
    if (!cfg) return res.status(400).json({ error: '请先在「设置 - AI 配置」里填写接口与模型' });
    const ai = { baseUrl: cfg.baseUrl, apiKey: decrypt(cfg.apiKey), model: cfg.model };
    const intent = (instruction || 'continue').trim();
    let systemPrompt: string;
    if (intent === 'continue' || intent === '续写') {
      systemPrompt = `你是工作记录助手。请基于用户给出的内容，自然地续写下文，补充合理的后续步骤、可能的结果或跟进事项。
要求：
1. 不要重复原文；
2. 保持与原文相同的语气和颗粒度；
3. 用 1-3 条短句输出，每条以「·」开头；
只输出续写内容。`;
    } else if (intent === 'expand' || intent === '扩展') {
      systemPrompt = `你是工作记录助手。请把用户给出的口语化内容扩展为更详细的描述，补充过程、动作、参与人和结果。
只输出扩展后的内容，不要解释。`;
    } else {
      // 当作追问/自定义指令
      systemPrompt = `你是工作记录助手。请根据下面的指令处理用户提供的工作记录内容。
指令：${intent}
只输出处理后的内容，不要解释。`;
    }

    const result = await chat(ai, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text },
    ]);
    pushLog('info', `AI 续写成功 (用户: ${req.user!.username}, 指令: ${intent})`);
    res.json({ result });
  } catch (e: any) {
    pushLog('error', `AI 续写失败 (用户: ${req.user!.username})`, e.message);
    res.status(502).json({ error: e.message || 'AI 调用失败' });
  }
});

export default router;
