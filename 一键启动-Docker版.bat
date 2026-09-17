@echo off
chcp 65001 >nul
title 工作日志助手 - 一键启动 (Docker版)

echo ======================================================
echo           工作日志助手 - 正在启动 Docker 容器
echo ======================================================
echo.

where docker >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Docker！
    echo 请先安装并启动 Docker Desktop (https://www.docker.com/products/docker-desktop/)
    echo.
    pause
    exit /b 1
)

echo [1/2] 正在构建并拉起容器（首次启动需要下载基础镜像，请稍候）...
docker compose up -d --build

if %errorlevel% neq 0 (
    echo.
    echo [失败] 启动失败，请检查 Docker Desktop 是否已经正常运行！
    echo.
    pause
    exit /b 1
)

echo.
echo [2/2] 服务启动成功！
echo 前端访问地址: http://localhost:5080
echo.
echo 正在为您自动打开浏览器...
start http://localhost:5080

echo.
echo 提示：如需停止运行，请双击打开同目录下的 "停止运行.bat" 或输入 docker compose down
echo.
pause
