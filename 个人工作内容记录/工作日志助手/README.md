# 📝 工作日志助手 (WorkLog Assistant)

> 💡 **告别流水账与周报痛苦**：口语化随时记录日常工作琐事，AI 自动提炼为专业、规范的书面条目，一键导出精美周报与月报！

---

## 🐳 Docker Compose 独立秒级部署（推荐，直接复制粘贴）

如果你已有 Docker 环境，**甚至无需下载/克隆整个 Git 代码仓库**，只需创建一个 `docker-compose.yml` 文件并启动：

### 1. 复制保存为 `docker-compose.yml`

```yaml
version: "3.8"

services:
  server:
    image: wndfl/worklog-server:latest
    container_name: worklog-server
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - PORT=3001
      - JWT_SECRET=worklog-secret-key-change-it-in-production
      - JWT_EXPIRES_IN=7d
      - DATABASE_URL=file:/app/data/worklog.db
    volumes:
      - worklog-data:/app/data
      - worklog-uploads:/app/uploads
    expose:
      - "3001"

  web:
    image: wndfl/worklog-web:latest
    container_name: worklog-web
    restart: unless-stopped
    depends_on:
      - server
    environment:
      - VITE_API_BASE=/api
    ports:
      - "5080:80"   # 左边 5080 可按需替换为任意你想访问的主机端口

volumes:
  worklog-data:
  worklog-uploads:
```

### 2. 命令行一键启动

在 `docker-compose.yml` 所在目录下执行：

```bash
docker compose pull && docker compose up -d
```

- 🌐 访问地址：`http://localhost:5080`（或 `http://你的服务器IP:5080`）
- ⏹️ 停止服务：`docker compose down`
- 📜 查看日志：`docker compose logs -f`
- 🔄 升级最新版本：`docker compose pull && docker compose up -d`

---

## ⚡ Ubuntu / Debian 云服务器【一键交互式安装】

即使是一台刚开机的**全新、纯净的 Ubuntu / Debian 服务器**（没有 Docker、没有 Git），你只需直接**复制下面这行命令**粘贴到终端回车即可：

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/WonderMaker123/workjilu/main/install.sh)"
```

### ✨ 安装过程全交互（可自定义目录与端口）：
1. 📁 **自定义存放文件夹**：提示输入安装目录（如 `/opt/worklog`、`/home/ubuntu/worklog`、`/data/worklog`），**直接按回车默认装在 `/opt/worklog`**。
2. 🌐 **自定义 Web 端口**：支持输入你喜欢的访问端口（**回车默认使用 `5080`**）。脚本会**自动检测端口占用**，如果 5080 端口已被占用，会自动提醒并推荐 `15080` 等可用端口！
3. 🐳 **全自动环境安装**：全自动检测并安装 `Docker`、`Compose`、`Git` 等必要依赖。
4. 🚀 **自动启动并输出外网访问网址**：部署完成后自动打印服务器公网访问地址（如 `http://你的IP:5080`），并提示防火墙放行方法。

---

## 🚀 其它快捷运行方式

### 🐳 方式一：服务器已有 Docker 且想直接跑
```bash
git clone https://github.com/WonderMaker123/workjilu.git && cd workjilu && docker compose up -d --build
```
- 默认端口：`5080`（访问 `http://localhost:5080`；如需改端口，在目录里新建 `.env` 写入 `WEB_PORT=8080` 即可）
- 停止服务：`docker compose down`
- 查看日志：`docker compose logs -f`

---

### 🌟 方式二：Windows 电脑小白【双击即开】（零敲命令）

无需懂任何命令行，按如下步骤双击即可：

1. **下载本项目**：
   - 点击 GitHub 页面右上角绿色按钮 `Code` ➔ 点击 **`Download ZIP`** 并解压。
2. **启动**：
   - 如果电脑已装 Docker：直接**双击运行 `一键启动-Docker版.bat`** 即可，脚本会自动拉起并唤起浏览器访问！
   - 如果电脑未装 Docker 但有 Node.js：直接**双击运行 `一键启动-本地源码版.bat`**，全自动装依赖并打开系统！
3. **停止**：双击 `停止运行.bat` 即可。

---

### 💻 方式三：本地开发/源码极速启动（Node.js 模式）

如果你需要直接在本地修改源码：

```bash
# 1. 克隆并进入工程
git clone https://github.com/WonderMaker123/workjilu.git
cd workjilu/个人工作内容记录/工作日志助手

# 2. 启动后端服务 (终端 1)
cd server
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev

# 3. 启动前端服务 (终端 2)
cd ../web
npm install
npm run dev
```

- 浏览器访问：**`http://localhost:5173`**

---

## 🎯 首次使用指引（30秒上手）

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

## 🚀 持续集成与 Docker Hub 镜像构建 (CI/CD)

本项目配置了 **GitHub Actions** 自动化 CI/CD 流水线（`.github/workflows/docker-publish.yml`）：
- **自动构建**：每次向 `main` 分支提交代码或打版本标签（Tag `v*.*.*`）时，GitHub 自动云端构建前端与后端多架构 Docker 镜像（支持 `linux/amd64` 与 `linux/arm64`），并自动推送到 Docker Hub。
- **免本地编译**：用户端安装时直接拉取 Docker Hub 预构建镜像（`wndfl/worklog-server` 和 `wndfl/worklog-web`），数秒内即可拉起运行，无需在用户服务器或电脑上安装 Node.js/依赖编译。
- **手动触发**：在 GitHub 仓库的 **Actions** 页面，找到 `Build and Push Docker Images to Docker Hub`，可点击 **Run workflow** 手动随时触发云端打包发布。

> 💡 **首次配置提醒**：请在 GitHub 仓库的 `Settings -> Secrets and variables -> Actions` 中配置以下 Repository secrets：
> 1. `DOCKERHUB_USERNAME`: 你的 Docker Hub 用户名（如 `wndfl`）
> 2. `DOCKERHUB_TOKEN`: 你的 Docker Hub Access Token（在 Docker Hub 账号设置 -> Personal access tokens 中生成）

---

## 📄 开源许可证

本项目基于 [Apache 2.0 License](LICENSE) 开源协议。
