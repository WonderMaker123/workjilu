#!/usr/bin/env bash
# ==============================================================================
# 工作日志助手 (WorkLog Assistant) - Ubuntu / Debian 一键傻瓜式全自动安装脚本
# 支持系统: Ubuntu 20.04+, Debian 11+
# ==============================================================================

set -e

# 颜色输出
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}======================================================${NC}"
echo -e "${GREEN}       工作日志助手 - Ubuntu / Debian 一键全自动部署${NC}"
echo -e "${BLUE}======================================================${NC}"

# 1. 权限检查
if [ "$(id -u)" -ne 0 ]; then
    echo -e "${YELLOW}[提示] 当前非 root 用户，尝试获取 sudo 权限...${NC}"
    SUDO="sudo"
else
    SUDO=""
fi

# 2. 检查并安装基础组件 (curl, git)
echo -e "${BLUE}[1/4] 检查系统基础依赖 (curl, git)...${NC}"
$SUDO apt-get update -y
$SUDO apt-get install -y curl git ca-certificates

# 3. 检查并安装 Docker & Docker Compose
echo -e "${BLUE}[2/4] 检查 Docker 环境...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}未检测到 Docker，正在为您全自动安装 Docker 环境（请稍候）...${NC}"
    curl -fsSL https://get.docker.com | $SUDO sh
    $SUDO systemctl enable docker
    $SUDO systemctl start docker
else
    echo -e "${GREEN}Docker 已安装，跳过安装步骤。${NC}"
fi

# 确保 docker compose 可用
if ! docker compose version &> /dev/null; then
    echo -e "${YELLOW}正在安装 docker-compose-plugin...${NC}"
    $SUDO apt-get install -y docker-compose-plugin || true
fi

# 4. 拉取仓库代码
INSTALL_DIR="/opt/worklog"
echo -e "${BLUE}[3/4] 正在拉取项目代码至 ${INSTALL_DIR}...${NC}"

if [ -d "$INSTALL_DIR" ]; then
    echo -e "${YELLOW}检测到已存在安装目录，正在更新最新代码...${NC}"
    cd "$INSTALL_DIR"
    $SUDO git pull || true
else
    $SUDO git clone https://github.com/WonderMaker123/workjilu.git "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

# 5. 构建并启动容器
echo -e "${BLUE}[4/4] 正在构建并拉起 Docker 容器（首次构建需要 1-2 分钟，请稍候）...${NC}"
$SUDO docker compose up -d --build

# 获取服务器公网 IP
SERVER_IP=$(curl -s4 https://api.ipify.org || curl -s4 https://ifconfig.me || echo "你的服务器IP")

echo ""
echo -e "${GREEN}======================================================${NC}"
echo -e "${GREEN}🎉 恭喜！工作日志助手已成功部署并运行！${NC}"
echo -e "${GREEN}======================================================${NC}"
echo -e "👉 浏览器直接访问: ${YELLOW}http://${SERVER_IP}${NC}"
echo -e "👉 本地局域网/本机访问: ${YELLOW}http://localhost${NC}"
echo ""
echo -e "${BLUE}常用管理命令（在 ${INSTALL_DIR} 目录下执行）：${NC}"
echo -e "  查看运行状态: ${YELLOW}docker compose ps${NC}"
echo -e "  查看后台日志: ${YELLOW}docker compose logs -f${NC}"
echo -e "  停止服务:     ${YELLOW}docker compose down${NC}"
echo -e "  重启服务:     ${YELLOW}docker compose restart${NC}"
echo -e "${GREEN}======================================================${NC}"
