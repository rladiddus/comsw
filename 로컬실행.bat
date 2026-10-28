@echo off
chcp 65001 >nul
cd /d "%~dp0"
start "" http://localhost:8787/admin/
start "" http://localhost:8787/admin-v2/
node scripts\preview-server.mjs
pause
