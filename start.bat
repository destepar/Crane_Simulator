@echo off
cd /d "%~dp0"
title Lanzador Crane Simulator 3D
echo ========================================================
echo   Iniciando Crane Simulator (Liebherr LTM 1110)...
echo ========================================================
echo.

start http://localhost:8080/
python -m http.server 8080
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [AVISO] Puerto 8080 no disponible, probando puerto 8000...
    start http://localhost:8000/
    python -m http.server 8000
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo [ERROR] No se pudo levantar el servidor HTTP local.
        pause
    )
)
