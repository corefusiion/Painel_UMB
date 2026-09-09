"""
Plataforma de Inteligência Operacional para Saneamento
=====================================================
API Principal - FastAPI

Endpoints:
  /api/solicitacoes     - CRUD e filtros de solicitações
  /api/analytics/*      - KPIs, análises por bairro, temporal, tipo, setor
  /api/agent/*          - Chat, insights, análise NLP
  /api/ml/*             - Predições, re-treinamento, métricas do modelo
  /health               - Health check
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager
import os
from loguru import logger

from config.settings import get_settings
from database.connection import test_connection
from api.routes import solicitacoes, agent, integrations, ml, extraction


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup e shutdown da aplicação."""
    logger.info("=" * 60)
    logger.info("Plataforma de Inteligencia Operacional - Saneamento (SaneaIA)")
    logger.info("Desenvolvido por: Gleisson Santos - Embasa UMB")
    logger.info("=" * 60)

    # Testar conexão com o banco
    db_ok = test_connection()
    app.state.db_healthy = db_ok

    logger.info(f"Banco de dados: {'Conectado' if db_ok else 'Falha'}")
    logger.info(f"Modelo LLM: {get_settings().openrouter_model}")
    logger.info(f"Servidor: http://{get_settings().app_host}:{get_settings().app_port}")
    logger.info("=" * 60)

    # Iniciar o Agendador Inteligente de Treinamento
    from api.scheduler_jobs import start_scheduler
    scheduler = start_scheduler()

    yield

    # Desligamento Gracioso do Agendador
    if scheduler:
        scheduler.shutdown()
        logger.info("[SCHEDULER] APScheduler finalizado.")

    logger.info("Servidor encerrado.")


# --- App ---
app = FastAPI(
    title="Plataforma de Inteligência Operacional - Saneamento",
    description=(
        "API para análise inteligente de solicitações de serviço de saneamento. "
        "Integra Machine Learning, NLP e Agente de IA (DeepSeek) para geração "
        "de insights operacionais e recomendações estratégicas."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

import sys
import traceback
from fastapi.responses import JSONResponse

# Forçar stdout e stderr em UTF-8 no Windows
try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    print(f"[GLOBAL EXCEPTION] {exc}")
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"error": str(exc), "status": "internal_error"},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        }
    )

# --- Static Files ---
static_dir = os.path.join(os.path.dirname(__file__), "static")
app.mount("/static", StaticFiles(directory=static_dir), name="static")

# --- Rotas ---
app.include_router(solicitacoes.router)
app.include_router(agent.router)
# app.include_router(predictions.router)
app.include_router(integrations.router)
app.include_router(ml.router)
app.include_router(extraction.router)


# --- Health Check ---
@app.get("/health", tags=["Sistema"])
async def health_check():
    """Verifica saúde da aplicação."""
    settings = get_settings()
    return {
        "status": "healthy",
        "database": getattr(app.state, "db_healthy", False),
        "llm_model": settings.openrouter_model,
        "version": "1.0.0",
        "environment": settings.app_env,
    }


@app.get("/", tags=["Sistema"])
async def root():
    """Serve o Dashboard."""
    return FileResponse(
        os.path.join(static_dir, "index.html"),
        headers={"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"}
    )


def free_port_if_occupied(target_port: int):
    """Garante que a porta seja liberada de processos zumbis anteriores antes de iniciar (previne WinError 10048)."""
    import subprocess
    import time
    my_pid = os.getpid()
    try:
        output = subprocess.check_output("netstat -ano", shell=True, text=True, errors="ignore")
        for line in output.splitlines():
            line = line.strip()
            if not line:
                continue
            parts = line.split()
            if len(parts) >= 5 and parts[0].upper() == "TCP":
                local_addr = parts[1]
                state = parts[3]
                pid_str = parts[4]
                if state.upper() == "LISTENING" and local_addr.endswith(f":{target_port}"):
                    try:
                        pid = int(pid_str)
                        if pid != my_pid and pid != 0:
                            logger.warning(f"[AUTO-PORT] Porta {target_port} ocupada pelo processo residual {pid}. Liberando...")
                            subprocess.run(f"taskkill /F /PID {pid}", shell=True, capture_output=True)
                            time.sleep(1)
                    except Exception:
                        pass
    except Exception as e:
        logger.debug(f"[AUTO-PORT] Verificação de porta: {e}")


# --- Entry Point ---
if __name__ == "__main__":
    import uvicorn

    settings = get_settings()
    base_dir = os.path.dirname(__file__)

    # Auto-liberar a porta configurada se houver processo residual preso
    free_port_if_occupied(settings.app_port)

    uvicorn.run(
        app,
        host=settings.app_host,
        port=settings.app_port,
    )
