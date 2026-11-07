@echo off
cd /d "%~dp0"
title Servidor Local Crane Simulator 3D
cls
echo ====================================================================
echo   CRANE SIMULATOR 3D (Liebherr LTM 1110 + UH-60) - SERVIDOR LOCAL
echo ====================================================================
echo.
echo   [AVISO] Servidor configurado con recarga en vivo (NO-CACHE) para
echo   cargar siempre la ultima version de HTML, JS, CSS y Assets 3D.
echo.
echo   NO CIERRES esta ventana negra mientras uses el simulador.
echo ====================================================================
echo.

set PYTHON_CMD=

where python >nul 2>&1
if %ERRORLEVEL% EQU 0 set PYTHON_CMD=python

if "%PYTHON_CMD%"=="" (
    where py >nul 2>&1
    if %ERRORLEVEL% EQU 0 set PYTHON_CMD=py
)

if "%PYTHON_CMD%"=="" (
    if exist "C:\Users\Daniel\AppData\Local\Programs\Python\Python313\python.exe" (
        set PYTHON_CMD="C:\Users\Daniel\AppData\Local\Programs\Python\Python313\python.exe"
    )
)

if "%PYTHON_CMD%"=="" (
    echo [ERROR CRITICO] No se encontro Python en el sistema.
    echo Por favor asegurate de tener Python instalado.
    pause
    exit /b 1
)

echo Iniciando servidor sin cache...
%PYTHON_CMD% scripts/server_nocache.py 8888

pause
