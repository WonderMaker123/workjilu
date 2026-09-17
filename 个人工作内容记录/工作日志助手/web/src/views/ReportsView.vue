<script setup lang="ts">
import { computed, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { aiApi } from '@/api/ai';
import { reportsApi, type Report } from '@/api/reports';
import { marked } from 'marked';

const mode = ref<'month' | 'week'>('month');
const month = ref(new Date().toISOString().slice(0, 7));
// 周报用某一天定位所在周
const weekDate = ref(new Date().toISOString().slice(0, 10));

const report = ref<Report | null>(null);
const generating = ref(false);
const loading = ref(false);
const editing = ref(false);
const editContent = ref('');
const rendered = computed(() => marked.parse(report.value?.content || '', { async: false }) as string);

// 历史报告
interface HistoryItem { id: number; yearMonth: string; updatedAt: string }
const history = ref<HistoryItem[]>([]);
async function loadHistory() {
  try { const { data } = await reportsApi.list(); history.value = data; } catch { /* 忽略 */ }
}
loadHistory();

function reportLabel(key: string) {
  return /-W\d{1,2}$/.test(key) ? `周报 ${key.replace('-W', ' 第') + ' 周'}` : `月报 ${key.replace('-', ' 年 ') + ' 月'}`;
}
// ISO 周年份/周数 → 该周任意一天（周一）
function mondayFromISO(year: number, week: number): string {
  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  const dow = simple.getUTCDay();
  if (dow <= 4) simple.setUTCDate(simple.getUTCDate() - dow + 1);
  else simple.setUTCDate(simple.getUTCDate() + 8 - dow);
  const d = new Date(simple.getTime() + 8 * 3600 * 1000); // 转回东八区显示
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
async function pickHistory(key: string) {
  if (!key) return;
  const wm = /^(\d{4})-W(\d{1,2})$/.exec(key);
  if (wm) {
    mode.value = 'week';
    weekDate.value = mondayFromISO(Number(wm[1]), Number(wm[2]));
  } else {
    mode.value = 'month';
    month.value = key;
  }
  report.value = null;
  await load();
}

// ISO 周计算
function isoWeekInfo(d: Date) {
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNr = (d.getDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = target.getTime();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay() + 7) % 7));
  }
  const week = 1 + Math.ceil((firstThursday - target.getTime()) / (7 * 24 * 3600 * 1000));
  return { year: target.getUTCFullYear(), week };
}
function mondayOf(d: Date) {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day);
  return date;
}
function isoDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const weekInfo = computed(() => isoWeekInfo(new Date(weekDate.value + 'T00:00:00')));
const weekKey = computed(() => `${weekInfo.value.year}-W${String(weekInfo.value.week).padStart(2, '0')}`);
const weekRange = computed(() => {
  const mon = mondayOf(new Date(weekDate.value + 'T00:00:00'));
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return `${isoDateStr(mon)} ~ ${isoDateStr(sun)}`;
});
const currentKey = computed(() => mode.value === 'month' ? month.value : weekKey.value);

function shift(delta: number) {
  if (mode.value === 'month') {
    const [y, m] = month.value.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    month.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  } else {
    const d = new Date(weekDate.value + 'T00:00:00');
    d.setDate(d.getDate() + delta * 7);
    weekDate.value = isoDateStr(d);
  }
  report.value = null; load();
}

async function load() {
  loading.value = true;
  try { const { data } = await reportsApi.get(currentKey.value); report.value = data; }
  catch { report.value = null; } finally { loading.value = false; }
}

async function generate() {
  generating.value = true;
  try {
    if (mode.value === 'month') {
      const { data } = await aiApi.monthly({ yearMonth: month.value });
      report.value = data.report;
      ElMessage.success('月报已生成');
    } else {
      const { data } = await aiApi.weekly({ date: weekDate.value });
      report.value = data.report;
      ElMessage.success('周报已生成');
    }
    loadHistory();
  } catch {} finally { generating.value = false; }
}

function startEdit() { editContent.value = report.value?.content || ''; editing.value = true; }
async function saveEdit() {
  if (!editContent.value.trim()) { ElMessage.warning('内容不能为空'); return; }
  const { data } = await reportsApi.save(currentKey.value, editContent.value);
  report.value = data; editing.value = false; ElMessage.success('已保存');
  loadHistory();
}

function copyContent() {
  navigator.clipboard.writeText(report.value?.content || '').then(() => ElMessage.success('已复制到剪贴板'), () => ElMessage.error('复制失败'));
}

function download(format: 'md' | 'txt') {
  if (!report.value) return;
  let text = report.value.content;
  if (format === 'txt') text = text.replace(/^#+\s/gm, '').replace(/\*\*/g, '').replace(/[*_`#>]/g, '');
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${currentKey.value}${mode.value === 'month' ? '月报' : '周报'}.${format}`;
  a.click(); URL.revokeObjectURL(url);
}

// 公司 + 部门抬头（Word/打印统一）
function companyHeader() {
  return `<div style="text-align:center;margin-bottom:18px;">
    <div style="font-size:20px;font-weight:bold;letter-spacing:2px;">安徽海博智能科技有限责任公司</div>
    <div style="font-size:13px;color:#444;margin-top:6px;">卡调事业部 · 运维实施组</div>
  </div>`;
}

const DOC_CSS = `
  body { font-family: "宋体", SimSun, serif; font-size: 14px; line-height: 1.8; color: #111; }
  h1 { font-size: 18px; text-align: center; font-family: "黑体", SimHei, sans-serif; }
  h2 { font-size: 15px; font-family: "黑体", SimHei, sans-serif; margin-top: 18px; }
  ul, ol { padding-left: 26px; margin: 6px 0; }
  li { margin: 3px 0; }
  blockquote { color: #555; border-left: 3px solid #bbb; padding-left: 10px; margin: 8px 0; }
  @page { margin: 2.2cm 2cm; }
`;

const exporting = ref(false);
async function exportWord() {
  if (!report.value || exporting.value) return;
  exporting.value = true;
  try {
    // 动态加载，docx 生成库不占首屏体积
    const { markdownToDocxBlob } = await import('@/lib/docx');
    const blob = await markdownToDocxBlob(report.value.content, {
      company: '安徽海博智能科技有限责任公司',
      department: '卡调事业部 · 运维实施组',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentKey.value}${mode.value === 'month' ? '运维实施月报' : '运维实施周报'}.docx`;
    a.click();
    URL.revokeObjectURL(url);
    ElMessage.success('Word 已导出');
  } catch {
    ElMessage.error('导出失败，请重试');
  } finally {
    exporting.value = false;
  }
}

function printPdf() {
  if (!report.value) return;
  const body = marked.parse(report.value.content, { async: false }) as string;
  const win = window.open('', '_blank');
  if (!win) { ElMessage.error('浏览器拦截了打印窗口，请允许弹出窗口'); return; }
  win.document.write(`<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>${currentKey.value} 工作汇报</title><style>${DOC_CSS}</style></head><body>${companyHeader()}${body}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 350);
}

async function removeReport() {
  const type = mode.value === 'month' ? '月报' : '周报';
  try { await ElMessageBox.confirm(`确定删除 ${currentKey.value} 的${type}吗？删除后可重新生成。`, '删除确认', { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' }); }
  catch { return; }
  await reportsApi.delete(currentKey.value); report.value = null; editing.value = false; ElMessage.success('已删除');
  loadHistory();
}

function switchMode(m: 'month' | 'week') {
  if (mode.value === m) return;
  mode.value = m; report.value = null; editing.value = false; load();
}

load();
</script>

<template>
  <div class="reports-page">
    <div class="page-head">
      <h1 class="page-title">工作汇总</h1>
      <p class="page-desc">AI 根据记录自动生成月报 / 周报初稿</p>
    </div>

    <div class="toolbar panel">
      <el-radio-group v-model="mode" @change="(v: any) => switchMode(v)">
        <el-radio-button value="month">月报</el-radio-button>
        <el-radio-button value="week">周报</el-radio-button>
      </el-radio-group>

      <div class="month-nav">
        <button class="nav-arrow" @click="shift(-1)"><el-icon><ArrowLeft /></el-icon></button>
        <el-date-picker
          v-if="mode === 'month'"
          v-model="month" type="month" format="YYYY年MM月" value-format="YYYY-MM"
          :clearable="false" @change="report = null; load()" class="month-picker"
        />
        <el-date-picker
          v-else
          v-model="weekDate" type="date" format="YYYY-MM-DD" value-format="YYYY-MM-DD"
          :clearable="false" @change="report = null; load()" class="month-picker week-picker"
        />
        <button class="nav-arrow" @click="shift(1)"><el-icon><ArrowRight /></el-icon></button>
      </div>

      <div v-if="mode === 'week'" class="week-range">{{ weekRange }} · {{ weekKey }}</div>

      <el-select
        v-if="history.length"
        :model-value="report ? currentKey : ''"
        placeholder="历史报告"
        class="history-select"
        @change="pickHistory"
      >
        <template #prefix><el-icon><FolderOpened /></el-icon></template>
        <el-option label="" value="" disabled>已生成的报告</el-option>
        <el-option v-for="h in history" :key="h.id" :label="reportLabel(h.yearMonth)" :value="h.yearMonth" />
      </el-select>

      <div class="spacer" />
      <el-button type="primary" :loading="generating" @click="generate">
        <el-icon style="margin-right:4px"><MagicStick /></el-icon>
        {{ report ? '重新生成' : `AI 生成${mode === 'month' ? '月报' : '周报'}` }}
      </el-button>
    </div>

    <div v-if="loading" class="panel"><el-skeleton :rows="6" animated /></div>

    <div v-else-if="!report" class="panel empty">
      <div class="empty-icon"><el-icon :size="28"><DataAnalysis /></el-icon></div>
      <div class="empty-title">{{ currentKey }} 还没有{{ mode === 'month' ? '月报' : '周报' }}</div>
      <div class="empty-desc">点击右上角按钮，基于该{{ mode === 'month' ? '月' : '周' }}记录生成汇报初稿</div>
    </div>

    <template v-else>
      <div class="report-panel panel">
        <div class="report-head">
          <span class="report-meta">更新于 {{ new Date(report.updatedAt).toLocaleString('zh-CN') }}</span>
          <div class="report-actions">
            <template v-if="!editing">
              <el-button size="small" @click="startEdit"><el-icon style="margin-right:4px"><Edit /></el-icon>编辑</el-button>
              <el-button size="small" @click="copyContent"><el-icon style="margin-right:4px"><CopyDocument /></el-icon>复制</el-button>
              <el-dropdown @command="(c: any) => (c === 'word' ? exportWord() : c === 'pdf' ? printPdf() : download(c))">
                <el-button size="small" :loading="exporting"><el-icon style="margin-right:4px"><Download /></el-icon>导出<el-icon class="el-icon--right"><ArrowDown /></el-icon></el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="word"><el-icon style="margin-right:4px"><Document /></el-icon>Word (.docx)</el-dropdown-item>
                    <el-dropdown-item command="pdf"><el-icon style="margin-right:4px"><Printer /></el-icon>打印 / 另存为 PDF</el-dropdown-item>
                    <el-dropdown-item command="md" divided>Markdown (.md)</el-dropdown-item>
                    <el-dropdown-item command="txt">纯文本 (.txt)</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
              <el-button size="small" type="danger" text @click="removeReport"><el-icon><Delete /></el-icon></el-button>
            </template>
            <template v-else>
              <el-button size="small" @click="editing = false">取消</el-button>
              <el-button size="small" type="primary" @click="saveEdit">保存</el-button>
            </template>
          </div>
        </div>

        <el-input v-if="editing" v-model="editContent" type="textarea" :rows="22" class="edit-area" />
        <div v-else class="md report-body" v-html="rendered"></div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.reports-page { display: flex; flex-direction: column; gap: var(--space-lg); }
.page-head { margin-bottom: var(--space-3xs); }
.page-title { font-size: var(--fs-display); line-height: var(--lh-display); font-weight: 800; color: var(--color-text-title); letter-spacing: -0.03em; }
.page-desc { font-size: var(--fs-aux); color: var(--color-text-sub); margin-top: 2px; }

.toolbar { display: flex; align-items: center; gap: var(--space-md); padding: 14px var(--space-lg); flex-wrap: wrap; }
.month-nav { display: flex; align-items: center; gap: 6px; }
.nav-arrow { width: 32px; height: 32px; border-radius: var(--radius-sm); border: 1px solid var(--color-border); color: var(--color-text-sub); display: flex; align-items: center; justify-content: center; transition: all var(--dur-fast) var(--ease-out); }
.nav-arrow:hover { border-color: var(--color-primary); color: var(--color-primary); background: var(--color-primary-bg); }
.month-picker { width: 130px; }
.week-picker { width: 150px; }
.week-range { font-size: var(--fs-micro); color: var(--color-text-sub); font-variant-numeric: tabular-nums; }
.history-select { width: 170px; }
.spacer { flex: 1; }

.report-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding-bottom: 14px; border-bottom: 1px solid var(--color-border-light); margin-bottom: 18px; }
.report-meta { font-size: var(--fs-micro); color: var(--color-text-placeholder); }
.report-actions { display: flex; align-items: center; gap: 6px; }
.report-body { min-height: 200px; }
.edit-area :deep(.el-textarea__inner) { font-family: var(--font-mono); font-size: 13px; line-height: 1.7; }

@media (max-width: 768px) { .report-head { flex-direction: column; align-items: flex-start; } }
</style>
