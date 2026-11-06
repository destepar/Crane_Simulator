@echo off
cd /d "%~dp0"
title Servidor Local Crane Simulator 3D
cls
echo ====================================================================
echo   CRANE SIMULATOR 3D (Liebherr LTM 1110) - SERVIDOR LOCAL
echo ====================================================================
echo.
echo   [AVISO] Los navegadores (Chrome/Edge) BLOQUEAN los modelos 3D y 
echo   modulos JS si se abre 'index.html' directamente con doble clic.
echo   Por eso DEBE abrirse a traves de este servidor (http://localhost:8888).
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

echo Iniciando servidor en puerto 8888...
start http://localhost:8888/
%PYTHON_CMD% -m http.server 8888

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [AVISO] Puerto 8888 ocupado, intentando puerto 8000...
    start http://localhost:8000/
    %PYTHON_CMD% -m http.server 8000
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo [ERROR] No se pudo levantar el servidor en el puerto 8000 ni 8888.
        pause
    )
)

pause
