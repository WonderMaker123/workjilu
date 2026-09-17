#!/usr/bin/env bash
set -e

echo "======================================================"
echo "          工作日志助手 - 一键启动 (Linux / macOS)"
echo "======================================================"
echo ""

if ! command -v docker &> /dev/null; then
    echo "[错误] 未检测到 Docker 环境，请先安装 Docker！"
    exit 1
fi

echo "正在启动容器（首次启动将自动构建）..."
docker compose up -d --build

echo ""
echo "启动完成！请在浏览器访问: http://localhost:5080"
