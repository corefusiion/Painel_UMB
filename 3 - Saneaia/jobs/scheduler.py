"""Scheduler para tarefas periódicas."""

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from ml.pipeline import run_training_pipeline
from agent.analyzer import get_analyzer


scheduler = AsyncIOScheduler()


async def job_generate_insights():
    """Job: Gera insights automaticamente."""
    print("⏰ [JOB] Gerando insights automáticos...")
    try:
        analyzer = get_analyzer()
        await analyzer.generate_and_save_insights()
        print("✅ [JOB] Insights gerados com sucesso")
    except Exception as e:
        print(f"❌ [JOB] Erro ao gerar insights: {e}")


def job_retrain_model():
    """Job: Re-treina o modelo ML."""
    print("⏰ [JOB] Iniciando re-treinamento do modelo...")
    try:
        metrics = run_training_pipeline()
        print(f"✅ [JOB] Modelo re-treinado: {metrics}")
    except Exception as e:
        print(f"❌ [JOB] Erro no re-treinamento: {e}")


def setup_scheduler():
    """Configura os jobs periódicos."""
    # Gerar insights a cada 6 horas
    scheduler.add_job(
        job_generate_insights,
        "interval",
        hours=6,
        id="generate_insights",
        replace_existing=True,
    )

    # Re-treinar modelo semanalmente (segunda-feira às 3h)
    scheduler.add_job(
        job_retrain_model,
        "cron",
        day_of_week="mon",
        hour=3,
        id="retrain_model",
        replace_existing=True,
    )

    scheduler.start()
    print("📅 Scheduler configurado: insights a cada 6h, re-treino semanal")


def shutdown_scheduler():
    """Para o scheduler."""
    scheduler.shutdown()
