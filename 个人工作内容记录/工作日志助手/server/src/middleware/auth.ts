import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import type { Request, Response, NextFunction } from 'express';

export interface AuthRequest extends Request {
  user?: { id: number; username: string };
}

export function signToken(user: { id: number; username: string }) {
  return jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET || 'dev-secret', {
    expiresIn: (process.env.JWT_EXPIRES_IN as any) || '7d',
  });
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: '未登录' });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret') as {
      id: number;
      username: string;
    };
    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user) return res.status(401).json({ error: '用户不存在' });
    req.user = { id: user.id, username: user.username };
    next();
  } catch {
    return res.status(401).json({ error: '登录已过期，请重新登录' });
  }
}
