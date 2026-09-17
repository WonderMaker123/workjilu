#!/usr/bin/env bash
# ==============================================================================
# 工作日志助手 (WorkLog Assistant) - Ubuntu / Debian 一键全自动交互式安装脚本
# 支持系统: Ubuntu 20.04+, Debian 11+
# ==============================================================================

set -e

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}================================================================${NC}"
echo -e "${GREEN}          工作日志助手 (WorkLog) - 一键全自动交互式安装${NC}"
echo -e "${BLUE}================================================================${NC}"
echo ""

# 1. 权限检查
if [ "$(id -u)" -ne 0 ]; then
    echo -e "${YELLOW}[提示] 当前非 root 用户，将自动调用 sudo 执行命令...${NC}"
    SUDO="sudo"
else
    SUDO=""
fi

# 2. 读取终端输入的辅助函数（保证 curl | bash 管道模式下能正常交互）
read_input() {
    local prompt="$1"
    local default_val="$2"
    local result=""
    if [ -t 0 ]; then
        read -r -p "$prompt" result
    elif [ -e /dev/tty ]; then
        read -r -p "$prompt" result </dev/tty
    else
        result=""
    fi
    if [ -z "$result" ]; then
        echo "$default_val"
    else
        echo "$result"
    fi
}

echo -e "${CYAN}>>> 请进行简单的安装配置（直接按回车将使用默认推荐值）：${NC}"
echo ""

# 询问安装目录
DEFAULT_DIR="/opt/worklog"
echo -e "📁 ${YELLOW}1. 项目存放目录${NC}"
USER_DIR=$(read_input "   请输入安装文件夹路径 [默认: ${DEFAULT_DIR}]: " "${DEFAULT_DIR}")
INSTALL_DIR=$(eval echo "$USER_DIR")
echo -e "   -> 安装目录设为: ${GREEN}${INSTALL_DIR}${NC}\n"

# 检查端口占用的辅助函数
check_port_in_use() {
    local port="$1"
    if command -v ss &>/dev/null; then
        ss -tuln | grep -q ":${port}\b"
    elif command -v netstat &>/dev/null; then
        netstat -tuln | grep -q ":${port}\b"
    elif command -v lsof &>/dev/null; then
        lsof -i ":${port}" &>/dev/null
    else
        return 1
    fi
}

# 询问 Web 访问端口
DEFAULT_PORT=5080
if check_port_in_use 5080; then
    DEFAULT_PORT=15080
    echo -e "🌐 ${YELLOW}2. Web 访问端口 (检测到默认 5080 端口已被占用，为您推荐 15080)${NC}"
else
    echo -e "🌐 ${YELLOW}2. Web 访问端口${NC}"
fi

while true; do
    USER_PORT=$(read_input "   请输入 Web 访问端口 [默认: ${DEFAULT_PORT}]: " "${DEFAULT_PORT}")
    
    # 验证是否为合法纯数字
    if ! [[ "$USER_PORT" =~ ^[0-9]+$ ]] || [ "$USER_PORT" -lt 1 ] || [ "$USER_PORT" -gt 65535 ]; then
        echo -e "   ${RED}[错误] 端口号必须是 1 到 65535 之间的整数，请重新输入！${NC}"
        continue
    fi
    
    # 检查输入端口是否被占用
    if check_port_in_use "$USER_PORT"; then
        echo -e "   ${YELLOW}[警告] 端口 ${USER_PORT} 当前已被其他进程占用！${NC}"
        OVERWRITE=$(read_input "   是否仍要强制使用此端口？(y/N): " "N")
        if [[ "$OVERWRITE" =~ ^[Yy]$ ]]; then
            TARGET_PORT="$USER_PORT"
            break
        else
            continue
        fi
    else
        TARGET_PORT="$USER_PORT"
        break
    fi
done

echo -e "   -> 访问端口设为: ${GREEN}${TARGET_PORT}${NC}\n"

echo -e "${BLUE}----------------------------------------------------------------${NC}"
echo -e "确认安装参数："
echo -e "  • 安装路径: ${GREEN}${INSTALL_DIR}${NC}"
echo -e "  • 访问端口: ${GREEN}${TARGET_PORT}${NC}"
echo -e "${BLUE}----------------------------------------------------------------${NC}"
echo ""

# 3. 基础依赖检查 (已有则秒级跳过)
echo -e "${BLUE}[1/4] 检查系统基础依赖 (curl, git, openssl)...${NC}"
MISSING_PKGS=()
for cmd in curl git openssl; do
    if ! command -v "$cmd" &> /dev/null; then
        MISSING_PKGS+=("$cmd")
    fi
done

if [ ${#MISSING_PKGS[@]} -eq 0 ]; then
    echo -e "${GREEN}基础系统工具 (curl, git, openssl) 已具备，直接跳过安装。${NC}"
else
    echo -e "${YELLOW}检测到缺少基础工具: ${MISSING_PKGS[*]}，正在补充安装...${NC}"
    $SUDO apt-get update -y
    $SUDO apt-get install -y "${MISSING_PKGS[@]}" ca-certificates
fi

# 4. 检查并安装 Docker & Docker Compose (已有则秒级跳过)
echo -e "${BLUE}[2/4] 检查 Docker 与 Compose 环境...${NC}"
if command -v docker &> /dev/null; then
    DOCKER_VER=$(docker --version | awk '{print $3}' | tr -d ',')
    echo -e "${GREEN}Docker 已安装 (版本: ${DOCKER_VER})，跳过安装。${NC}"
    # 确保 Docker 服务处于运行状态
    if ! $SUDO systemctl is-active --quiet docker; then
        echo -e "${YELLOW}正在启动 Docker 守护进程...${NC}"
        $SUDO systemctl start docker
    fi
else
    echo -e "${YELLOW}未检测到 Docker，正在全自动安装 Docker 环境，请稍候...${NC}"
    curl -fsSL https://get.docker.com | $SUDO sh
    $SUDO systemctl enable docker
    $SUDO systemctl start docker
fi

# 确保 docker compose 可用
if docker compose version &> /dev/null; then
    COMPOSE_VER=$(docker compose version --short 2>/dev/null || echo "已就绪")
    echo -e "${GREEN}Docker Compose 已就绪 (版本: ${COMPOSE_VER})，跳过安装。${NC}"
else
    echo -e "${YELLOW}正在补充安装 docker-compose-plugin...${NC}"
    $SUDO apt-get update -y
    $SUDO apt-get install -y docker-compose-plugin || true
fi

# 5. 拉取项目源码
echo -e "${BLUE}[3/4] 正在拉取项目代码至 ${INSTALL_DIR}...${NC}"
$SUDO mkdir -p "$INSTALL_DIR"

if [ -d "$INSTALL_DIR/.git" ]; then
    echo -e "${YELLOW}检测到已存在 Git 仓库，正在更新最新代码...${NC}"
    cd "$INSTALL_DIR"
    $SUDO git pull || true
else
    $SUDO git clone https://github.com/WonderMaker123/workjilu.git "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

# 6. 配置环境变量 (.env)
echo -e "${BLUE}[4/4] 正在生成运行配置并构建容器...${NC}"

# 生成安全随机 JWT 密钥
RANDOM_SECRET=$(openssl rand -hex 16 2>/dev/null || date +%s%N | md5sum | head -c 32)

$SUDO tee "$INSTALL_DIR/.env" > /dev/null <<EOF
WEB_PORT=${TARGET_PORT}
JWT_SECRET=${RANDOM_SECRET}
EOF

# 7. 拉取镜像并启动容器
echo -e "${YELLOW}正在拉取 Docker Hub 预构建镜像并启动（无需本地漫长编译）...${NC}"
if $SUDO docker compose pull; then
    echo -e "${GREEN}镜像拉取成功，正在启动服务...${NC}"
    $SUDO docker compose up -d
else
    echo -e "${YELLOW}未能直接拉取预构建镜像，降级为本地实时构建启动...${NC}"
    $SUDO docker compose up -d --build
fi

# 8. 获取服务器公网 IP
SERVER_IP=$(curl -s4 https://api.ipify.org || curl -s4 https://ifconfig.me || echo "<服务器公网IP>")

if [ "$TARGET_PORT" = "80" ]; then
    ACCESS_URL="http://${SERVER_IP}"
    LOCAL_URL="http://localhost"
else
    ACCESS_URL="http://${SERVER_IP}:${TARGET_PORT}"
    LOCAL_URL="http://localhost:${TARGET_PORT}"
fi

echo ""
echo -e "${GREEN}================================================================${NC}"
echo -e "${GREEN}🎉 恭喜！工作日志助手已成功安装并启动！${NC}"
echo -e "${GREEN}================================================================${NC}"
echo ""
echo -e "👉 浏览器公网访问: ${CYAN}${ACCESS_URL}${NC}"
echo -e "👉 本机/内网访问:   ${CYAN}${LOCAL_URL}${NC}"
echo ""
echo -e "${YELLOW}💡 提示：若外网无法访问，请检查云服务器安全组/防火墙是否已放行 ${TARGET_PORT} 端口！${NC}"
echo -e "   Ubuntu 防火墙放行命令: ${GREEN}sudo ufw allow ${TARGET_PORT}/tcp${NC}"
echo ""
echo -e "${BLUE}常用运维命令（在 ${INSTALL_DIR} 目录下执行）：${NC}"
echo -e "  查看运行状态:   ${YELLOW}docker compose ps${NC}"
echo -e "  查看实时日志:   ${YELLOW}docker compose logs -f${NC}"
echo -e "  停止服务:       ${YELLOW}docker compose down${NC}"
echo -e "  重启服务:       ${YELLOW}docker compose restart${NC}"
echo -e "${GREEN}================================================================${NC}"
