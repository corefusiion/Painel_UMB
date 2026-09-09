import os
import sqlite3
import json
from loguru import logger
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from api.routes.ml import get_db_path, get_model_paths, train_random_forest_task

def auto_train_ml():
    """Gatilho de Treinamento Inteligente com Validação de Threshold."""
    try:
        db_path = get_db_path()
        _, metrics_path, _ = get_model_paths()
        
        # 1. Recupera o total de amostras usadas no último treino (do arquivo rf_metrics.json)
        last_samples = 0
        if os.path.exists(metrics_path):
            with open(metrics_path, 'r') as f:
                metrics = json.load(f)
                last_samples = metrics.get('samples_used', 0)
                
        # 2. Conta quantas OSs concluídas existem no banco neste exato momento
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        # Query idêntica à de extração de treino
        cursor.execute("SELECT COUNT(*) FROM solicitacoes WHERE situacao IS NOT NULL AND situacao != '' AND situacao NOT IN ('ABERTA', 'PROGRAMADA')")
        current_samples = cursor.fetchone()[0]
        conn.close()
        
        # 3. Calcula o Delta (Volume de Novos Dados Injetados)
        novos_dados = current_samples - last_samples
        
        # 4. Validação de Threshold (Evitar processamento à toa)
        if novos_dados < 100:
            logger.info(f"[AUTO-ML] Treino ignorado: Volume insuficiente de novos dados ({novos_dados} novas OSs). Limiar é 100.")
            print(f"[AUTO-ML] Treino ignorado: Volume insuficiente de novos dados ({novos_dados} novas OSs).")
            return
            
        # 5. Threshold Atingido: Disparar Treinamento
        logger.info(f"[AUTO-ML] Limiar atingido! {novos_dados} novos registros na base. Iniciando treinamento pesado...")
        print(f"[AUTO-ML] Limiar atingido! {novos_dados} novos registros. Iniciando treinamento...")
        
        # Dispara a função do Scikit-Learn importada do ml.py
        train_random_forest_task()
        
    except Exception as e:
        logger.error(f"[AUTO-ML ERROR] Falha no gatilho de validação: {e}")
        print(f"[AUTO-ML ERROR] {e}")

def start_scheduler():
    """Inicializa o APScheduler."""
    scheduler = AsyncIOScheduler()
    
    # Adiciona a rotina pesada de treinamento apenas 1x ao dia às 03:00 AM
    scheduler.add_job(auto_train_ml, 'cron', hour=3, minute=0, id='diario_ml_training', replace_existing=True)
    
    # Inicia o relógio
    scheduler.start()
    logger.info("[SCHEDULER] APScheduler iniciado. Tarefa [AUTO-ML] agendada para rodar diariamente às 03:00 AM.")
    return scheduler
