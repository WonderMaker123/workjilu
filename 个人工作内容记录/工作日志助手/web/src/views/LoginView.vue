<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const auth = useAuthStore();

const mode = ref<'login' | 'register'>('login');
const loading = ref(false);
const form = reactive({ username: '', password: '' });

async function submit() {
  if (loading.value) return;
  loading.value = true;
  try {
    if (mode.value === 'register') await auth.register(form.username.trim(), form.password);
    else await auth.login(form.username.trim(), form.password);
    router.push('/');
  } catch { /* http 拦截器处理 */ } finally { loading.value = false; }
}

function switchMode() { mode.value = mode.value === 'login' ? 'register' : 'login'; }
</script>

<template>
  <div class="auth-page">
    <!-- 左侧视觉区 -->
    <div class="visual-side">
      <div class="visual-content">
        <div class="logo-row">
          <div class="logo-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M9 11H15M9 15H13M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </div>
          <div class="logo-group">
            <span class="logo-text">工作日志助手</span>
            <span class="logo-sub">安徽海博智能科技有限责任公司</span>
          </div>
        </div>

        <div class="hero">
          <h1 class="hero-title">运维实施随手记<br/>周报月报一键生成</h1>
          <p class="hero-desc">现场实施、设备调试、故障处理随时口语化记录，AI 自动整理为书面条目；周报、月报一键汇总，汇报不再临时翻记录。</p>
        </div>

        <div class="features">
          <div class="feat">
            <span class="feat-dot"></span>
            <span>口语记录 → AI 书面化整理</span>
          </div>
          <div class="feat">
            <span class="feat-dot"></span>
            <span>实施 / 巡检 / 故障，标签分类快速检索</span>
          </div>
          <div class="feat">
            <span class="feat-dot"></span>
            <span>周报、月报 AI 汇总 + 多格式导出</span>
          </div>
          <div class="feat">
            <span class="feat-dot"></span>
            <span>自建部署，数据内部留存</span>
          </div>
        </div>

        <div class="visual-footer">卡调事业部 · 运维实施组</div>
      </div>
      <div class="visual-bg"></div>
    </div>

    <!-- 右侧表单区 -->
    <div class="form-side">
      <div class="form-wrapper">
        <div class="mobile-brand">
          <div class="m-logo">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M9 11H15M9 15H13M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </div>
          <div>
            <div class="m-name">工作日志助手</div>
            <div class="m-sub">安徽海博智能科技有限责任公司 · 卡调事业部运维实施组</div>
          </div>
        </div>
        <div class="form-header">
          <h2 class="form-title">{{ mode === 'login' ? '欢迎回来' : '创建账号' }}</h2>
          <p class="form-sub">{{ mode === 'login' ? '登录后继续记录你的工作' : '注册后即可开始使用' }}</p>
        </div>

        <div class="tab-row">
          <button class="tab-btn" :class="{ active: mode === 'login' }" @click="mode = 'login'">登录</button>
          <button class="tab-btn" :class="{ active: mode === 'register' }" @click="mode = 'register'">注册</button>
          <div class="tab-indicator" :class="{ right: mode === 'register' }"></div>
        </div>

        <form @submit.prevent="submit" class="form-body">
          <div class="field">
            <label class="field-label">用户名</label>
            <el-input
              v-model="form.username"
              placeholder="请输入用户名"
              size="large"
              clearable
              @keyup.enter="submit"
            />
          </div>

          <div class="field">
            <label class="field-label">密码</label>
            <el-input
              v-model="form.password"
              type="password"
              placeholder="至少 6 位"
              size="large"
              show-password
              @keyup.enter="submit"
            />
          </div>

          <el-button
            type="primary"
            size="large"
            class="submit-btn"
            :loading="loading"
            @click="submit"
          >
            {{ mode === 'login' ? '登 录' : '注册并登录' }}
          </el-button>
        </form>

        <div class="form-foot">
          <span>{{ mode === 'login' ? '还没有账号？' : '已有账号？' }}</span>
          <a @click="switchMode">{{ mode === 'login' ? '去注册' : '去登录' }}</a>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
}

/* —— 左侧视觉区 —— */
.visual-side {
  width: 46%;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary);
}
.visual-bg {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse at 20% 20%, rgba(255,255,255,0.12) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 80%, rgba(129, 140, 248, 0.3) 0%, transparent 50%),
    radial-gradient(ellipse at 50% 50%, rgba(99, 102, 241, 0.15) 0%, transparent 60%);
}
.visual-content {
  position: relative;
  z-index: 1;
  max-width: 420px;
  padding: var(--space-3xl);
  color: #fff;
}
.logo-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: var(--space-3xl);
}
.logo-icon {
  width: 36px; height: 36px;
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(8px);
  display: flex; align-items: center; justify-content: center;
  color: #fff;
}
.logo-group { display: flex; flex-direction: column; gap: 2px; }
.logo-text {
  font-size: var(--fs-h2);
  font-weight: 700;
  letter-spacing: -0.02em;
}
.logo-sub {
  font-size: 11px;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.72);
  letter-spacing: 0.02em;
}
.hero-title {
  font-size: var(--fs-display);
  line-height: 1.3;
  font-weight: 800;
  letter-spacing: -0.03em;
  margin-bottom: var(--space-md);
}
.hero-desc {
  font-size: 15px;
  line-height: 1.7;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: var(--space-2xl);
}
.features {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-bottom: var(--space-3xl);
}
.feat {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.85);
}
.feat-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.6);
  flex-shrink: 0;
}
.visual-footer {
  font-size: var(--fs-micro);
  color: rgba(255, 255, 255, 0.5);
  padding-top: var(--space-xl);
  border-top: 1px solid rgba(255, 255, 255, 0.15);
}

/* —— 右侧表单区 —— */
.form-side {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-card);
  padding: var(--space-xl);
}
.form-wrapper {
  width: 100%;
  max-width: 360px;
}
.form-header {
  margin-bottom: var(--space-xl);
}
.form-title {
  font-size: var(--fs-display);
  line-height: var(--lh-display);
  font-weight: 800;
  color: var(--color-text-title);
  letter-spacing: -0.03em;
  margin-bottom: var(--space-3xs);
}
.form-sub {
  font-size: var(--fs-aux);
  color: var(--color-text-sub);
}

/* —— Tab 切换 —— */
.tab-row {
  display: flex;
  background: var(--color-bg-page);
  border-radius: var(--radius-md);
  padding: 4px;
  margin-bottom: var(--space-xl);
  position: relative;
}
.tab-btn {
  flex: 1;
  height: 36px;
  font-size: var(--fs-aux);
  font-weight: 500;
  color: var(--color-text-sub);
  border-radius: var(--radius-sm);
  transition: color var(--dur-fast) var(--ease-out);
  position: relative;
  z-index: 1;
}
.tab-btn.active {
  color: var(--color-primary);
  font-weight: 600;
}
.tab-indicator {
  position: absolute;
  top: 4px; left: 4px;
  width: calc(50% - 4px);
  height: 36px;
  background: var(--color-bg-card);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-xs);
  transition: transform var(--dur-normal) var(--ease-out);
}
.tab-indicator.right {
  transform: translateX(100%);
}

/* —— 表单 —— */
.field { margin-bottom: var(--space-md); }
.field-label {
  display: block;
  font-size: var(--fs-micro);
  font-weight: 500;
  color: var(--color-text-sub);
  margin-bottom: 6px;
}

.submit-btn {
  width: 100%;
  height: 44px;
  font-size: var(--fs-h3);
  font-weight: 600;
  margin-top: var(--space-xs);
  border-radius: var(--radius-md) !important;
}

.form-foot {
  margin-top: var(--space-lg);
  text-align: center;
  font-size: var(--fs-aux);
  color: var(--color-text-sub);
}
.form-foot a {
  color: var(--color-primary);
  cursor: pointer;
  font-weight: 500;
  margin-left: 4px;
}

/* —— 响应式 —— */
.mobile-brand { display: none; }
@media (max-width: 900px) {
  .visual-side { display: none; }
  .form-side { padding: var(--space-lg); }
  .mobile-brand {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: var(--space-xl);
  }
  .m-logo {
    width: 34px; height: 34px;
    border-radius: var(--radius-md);
    background: var(--color-primary);
    color: #fff;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .m-name { font-size: var(--fs-h3); font-weight: 700; color: var(--color-text-title); }
  .m-sub { font-size: var(--fs-micro); color: var(--color-text-sub); margin-top: 1px; }
}
</style>
