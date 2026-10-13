@echo off
title WILOTECH OS — Laboratorio Tecnico & Comparador
color 0b
echo =====================================================================
echo           WILOTECH OS — Servidor Local de Laboratorio
echo =====================================================================
echo.
echo [*] Verificando entorno de Python...

if exist "%LOCALAPPDATA%\Programs\Python\Python311\python.exe" (
    "%LOCALAPPDATA%\Programs\Python\Python311\python.exe" run.py
) else (
    python run.py
)

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [!] Hubo un error al iniciar el servidor.
    pause
)
