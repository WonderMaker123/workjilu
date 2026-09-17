import express from 'express';
import cors from 'cors';

import authRoutes from './routes/auth';
import entryRoutes from './routes/entries';
import aiRoutes from './routes/ai';
import reportRoutes from './routes/reports';
import aiConfigRoutes from './routes/aiConfig';
import logRoutes, { pushLog } from './routes/logs';
import statsRoutes from './routes/stats';
import backupRoutes from './routes/backup';
import photoRoutes from './routes/photos';

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: (process.env.CORS_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173').split(','),
      credentials: true,
    })
  );
  app.use(express.json({ limit: '12mb' }));

  // 健康检查
  app.get('/api/health', (_req, res) => res.json({ ok: true, time: Date.now() }));

  app.use('/api/auth', authRoutes);
  app.use('/api/entries', entryRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/ai-config', aiConfigRoutes);
  app.use('/api/logs', logRoutes);
  app.use('/api/stats', statsRoutes);
  app.use('/api/backup', backupRoutes);
  app.use('/api/photos', photoRoutes);

  // 统一错误兜底
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[error]', err);
    pushLog('error', err?.message || '服务器内部错误', err?.stack);
    res.status(500).json({ error: err?.message || '服务器内部错误' });
  });

  return app;
}
