@echo off
chcp 65001 >nul
cd /d "%~dp0"
start "" http://localhost:8787/admin/
node scripts\preview-server.mjs
pause
