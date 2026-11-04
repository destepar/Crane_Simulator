@echo off
title Lanzador Crane Simulator 3D
echo ========================================================
echo   Iniciando Crane Simulator (Liebherr LTM 1110)...
echo ========================================================
echo.

:: Abre el navegador directamente a la URL local
start http://localhost:8000/

:: Inicia el servidor HTTP de Python en el puerto 8000
python -m http.server 8000
