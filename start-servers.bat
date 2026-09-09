@echo off
title UMBMAS - Inicializador do Ecossistema
echo ===================================================
echo   PAINEL OPERACIONAL UMB ^& SANEAIA
echo   Desenvolvido por: Gleisson Santos - Embasa UMB
echo ===================================================
echo.

:: Localizar interpretador Python do ecossistema
set "PY_EXE="
if exist "%~dp03 - Saneaia\venv\Scripts\python.exe" (
    set "PY_EXE=%~dp03 - Saneaia\venv\Scripts\python.exe"
) else if exist "%~dp03 - Saneaia\.venv\Scripts\python.exe" (
    set "PY_EXE=%~dp03 - Saneaia\.venv\Scripts\python.exe"
) else (
    set "PY_EXE=python"
)

:: 0. Liberar portas que possam ter ficado presas por execuções anteriores (evita erro Errno 10048 / EADDRINUSE)
"%PY_EXE%" "%~dp02 - extracao_pendencias\liberar_portas.py"
echo.

:: 1. Backend do GestaoUMB (Express + SQLite)
echo [+] Iniciando GestaoUMB Backend (Express na porta 3001)...
start "GestaoUMB - Backend (Express - Porta 3001)" /D "%~dp01 - gestoaumb" cmd /c "npm run server"
timeout /t 2 /nobreak >nul

:: 2. Frontend do GestaoUMB (Vite)
echo [+] Iniciando GestaoUMB Frontend (Vite na porta 8080)...
start "GestaoUMB - Frontend (Vite - Porta 8080)" /D "%~dp01 - gestoaumb" cmd /c "npm run dev"
timeout /t 2 /nobreak >nul

:: 3. Backend SaneaIA (FastAPI + ML/NLP)
echo [+] Iniciando SaneaIA Backend (FastAPI na porta 8000)...
start "SaneaIA - Backend (FastAPI - Porta 8000)" /D "%~dp03 - Saneaia" cmd /k ""%PY_EXE%" main.py"
timeout /t 2 /nobreak >nul

:: 4. Webhook Recebimento Embasa (Python na porta 3002)
echo [+] Iniciando Webhook Recebimento (Python na porta 3002)...
start "UMBMAS - Webhook Receiver (Porta 3002)" /D "%~dp02 - extracao_pendencias" cmd /k "iniciar_webhook.bat"
timeout /t 3 /nobreak >nul

:: 5. Abrir Emulador de Teste no Navegador
echo [+] Abrindo Emulador de Webhook no navegador...
start http://localhost:8080/testar-webhook.html

echo.
echo ===================================================
echo   Todos os servicos foram iniciados com sucesso!
echo.
echo   - Dashboard Principal : http://localhost:8080
echo   - Emulador de Testes  : http://localhost:8080/testar-webhook.html
echo   - Backend Gestao (API): http://localhost:3001
echo   - SaneaIA API / ML    : http://localhost:8000
echo   - Webhook Embasa      : http://localhost:8080/webhook (ou :3002)
echo.
echo   [EXPURGO DE TESTES]
echo   - No navegador: Clique em "EXPURGAR DADOS DE TESTE" no emulador.
echo   - No terminal : Execute limpar-dados-teste.bat na raiz.
echo.
echo   [ENCERRAMENTO DE SERVICOS]
echo   - Feche as janelas individuais do terminal, ou
echo   - Execute stop-servers.bat na raiz para desligamento automatico.
echo ===================================================
echo.
pause
