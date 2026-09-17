# 📝 工作日志助手 (WorkLog Assistant)

> 💡 **告别流水账与周报痛苦**：口语化随时记录日常工作琐事，AI 自动提炼为专业、规范的书面条目，一键导出精美周报与月报！

---

## ⚡ 极速傻瓜式安装（3 种方式任意选）

无论你是完全不会代码的普通用户，还是开发者，按以下步骤**只需 1 分钟**即可跑起来！

---

### 🌟 方式一：Windows 用户【双击即开】（最省心、零敲命令）

无需懂任何命令行，按如下步骤双击即可：

1. **下载本项目**：
   - 点击 GitHub 页面右上角绿色按钮 `Code` ➔ 点击 **`Download ZIP`** 并解压。
2. **启动**：
   - 如果电脑已装 Docker：直接**双击运行 `一键启动-Docker版.bat`** 即可，脚本会自动编译并唤起浏览器访问！
   - 如果电脑未装 Docker 但有 Node.js：直接**双击运行 `一键启动-本地源码版.bat`**，全自动装依赖并打开系统！
3. **停止**：双击 `停止运行.bat` 即可。

---

### 🐳 方式二：终端一行命令傻瓜运行（Docker 模式）

只要电脑装有 Docker，无论是在 Windows、Mac 还是云服务器，在终端直接**复制下面一整行命令**粘贴回车即可：

#### 🖥️ Linux / macOS / 云服务器（复制一整行回车）：
```bash
git clone https://github.com/WonderMaker123/workjilu.git && cd workjilu && docker compose up -d --build
```

#### 🪟 Windows PowerShell（复制一整行回车）：
```powershell
git clone https://github.com/WonderMaker123/workjilu.git; cd workjilu; docker compose up -d --build
```

- 启动完成后，打开浏览器访问：**`http://localhost`**
- 停止运行命令：`docker compose down`

---

### 💻 方式三：本地开发/源码极速启动（Node.js 模式）

如果你需要直接在本地修改源码，只需执行：

```bash
# 1. 克隆并进入工程
git clone https://github.com/WonderMaker123/workjilu.git
cd workjilu/个人工作内容记录/工作日志助手

# 2. 启动后端服务 (新开一个终端窗口)
cd server
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev

# 3. 启动前端服务 (新开一个终端窗口)
cd ../web
npm install
npm run dev
```

- 启动后浏览器访问：**`http://localhost:5173`**
- 后端 API 端口：`http://localhost:3001`

---

## 🚀 首次使用指引（30秒上手）

1. **注册与登录**：
   - 打开系统后点击【注册】，输入任意账号密码即可创建你的私有账户（数据全部存储在本地）。
2. **配置 AI 接口（开启智能整理的核心）**：
   - 登录后进入左下角【设置】➔【AI 服务配置】。
   - 本系统采用通用 OpenAI 兼容协议，支持市面上几乎所有大模型，推荐以下配置：

| 推荐模型提供商 | API 端点 (Base URL) | 模型名称 (Model Name) | 获取 Key 方式 |
| :--- | :--- | :--- | :--- |
| **DeepSeek (推荐)** | `https://api.deepseek.com` | `deepseek-chat` | [deepseek.com](https://platform.deepseek.com/) |
| **阿里通义千问** | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-plus` | [阿里云百炼](https://bailian.console.aliyun.com/) |
| **本地 Ollama (完全离线)**| `http://localhost:11434/v1` | `qwen2.5:7b` | 无需 API Key |

3. **开始记录**：
   - 在【今日工作】文本框随意输入日常口语，如：*“上午修了两个用户反馈的登录超时bug，下午配合老张调通了支付接口”*。
   - 点击 **【AI 智能整理】**，系统将瞬间将其转化为规范工整的专业条目！
   - 进入【报表生成】一键汇出周报/月报，支持导出 Word / PDF。

---

## 🔒 数据安全与本地自托管

- **数据绝对私有**：所有工作日志、分类与凭据均存放在本机的 SQLite 数据库文件中，绝不上报给任何第三方。
- **一键备份导出**：进入【设置】页面可随时将全量日志导出为单个 JSON 文件备份，或导入至新环境迁移。

---

## 📄 开源许可证

本项目基于 [Apache 2.0 License](LICENSE) 开源协议。
