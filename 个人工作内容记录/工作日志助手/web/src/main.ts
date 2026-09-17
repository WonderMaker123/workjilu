import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import 'element-plus/theme-chalk/dark/css-vars.css';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
// 按需引入实际使用到的 Element Plus 图标，避免打包全量 290+ 图标
import {
  ArrowDown, ArrowLeft, ArrowRight, Bell, Calendar,
  CircleCheckFilled, Close, Connection, CopyDocument, DataAnalysis,
  Delete, Document, DocumentCopy, Download, Edit,
  EditPen, FolderOpened, List, Loading, Lock,
  MagicStick, Microphone, Moon, Operation, Printer,
  Refresh, Search, Setting, Sunny, SwitchButton,
  Upload, User
} from '@element-plus/icons-vue';

import App from './App.vue';
import router from './router';

import './assets/tokens.css';
import './assets/element-theme.css';
import { initTheme } from './lib/theme';
import { startReminder } from './lib/reminder';

initTheme();

const app = createApp(App);

const icons = {
  ArrowDown, ArrowLeft, ArrowRight, Bell, Calendar,
  CircleCheckFilled, Close, Connection, CopyDocument, DataAnalysis,
  Delete, Document, DocumentCopy, Download, Edit,
  EditPen, FolderOpened, List, Loading, Lock,
  MagicStick, Microphone, Moon, Operation, Printer,
  Refresh, Search, Setting, Sunny, SwitchButton,
  Upload, User
};

for (const [key, component] of Object.entries(icons)) {
  app.component(key, component);
}

app.use(createPinia());
app.use(router);
app.use(ElementPlus, { locale: zhCn });
app.mount('#app');

// 注册 PWA Service Worker（仅生产环境，避免干扰开发热更新）
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

// 启动每日提醒检查
startReminder();
