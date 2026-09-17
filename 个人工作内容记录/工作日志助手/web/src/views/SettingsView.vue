<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useRouter } from 'vue-router';
import { aiConfigApi, type AiConfigView } from '@/api/aiConfig';
import { authApi } from '@/api/auth';
import { useAuthStore } from '@/stores/auth';
import { logsApi, type LogEntry } from '@/api/logs';
import { backupApi } from '@/api/backup';
import { getStoredTheme, setTheme, type ThemeMode } from '@/lib/theme';
import {
  reminderSupported, getReminderEnabled, getReminderTime, permissionState,
  enableReminder, disableReminder, setReminderTime, testReminder,
} from '@/lib/reminder';

const router = useRouter();
const auth = useAuthStore();

/* ---- 外观（深色模式） ---- */
const themeMode = ref<ThemeMode>(getStoredTheme());
function changeTheme(v: ThemeMode) { setTheme(v); themeMode.value = v; }

/* ---- 数据备份 ---- */
const exporting = ref(false);
const importing = ref(false);
const importInput = ref<HTMLInputElement | null>(null);
async function doExport() {
  exporting.value = true;
  try {
    const { data } = await backupApi.download();
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url; a.download = `worklog-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); URL.revokeObjectURL(url);
    ElMessage.success('备份已导出');
  } finally { exporting.value = false; }
}
async function onImportFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  try {
    const text = await file.text();
    const json = JSON.parse(text);
    await ElMessageBox.confirm(
      `即将导入备份：${json.entries?.length || 0} 条记录、${json.reports?.length || 0} 份报告。重复记录会自动跳过，确定继续吗？`,
      '导入确认', { confirmButtonText: '导入', cancelButtonText: '取消', type: 'warning' }
    );
    importing.value = true;
    const { data } = await backupApi.import(json);
    ElMessage.success(`导入完成：新增 ${data.entries} 条记录、${data.reports} 份报告${data.aiConfig ? '，含 AI 配置' : ''}`);
  } catch (err: any) {
    if (err === 'cancel' || err?.message?.includes('cancel')) return;
    ElMessage.error('导入失败：文件格式不正确');
  } finally {
    importing.value = false;
  }
}

/* ---- 每日提醒 ---- */
const reminderOn = ref(getReminderEnabled());
const reminderTime = ref(getReminderTime());
const reminderOk = ref(reminderSupported());
const reminderPerm = ref(permissionState());
async function onToggleReminder(v: boolean) {
  if (v) {
    const ok = await enableReminder(reminderTime.value);
    if (!ok) { reminderOn.value = false; ElMessage.warning('需要允许浏览器通知权限'); return; }
    ElMessage.success('已开启每日提醒');
  } else {
    disableReminder();
    ElMessage.success('已关闭提醒');
  }
  reminderPerm.value = permissionState();
}
function onChangeTime(t: string) {
  setReminderTime(t);
  ElMessage.success(`提醒时间已设为 ${t}`);
}
function onTestReminder() {
  if (testReminder()) ElMessage.success('已发送测试通知');
  else ElMessage.warning('请先开启提醒并允许通知权限');
}

/* ---- 系统日志 ---- */
const logs = ref<LogEntry[]>([]);
const logsLoading = ref(false);
const logsExpanded = ref(false);
const logsTimer = ref<number | undefined>();

async function loadLogs() {
  logsLoading.value = true;
  try {
    const { data } = await logsApi.list();
    logs.value = data.logs;
  } finally {
    logsLoading.value = false;
  }
}

function toggleLogs() {
  logsExpanded.value = !logsExpanded.value;
  if (logsExpanded.value) {
    loadLogs();
    logsTimer.value = window.setInterval(loadLogs, 5000);
  } else {
    if (logsTimer.value) window.clearInterval(logsTimer.value);
  }
}

async function clearLogs() {
  await logsApi.clear();
  logs.value = [];
  ElMessage.success('日志已清除');
}

function fmtLogTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
}

onMounted(loadLogs); // 加载一次初始日志（不轮询）

const cfgLoading = ref(false);
const cfgSaving = ref(false);
const testing = ref(false);
const apiKeyInput = ref('');
const cfgForm = reactive({ baseUrl: '', model: '', formality: 'standard' as 'simple' | 'standard' | 'detailed' });
const configured = ref(false);
const hasApiKey = ref(false);

const FORMALITY_MAP: Record<string, string> = { simple: '简洁：一句话说清一件事', standard: '标准：书面、正式、条理清晰', detailed: '详细：完整呈现过程与结果' };

onMounted(async () => {
  cfgLoading.value = true;
  try { const { data } = await aiConfigApi.get(); applyConfig(data); } finally { cfgLoading.value = false; }
});

function applyConfig(d: AiConfigView) {
  configured.value = d.configured; hasApiKey.value = !!d.hasApiKey;
  if (d.configured) { cfgForm.baseUrl = d.baseUrl || ''; cfgForm.model = d.model || ''; cfgForm.formality = d.formality || 'standard'; }
}

async function saveConfig() {
  if (!cfgForm.baseUrl || !cfgForm.model) { ElMessage.warning('请填写接口地址和模型名'); return; }
  if (!configured.value && !apiKeyInput.value) { ElMessage.warning('请填写 API Key'); return; }
  cfgSaving.value = true;
  try {
    const { data } = await aiConfigApi.save({ baseUrl: cfgForm.baseUrl, model: cfgForm.model, formality: cfgForm.formality, apiKey: apiKeyInput.value || undefined });
    applyConfig(data); apiKeyInput.value = ''; ElMessage.success('AI 配置已保存');
  } finally { cfgSaving.value = false; }
}

async function testConfig() {
  testing.value = true;
  try { await aiConfigApi.test({ baseUrl: cfgForm.baseUrl || undefined, apiKey: apiKeyInput.value || undefined, model: cfgForm.model || undefined }); ElMessage.success('连接成功'); }
  catch {} finally { testing.value = false; }
}

async function clearConfig() {
  try { await ElMessageBox.confirm('确定清除 AI 配置吗？清除后需重新填写。', '提示', { confirmButtonText: '清除', cancelButtonText: '取消', type: 'warning' }); }
  catch { return; }
  await aiConfigApi.delete();
  configured.value = false; hasApiKey.value = false; cfgForm.baseUrl = ''; cfgForm.model = ''; cfgForm.formality = 'standard'; apiKeyInput.value = '';
  ElMessage.success('已清除');
}

const pwdForm = reactive({ oldPassword: '', newPassword: '', confirm: '' });
const pwdSaving = ref(false);

async function changePwd() {
  if (!pwdForm.oldPassword || pwdForm.newPassword.length < 6) { ElMessage.warning('新密码至少 6 位'); return; }
  if (pwdForm.newPassword !== pwdForm.confirm) { ElMessage.warning('两次输入的新密码不一致'); return; }
  pwdSaving.value = true;
  try { await authApi.changePassword({ oldPassword: pwdForm.oldPassword, newPassword: pwdForm.newPassword }); ElMessage.success('密码已修改'); pwdForm.oldPassword = pwdForm.newPassword = pwdForm.confirm = ''; }
  finally { pwdSaving.value = false; }
}

function logout() { auth.logout(); router.push('/login'); }
</script>

<template>
  <div class="settings-page">
    <div class="page-head">
      <h1 class="page-title">设置</h1>
      <p class="page-desc">配置 AI 接口、修改密码、管理账号</p>
    </div>

    <!-- AI 配置 -->
    <section class="panel">
      <div class="section-head">
        <div class="section-icon" style="background:var(--color-primary-bg);color:var(--color-primary)">
          <el-icon :size="18"><Setting /></el-icon>
        </div>
        <div>
          <h2 class="section-title">AI 配置</h2>
          <p class="section-desc">使用 OpenAI 兼容接口，填好即可随时切换服务商</p>
        </div>
      </div>

      <div v-if="cfgLoading" style="margin-top:16px"><el-skeleton :rows="3" animated /></div>

      <el-form v-else class="cfg-form" label-position="top" @submit.prevent>
        <div class="form-grid">
          <el-form-item label="接口地址（以 /v1 结尾）">
            <el-input v-model="cfgForm.baseUrl" placeholder="https://api.deepseek.com/v1" clearable />
          </el-form-item>
          <el-form-item :label="hasApiKey ? 'API Key（已保存，留空不修改）' : 'API Key'">
            <el-input v-model="apiKeyInput" type="password" show-password :placeholder="hasApiKey ? '••••••••' : 'sk-…'" />
          </el-form-item>
          <el-form-item label="模型名">
            <el-input v-model="cfgForm.model" placeholder="deepseek-chat / gpt-4o-mini" clearable />
          </el-form-item>
          <el-form-item label="整理风格">
            <el-radio-group v-model="cfgForm.formality">
              <el-radio-button value="simple">简洁</el-radio-button>
              <el-radio-button value="standard">标准</el-radio-button>
              <el-radio-button value="detailed">详细</el-radio-button>
            </el-radio-group>
            <div class="formality-desc">{{ FORMALITY_MAP[cfgForm.formality] }}</div>
          </el-form-item>
        </div>

        <div class="cfg-actions">
          <el-button :loading="testing" @click="testConfig"><el-icon style="margin-right:4px"><Connection /></el-icon>测试连接</el-button>
          <el-button v-if="configured" @click="clearConfig">清除配置</el-button>
          <el-button type="primary" :loading="cfgSaving" @click="saveConfig">保存</el-button>
        </div>
      </el-form>
    </section>

    <!-- 外观 -->
    <section class="panel">
      <div class="section-head">
        <div class="section-icon" style="background:var(--color-primary-bg);color:var(--color-primary)">
          <el-icon :size="18"><component :is="themeMode === 'dark' ? 'Moon' : 'Sunny'" /></el-icon>
        </div>
        <div>
          <h2 class="section-title">外观</h2>
          <p class="section-desc">切换浅色 / 深色主题，自动记住你的选择</p>
        </div>
      </div>
      <el-radio-group :model-value="themeMode" @change="(v: any) => changeTheme(v)">
        <el-radio-button value="light"><el-icon style="margin-right:4px"><Sunny /></el-icon>浅色</el-radio-button>
        <el-radio-button value="dark"><el-icon style="margin-right:4px"><Moon /></el-icon>深色</el-radio-button>
      </el-radio-group>
    </section>

    <!-- 每日提醒 -->
    <section class="panel">
      <div class="section-head">
        <div class="section-icon" style="background:var(--color-warning-bg);color:var(--color-warning)">
          <el-icon :size="18"><Bell /></el-icon>
        </div>
        <div>
          <h2 class="section-title">每日提醒</h2>
          <p class="section-desc">到点浏览器通知你写日志（需保持页面打开）</p>
        </div>
      </div>
      <div v-if="!reminderOk" class="reminder-tip">当前浏览器不支持通知提醒</div>
      <div v-else class="reminder-row">
        <el-switch
          :model-value="reminderOn"
          @change="(v: any) => onToggleReminder(!!v)"
          active-text="开启提醒"
          inline-prompt
        />
        <el-time-picker
          v-model="reminderTime"
          format="HH:mm"
          value-format="HH:mm"
          :clearable="false"
          class="reminder-time"
          @change="(v: any) => v && onChangeTime(v)"
        />
        <el-button @click="onTestReminder" plain>发送测试通知</el-button>
        <span v-if="reminderPerm === 'denied'" class="reminder-warn">通知权限已被拒绝，请在浏览器设置中允许</span>
      </div>
    </section>

    <!-- 数据备份 -->
    <section class="panel">
      <div class="section-head">
        <div class="section-icon" style="background:var(--color-success-bg);color:var(--color-success)">
          <el-icon :size="18"><FolderOpened /></el-icon>
        </div>
        <div>
          <h2 class="section-title">数据备份与恢复</h2>
          <p class="section-desc">导出全部记录 / 报告 / AI 配置为 JSON，或从备份文件恢复</p>
        </div>
      </div>
      <div class="backup-actions">
        <el-button :loading="exporting" @click="doExport">
          <el-icon style="margin-right:4px"><Download /></el-icon>导出备份
        </el-button>
        <el-button :loading="importing" @click="importInput?.click()">
          <el-icon style="margin-right:4px"><Upload /></el-icon>导入备份
        </el-button>
        <input ref="importInput" type="file" accept="application/json,.json" style="display:none" @change="onImportFile" />
      </div>
    </section>

    <!-- 修改密码 -->
    <section class="panel">
      <div class="section-head">
        <div class="section-icon" style="background:var(--color-warning-bg);color:var(--color-warning)">
          <el-icon :size="18"><Lock /></el-icon>
        </div>
        <div>
          <h2 class="section-title">修改密码</h2>
          <p class="section-desc">定期修改以保障账号安全</p>
        </div>
      </div>
      <el-form class="pwd-form" label-position="top" @submit.prevent>
        <div class="form-grid">
          <el-form-item label="原密码"><el-input v-model="pwdForm.oldPassword" type="password" show-password /></el-form-item>
          <el-form-item label="新密码（至少 6 位）"><el-input v-model="pwdForm.newPassword" type="password" show-password /></el-form-item>
          <el-form-item label="确认新密码"><el-input v-model="pwdForm.confirm" type="password" show-password @keyup.enter="changePwd" /></el-form-item>
        </div>
        <el-button type="primary" :loading="pwdSaving" @click="changePwd">修改密码</el-button>
      </el-form>
    </section>

    <!-- 账号 -->
    <section class="panel">
      <div class="section-head">
        <div class="section-icon" style="background:var(--color-success-bg);color:var(--color-success)">
          <el-icon :size="18"><User /></el-icon>
        </div>
        <div>
          <h2 class="section-title">账号</h2>
          <p class="section-desc">数据仅本人可见，按用户严格隔离</p>
        </div>
      </div>
      <div class="account-row">
        <div class="user-avatar">{{ auth.user?.username?.slice(0,1).toUpperCase() }}</div>
        <div class="user-name">{{ auth.user?.username }}</div>
        <div class="spacer" />
        <el-button @click="logout">退出登录</el-button>
      </div>
    </section>

    <!-- 系统日志 -->
    <section class="panel">
      <div class="section-head">
        <div class="section-icon" style="background:var(--color-bg-hover);color:var(--color-text-sub)">
          <el-icon :size="18"><Document /></el-icon>
        </div>
        <div class="logs-head-text">
          <h2 class="section-title">系统日志</h2>
          <p class="section-desc">查看 AI 调用与服务端运行记录</p>
        </div>
        <div class="spacer" />
        <el-button size="small" @click="loadLogs" :loading="logsLoading">
          <el-icon style="margin-right:4px"><Refresh /></el-icon>刷新
        </el-button>
        <el-button size="small" @click="toggleLogs">
          <el-icon style="margin-right:4px">
            <component :is="logsExpanded ? 'ArrowUp' : 'ArrowDown'" />
          </el-icon>
          {{ logsExpanded ? '收起' : '展开' }}
        </el-button>
        <el-button v-if="logsExpanded && logs.length" size="small" type="danger" text @click="clearLogs">
          清除
        </el-button>
      </div>

      <div v-if="logsExpanded" class="logs-body">
        <div v-if="logs.length === 0" class="logs-empty">暂无日志记录</div>
        <div v-else class="logs-list">
          <div v-for="(log, i) in logs" :key="i" class="log-row" :class="'log-' + log.level">
            <span class="log-time">{{ fmtLogTime(log.time) }}</span>
            <span class="log-level">{{ log.level.toUpperCase() }}</span>
            <div class="log-content">
              <div class="log-msg">{{ log.message }}</div>
              <div v-if="log.detail" class="log-detail">{{ log.detail }}</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 关于 -->
    <section class="panel about-panel">
      <div class="about-row">
        <div class="about-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M9 11H15M9 15H13M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="about-text">
          <div class="about-name">工作日志助手 <span class="about-ver">v1.0</span></div>
          <div class="about-org">安徽海博智能科技有限责任公司</div>
          <div class="about-dept">卡调事业部 · 运维实施组</div>
        </div>
      </div>
      <div class="about-note">记录按账号隔离，仅本人可见；支持自建部署，数据内部留存。</div>
    </section>
  </div>
</template>

<style scoped>
.settings-page { display: flex; flex-direction: column; gap: var(--space-lg); max-width: 720px; }
.page-head { margin-bottom: var(--space-3xs); }
.page-title { font-size: var(--fs-display); line-height: var(--lh-display); font-weight: 800; color: var(--color-text-title); letter-spacing: -0.03em; }
.page-desc { font-size: var(--fs-aux); color: var(--color-text-sub); margin-top: 2px; }

.section-head { display: flex; align-items: center; gap: 12px; margin-bottom: var(--space-lg); }
.section-icon { width: 36px; height: 36px; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.section-title { font-size: var(--fs-h2); font-weight: 700; color: var(--color-text-title); }
.section-desc { font-size: var(--fs-micro); color: var(--color-text-sub); margin-top: 2px; }

.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 20px; }
.formality-desc { margin-top: 6px; font-size: var(--fs-micro); color: var(--color-text-sub); }
.cfg-actions { display: flex; gap: 10px; margin-top: 8px; }

/* 提醒与备份 */
.reminder-row { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.reminder-time { width: 130px; }
.reminder-tip { font-size: var(--fs-aux); color: var(--color-text-placeholder); }
.reminder-warn { font-size: var(--fs-micro); color: var(--color-warning); }
.backup-actions { display: flex; gap: 10px; flex-wrap: wrap; }

.account-row { display: flex; align-items: center; gap: 12px; }
.user-avatar { width: 40px; height: 40px; border-radius: var(--radius-full); background: linear-gradient(135deg, var(--color-primary), var(--color-primary-light)); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 600; }
.user-name { font-size: var(--fs-h3); font-weight: 600; color: var(--color-text-title); }
.spacer { flex: 1; }

@media (max-width: 768px) { .form-grid { grid-template-columns: 1fr; } }

/* 日志面板 */
.logs-head-text { flex: 1; min-width: 0; }
.logs-body {
  margin-top: 12px;
  background: #1C1917;
  border-radius: var(--radius-md);
  max-height: 400px;
  overflow-y: auto;
  font-family: var(--font-mono);
}
.logs-empty {
  padding: 32px;
  text-align: center;
  color: #78716C;
  font-size: var(--fs-aux);
}
.logs-list {
  padding: 8px 0;
}
.log-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 6px 14px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
.log-row:last-child { border-bottom: none; }
.log-time {
  font-size: 11px;
  color: #78716C;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
  padding-top: 1px;
}
.log-level {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 3px;
  flex-shrink: 0;
  min-width: 40px;
  text-align: center;
}
.log-info .log-level { background: rgba(79,70,229,0.2); color: #A5A0F0; }
.log-error .log-level { background: rgba(220,38,38,0.25); color: #FCA5A5; }
.log-warn .log-level { background: rgba(217,119,6,0.25); color: #FCD34D; }
.log-content { flex: 1; min-width: 0; }
.log-msg { font-size: 12px; color: #D6D3D1; line-height: 1.6; }
.log-error .log-msg { color: #FCA5A5; }
.log-detail { font-size: 11px; color: #78716C; margin-top: 2px; word-break: break-word; }

/* 关于 */
.about-panel { display: flex; flex-direction: column; gap: 10px; }
.about-row { display: flex; align-items: center; gap: 14px; }
.about-icon {
  width: 44px; height: 44px;
  border-radius: var(--radius-md);
  background: var(--color-primary-bg);
  color: var(--color-primary);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.about-name { font-size: var(--fs-h2); font-weight: 700; color: var(--color-text-title); }
.about-ver { font-size: var(--fs-micro); font-weight: 500; color: var(--color-text-placeholder); margin-left: 4px; }
.about-org { font-size: var(--fs-aux); color: var(--color-text-body); margin-top: 2px; }
.about-dept { font-size: var(--fs-micro); color: var(--color-text-sub); margin-top: 1px; }
.about-note { font-size: var(--fs-micro); color: var(--color-text-placeholder); padding-top: 10px; border-top: 1px solid var(--color-border-light); }
</style>
