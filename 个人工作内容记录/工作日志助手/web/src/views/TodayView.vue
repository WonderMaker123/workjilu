<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch, onBeforeUnmount, nextTick } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { entriesApi, type Entry } from '@/api/entries';
import { aiApi } from '@/api/ai';
import { useAuthStore } from '@/stores/auth';
import { isSpeechSupported, createSpeechSession, type SpeechSession } from '@/lib/speech';
import EntryPhotos from '@/components/EntryPhotos.vue';

const auth = useAuthStore();
const loading = ref(false);
const saving = ref(false);
const polishing = ref(false);
const continuing = ref(false);
const form = reactive({ content: '', date: new Date().toISOString().slice(0, 10) });
const todayEntries = ref<Entry[]>([]);
const comparingId = ref<number | null>(null);
const polishedDraft = ref('');
const editingId = ref<number | null>(null);
const formality = ref<'simple' | 'standard' | 'detailed'>('standard');
const count = computed(() => form.content.trim().length);

// 标签：编辑时输入与回车
const tags = ref<string[]>([]);
const tagInput = ref('');
const tagInputRef = ref<any>(null);

// 运维实施岗位常用模板
const TEMPLATES: { label: string; value: string; content: string }[] = [
  { label: '现场实施', value: 'implement', content: '【现场实施】项目/地点：\n实施内容：\n完成情况：\n遇到问题：\n后续计划：' },
  { label: '设备巡检', value: 'inspect', content: '【设备巡检】站点/设备：\n检查情况：\n异常项：\n处理结果：' },
  { label: '故障处理', value: 'fault', content: '【故障处理】故障现象：\n影响范围：\n排查过程：\n解决措施：\n待跟进：' },
  { label: '客户沟通', value: 'comm', content: '【客户沟通】客户/对象：\n沟通事项：\n沟通结论：\n后续动作：' },
  { label: '会议', value: 'meeting', content: '【会议】主题：\n参会：\n讨论：\n结论：\n后续：' },
  { label: '日常', value: 'daily', content: '【日常】' },
];
const templateVal = ref('');
function applyTemplate(v: string) {
  if (!v) return;
  const t = TEMPLATES.find((x) => x.value === v);
  if (!t) return;
  if (form.content.trim()) {
    // 已有内容时追加，避免误覆盖
    const sep = form.content.endsWith('\n') ? '' : '\n';
    form.content = form.content + sep + t.content;
  } else {
    form.content = t.content;
  }
  templateVal.value = '';
}

// 草稿自动保存
const draftKey = computed(() => `worklog:draft:${auth.user?.id || 'anon'}:${form.date}`);
let draftTimer: number | undefined;
function loadDraft() {
  if (editingId.value) return;
  try {
    const s = localStorage.getItem(draftKey.value);
    if (s && !form.content) form.content = s;
  } catch {}
}
function saveDraft() {
  try {
    if (!editingId.value) localStorage.setItem(draftKey.value, form.content);
  } catch {}
}
function clearDraft() {
  try { localStorage.removeItem(draftKey.value); } catch {}
}
watch(() => form.content, () => {
  if (draftTimer) window.clearTimeout(draftTimer);
  draftTimer = window.setTimeout(saveDraft, 1500); // 1.5s 防抖
});
watch(draftKey, () => { form.content = ''; loadDraft(); });
onBeforeUnmount(() => { if (draftTimer) window.clearTimeout(draftTimer); saveDraft(); });

onMounted(load);

async function load() {
  loading.value = true;
  try { const { data } = await entriesApi.today(); todayEntries.value = data; }
  finally { loading.value = false; }
  if (!form.content) loadDraft();
}

async function save() {
  if (!form.content.trim()) { ElMessage.warning('先写点今天做了什么吧'); return; }
  saving.value = true;
  try {
    if (editingId.value) {
      await entriesApi.update(editingId.value, { rawContent: form.content, tags: tags.value });
      ElMessage.success('已更新');
    } else {
      await entriesApi.create({ rawContent: form.content, entryDate: form.date, tags: tags.value });
      ElMessage.success('已保存');
    }
    form.content = ''; editingId.value = null; tags.value = [];
    clearDraft();
    await load();
  } finally { saving.value = false; }
}

// Ctrl+Enter 快捷键
function onContentKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    save();
  }
}

function edit(e: Entry) {
  editingId.value = e.id;
  form.content = e.rawContent;
  tags.value = (() => { try { return JSON.parse(e.tags || '[]'); } catch { return []; } })();
  form.date = e.entryDate;
  window.scrollTo({ top: 0, behavior: 'smooth' });
  nextTick(() => tagInputRef.value?.focus?.());
}

async function remove(e: Entry) {
  try { await ElMessageBox.confirm('删除后不可恢复，确定删除这条记录吗？', '删除确认', { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' }); }
  catch { return; }
  await entriesApi.delete(e.id); ElMessage.success('已删除');
  if (editingId.value === e.id) { editingId.value = null; form.content = ''; tags.value = []; }
  await load();
}

async function aiPolish(e: Entry) {
  polishing.value = true; comparingId.value = e.id;
  try { const { data } = await aiApi.polish({ text: e.rawContent, formality: formality.value }); polishedDraft.value = data.polished; }
  finally { polishing.value = false; }
}

async function applyPolish() {
  if (!comparingId.value) return;
  await entriesApi.update(comparingId.value, { polishedContent: polishedDraft.value });
  ElMessage.success('已替换为整理后的内容');
  comparingId.value = null; polishedDraft.value = ''; await load();
}

function cancelCompare() { comparingId.value = null; polishedDraft.value = ''; }

// AI 续写：基于当前编辑框内容续写，把结果追加
async function aiContinue() {
  if (!form.content.trim()) { ElMessage.warning('先写一点内容，AI 才能帮你续写'); return; }
  continuing.value = true;
  try {
    const { data } = await aiApi.continue({ text: form.content, instruction: 'continue' });
    const sep = form.content.endsWith('\n') ? '' : '\n';
    form.content = form.content + sep + data.result;
    ElMessage.success('AI 续写已追加到下方');
  } finally { continuing.value = false; }
}

// 标签输入
function addTag() {
  const v = tagInput.value.trim();
  if (!v) return;
  if (tags.value.includes(v)) { tagInput.value = ''; return; }
  if (tags.value.length >= 8) { ElMessage.warning('最多 8 个标签'); return; }
  tags.value.push(v); tagInput.value = '';
}
function removeTag(t: string) { tags.value = tags.value.filter((x) => x !== t); }

// 语音输入
const speechSupported = isSpeechSupported();
const listening = ref(false);
const speechInterim = ref('');
let speech: SpeechSession | null = null;

function appendSpoken(chunk: string) {
  const text = chunk.replace(/^\s+/, '');
  if (!text) return;
  const cur = form.content;
  // 已有内容且结尾不是换行/空格时，不加多余分隔（中文连续口述）
  form.content = cur + text;
}

function toggleSpeech() {
  if (!speechSupported) {
    ElMessage.info('当前浏览器不支持语音输入，请使用 Chrome / Edge 或安卓手机浏览器');
    return;
  }
  if (listening.value) {
    speech?.stop();
    return;
  }
  if (!speech) {
    speech = createSpeechSession();
    if (!speech) return;
    speech.onFinal = appendSpoken;
    speech.onInterim = (t) => { speechInterim.value = t; };
    speech.onStateChange = (active) => { listening.value = active; if (!active) speechInterim.value = ''; };
    speech.onError = (msg) => ElMessage.error(msg);
  }
  speechInterim.value = '';
  speech.start();
}

onBeforeUnmount(() => speech?.stop());

function tagList(e: Entry): string[] { try { return JSON.parse(e.tags || '[]'); } catch { return []; } }
function fmtTime(iso?: string | null) { if (!iso) return ''; const d = new Date(iso); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; }

// 复制单条（优先 AI 整理稿）
function copyEntry(e: Entry) {
  const text = e.polishedContent?.trim() ? e.polishedContent : e.rawContent;
  const ts = tagList(e);
  const full = ts.length ? `${text}\n标签：${ts.join('、')}` : text;
  navigator.clipboard.writeText(full).then(
    () => ElMessage.success(e.polishedContent?.trim() ? '已复制 AI 整理稿' : '已复制原文'),
    () => ElMessage.error('复制失败，请手动选择文本复制')
  );
}

// 复制今日全部，拼成日报格式直接发群
function copyTodayAll() {
  if (todayEntries.value.length === 0) { ElMessage.warning('今天还没有记录'); return; }
  const lines: string[] = [`【${form.date} 工作日报】`, ''];
  [...todayEntries.value].reverse().forEach((e, i) => {
    const body = (e.polishedContent?.trim() || e.rawContent).trim();
    const ts = tagList(e);
    lines.push(`${i + 1}. ${body}`);
    if (ts.length) lines.push(`   标签：${ts.join('、')}`);
  });
  navigator.clipboard.writeText(lines.join('\n')).then(
    () => ElMessage.success('今日日报已复制，可直接粘贴发送'),
    () => ElMessage.error('复制失败，请手动选择文本复制')
  );
}
</script>

<template>
  <div class="today-page">
    <!-- 页面标题 -->
    <div class="page-head">
      <div>
        <h1 class="page-title">今日记录</h1>
        <p class="page-desc">{{ form.date }} · 现场实施 / 巡检 / 故障处理，随手记，AI 帮你整理</p>
      </div>
    </div>

    <!-- 编辑区 -->
    <section class="editor panel">
      <div class="editor-top">
        <el-date-picker v-model="form.date" type="date" format="YYYY-MM-DD" value-format="YYYY-MM-DD" :clearable="false" :disabled="!!editingId" size="default" />
        <el-select v-model="templateVal" placeholder="插入模板" size="default" class="tmpl-select" @change="applyTemplate" clearable>
          <template #prefix><el-icon><DocumentCopy /></el-icon></template>
          <el-option v-for="t in TEMPLATES" :key="t.value" :label="t.label" :value="t.value" />
        </el-select>
        <div v-if="todayEntries.length" class="formality-group">
          <span class="formality-label">风格</span>
          <el-radio-group v-model="formality" size="small">
            <el-radio-button value="simple">简洁</el-radio-button>
            <el-radio-button value="standard">标准</el-radio-button>
            <el-radio-button value="detailed">详细</el-radio-button>
          </el-radio-group>
        </div>
      </div>

      <el-input v-model="form.content" type="textarea" :rows="6" maxlength="5000" show-word-limit resize="vertical"
        placeholder="随手记，比如：&#10;上午改了登录页的 bug，下午和产品对了一下新需求…" class="editor-input"
        @keydown="onContentKeydown" />

      <!-- 标签编辑 -->
      <div class="tags-row">
        <span class="tags-label">标签</span>
        <div class="tags-box">
          <el-tag v-for="t in tags" :key="t" closable size="small" class="tag-item" @close="removeTag(t)">{{ t }}</el-tag>
          <el-input
            ref="tagInputRef"
            v-model="tagInput"
            size="small"
            class="tag-input"
            placeholder="回车添加标签"
            @keydown.enter.prevent="addTag"
            @blur="addTag"
          />
        </div>
      </div>

      <div class="editor-foot">
        <span class="char-count">{{ count }} 字 · Ctrl+Enter 保存</span>
        <div class="foot-actions">
          <el-tooltip v-if="speechSupported" :content="listening ? '点击停止语音输入' : '语音输入（现场口述）'" placement="top">
            <button class="mic-btn" :class="{ active: listening }" @click="toggleSpeech">
              <el-icon :size="16" :class="{ 'mic-pulse': listening }"><Microphone /></el-icon>
              <span>{{ listening ? '停止' : '语音' }}</span>
            </button>
          </el-tooltip>
          <el-button :loading="continuing" @click="aiContinue" plain>
            <el-icon style="margin-right:4px"><MagicStick /></el-icon>AI 续写
          </el-button>
          <el-button v-if="editingId" @click="editingId = null; form.content = ''; tags = []">取消编辑</el-button>
          <el-button type="primary" :loading="saving" @click="save">
            {{ editingId ? '保存修改' : '保存' }}
          </el-button>
        </div>
      </div>

      <!-- 语音识别中 -->
      <div v-if="listening" class="speech-bar">
        <el-icon :size="14" class="mic-pulse"><Microphone /></el-icon>
        <span class="speech-label">正在听：</span>
        <span class="speech-interim">{{ speechInterim || '请讲话，说完自动转成文字…' }}</span>
      </div>
    </section>

    <!-- 今日列表 -->
    <section class="list-section">
      <div class="list-head">
        <h2 class="list-title">今日记录</h2>
        <span class="list-count">{{ todayEntries.length }} 条</span>
        <el-button v-if="todayEntries.length" size="small" plain class="copy-all-btn" @click="copyTodayAll">
          <el-icon style="margin-right:4px"><CopyDocument /></el-icon>复制今日日报
        </el-button>
      </div>

      <div v-if="loading" class="panel"><el-skeleton :rows="3" animated /></div>

      <div v-else-if="todayEntries.length === 0" class="panel empty">
        <div class="empty-icon">
          <el-icon :size="28"><EditPen /></el-icon>
        </div>
        <div class="empty-title">今天还没有记录</div>
        <div class="empty-desc">在上面写下第一笔吧</div>
      </div>

      <div v-else class="entries">
        <article v-for="e in todayEntries" :key="e.id" class="entry panel">
          <header class="entry-head">
            <span class="entry-time">{{ fmtTime(e.createdAt) }}</span>
            <span v-for="t in tagList(e)" :key="t" class="tag">{{ t }}</span>
            <div class="entry-actions">
              <el-tooltip content="复制" placement="top">
                <button class="icon-btn" @click="copyEntry(e)"><el-icon :size="16"><CopyDocument /></el-icon></button>
              </el-tooltip>
              <el-tooltip content="编辑" placement="top">
                <button class="icon-btn" @click="edit(e)"><el-icon :size="16"><Edit /></el-icon></button>
              </el-tooltip>
              <el-tooltip content="删除" placement="top">
                <button class="icon-btn danger" @click="remove(e)"><el-icon :size="16"><Delete /></el-icon></button>
              </el-tooltip>
            </div>
          </header>

          <!-- AI 对比 -->
          <div v-if="comparingId === e.id" class="compare">
            <div class="compare-col">
              <div class="compare-tag">原文</div>
              <div class="compare-body">{{ e.rawContent }}</div>
            </div>
            <div class="compare-col polished">
              <div class="compare-tag">
                <el-icon v-if="polishing" class="is-loading"><Loading /></el-icon>
                AI 整理
              </div>
              <div class="compare-body">{{ polishing ? '整理中，请稍候…' : polishedDraft }}</div>
            </div>
            <div class="compare-foot" v-if="!polishing">
              <el-button size="small" @click="cancelCompare">取消</el-button>
              <el-button size="small" type="primary" @click="applyPolish">替换原文</el-button>
            </div>
          </div>

          <template v-else>
            <p class="entry-raw">{{ e.rawContent }}</p>
            <div v-if="e.polishedContent" class="entry-polished">
              <div class="polished-tag"><el-icon :size="13"><MagicStick /></el-icon> AI 整理</div>
              <div class="polished-text">{{ e.polishedContent }}</div>
            </div>
            <EntryPhotos :entry-id="e.id" :photos-json="e.photos" editable @changed="(m) => (e.photos = JSON.stringify(m))" />
            <div class="entry-foot">
              <el-button size="small" :loading="polishing && comparingId === e.id" @click="aiPolish(e)">
                <el-icon style="margin-right:4px"><MagicStick /></el-icon>
                {{ e.polishedContent ? '重新整理' : 'AI 整理' }}
              </el-button>
            </div>
          </template>
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped>
.today-page { display: flex; flex-direction: column; gap: var(--space-lg); }

.page-head { margin-bottom: var(--space-3xs); }
.page-title { font-size: var(--fs-display); line-height: var(--lh-display); font-weight: 800; color: var(--color-text-title); letter-spacing: -0.03em; }
.page-desc { font-size: var(--fs-aux); color: var(--color-text-sub); margin-top: 2px; }

/* 编辑区 */
.editor-top { display: flex; align-items: center; gap: 12px; margin-bottom: var(--space-md); flex-wrap: wrap; }
.tmpl-select { width: 168px; }
.formality-group { display: flex; align-items: center; gap: 8px; margin-left: auto; }
.formality-label { font-size: var(--fs-micro); color: var(--color-text-sub); }
.editor-input :deep(.el-textarea__inner) { font-size: 15px; line-height: 1.7; padding: 12px 14px; border-radius: var(--radius-md) !important; }

.tags-row { display: flex; align-items: flex-start; gap: 10px; margin-top: 12px; }
.tags-label { font-size: var(--fs-micro); color: var(--color-text-sub); padding-top: 6px; }
.tags-box { flex: 1; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; min-height: 28px; }
.tag-item { margin: 0; }
.tag-input { width: 140px; }
.tag-input :deep(.el-input__wrapper) { box-shadow: none; border: 1px dashed var(--color-border); background: var(--color-bg-page); }

.editor-foot { display: flex; align-items: center; gap: 12px; margin-top: 12px; }
.char-count { font-size: var(--fs-micro); color: var(--color-text-placeholder); }
.foot-actions { margin-left: auto; display: flex; gap: 8px; align-items: center; }

/* 语音输入 */
.mic-btn {
  display: inline-flex; align-items: center; gap: 4px;
  height: 32px; padding: 0 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-bg-card);
  color: var(--color-text-sub);
  font-size: var(--fs-aux); font-weight: 500;
  transition: all var(--dur-fast) var(--ease-out);
}
.mic-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }
.mic-btn.active { background: var(--color-danger-bg); border-color: var(--color-danger); color: var(--color-danger); }
.mic-pulse { animation: mic-pulse 1.2s ease-in-out infinite; }
@keyframes mic-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
.speech-bar {
  display: flex; align-items: center; gap: 8px;
  margin-top: 10px; padding: 9px 12px;
  border-radius: var(--radius-md);
  background: var(--color-danger-bg);
  color: var(--color-danger);
  font-size: var(--fs-aux);
}
.speech-label { font-weight: 600; flex-shrink: 0; }
.speech-interim { color: var(--color-text-body); }

/* 列表 */
.list-head { display: flex; align-items: baseline; gap: 8px; margin-bottom: var(--space-md); }
.list-title { font-size: var(--fs-h2); font-weight: 700; color: var(--color-text-title); }
.list-count { font-size: var(--fs-micro); color: var(--color-text-placeholder); }
.copy-all-btn { margin-left: auto; align-self: center; }

.entries { display: flex; flex-direction: column; gap: var(--space-sm); }
.entry { padding: var(--space-md) var(--space-lg); transition: box-shadow var(--dur-fast) var(--ease-out); }
.entry:hover { box-shadow: var(--shadow-md); }

.entry-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.entry-time { font-size: var(--fs-micro); color: var(--color-text-placeholder); font-variant-numeric: tabular-nums; font-weight: 500; }
.tag { font-size: 11px; line-height: 1; padding: 4px 8px; border-radius: var(--radius-full); background: var(--color-primary-bg); color: var(--color-primary); font-weight: 500; }
.entry-actions { margin-left: auto; display: flex; gap: 4px; }
.icon-btn { width: 28px; height: 28px; border-radius: var(--radius-sm); color: var(--color-text-placeholder); display: flex; align-items: center; justify-content: center; transition: all var(--dur-fast) var(--ease-out); }
.icon-btn:hover { background: var(--color-bg-hover); color: var(--color-text-title); }
.icon-btn.danger:hover { background: var(--color-danger-bg); color: var(--color-danger); }

.entry-raw { font-size: 15px; line-height: 1.7; color: var(--color-text-body); white-space: pre-wrap; word-break: break-word; }
.entry-polished { margin-top: 12px; background: var(--color-primary-bg); border-radius: var(--radius-md); padding: 12px 14px; border: 1px solid var(--color-primary-bg-hover); }
.polished-tag { display: flex; align-items: center; gap: 4px; font-size: var(--fs-micro); color: var(--color-primary); margin-bottom: 6px; font-weight: 500; }
.polished-text { font-size: var(--fs-aux); line-height: 1.7; color: var(--color-text-body); white-space: pre-wrap; word-break: break-word; }
.entry-foot { margin-top: 10px; display: flex; justify-content: flex-end; }

/* 对比视图 */
.compare { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.compare-col { border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 12px 14px; min-height: 80px; }
.compare-col.polished { border-color: var(--color-primary-light); background: var(--color-primary-bg); }
.compare-tag { font-size: var(--fs-micro); color: var(--color-text-sub); margin-bottom: 6px; display: flex; align-items: center; gap: 4px; font-weight: 500; }
.compare-body { font-size: var(--fs-aux); line-height: 1.7; white-space: pre-wrap; word-break: break-word; }
.compare-foot { grid-column: 1 / -1; display: flex; justify-content: flex-end; gap: 8px; }

@media (max-width: 768px) {
  .compare { grid-template-columns: 1fr; }
  .formality-group { display: none; }
  .tag-input { width: 100%; }
}
</style>
