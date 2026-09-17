// 每日记录提醒：基于浏览器 Notification API，应用打开期间定时检查
const ENABLED_KEY = 'worklog:reminder:enabled';
const TIME_KEY = 'worklog:reminder:time'; // "HH:MM"
const FIRED_KEY = 'worklog:reminder:fired'; // 已提醒日期 yyyy-mm-dd
const DEFAULT_TIME = '18:00';

let timer: number | undefined;

export function reminderSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getReminderEnabled(): boolean {
  try { return localStorage.getItem(ENABLED_KEY) === '1'; } catch { return false; }
}
export function getReminderTime(): string {
  try { return localStorage.getItem(TIME_KEY) || DEFAULT_TIME; } catch { return DEFAULT_TIME; }
}
export function permissionState(): NotificationPermission | 'unsupported' {
  if (!reminderSupported()) return 'unsupported';
  return Notification.permission;
}

function todayStr() { return new Date().toISOString().slice(0, 10); }

function notify() {
  try {
    new Notification('该写工作日志啦', {
      body: '花一分钟，记录一下今天做了什么吧',
      icon: '/icon.svg',
      tag: 'worklog-daily',
    });
  } catch {}
  try { localStorage.setItem(FIRED_KEY, todayStr()); } catch {}
}

function tick() {
  if (!getReminderEnabled()) return;
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  if (hhmm !== getReminderTime()) return;
  let fired = '';
  try { fired = localStorage.getItem(FIRED_KEY) || ''; } catch {}
  if (fired === todayStr()) return;
  notify();
}

export function startReminder() {
  if (!reminderSupported()) return;
  if (timer) window.clearInterval(timer);
  timer = window.setInterval(tick, 30000); // 每 30 秒检查
}

// 开启（会请求权限）
export async function enableReminder(time?: string): Promise<boolean> {
  if (!reminderSupported()) return false;
  let perm = Notification.permission;
  if (perm === 'default') perm = await Notification.requestPermission();
  if (perm !== 'granted') return false;
  try {
    localStorage.setItem(ENABLED_KEY, '1');
    if (time) localStorage.setItem(TIME_KEY, time);
    localStorage.removeItem(FIRED_KEY);
  } catch {}
  startReminder();
  return true;
}

export function setReminderTime(time: string) {
  try {
    localStorage.setItem(TIME_KEY, time);
    localStorage.removeItem(FIRED_KEY); // 改时间后允许当天再次触发
  } catch {}
}

export function disableReminder() {
  try { localStorage.setItem(ENABLED_KEY, '0'); } catch {}
}

// 立即测试一条
export function testReminder(): boolean {
  if (!reminderSupported() || Notification.permission !== 'granted') return false;
  notify();
  return true;
}
