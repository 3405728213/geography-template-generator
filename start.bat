@echo off
chcp 65001 >nul
title 地理答题模板生成器

echo ============================================================
echo   正在启动...
echo ============================================================

cd /d "%~dp0"

echo [1/2] 启动公网隧道守护进程...
start "地理模板-隧道" /MIN python tunnel_daemon.py

echo        等待隧道建立（约 10 秒）...
timeout /t 10 /nobreak >nul

echo [2/2] 启动 Web 服务器...
start "地理模板-Web" python app.py

timeout /t 3 /nobreak >nul

echo.
echo ============================================================
echo   ✅ 启动完成！
echo.
echo   当 Flask 窗口显示公网 URL 后，用手机浏览器打开即可
echo.
echo   关闭本窗口不会影响服务运行
echo   要停止服务，关闭 "地理模板" 开头的窗口即可
echo ============================================================
echo.
pause
