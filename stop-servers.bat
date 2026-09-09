@echo off
title UMBMAS - Encerrar Servicos
echo ===================================================
echo   PAINEL OPERACIONAL UMB ^& SANEAIA
echo   Desenvolvido por: Gleisson Santos - Embasa UMB
echo ===================================================
echo.
echo [*] Encerrando processos e liberando portas do ecossistema...
echo.

set "PY_EXE="
if exist "%~dp03 - Saneaia\venv\Scripts\python.exe" (
    set "PY_EXE=%~dp03 - Saneaia\venv\Scripts\python.exe"
) else if exist "%~dp03 - Saneaia\.venv\Scripts\python.exe" (
    set "PY_EXE=%~dp03 - Saneaia\.venv\Scripts\python.exe"
) else (
    set "PY_EXE=python"
)

"%PY_EXE%" "%~dp02 - extracao_pendencias\liberar_portas.py"

echo.
echo ===================================================
echo Pressione qualquer tecla para fechar esta janela...
pause >nul
