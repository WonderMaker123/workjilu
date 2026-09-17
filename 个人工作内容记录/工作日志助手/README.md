# 工作日志助手（WorkLog）

> 💡 **口语化随手记，AI 智能润色，一键自动生成周报 / 月报的开源轻量 Web 工具。**  
> 适合个人日常工作记录、团队运维实施日志、工作汇报总结等场景。支持多用户、PC / 手机自适应、数据 100% 本地自托管。

---

## 🌟 核心特性

- 📝 **口语化随手记**：想到什么记什么，无需刻意排版，支持多条、编辑、标签分类、快速检索。
- 🤖 **AI 智能书面化整理**：兼容 OpenAI 标准接口（支持 **DeepSeek / 通义千问 / Kimi / 智谱 / Ollama** 等），一键将口语转为专业规范的职场表述。
- 📊 **周报 / 月报一键生成**：根据周期内的记录，AI 自动提炼核心工作、项目进度与后续计划，支持存档与重新润色。
- 📄 **多格式公文导出**：支持导出规范排版的 **Word (.docx)**（标准公文版式）、Markdown、CSV，支持打印预览与保存为 PDF。
- 📷 **现场照片附件**：支持工作照片上传（前端自动压缩、后端隔离存储）。
- 🔒 **数据安全与隐私**：
  - 数据完全私有化保存（基于 SQLite 轻量数据库）。
  - AI API Key 在服务端加密落盘，永不下发到浏览器前端。
  - 支持一键导出 JSON 备份与数据导入恢复。
- 📱 **多端自适应**：支持手机浏览器访问，支持 PWA 桌面/移动快捷方式安装。

---

## 🛠️ 技术栈

| 层次 | 选型 |
|---|---|
| **前端** | Vue 3 + Vite + TypeScript + Element Plus + Pinia + Axios |
| **后端** | Node.js (Express) + Prisma ORM + SQLite + JWT + Zod |
| **部署** | Docker / Docker Compose / 传统轻量部署 |

---

## 🚀 极速安装与部署教程（适合新手小白）

你可以根据自己的习惯，选择 **【方式一：Docker 一键部署（最推荐）】** 或 **【方式二：本地 Node.js 运行】**。

---

### 方式一：Docker 一键部署（最简单，推荐 ⭐⭐⭐⭐⭐）

无需在电脑或服务器上配置 Node.js、编译环境，只要装有 Docker 即可 3 分钟跑起来。

#### 1. 前置准备
- 电脑或服务器已安装 **Docker** 和 **Docker Compose**。
  - Windows / macOS：安装 [Docker Desktop](https://www.docker.com/products/docker-desktop/) 即可。
  - Linux（Ubuntu/Debian）：运行 `curl -fsSL https://get.docker.com | bash`。

#### 2. 进入项目目录并启动
在当前目录下打开命令行终端，执行：

```bash
# 一键构建并后台启动前端和后端容器
docker compose up -d --build
```

#### 3. 访问使用
- 打开浏览器访问：`http://localhost` （如果在云服务器上，访问 `http://你的服务器IP`）。
- 首次使用点击 **【注册】** 账号即可开始记录。

> 💡 **常用 Docker 运维命令**：
> - 查看运行状态：`docker compose ps`
> - 查看运行日志：`docker compose logs -f`
> - 停止运行：`docker compose down`

---

### 方式二：本地开发 / 手动运行（适合开发者或想深入调试的小白）

#### 1. 前置准备
- 安装 **Node.js**（版本推荐 `≥ 20.0.0`）：前往 [Node.js 官网](https://nodejs.org/) 下载 LTS 版本安装。
- 安装完成可打开终端输入 `node -v` 和 `npm -v` 检查是否成功。

#### 2. 启动后端服务

打开第 1 个终端窗口：

```bash
# 1. 进入后端目录
cd server

# 2. 复制环境配置文件
# Windows CMD / PowerShell 执行：
copy .env.example .env
# Linux / macOS 执行：cp .env.example .env

# 3. 安装依赖（国内网络慢可加 --registry=https://registry.npmmirror.com）
npm install

# 4. 初始化数据库
npx prisma migrate deploy

# 5. 启动后端开发服务
npm run dev
```
> 后端启动成功后，默认监听在：`http://localhost:3001`

#### 3. 启动前端页面

打开第 2 个终端窗口：

```bash
# 1. 进入前端目录
cd web

# 2. 复制前端配置
# Windows CMD / PowerShell 执行：
copy .env.example .env
# Linux / macOS 执行：cp .env.example .env

# 3. 安装依赖
npm install

# 4. 启动前端服务
npm run dev
```
> 控制台会输出前端访问地址，通常为：`http://localhost:5173`

#### 4. 开始使用
在浏览器中打开 `http://localhost:5173`，注册新用户即可登录！

---

## 🤖 如何配置与使用 AI 功能？

系统支持所有兼容 OpenAI 格式的大模型服务（例如 **DeepSeek**、**阿里通义千问**、**Kimi / Moonshot**、**智谱 GLM**、**本地 Ollama** 等）。

1. 登录工作日志助手系统。
2. 点击右上角或导航栏进入 **【设置】** 页面。
3. 找到 **【AI 大模型配置】** 区域：
   - **接口地址 (Base URL)**：填入大模型提供商的 API 地址，例如：
     - DeepSeek：`https://api.deepseek.com/v1`
     - 阿里百炼 / 通义千问：`https://dashscope.aliyuncs.com/compatible-mode/v1`
     - 本地 Ollama：`http://localhost:11434/v1`
   - **API Key**：填入你在对应平台申请的 Key（服务端会加密保存）。
   - **模型名称 (Model)**：例如 `deepseek-chat`、`qwen-plus` 等。
4. 点击 **【保存配置】**。现在，你在日常记录或生成周月报时，就可以点击 AI 按钮一键润色、提炼了！

---

## 📁 目录结构简介

```text
工作日志助手/
├── docker-compose.yml          # Docker 一键编排文件
├── docker-compose.prod.yml     # 生产环境部署配置
├── docs/                       # 开发、架构与运维详细文档
│   ├── 架构设计.md
│   ├── 开发指南.md
│   └── 部署运维手册.md
├── server/                     # 后端工程 (Express + Prisma SQLite)
│   ├── src/                    # 后端源代码
│   ├── prisma/                 # 数据库结构与迁移
│   └── package.json
└── web/                        # 前端工程 (Vue 3 + Element Plus)
    ├── src/                    # 页面组件与视图
    └── package.json
```

---

## 🔒 隐私与备份

- **数据隔离**：每个用户的记录与配置均在系统内完全隔离。
- **数据备份**：可在「设置」页中随时点击 **【导出数据备份】**（下载为 `.json` 文件），需要时可随时一键上传还原，无惧数据丢失。

---

## 📄 开源许可证

本项目基于 [Apache 2.0 License](./LICENSE) 开源。
