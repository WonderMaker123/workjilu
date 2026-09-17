import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// 简易内存日志缓冲区（最近 200 条）
const MAX_LOGS = 200;
interface LogEntry {
  time: string;
  level: 'info' | 'error' | 'warn';
  message: string;
  detail?: string;
}
const logBuffer: LogEntry[] = [];

export function pushLog(level: LogEntry['level'], message: string, detail?: string) {
  logBuffer.push({ time: new Date().toISOString(), level, message, detail });
  if (logBuffer.length > MAX_LOGS) logBuffer.shift();
}

router.use(authMiddleware);

// 获取日志
router.get('/', (req: AuthRequest, res) => {
  res.json({ logs: [...logBuffer].reverse() });
});

// 清除日志
router.delete('/', (req: AuthRequest, res) => {
  logBuffer.length = 0;
  res.json({ ok: true });
});

export default router;
