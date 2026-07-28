@echo off
cd /d "%~dp0"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop-intellidesk.ps1"

if errorlevel 1 (
    echo.
    echo IntelliDesk kapatilirken hata olustu.
    pause
)