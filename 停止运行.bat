@echo off
chcp 65001 >nul
title 工作日志助手 - 停止运行

echo 正在停止工作日志助手容器...
docker compose down
echo.
echo 容器已停止！
pause
