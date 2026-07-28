@echo off
cd /d "%~dp0"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-intellidesk.ps1"

if errorlevel 1 (
    echo.
    echo IntelliDesk baslatilirken hata olustu.
    pause
)