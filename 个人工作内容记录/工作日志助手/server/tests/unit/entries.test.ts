import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { signToken } from '../../src/middleware/auth';
import { prisma } from '../../src/lib/prisma';

// Mock prisma
vi.mock('../../src/lib/prisma', () => {
  return {
    prisma: {
      entry: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
      },
    },
  };
});

describe('Entries API & Zod Validation', () => {
  const app = createApp();
  const mockUser = { id: 1, username: 'testuser' };
  const validToken = signToken(mockUser);

  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.user.findUnique as any).mockResolvedValue(mockUser);
  });

  it('should reject unauthenticated request with 401', async () => {
    const res = await request(app).get('/api/entries');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('未登录');
  });

  it('should validate entry creation schema (require non-empty rawContent)', async () => {
    const res = await request(app)
      .post('/api/entries')
      .set('Authorization', `Bearer ${validToken}`)
      .send({
        entryDate: '2025-05-18',
        rawContent: '', // rawContent min 1
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('内容不能为空');
  });

  it('should successfully create entry when payload is valid', async () => {
    const mockEntry = {
      id: 10,
      userId: mockUser.id,
      entryDate: new Date('2025-05-18T00:00:00.000Z'),
      rawContent: '今日编写了核心模块的单元测试',
      polishedContent: null,
      wordCount: 15,
      tags: '["开发","测试"]',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (prisma.entry.create as any).mockResolvedValue(mockEntry);

    const res = await request(app)
      .post('/api/entries')
      .set('Authorization', `Bearer ${validToken}`)
      .send({
        entryDate: '2025-05-18',
        rawContent: '今日编写了核心模块的单元测试',
        tags: ['开发', '测试'],
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(10);
    expect(res.body.rawContent).toBe('今日编写了核心模块的单元测试');
    expect(prisma.entry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: mockUser.id,
        rawContent: '今日编写了核心模块的单元测试',
        tags: JSON.stringify(['开发', '测试']),
      }),
    });
  });

  it('should list entries with month and tag filters', async () => {
    const mockEntries = [
      {
        id: 1,
        userId: mockUser.id,
        entryDate: new Date('2025-05-18T00:00:00.000Z'),
        rawContent: '完成任务 A',
        tags: '["工作"]',
      },
    ];

    (prisma.entry.findMany as any).mockResolvedValue(mockEntries);

    const res = await request(app)
      .get('/api/entries?month=2025-05&tag=工作')
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0].rawContent).toBe('完成任务 A');
    expect(prisma.entry.findMany).toHaveBeenCalled();
  });

  it('should reject entry deletion if entry not found', async () => {
    (prisma.entry.findFirst as any).mockResolvedValue(null);

    const res = await request(app)
      .delete('/api/entries/999')
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('记录不存在');
  });
});
