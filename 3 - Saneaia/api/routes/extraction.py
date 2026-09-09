# -*- coding: utf-8 -*-
"""
UMBMAS - Rotas da Central de Extração e Logs RUM (FastAPI)
=========================================================
Fornece APIs REST e streaming SSE (Server-Sent Events) para controle total
das rotinas de extração, logs em tempo real, monitoramento de impacto no SQLite,
histórico de execuções e agendador automático.
"""

import json
import asyncio
from typing import Optional
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from api.extraction_manager import extraction_manager, ROUTINE_NAMES

router = APIRouter(prefix="/api/extraction", tags=["Extração e Logs RUM"])


class StartExtractionRequest(BaseModel):
    routine: str = Field(..., description="Nome da rotina: ciclo_completo, executadas, pendencias, detalhes_isolado, preditiva")
    dt_inicio: Optional[str] = Field(None, description="Data de início (DD/MM/AAAA)")
    dt_fim: Optional[str] = Field(None, description="Data final (DD/MM/AAAA)")
    headless: bool = Field(True, description="Execução oculta em segundo plano")


class SchedulerConfigRequest(BaseModel):
    enabled: bool = Field(..., description="Ativar ou desativar o agendador automático")
    interval_minutes: int = Field(60, ge=5, le=1440, description="Intervalo em minutos entre execuções")
    routine: str = Field("ciclo_completo", description="Rotina a ser executada no agendador")


@router.get("/status")
async def get_extraction_status():
    """Retorna o status atual do sistema de extração, job ativo e agendador."""
    return extraction_manager.get_status()


@router.post("/start")
async def start_extraction(payload: StartExtractionRequest):
    """Inicia uma rotina de extração em segundo plano."""
    if payload.routine not in ROUTINE_NAMES:
        raise HTTPException(
            status_code=400,
            detail=f"Rotina inválida: '{payload.routine}'. Opções válidas: {list(ROUTINE_NAMES.keys())}"
        )

    if extraction_manager.is_running():
        raise HTTPException(
            status_code=409,
            detail="Já existe uma extração em andamento. Aguarde a conclusão ou solicite o cancelamento."
        )

    try:
        job = extraction_manager.start_job(
            routine=payload.routine,
            dt_inicio=payload.dt_inicio,
            dt_fim=payload.dt_fim,
            headless=payload.headless
        )
        return {
            "status": "success",
            "message": f"Rotina '{job.get('routine_name')}' iniciada com sucesso.",
            "job": job
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stop")
async def stop_extraction():
    """Cancela a rotina de extração atualmente em execução."""
    if not extraction_manager.is_running():
        return {"status": "idle", "message": "Nenhuma extração ativa para cancelar."}

    res = extraction_manager.stop_job()
    return res


@router.get("/stream")
async def stream_extraction_logs(request: Request):
    """
    Streaming SSE (Server-Sent Events) de logs, progresso e impacto em tempo real.
    Transmite eventos instantâneos para o terminal no navegador.
    """
    # Garantir que o loop assíncrono esteja configurado no manager
    loop = asyncio.get_running_loop()
    extraction_manager.set_async_loop(loop)

    queue = extraction_manager.subscribe()

    async def event_generator():
        try:
            # 1. Enviar estado inicial imediatamente na conexão
            status = extraction_manager.get_status()
            initial_event = {
                "type": "initial_state",
                "status": status
            }
            yield f"data: {json.dumps(initial_event, ensure_ascii=False)}\n\n"

            # 2. Escutar e despachar novos eventos da fila
            while True:
                # Verificar se o cliente fechou a conexão
                if await request.is_disconnected():
                    break

                try:
                    # Timeout de 15s para emitir keep-alive ping se ocioso
                    event_data = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield f"data: {json.dumps(event_data, ensure_ascii=False)}\n\n"
                except asyncio.TimeoutError:
                    # Ping keep-alive para não derrubar proxies ou navegadores
                    yield ": keepalive\n\n"

        except asyncio.CancelledError:
            pass
        finally:
            extraction_manager.unsubscribe(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@router.get("/history")
async def get_extraction_history(limit: int = 50):
    """Retorna os últimos N registros do histórico de execuções."""
    history = extraction_manager.get_history(limit=limit)
    return {
        "total": len(history),
        "history": history
    }


@router.get("/history/{history_id}/logs")
async def get_historical_logs(history_id: int):
    """Retorna o log bruto completo de uma execução passada."""
    logs = extraction_manager.get_history_logs(history_id)
    return {
        "id": history_id,
        "logs": logs
    }


@router.get("/scheduler")
async def get_scheduler():
    """Retorna a configuração e próximo disparo do agendador automático."""
    status = extraction_manager.get_status()
    return status.get("scheduler", {})


@router.post("/scheduler")
async def configure_scheduler(config: SchedulerConfigRequest):
    """Ativa/desativa ou altera a periodicidade do agendador automático."""
    if config.routine not in ROUTINE_NAMES:
        raise HTTPException(
            status_code=400,
            detail=f"Rotina inválida: '{config.routine}'. Opções válidas: {list(ROUTINE_NAMES.keys())}"
        )

    extraction_manager.set_scheduler(
        enabled=config.enabled,
        interval_minutes=config.interval_minutes,
        routine=config.routine
    )
    return {
        "status": "success",
        "message": f"Agendador {'ativado' if config.enabled else 'desativado'} com sucesso.",
        "scheduler": extraction_manager.get_status().get("scheduler")
    }


@router.get("/db-snapshot")
async def get_db_snapshot():
    """Retorna a contagem de registros atual de cada tabela em ambos os bancos SQLite."""
    snapshot = extraction_manager.get_database_snapshot()
    return {
        "status": "success",
        "databases": snapshot
    }
