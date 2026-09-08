@echo off
title AutoPrice Pro - Comparador de Precios de Repuestos
cd /d "%~dp0"

echo =======================================================================
echo          AutoPrice Pro - Comparador de Repuestos Multidistribuidora
echo =======================================================================
echo.

set "PY_BIN="
if exist "%LOCALAPPDATA%\Programs\Python\Python311\python.exe" (
    set "PY_BIN=%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
) else (
    where python >nul 2>nul
    if %errorlevel% equ 0 (
        set "PY_BIN=python"
    )
)

if "%PY_BIN%"=="" (
    echo [ERROR] No se encontro el ejecutable de Python.
    echo Por favor asegurese de tener Python 3.11 instalado.
    pause
    exit /b 1
)

echo [*] Utilizando Python: %PY_BIN%
echo [*] Iniciando servidor y abriendo navegador web...
echo.

"%PY_BIN%" run.py

if %errorlevel% neq 0 (
    echo.
    echo [!] El servidor se detuvo con codigo de error %errorlevel%.
    pause
)
