<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { statsApi, type StatsOverview } from '@/api/stats';

const router = useRouter();
const loading = ref(false);
const stats = ref<StatsOverview | null>(null);

onMounted(load);
async function load() {
  loading.value = true;
  try { const { data } = await statsApi.overview(); stats.value = data; }
  finally { loading.value = false; }
}

const maxDay = computed(() => Math.max(1, ...(stats.value?.sevenDays.map((d) => d.count) || [1])));
const maxTag = computed(() => Math.max(1, ...(stats.value?.tags.map((t) => t.count) || [1])));

const todayCount = computed(() => stats.value?.sevenDays[6]?.count ?? 0);

const now = new Date();
const monthLabel = `${now.getFullYear()} 年 ${now.getMonth() + 1} 月`;

function barH(c: number) { return Math.round((c / maxDay.value) * 100); }
function tagW(c: number) { return Math.round((c / maxTag.value) * 100); }
function dayLabel(date: string) { return ['日','一','二','三','四','五','六'][new Date(date + 'T00:00:00').getDay()]; }

const cards = computed(() => [
  { label: '本月记录', value: stats.value?.monthCount ?? 0, unit: '条', icon: 'EditPen', tone: 'primary' },
  { label: '本月字数', value: stats.value?.monthWords ?? 0, unit: '字', icon: 'Histogram', tone: 'success' },
  { label: '连续记录', value: stats.value?.streak ?? 0, unit: '天', icon: 'Trophy', tone: 'warning' },
  { label: '累计记录', value: stats.value?.totalEntries ?? 0, unit: '条', icon: 'Files', tone: 'neutral' },
]);
</script>

<template>
  <div class="dash-page" v-loading="loading">
    <div class="page-head">
      <div>
        <h1 class="page-title">数据仪表盘</h1>
        <p class="page-desc">{{ monthLabel }} · 卡调事业部运维实施组工作记录一览</p>
      </div>
      <el-button type="primary" @click="router.push('/today')">
        <el-icon style="margin-right:4px"><EditPen /></el-icon>写今日记录
      </el-button>
    </div>

    <!-- 今日未写提醒 -->
    <button v-if="!loading && todayCount === 0" class="todo-banner" @click="router.push('/today')">
      <el-icon :size="18"><EditPen /></el-icon>
      <span class="todo-text">今天还没有记录，花一分钟写下今天的实施 / 巡检 / 故障处理 →</span>
    </button>
    <button v-else-if="!loading" class="todo-banner done" @click="router.push('/today')">
      <el-icon :size="18"><CircleCheckFilled /></el-icon>
      <span class="todo-text">今天已记录 {{ todayCount }} 条，继续添加或 AI 整理 →</span>
    </button>

    <!-- 统计卡片 -->
    <div class="card-grid">
      <div v-for="c in cards" :key="c.label" class="stat-card panel" :class="'tone-' + c.tone">
        <div class="stat-icon"><el-icon :size="20"><component :is="c.icon" /></el-icon></div>
        <div class="stat-meta">
          <div class="stat-value">{{ c.value }}<span class="stat-unit">{{ c.unit }}</span></div>
          <div class="stat-label">{{ c.label }}</div>
        </div>
      </div>
    </div>

    <div class="chart-grid">
      <!-- 近 7 天活动 -->
      <section class="panel chart-panel">
        <h2 class="panel-title">近 7 天活动</h2>
        <div class="bars">
          <div v-for="d in stats?.sevenDays" :key="d.date" class="bar-col">
            <div class="bar-track">
              <div class="bar-fill" :style="{ height: barH(d.count) + '%' }" :title="`${d.count} 条`"></div>
            </div>
            <span class="bar-val">{{ d.count || '' }}</span>
            <span class="bar-day">{{ dayLabel(d.date) }}</span>
          </div>
        </div>
      </section>

      <!-- 标签分布 -->
      <section class="panel chart-panel">
        <h2 class="panel-title">本月标签分布</h2>
        <div v-if="!stats?.tags.length" class="mini-empty">
          还没有标签，去「今日记录」给条目加上标签吧
        </div>
        <ul v-else class="tag-rank">
          <li v-for="t in stats.tags.slice(0, 8)" :key="t.name" class="rank-item">
            <span class="rank-name">{{ t.name }}</span>
            <div class="rank-track"><div class="rank-fill" :style="{ width: tagW(t.count) + '%' }"></div></div>
            <span class="rank-count">{{ t.count }}</span>
          </li>
        </ul>
      </section>
    </div>

    <!-- 快捷入口 -->
    <section class="panel quick-panel">
      <h2 class="panel-title">快捷入口</h2>
      <div class="quick-grid">
        <button class="quick-item" @click="router.push('/today')">
          <el-icon :size="22"><EditPen /></el-icon><span>今日记录</span>
        </button>
        <button class="quick-item" @click="router.push('/calendar')">
          <el-icon :size="22"><Calendar /></el-icon><span>日历视图</span>
        </button>
        <button class="quick-item" @click="router.push('/list')">
          <el-icon :size="22"><List /></el-icon><span>记录列表</span>
        </button>
        <button class="quick-item" @click="router.push('/reports')">
          <el-icon :size="22"><DataAnalysis /></el-icon><span>{{ stats?.hasMonthReport ? '查看月报' : '生成月报' }}</span>
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.dash-page { display: flex; flex-direction: column; gap: var(--space-lg); }
.page-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: var(--space-3xs); }
.page-title { font-size: var(--fs-display); line-height: var(--lh-display); font-weight: 800; color: var(--color-text-title); letter-spacing: -0.03em; }
.page-desc { font-size: var(--fs-aux); color: var(--color-text-sub); margin-top: 2px; }

/* 今日提醒横幅 */
.todo-banner {
  display: flex; align-items: center; gap: 10px;
  width: 100%;
  padding: 12px 16px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-primary-light);
  background: var(--color-primary-bg);
  color: var(--color-primary);
  font-size: var(--fs-aux); font-weight: 500;
  text-align: left;
  transition: all var(--dur-fast) var(--ease-out);
}
.todo-banner:hover { background: var(--color-primary-bg-hover); transform: translateY(-1px); }
.todo-banner.done { border-color: var(--color-success); background: var(--color-success-bg); color: var(--color-success); }
.todo-text { flex: 1; }

.card-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-md); }
.stat-card { display: flex; align-items: center; gap: 14px; padding: var(--space-md) var(--space-lg); }
.stat-icon { width: 44px; height: 44px; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.tone-primary .stat-icon { background: var(--color-primary-bg); color: var(--color-primary); }
.tone-success .stat-icon { background: var(--color-success-bg); color: var(--color-success); }
.tone-warning .stat-icon { background: var(--color-warning-bg); color: var(--color-warning); }
.tone-neutral .stat-icon { background: var(--color-bg-hover); color: var(--color-text-sub); }
.stat-value { font-size: 26px; font-weight: 800; color: var(--color-text-title); line-height: 1.1; letter-spacing: -0.02em; }
.stat-unit { font-size: var(--fs-micro); font-weight: 500; color: var(--color-text-placeholder); margin-left: 3px; }
.stat-label { font-size: var(--fs-micro); color: var(--color-text-sub); margin-top: 2px; }

.chart-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-md); }
.chart-panel { padding: var(--space-md) var(--space-lg); }
.panel-title { font-size: var(--fs-h2); font-weight: 700; color: var(--color-text-title); margin-bottom: var(--space-md); }
.mini-empty { padding: var(--space-lg) 0; text-align: center; font-size: var(--fs-aux); color: var(--color-text-placeholder); }

/* 柱状图 */
.bars { display: flex; align-items: flex-end; justify-content: space-between; gap: 8px; height: 160px; }
.bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; height: 100%; }
.bar-track { flex: 1; width: 100%; max-width: 36px; display: flex; align-items: flex-end; }
.bar-fill { width: 100%; background: linear-gradient(180deg, var(--color-primary-light), var(--color-primary)); border-radius: 6px 6px 3px 3px; min-height: 3px; transition: height var(--dur-slow) var(--ease-out); }
.bar-val { font-size: 10px; color: var(--color-text-sub); font-weight: 600; min-height: 12px; }
.bar-day { font-size: var(--fs-micro); color: var(--color-text-placeholder); }

/* 标签排行 */
.tag-rank { list-style: none; display: flex; flex-direction: column; gap: 10px; }
.rank-item { display: flex; align-items: center; gap: 10px; }
.rank-name { width: 72px; font-size: var(--fs-aux); color: var(--color-text-body); flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rank-track { flex: 1; height: 8px; background: var(--color-bg-page); border-radius: var(--radius-full); overflow: hidden; }
.rank-fill { height: 100%; background: var(--color-primary); border-radius: var(--radius-full); transition: width var(--dur-slow) var(--ease-out); }
.rank-count { width: 24px; text-align: right; font-size: var(--fs-micro); color: var(--color-text-sub); font-weight: 600; }

.quick-panel { padding: var(--space-md) var(--space-lg); }
.quick-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-sm); }
.quick-item { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: var(--space-md) 0; border-radius: var(--radius-md); background: var(--color-bg-page); color: var(--color-text-sub); font-size: var(--fs-aux); font-weight: 500; transition: all var(--dur-fast) var(--ease-out); }
.quick-item:hover { background: var(--color-primary-bg); color: var(--color-primary); transform: translateY(-2px); }

@media (max-width: 900px) {
  .card-grid { grid-template-columns: repeat(2, 1fr); }
  .chart-grid { grid-template-columns: 1fr; }
  .quick-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>
