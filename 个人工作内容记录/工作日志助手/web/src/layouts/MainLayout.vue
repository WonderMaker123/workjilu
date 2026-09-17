<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessageBox } from 'element-plus';
import { useAuthStore } from '@/stores/auth';
import { getStoredTheme, toggleTheme } from '@/lib/theme';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const isMobile = ref(window.innerWidth <= 768);
window.addEventListener('resize', () => { isMobile.value = window.innerWidth <= 768; });

const isDark = ref(getStoredTheme() === 'dark');
function onToggleTheme() {
  isDark.value = toggleTheme() === 'dark';
}

const navItems = [
  { key: 'dashboard', path: '/dashboard', title: '仪表盘', icon: 'Odometer' },
  { key: 'today', path: '/today', title: '今日记录', icon: 'EditPen' },
  { key: 'calendar', path: '/calendar', title: '日历', icon: 'Calendar' },
  { key: 'list', path: '/list', title: '记录列表', icon: 'List' },
  { key: 'reports', path: '/reports', title: '工作汇总', icon: 'DataAnalysis' },
  { key: 'settings', path: '/settings', title: '设置', icon: 'Setting' },
];

const active = computed(() => (route.meta.nav as string) || '');

// 移动端底部只放 4 个高频入口
const mobileNavItems = computed(() => navItems.filter((i) => ['dashboard', 'today', 'list', 'settings'].includes(i.key)));

function logout() {
  ElMessageBox.confirm('确定要退出登录吗？', '提示', {
    confirmButtonText: '退出', cancelButtonText: '取消', type: 'warning',
  }).then(() => { auth.logout(); router.push('/login'); }).catch(() => {});
}

function initial() {
  return auth.user?.username?.slice(0, 1).toUpperCase() || '?';
}
</script>

<template>
  <div class="layout">
    <!-- 侧边栏（桌面） -->
    <aside class="sidebar" v-if="!isMobile">
      <div class="sidebar-brand" @click="router.push('/dashboard')">
        <div class="brand-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M9 11H15M9 15H13M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="brand-text-group">
          <span class="brand-text">工作日志助手</span>
          <span class="brand-sub">卡调事业部 · 运维实施组</span>
        </div>
      </div>

      <nav class="sidebar-nav">
        <router-link
          v-for="item in navItems"
          :key="item.key"
          :to="item.path"
          class="nav-link"
          :class="{ active: active === item.key }"
        >
          <el-icon :size="20"><component :is="item.icon" /></el-icon>
          <span>{{ item.title }}</span>
        </router-link>
      </nav>

      <div class="sidebar-foot">
        <div class="user-card">
          <div class="user-avatar">{{ initial() }}</div>
          <div class="user-info">
            <div class="user-name">{{ auth.user?.username }}</div>
            <div class="user-label">已登录</div>
          </div>
          <el-tooltip :content="isDark ? '切换浅色' : '切换深色'" placement="top">
            <button class="logout-btn" @click="onToggleTheme">
              <el-icon :size="16"><component :is="isDark ? 'Sunny' : 'Moon'" /></el-icon>
            </button>
          </el-tooltip>
          <el-tooltip content="退出登录" placement="top">
            <button class="logout-btn" @click="logout">
              <el-icon :size="16"><SwitchButton /></el-icon>
            </button>
          </el-tooltip>
        </div>
      </div>
    </aside>

    <!-- 主内容区 -->
    <div class="main-area">
      <main class="content">
        <router-view />
      </main>
    </div>

    <!-- 底部移动端导航 -->
    <nav class="mobile-nav" v-if="isMobile">
      <router-link
        v-for="item in mobileNavItems"
        :key="item.key"
        :to="item.path"
        class="mnav-item"
        :class="{ active: active === item.key }"
      >
        <el-icon :size="22"><component :is="item.icon" /></el-icon>
        <span>{{ item.title }}</span>
      </router-link>
    </nav>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  min-height: 100vh;
  background: var(--color-bg-page);
}

/* —— 侧边栏 —— */
.sidebar {
  width: var(--sidebar-width);
  background: var(--color-bg-card);
  border-right: 1px solid var(--color-border-light);
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0; left: 0; bottom: 0;
  z-index: 40;
}
.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px 20px;
  cursor: pointer;
}
.brand-icon {
  width: 32px; height: 32px;
  border-radius: var(--radius-md);
  background: var(--color-primary);
  display: flex; align-items: center; justify-content: center;
  color: #fff;
  box-shadow: var(--shadow-primary);
}
.brand-text-group { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.brand-text {
  font-size: var(--fs-h2);
  font-weight: 700;
  color: var(--color-text-title);
  letter-spacing: -0.02em;
  line-height: 1.2;
}
.brand-sub {
  font-size: 10px;
  font-weight: 500;
  color: var(--color-text-placeholder);
  letter-spacing: 0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-nav {
  flex: 1;
  padding: var(--space-sm) 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.nav-link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: var(--radius-md);
  color: var(--color-text-sub);
  font-size: var(--fs-aux);
  font-weight: 500;
  text-decoration: none;
  transition: all var(--dur-fast) var(--ease-out);
}
.nav-link:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-title);
}
.nav-link.active {
  background: var(--color-primary-bg);
  color: var(--color-primary);
  font-weight: 600;
}

/* 底部用户卡片 */
.sidebar-foot {
  padding: 12px;
  border-top: 1px solid var(--color-border-light);
}
.user-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: var(--radius-md);
}
.user-avatar {
  width: 32px; height: 32px;
  border-radius: var(--radius-full);
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-light));
  color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px;
  font-weight: 600;
  flex-shrink: 0;
}
.user-info {
  flex: 1;
  min-width: 0;
}
.user-name {
  font-size: var(--fs-aux);
  font-weight: 600;
  color: var(--color-text-title);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.user-label {
  font-size: var(--fs-micro);
  color: var(--color-text-placeholder);
}
.logout-btn {
  width: 30px; height: 30px;
  border-radius: var(--radius-sm);
  color: var(--color-text-placeholder);
  display: flex; align-items: center; justify-content: center;
  transition: all var(--dur-fast) var(--ease-out);
}
.logout-btn:hover {
  background: var(--color-danger-bg);
  color: var(--color-danger);
}

/* —— 主内容区 —— */
.main-area {
  flex: 1;
  margin-left: var(--sidebar-width);
  min-width: 0;
}
.content {
  padding: var(--space-xl) var(--space-2xl);
  max-width: 960px;
  margin: 0 auto;
}

/* —— 移动端导航 —— */
.mobile-nav {
  display: none;
}

@media (max-width: 768px) {
  .main-area { margin-left: 0; }
  .content { padding: var(--space-md); max-width: none; }
  .mobile-nav {
    display: flex;
    position: fixed;
    bottom: 0; left: 0; right: 0;
    height: 60px;
    background: var(--color-bg-card);
    border-top: 1px solid var(--color-border);
    z-index: 40;
    padding-bottom: env(safe-area-inset-bottom);
  }
  .mnav-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    color: var(--color-text-placeholder);
    font-size: 11px;
    text-decoration: none;
    transition: color var(--dur-fast) var(--ease-out);
  }
  .mnav-item.active { color: var(--color-primary); }
  .main-area { padding-bottom: 60px; }
}
</style>
