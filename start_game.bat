@echo off
title Exploding Kittens Online Game Server
cd /d "%~dp0"
echo ========================================================
echo   🐱💣 Exploding Kittens Online Server is Starting...
echo ========================================================
echo.
echo [1] Browser (เครื่องนี้): http://localhost:3000
echo [2] For Friends (เพื่อนร่วม WiFi เดียวกัน): http://10.194.2.210:3000
echo.
echo กดเปิด Browser ให้โดยอัตโนมัติ...
start http://localhost:3000
node server.js
pause
