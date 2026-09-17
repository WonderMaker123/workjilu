# 📝 工作日志助手 (WorkLog Assistant)

> 💡 **告别流水账与周报痛苦**：口语化随时记录日常工作琐事，AI 自动提炼为专业、规范的书面条目，一键导出精美周报与月报！

---

## 🐳 方式一：Docker Compose 极速部署（推荐，直接复制）

直接创建一个 `docker-compose.yml` 文件并启动：

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
      - "5080:80"   # 左侧 5080 为主机端口，可按需修改

volumes:
  worklog-data:
  worklog-uploads:
```

### 2. 一键启动

在 `docker-compose.yml` 所在目录执行：

```bash
docker compose pull && docker compose up -d
```

- 🌐 访问地址：`http://localhost:5080`（或 `http://服务器IP:5080`）
- ⏹️ 停止服务：`docker compose down`
- 📜 查看日志：`docker compose logs -f`
- 🔄 升级更新：`docker compose pull && docker compose up -d`

---

## ⚡ 方式二：Linux 服务器一键全自动安装

适用于全新或已有的 Ubuntu / Debian 服务器，全自动检测依赖、支持自定义目录与端口：

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/WonderMaker123/workjilu/main/install.sh)"
```

---

## 🌟 方式三：Windows 电脑一键启动

1. 点击仓库右上角 `Code` ➔ **`Download ZIP`** 并解压。
2. 双击运行 **`一键启动-Docker版.bat`** 即可自动启动并在浏览器中打开。
3. 需要停止时双击 **`停止运行.bat`**。

---

## 💻 方式四：源码本地开发调试

```bash
# 1. 克隆代码
git clone https://github.com/WonderMaker123/workjilu.git
cd workjilu/个人工作内容记录/工作日志助手

# 2. 启动后端 (终端 1)
cd server
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev

# 3. 启动前端 (终端 2)
cd ../web
npm install
npm run dev
```

浏览器访问：`http://localhost:5173`

---

## 🎯 首次使用配置（30秒上手）

1. **注册与登录**：进入网页点击【注册】，创建你的本地私有账号。
2. **配置 AI 接口**：登录后在左下角【设置】➔【AI 服务配置】中填入 API Key：

| 推荐模型提供商 | API 端点 (Base URL) | 模型名称 (Model Name) | 获取方式 |
| :--- | :--- | :--- | :--- |
| **DeepSeek (推荐)** | `https://api.deepseek.com` | `deepseek-chat` | [deepseek.com](https://platform.deepseek.com/) |
| **阿里通义千问** | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-plus` | [阿里云百炼](https://bailian.console.aliyun.com/) |
| **本地 Ollama (离线)**| `http://localhost:11434/v1` | `qwen2.5:7b` | 无需 API Key |

3. **开始使用**：在【今日工作】输入口语碎碎念，点击【AI 智能整理】生成规范条目；在【报表生成】中导出周报/月报。

---

## 🔒 数据安全

- **本地存储**：所有工作日志与数据均存放在本地 SQLite 数据库中，数据完全自主可控。
- **备份迁移**：在【设置】页面可随时导出全部日志为 JSON 文件进行备份或迁移。

---

## 📄 许可证

本项目基于 [Apache 2.0 License](LICENSE) 开源。
