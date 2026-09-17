import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { signToken, authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

const registerSchema = z.object({
  username: z.string().min(2, '用户名至少 2 个字符').max(30),
  password: z.string().min(6, '密码至少 6 位'),
});

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

// 注册
router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const { username, password } = parsed.data;
  const exists = await prisma.user.findUnique({ where: { username } });
  if (exists) return res.status(409).json({ error: '用户名已存在' });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { username, passwordHash } });

  const token = signToken({ id: user.id, username: user.username });
  res.status(201).json({ token, user: { id: user.id, username: user.username } });
});

// 登录
router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: '请输入用户名和密码' });

  const { username, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) return res.status(401).json({ error: '用户名或密码错误' });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: '用户名或密码错误' });

  const token = signToken({ id: user.id, username: user.username });
  res.json({ token, user: { id: user.id, username: user.username } });
});

// 当前用户信息
router.get('/me', authMiddleware, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  res.json({ id: user!.id, username: user!.username });
});

// 修改密码
router.post('/change-password', authMiddleware, async (req: AuthRequest, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: '新密码至少 6 位' });
  }
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  const ok = await bcrypt.compare(oldPassword, user!.passwordHash);
  if (!ok) return res.status(400).json({ error: '原密码错误' });

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: user!.id }, data: { passwordHash } });
  res.json({ ok: true });
});

export default router;
