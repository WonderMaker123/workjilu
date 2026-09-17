@echo off
chcp 65001 >nul
title 工作日志助手 - 本地源码一键启动

echo ======================================================
echo       工作日志助手 - 本地源码一键启动 (Windows)
echo ======================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js 环境！
    echo 请前往官方下载安装: https://nodejs.org/ (推荐 v20 或更高版本)
    echo.
    pause
    exit /b 1
)

set BASE_DIR=%~dp0个人工作内容记录\工作日志助手

echo [1/4] 初始化后端环境...
cd /d "%BASE_DIR%\server"
if not exist ".env" (
    echo 创建后端 .env 配置文件...
    copy .env.example .env >nul 2>nul
)

if not exist "node_modules" (
    echo 安装后端依赖包，请稍候...
    call npm install
)

echo [2/4] 生成后端数据库结构...
call npx prisma generate
call npx prisma migrate deploy

echo [3/4] 初始化前端环境...
cd /d "%BASE_DIR%\web"
if not exist "node_modules" (
    echo 安装前端依赖包，请稍候...
    call npm install
)

echo [4/4] 正在启动后端与前端服务...
cd /d "%BASE_DIR%\server"
start "工作日志助手-后端" cmd /k "npm run dev"

cd /d "%BASE_DIR%\web"
start "工作日志助手-前端" cmd /k "npm run dev"

echo.
echo ======================================================
echo 服务已成功启动！
echo 后端地址: http://localhost:3001
echo 前端地址: http://localhost:5173
echo ======================================================
echo.
timeout /t 3 >nul
start http://localhost:5173
pause
