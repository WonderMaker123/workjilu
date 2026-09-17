import { test, expect } from '@playwright/test';

test.describe('工作日志助手 E2E 冒烟测试', () => {
  test('未登录时访问主页应重定向到登录页，并能展示登录表单', async ({ page }) => {
    await page.goto('/');

    // 应该重定向到 /login
    await expect(page).toHaveURL(/.*\/login/);

    // 检查页面核心文案和输入框
    await expect(page.locator('.form-title')).toContainText('欢迎回来');
    await expect(page.locator('input[type="text"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // 切换到注册标签
    const registerTab = page.locator('.tab-btn', { hasText: '注册' });
    await registerTab.click();
    await expect(page.locator('.form-title')).toContainText('创建账号');

    // 切回登录
    const loginTab = page.locator('.tab-btn', { hasText: '登录' });
    await loginTab.click();
    await expect(page.locator('.form-title')).toContainText('欢迎回来');
  });

  test('日历与主题模式在本地存储验证', async ({ page }) => {
    // 注入已登录 token 和个人偏好到 localStorage
    await page.addInitScript(() => {
      window.localStorage.setItem('worklog_token', 'mock-smoke-token');
      window.localStorage.setItem(
        'worklog_user',
        JSON.stringify({ id: 1, username: 'testuser', aiModel: 'deepseek-chat' })
      );
    });

    // 拦截日历 API 请求，返回模拟数据
    await page.route('**/api/entries*', async (route) => {
      const json = [
        {
          id: 101,
          entryDate: new Date().toISOString().slice(0, 10),
          rawContent: '完成现场设备巡检与自动化集成测试',
          tags: JSON.stringify(['实施', '巡检']),
          wordCount: 18,
          createdAt: new Date().toISOString(),
        },
      ];
      await route.fulfill({ json });
    });

    await page.goto('/calendar');
    await expect(page).toHaveURL(/.*\/calendar/);

    // 验证日历面板结构已渲染
    await expect(page.locator('.cal-card')).toBeVisible();
    await expect(page.locator('.cal-grid')).toBeVisible();
    // 检查是否有日期单元格被选中
    await expect(page.locator('.day-cell.selected')).toBeVisible();
  });
});
