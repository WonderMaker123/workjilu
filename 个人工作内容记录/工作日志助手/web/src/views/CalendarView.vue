<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { entriesApi, type Entry } from '@/api/entries';

const router = useRouter();
const loading = ref(false);
const month = ref(new Date().toISOString().slice(0, 7)); // yyyy-mm
const entries = ref<Entry[]>([]);
const selectedDate = ref(new Date().toISOString().slice(0, 10));

// 按日期分组
const byDate = computed(() => {
  const m = new Map<string, Entry[]>();
  for (const e of entries.value) {
    if (!m.has(e.entryDate)) m.set(e.entryDate, []);
    m.get(e.entryDate)!.push(e);
  }
  return m;
});

const selectedEntries = computed(() => byDate.value.get(selectedDate.value) || []);

// 生成日历网格（周一起始，补齐前后空白）
interface Cell { date: string; day: number; inMonth: boolean; isToday: boolean; count: number; }
const weeks = computed<Cell[][]>(() => {
  const [y, m] = month.value.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const startWeekday = (first.getDay() + 6) % 7; // 0=Mon
  const daysInMonth = new Date(y, m, 0).getDate();
  const todayStr = new Date().toISOString().slice(0, 10);

  const cells: Cell[] = [];
  // 上月填充
  for (let i = startWeekday - 1; i >= 0; i--) {
    const d = new Date(y, m - 1, -i);
    cells.push(makeCell(d, false, todayStr));
  }
  // 本月
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(makeCell(new Date(y, m - 1, day), true, todayStr));
  }
  // 下月填充至 42 格
  let next = 1;
  while (cells.length < 42) {
    const d = new Date(y, m, next++);
    cells.push(makeCell(d, false, todayStr));
  }
  // 切成 6 行
  const rows: Cell[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
});

function makeCell(d: Date, inMonth: boolean, todayStr: string): Cell {
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { date, day: d.getDate(), inMonth, isToday: date === todayStr, count: byDate.value.get(date)?.length || 0 };
}

const monthActiveDays = computed(() => {
  let n = 0;
  for (const [date] of byDate.value) if (date.startsWith(month.value)) n++;
  return n;
});
const monthCount = computed(() => entries.value.length);

async function load() {
  loading.value = true;
  try {
    const { data } = await entriesApi.list({ month: month.value });
    entries.value = data;
  } finally { loading.value = false; }
}
onMounted(load);

function shiftMonth(delta: number) {
  const [y, m] = month.value.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  month.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  load();
}

function pick(cell: Cell) {
  selectedDate.value = cell.date;
  if (!cell.inMonth) {
    // 切到对应月份
    month.value = cell.date.slice(0, 7);
    load();
  }
}

const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

function goWrite() { router.push('/today'); }
function fmtTime(iso?: string | null) { if (!iso) return ''; const d = new Date(iso); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; }
function tagsOf(e: Entry): string[] { try { return JSON.parse(e.tags || '[]'); } catch { return []; } }
</script>

<template>
  <div class="cal-page">
    <div class="page-head">
      <h1 class="page-title">日历视图</h1>
      <p class="page-desc">直观看哪天有记录，点击日期查看当天内容</p>
    </div>

    <div class="layout-grid">
      <!-- 日历主体 -->
      <section class="panel cal-panel" v-loading="loading">
        <div class="cal-toolbar">
          <div class="month-nav">
            <button class="nav-arrow" @click="shiftMonth(-1)"><el-icon><ArrowLeft /></el-icon></button>
            <el-date-picker v-model="month" type="month" format="YYYY年MM月" value-format="YYYY-MM" :clearable="false" @change="load" class="month-picker" />
            <button class="nav-arrow" @click="shiftMonth(1)"><el-icon><ArrowRight /></el-icon></button>
          </div>
          <div class="cal-summary">
            <span class="stat-num">{{ monthActiveDays }}</span> 天有记录 · 共 <span class="stat-num">{{ monthCount }}</span> 条
          </div>
        </div>

        <div class="week-row">
          <div v-for="w in WEEK_LABELS" :key="w" class="week-label">{{ w }}</div>
        </div>

        <div class="grid">
          <template v-for="(row, ri) in weeks" :key="ri">
            <button
              v-for="cell in row"
              :key="cell.date"
              class="day-cell"
              :class="{
                'out-month': !cell.inMonth,
                'is-today': cell.isToday,
                'is-selected': selectedDate === cell.date,
                'has-entry': cell.count > 0,
              }"
              @click="pick(cell)"
            >
              <span class="day-num">{{ cell.day }}</span>
              <span v-if="cell.count" class="dot" :class="{ multi: cell.count > 2 }">
                {{ cell.count > 99 ? '99+' : cell.count }}
              </span>
            </button>
          </template>
        </div>
      </section>

      <!-- 当日详情 -->
      <section class="panel detail-panel">
        <div class="detail-head">
          <h2 class="detail-date">{{ selectedDate }}</h2>
          <el-button size="small" type="primary" plain @click="goWrite">
            <el-icon style="margin-right:4px"><EditPen /></el-icon>去记录
          </el-button>
        </div>

        <div v-if="selectedEntries.length === 0" class="detail-empty">
          <el-icon :size="26"><Calendar /></el-icon>
          <p>这一天还没有记录</p>
        </div>

        <div v-else class="detail-list">
          <article v-for="e in selectedEntries" :key="e.id" class="d-item">
            <div class="d-time">{{ fmtTime(e.createdAt) }}
              <span v-for="t in tagsOf(e)" :key="t" class="mini-tag">{{ t }}</span>
            </div>
            <p class="d-raw">{{ e.rawContent }}</p>
            <div v-if="e.polishedContent" class="d-polished">
              <span class="d-pol-tag"><el-icon :size="12"><MagicStick /></el-icon> AI</span>
              {{ e.polishedContent }}
            </div>
          </article>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.cal-page { display: flex; flex-direction: column; gap: var(--space-lg); }
.page-head { margin-bottom: var(--space-3xs); }
.page-title { font-size: var(--fs-display); line-height: var(--lh-display); font-weight: 800; color: var(--color-text-title); letter-spacing: -0.03em; }
.page-desc { font-size: var(--fs-aux); color: var(--color-text-sub); margin-top: 2px; }

.layout-grid { display: grid; grid-template-columns: 1.6fr 1fr; gap: var(--space-lg); align-items: start; }

.cal-panel { padding: var(--space-md) var(--space-lg); }
.cal-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: var(--space-md); flex-wrap: wrap; }
.month-nav { display: flex; align-items: center; gap: 6px; }
.nav-arrow { width: 32px; height: 32px; border-radius: var(--radius-sm); border: 1px solid var(--color-border); color: var(--color-text-sub); display: flex; align-items: center; justify-content: center; transition: all var(--dur-fast) var(--ease-out); }
.nav-arrow:hover { border-color: var(--color-primary); color: var(--color-primary); background: var(--color-primary-bg); }
.month-picker { width: 130px; }
.cal-summary { font-size: var(--fs-micro); color: var(--color-text-sub); }
.stat-num { font-weight: 600; color: var(--color-text-title); }

.week-row { display: grid; grid-template-columns: repeat(7, 1fr); margin-bottom: 6px; }
.week-label { text-align: center; font-size: var(--fs-micro); color: var(--color-text-placeholder); font-weight: 600; padding: 6px 0; }

.grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; }
.day-cell {
  position: relative;
  aspect-ratio: 1 / 1;
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  background: var(--color-bg-page);
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 3px;
  transition: all var(--dur-fast) var(--ease-out);
}
.day-cell:hover { border-color: var(--color-primary-light); background: var(--color-primary-bg); }
.day-num { font-size: var(--fs-aux); color: var(--color-text-body); font-variant-numeric: tabular-nums; }
.day-cell.out-month { opacity: 0.35; }
.day-cell.is-today .day-num { color: var(--color-primary); font-weight: 700; }
.day-cell.is-today { border-color: var(--color-primary-light); }
.day-cell.is-selected { background: var(--color-primary); border-color: var(--color-primary); }
.day-cell.is-selected .day-num, .day-cell.is-selected .dot { color: #fff; }
.day-cell.has-entry .day-num { font-weight: 600; }
.dot {
  font-size: 10px; font-weight: 700; line-height: 1;
  min-width: 18px; height: 18px; padding: 0 5px;
  border-radius: var(--radius-full);
  background: var(--color-primary-bg);
  color: var(--color-primary);
  display: flex; align-items: center; justify-content: center;
}
.day-cell.is-selected .dot { background: rgba(255,255,255,0.25); color: #fff; }

.detail-panel { padding: var(--space-md) var(--space-lg); position: sticky; top: 24px; max-height: calc(100vh - 48px); overflow-y: auto; }
.detail-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-md); }
.detail-date { font-size: var(--fs-h2); font-weight: 700; color: var(--color-text-title); font-variant-numeric: tabular-nums; }
.detail-empty { padding: var(--space-xl) 0; text-align: center; color: var(--color-text-placeholder); display: flex; flex-direction: column; align-items: center; gap: 10px; }
.detail-empty p { font-size: var(--fs-aux); }

.detail-list { display: flex; flex-direction: column; gap: 12px; }
.d-item { padding-bottom: 12px; border-bottom: 1px dashed var(--color-border-light); }
.d-item:last-child { border-bottom: none; }
.d-time { font-size: var(--fs-micro); color: var(--color-text-placeholder); margin-bottom: 4px; display: flex; align-items: center; gap: 6px; }
.mini-tag { font-size: 10px; padding: 2px 6px; border-radius: var(--radius-full); background: var(--color-primary-bg); color: var(--color-primary); }
.d-raw { font-size: var(--fs-aux); line-height: 1.6; color: var(--color-text-body); white-space: pre-wrap; word-break: break-word; }
.d-polished { margin-top: 6px; font-size: var(--fs-micro); line-height: 1.6; color: var(--color-text-sub); background: var(--color-primary-bg); border-radius: var(--radius-sm); padding: 8px 10px; }
.d-pol-tag { display: inline-flex; align-items: center; gap: 3px; color: var(--color-primary); font-weight: 600; margin-right: 4px; }

@media (max-width: 900px) {
  .layout-grid { grid-template-columns: 1fr; }
  .detail-panel { position: static; max-height: none; }
}
</style>
