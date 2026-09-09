@echo off
title UMBMAS - Webhook Receiver (Porta 3002)
cd /d "%~dp0"
echo ===================================================
echo   INICIANDO WEBHOOK RECEIVER EMBASA (PORTA 3002)
echo ===================================================
echo.

set "VENV_PY=%~dp0..\3 - Saneaia\venv\Scripts\python.exe"
if exist "%VENV_PY%" (
    echo [+] Executando com ambiente virtual Python...
    "%VENV_PY%" listener_recebimento.py
    goto fim
)

set "VENV_PY2=%~dp0..\3 - Saneaia\.venv\Scripts\python.exe"
if exist "%VENV_PY2%" (
    echo [+] Executando com .venv Python...
    "%VENV_PY2%" listener_recebimento.py
    goto fim
)

echo [+] Executando com Python padrao do sistema...
python listener_recebimento.py

:fim
echo.
echo Servidor encerrado.
pause
