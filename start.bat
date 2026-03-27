@echo off
chcp 65001 >nul
title NodeNotes — Local Server
cd /d "%~dp0"

echo ============================================
echo   NodeNotes — запуск локального сервера
echo ============================================
echo.

:: Пробуем py (Python Launcher for Windows — стандартный способ)
py --version >nul 2>&1
if %errorlevel% == 0 (
    echo [OK] Python найден. Запуск сервера на http://localhost:8080
    echo      Нажмите Ctrl+C чтобы остановить.
    echo.
    timeout /t 2 /nobreak >nul
    start "" "http://localhost:8080"
    py -m http.server 8080
    goto :end
)

:: Пробуем python
python --version >nul 2>&1
if %errorlevel% == 0 (
    echo [OK] Python найден. Запуск сервера на http://localhost:8080
    echo      Нажмите Ctrl+C чтобы остановить.
    echo.
    timeout /t 2 /nobreak >nul
    start "" "http://localhost:8080"
    python -m http.server 8080
    goto :end
)

:: Пробуем npx (Node.js)
where npx >nul 2>&1
if %errorlevel% == 0 (
    echo [OK] Node.js найден. Запуск сервера на http://localhost:8080
    echo      Нажмите Ctrl+C чтобы остановить.
    echo.
    timeout /t 3 /nobreak >nul
    start "" "http://localhost:8080"
    npx -y serve -l 8080 .
    goto :end
)

echo [ОШИБКА] Python или Node.js не найден!
echo.
echo Установите один из:
echo   Python : https://www.python.org/downloads/
echo   Node.js: https://nodejs.org/
echo.

:end
pause
