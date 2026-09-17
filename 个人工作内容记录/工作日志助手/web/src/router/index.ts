import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { public: true, title: '登录' },
  },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    children: [
      {
        path: '',
        redirect: '/dashboard',
      },
      {
        path: 'dashboard',
        name: 'dashboard',
        component: () => import('@/views/DashboardView.vue'),
        meta: { title: '数据仪表盘', nav: 'dashboard' },
      },
      {
        path: 'today',
        name: 'today',
        component: () => import('@/views/TodayView.vue'),
        meta: { title: '今日记录', nav: 'today' },
      },
      {
        path: 'calendar',
        name: 'calendar',
        component: () => import('@/views/CalendarView.vue'),
        meta: { title: '日历视图', nav: 'calendar' },
      },
      {
        path: 'list',
        name: 'list',
        component: () => import('@/views/ListView.vue'),
        meta: { title: '记录列表', nav: 'list' },
      },
      {
        path: 'reports',
        name: 'reports',
        component: () => import('@/views/ReportsView.vue'),
        meta: { title: '工作汇总', nav: 'reports' },
      },
      {
        path: 'settings',
        name: 'settings',
        component: () => import('@/views/SettingsView.vue'),
        meta: { title: '设置', nav: 'settings' },
      },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  document.title = `${to.meta.title || ''} · 工作日志助手`;
  const auth = useAuthStore();
  if (to.meta.public) return true;
  if (!auth.token && !auth.user) return '/login';
  if (!auth.user) {
    const user = await auth.me();
    if (!user) return '/login';
  }
  return true;
});

export default router;
