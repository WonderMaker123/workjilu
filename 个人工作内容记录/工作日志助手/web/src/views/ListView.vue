<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { entriesApi, type Entry } from '@/api/entries';
import { aiApi } from '@/api/ai';
import EntryPhotos from '@/components/EntryPhotos.vue';

const loading = ref(false);
const month = ref(new Date().toISOString().slice(0, 7));
const keyword = ref('');
const activeTag = ref('');
const entries = ref<Entry[]>([]);

const grouped = computed(() => {
  const map = new Map<string, Entry[]>();
  for (const e of entries.value) { const key = e.entryDate; if (!map.has(key)) map.set(key, []); map.get(key)!.push(e); }
  return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
});
const totalWords = computed(() => entries.value.reduce((s, e) => s + e.wordCount, 0));

// 收集当月出现过的所有标签
const allTags = computed(() => {
  const set = new Map<string, number>();
  for (const e of entries.value) {
    let arr: string[] = [];
    try { arr = JSON.parse(e.tags || '[]'); } catch { arr = []; }
    for (const t of arr) set.set(t, (set.get(t) || 0) + 1);
  }
  return [...set.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
});

onMounted(load);

async function load() {
  loading.value = true;
  try {
    const { data } = await entriesApi.list({
      month: month.value,
      keyword: keyword.value.trim() || undefined,
      tag: activeTag.value || undefined,
    });
    entries.value = data;
  } finally { loading.value = false; }
}

let searchTimer: number | undefined;
function onSearch() { window.clearTimeout(searchTimer); searchTimer = window.setTimeout(load, 300); }
function pickTag(t: string) { activeTag.value = activeTag.value === t ? '' : t; load(); }

// 标签重命名 / 删除（作用于全部记录）
async function renameTag(t: { name: string }) {
  try {
    const { value } = await ElMessageBox.prompt('输入新的标签名（全部记录中的该标签会一起更新）', '重命名标签', {
      confirmButtonText: '确定', cancelButtonText: '取消', inputValue: t.name, inputPattern: /\S+/, inputErrorMessage: '标签名不能为空',
    });
    const nv = value.trim();
    if (nv === t.name) return;
    const { data } = await entriesApi.renameTag(t.name, nv);
    ElMessage.success(`已更新 ${data.updated} 条记录`);
    if (activeTag.value === t.name) activeTag.value = nv;
    await load();
  } catch { /* 取消 */ }
}
async function removeTagGlobal(t: { name: string }) {
  try {
    await ElMessageBox.confirm(`将从全部记录中移除标签「${t.name}」，记录本身不会删除，确定吗？`, '删除标签', {
      confirmButtonText: '移除', cancelButtonText: '取消', type: 'warning',
    });
    const { data } = await entriesApi.deleteTag(t.name);
    ElMessage.success(`已从 ${data.updated} 条记录移除`);
    if (activeTag.value === t.name) activeTag.value = '';
    await load();
  } catch { /* 取消 */ }
}

function shiftMonth(delta: number) {
  const [y, m] = month.value.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  month.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; load();
}

function weekday(dateStr: string) { const [y, m, d] = dateStr.split('-').map(Number); return ['周日','周一','周二','周三','周四','周五','周六'][new Date(y, m - 1, d).getDay()]; }

const comparingId = ref<number | null>(null);
const polishedDraft = ref('');
const polishing = ref(false);

// 内联编辑
const editingId = ref<number | null>(null);
const editRaw = ref('');
const editTags = ref<string[]>([]);
const editTagInput = ref('');

function startEdit(e: Entry) {
  comparingId.value = null;
  editingId.value = e.id;
  editRaw.value = e.rawContent;
  editTags.value = tagsOf(e);
  editTagInput.value = '';
}
function addEditTag() {
  const v = editTagInput.value.trim();
  if (!v) return;
  if (!editTags.value.includes(v)) {
    if (editTags.value.length >= 8) { ElMessage.warning('最多 8 个标签'); return; }
    editTags.value.push(v);
  }
  editTagInput.value = '';
}
async function saveEdit(e: Entry) {
  if (!editRaw.value.trim()) { ElMessage.warning('内容不能为空'); return; }
  await entriesApi.update(e.id, { rawContent: editRaw.value, tags: editTags.value });
  ElMessage.success('已保存');
  editingId.value = null;
  await load();
}

// 复制（优先 AI 整理稿，没有则原文）
function copyEntry(e: Entry) {
  const text = e.polishedContent?.trim() ? e.polishedContent : e.rawContent;
  const ts = tagsOf(e);
  const full = ts.length ? `${text}\n标签：${ts.join('、')}` : text;
  navigator.clipboard.writeText(full).then(
    () => ElMessage.success(e.polishedContent?.trim() ? '已复制 AI 整理稿' : '已复制原文'),
    () => ElMessage.error('复制失败，请手动选择文本复制')
  );
}

async function aiPolish(e: Entry) {
  polishing.value = true; comparingId.value = e.id; polishedDraft.value = '';
  try { const { data } = await aiApi.polish({ text: e.rawContent }); polishedDraft.value = data.polished; }
  finally { polishing.value = false; }
}

async function applyPolish(e: Entry) {
  await entriesApi.update(e.id, { polishedContent: polishedDraft.value });
  ElMessage.success('已替换'); comparingId.value = null; await load();
}

async function remove(e: Entry) {
  try { await ElMessageBox.confirm('删除后不可恢复，确定删除这条记录吗？', '删除确认', { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' }); }
  catch { return; }
  await entriesApi.delete(e.id); ElMessage.success('已删除'); await load();
}

function fmtTime(iso?: string | null) { if (!iso) return ''; const d = new Date(iso); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; }
function tagsOf(e: Entry): string[] { try { return JSON.parse(e.tags || '[]'); } catch { return []; } }

// CSV 导出（含 BOM，Excel 可直接打开中文）
function exportCsv() {
  if (entries.value.length === 0) { ElMessage.warning('当前没有可导出的记录'); return; }
  const header = ['日期', '时间', '标签', '原始内容', 'AI整理内容', '字数'];
  const rows = entries.value.map((e) => [
    e.entryDate,
    fmtTime(e.createdAt),
    tagsOf(e).join('|'),
    e.rawContent,
    e.polishedContent || '',
    String(e.wordCount),
  ]);
  const esc = (v: string) => `"${v.replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
  const csv = [header, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `工作日志-${month.value}${activeTag.value ? '-' + activeTag.value : ''}.csv`;
  a.click(); URL.revokeObjectURL(url);
  ElMessage.success(`已导出 ${entries.value.length} 条记录`);
}
</script>

<template>
  <div class="list-page">
    <div class="page-head">
      <h1 class="page-title">记录列表</h1>
      <p class="page-desc">按月浏览、搜索、筛选你的所有工作记录</p>
    </div>

    <!-- 工具栏 -->
    <div class="toolbar panel">
      <div class="month-nav">
        <button class="nav-arrow" @click="shiftMonth(-1)"><el-icon><ArrowLeft /></el-icon></button>
        <el-date-picker v-model="month" type="month" format="YYYY年MM月" value-format="YYYY-MM" :clearable="false" @change="load" class="month-picker" />
        <button class="nav-arrow" @click="shiftMonth(1)"><el-icon><ArrowRight /></el-icon></button>
      </div>
      <div class="stats">
        <span class="stat-num">{{ entries.length }}</span> 条 · <span class="stat-num">{{ totalWords }}</span> 字
      </div>
      <div class="spacer" />
      <el-button @click="exportCsv" :disabled="!entries.length">
        <el-icon style="margin-right:4px"><Download /></el-icon>导出 CSV
      </el-button>
      <el-input v-model="keyword" placeholder="搜索记录内容…" clearable class="search" @input="onSearch">
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
    </div>

    <!-- 标签筛选 -->
    <div v-if="allTags.length" class="tag-bar">
      <button
        class="tag-chip"
        :class="{ active: !activeTag }"
        @click="activeTag = ''; load()"
      >全部</button>
      <button
        v-for="t in allTags"
        :key="t.name"
        class="tag-chip"
        :class="{ active: activeTag === t.name }"
        @click="pickTag(t.name)"
      >
        {{ t.name }} <span class="chip-count">{{ t.count }}</span>
      </button>

      <el-popover placement="bottom-start" :width="240" trigger="click">
        <template #reference>
          <button class="tag-chip manage-chip">
            <el-icon style="margin-right:3px"><Operation /></el-icon>管理标签
          </button>
        </template>
        <div class="tag-mgr">
          <div class="mgr-title">本月出现的标签</div>
          <div v-for="t in allTags" :key="t.name" class="mgr-row">
            <span class="mgr-name">{{ t.name }}</span>
            <span class="mgr-count">{{ t.count }}</span>
            <button class="mgr-btn" title="重命名" @click="renameTag(t)"><el-icon :size="13"><EditPen /></el-icon></button>
            <button class="mgr-btn danger" title="从全部记录移除" @click="removeTagGlobal(t)"><el-icon :size="13"><Delete /></el-icon></button>
          </div>
        </div>
      </el-popover>
    </div>

    <div v-if="loading" class="panel"><el-skeleton :rows="5" animated /></div>

    <div v-else-if="grouped.length === 0" class="panel empty">
      <div class="empty-icon"><el-icon :size="28"><Search /></el-icon></div>
      <div class="empty-title">该月份暂无记录</div>
      <div class="empty-desc">换个月份看看，或去「今日记录」写一条</div>
    </div>

    <div v-else class="timeline">
      <section v-for="[date, items] in grouped" :key="date" class="day-group panel">
        <header class="day-head">
          <span class="day-date">{{ date }}</span>
          <span class="day-week">{{ weekday(date) }}</span>
          <span class="day-count">{{ items.length }} 条</span>
        </header>

        <article v-for="e in items" :key="e.id" class="item">
          <div class="item-time">
            {{ fmtTime(e.createdAt) }}
            <span v-for="t in tagsOf(e)" :key="t" class="mini-tag">{{ t }}</span>
          </div>

          <div v-if="comparingId === e.id" class="compare">
            <div class="compare-col"><div class="compare-tag">原文</div><div class="compare-body">{{ e.rawContent }}</div></div>
            <div class="compare-col polished"><div class="compare-tag"><el-icon v-if="polishing" class="is-loading"><Loading /></el-icon> AI 整理</div><div class="compare-body">{{ polishing ? '整理中…' : polishedDraft }}</div></div>
            <div class="compare-foot" v-if="!polishing"><el-button size="small" @click="comparingId = null">取消</el-button><el-button size="small" type="primary" @click="applyPolish(e)">替换原文</el-button></div>
          </div>

          <div v-else-if="editingId === e.id" class="inline-edit">
            <el-input v-model="editRaw" type="textarea" :rows="4" class="edit-textarea" />
            <div class="edit-tags">
              <el-tag v-for="t in editTags" :key="t" closable size="small" @close="editTags = editTags.filter((x) => x !== t)">{{ t }}</el-tag>
              <el-input
                v-model="editTagInput"
                size="small"
                class="edit-tag-input"
                placeholder="回车添加标签"
                @keydown.enter.prevent="addEditTag"
                @blur="addEditTag"
              />
            </div>
            <div class="edit-foot">
              <el-button size="small" @click="editingId = null">取消</el-button>
              <el-button size="small" type="primary" @click="saveEdit(e)">保存修改</el-button>
            </div>
          </div>

          <template v-else>
            <p class="item-raw">{{ e.rawContent }}</p>
            <div v-if="e.polishedContent" class="item-polished">
              <div class="polished-tag"><el-icon :size="13"><MagicStick /></el-icon> AI 整理</div>
              <div class="polished-text">{{ e.polishedContent }}</div>
            </div>
            <EntryPhotos :entry-id="e.id" :photos-json="e.photos" editable compact @changed="(m) => (e.photos = JSON.stringify(m))" />
            <div class="item-foot">
              <el-button size="small" @click="aiPolish(e)"><el-icon style="margin-right:4px"><MagicStick /></el-icon>{{ e.polishedContent ? '重新整理' : 'AI 整理' }}</el-button>
              <el-button size="small" @click="copyEntry(e)"><el-icon style="margin-right:4px"><CopyDocument /></el-icon>复制</el-button>
              <el-button size="small" @click="startEdit(e)"><el-icon style="margin-right:4px"><Edit /></el-icon>编辑</el-button>
              <el-button size="small" type="danger" text @click="remove(e)"><el-icon><Delete /></el-icon></el-button>
            </div>
          </template>
        </article>
      </section>
    </div>
  </div>
</template>

<style scoped>
.list-page { display: flex; flex-direction: column; gap: var(--space-lg); }
.page-head { margin-bottom: var(--space-3xs); }
.page-title { font-size: var(--fs-display); line-height: var(--lh-display); font-weight: 800; color: var(--color-text-title); letter-spacing: -0.03em; }
.page-desc { font-size: var(--fs-aux); color: var(--color-text-sub); margin-top: 2px; }

.toolbar { display: flex; align-items: center; gap: var(--space-md); padding: 14px var(--space-lg); flex-wrap: wrap; }
.month-nav { display: flex; align-items: center; gap: 6px; }
.nav-arrow { width: 32px; height: 32px; border-radius: var(--radius-sm); border: 1px solid var(--color-border); color: var(--color-text-sub); display: flex; align-items: center; justify-content: center; transition: all var(--dur-fast) var(--ease-out); }
.nav-arrow:hover { border-color: var(--color-primary); color: var(--color-primary); background: var(--color-primary-bg); }
.month-picker { width: 120px; }
.stats { font-size: var(--fs-micro); color: var(--color-text-sub); }
.stat-num { font-weight: 600; color: var(--color-text-title); }
.spacer { flex: 1; }
.search { width: 220px; }

/* 标签筛选条 */
.tag-bar { display: flex; flex-wrap: wrap; gap: 8px; }
.tag-chip {
  font-size: var(--fs-micro);
  padding: 5px 12px;
  border-radius: var(--radius-full);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  color: var(--color-text-sub);
  font-weight: 500;
  transition: all var(--dur-fast) var(--ease-out);
}
.tag-chip:hover { border-color: var(--color-primary-light); color: var(--color-primary); }
.tag-chip.active { background: var(--color-primary); border-color: var(--color-primary); color: #fff; }
.chip-count { opacity: 0.7; font-size: 11px; margin-left: 2px; }
.manage-chip { display: inline-flex; align-items: center; }
.tag-mgr { display: flex; flex-direction: column; gap: 4px; }
.mgr-title { font-size: var(--fs-micro); color: var(--color-text-placeholder); margin-bottom: 4px; }
.mgr-row { display: flex; align-items: center; gap: 8px; padding: 4px 0; }
.mgr-name { flex: 1; font-size: var(--fs-aux); color: var(--color-text-body); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mgr-count { font-size: var(--fs-micro); color: var(--color-text-placeholder); width: 22px; text-align: right; }
.mgr-btn { width: 24px; height: 24px; border-radius: var(--radius-sm); color: var(--color-text-sub); display: flex; align-items: center; justify-content: center; }
.mgr-btn:hover { background: var(--color-primary-bg); color: var(--color-primary); }
.mgr-btn.danger:hover { background: var(--color-danger-bg); color: var(--color-danger); }

.timeline { display: flex; flex-direction: column; gap: var(--space-sm); }
.day-head { display: flex; align-items: baseline; gap: 10px; padding-bottom: 10px; border-bottom: 1px solid var(--color-border-light); margin-bottom: 12px; }
.day-date { font-size: var(--fs-h3); font-weight: 700; color: var(--color-text-title); font-variant-numeric: tabular-nums; }
.day-week { font-size: var(--fs-micro); color: var(--color-text-sub); }
.day-count { margin-left: auto; font-size: var(--fs-micro); color: var(--color-text-placeholder); }

.item { padding: 12px 0; border-bottom: 1px dashed var(--color-border-light); }
.item:last-child { border-bottom: none; padding-bottom: 0; }
.item-time { font-size: var(--fs-micro); color: var(--color-text-placeholder); margin-bottom: 4px; font-variant-numeric: tabular-nums; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.mini-tag { font-size: 10px; line-height: 1; padding: 2px 6px; border-radius: var(--radius-full); background: var(--color-primary-bg); color: var(--color-primary); }
.item-raw { font-size: 14px; line-height: 1.7; white-space: pre-wrap; word-break: break-word; color: var(--color-text-body); }
.item-polished { margin-top: 10px; background: var(--color-primary-bg); border-radius: var(--radius-md); padding: 10px 12px; border: 1px solid var(--color-primary-bg-hover); }
.polished-tag { display: flex; align-items: center; gap: 4px; font-size: var(--fs-micro); color: var(--color-primary); margin-bottom: 4px; font-weight: 500; }
.polished-text { font-size: var(--fs-aux); line-height: 1.7; white-space: pre-wrap; word-break: break-word; }
.item-foot { margin-top: 8px; display: flex; justify-content: flex-end; gap: 4px; }

.compare { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.compare-col { border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 10px 12px; }
.compare-col.polished { border-color: var(--color-primary-light); background: var(--color-primary-bg); }
.compare-tag { font-size: var(--fs-micro); color: var(--color-text-sub); margin-bottom: 4px; display: flex; align-items: center; gap: 4px; font-weight: 500; }
.compare-body { font-size: var(--fs-aux); line-height: 1.7; white-space: pre-wrap; word-break: break-word; }
.compare-foot { grid-column: 1 / -1; display: flex; justify-content: flex-end; gap: 8px; }

/* 内联编辑 */
.inline-edit { display: flex; flex-direction: column; gap: 10px; }
.edit-textarea :deep(.el-textarea__inner) { line-height: 1.7; }
.edit-tags { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.edit-tag-input { width: 150px; }
.edit-tag-input :deep(.el-input__wrapper) { box-shadow: none; border: 1px dashed var(--color-border); background: var(--color-bg-page); }
.edit-foot { display: flex; justify-content: flex-end; gap: 8px; }

@media (max-width: 768px) {
  .search { width: 100%; order: 10; }
  .compare { grid-template-columns: 1fr; }
}
</style>
