@echo off
cd /d "%~dp0"
title Lanzador Crane Simulator 3D
echo ========================================================
echo   Iniciando Crane Simulator (Liebherr LTM 1110)...
echo ========================================================
echo.

start http://localhost:8000/
python -m http.server 8000
