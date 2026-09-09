@echo off
title UMBMAS - Expurgo de Dados de Teste

echo ===================================================
echo   EXPURGO BLINDADO DE DADOS DE TESTE / HOMOLOGACAO
echo ===================================================
echo.

set "PY_EXE="
if exist "%~dp03 - Saneaia\venv\Scripts\python.exe" (
    set "PY_EXE=%~dp03 - Saneaia\venv\Scripts\python.exe"
) else if exist "%~dp03 - Saneaia\.venv\Scripts\python.exe" (
    set "PY_EXE=%~dp03 - Saneaia\.venv\Scripts\python.exe"
) else (
    set "PY_EXE=python"
)

"%PY_EXE%" "%~dp02 - extracao_pendencias\limpar_testes.py"

pause
