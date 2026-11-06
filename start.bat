@echo off
cd /d "%~dp0"
title Lanzador Crane Simulator 3D - Terminal Logistico
echo ========================================================
echo   Iniciando Crane Simulator 3D (Escala Real 1:1)...
echo ========================================================
echo.

start http://localhost:8000/
python -m http.server 8000
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [AVISO] Puerto 8000 en uso, intentando puerto 8080...
    start http://localhost:8080/
    python -m http.server 8080
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo [ERROR] No se pudo iniciar el servidor local.
        pause
    )
)
