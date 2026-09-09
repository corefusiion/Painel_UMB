"""Rotas de predições e modelo ML."""

from fastapi import APIRouter
from api.models import RetrainRequest
from database.connection import get_supabase_client
from ml.pipeline import run_training_pipeline, run_prediction_pipeline

router = APIRouter(prefix="/api/ml", tags=["Machine Learning"])


@router.get("/predictions")
async def list_predictions(limit: int = 50):
    """Lista predições ML recentes."""
    supabase = get_supabase_client()
    data = await supabase.get("predicoes_ml", {
        "order": "created_at.desc",
        "limit": str(limit),
    })
    return {"data": data}


@router.post("/predict")
async def run_predictions(limit: int = 100):
    """Executa predições ML em dados recentes."""
    supabase = get_supabase_client()
    df = supabase.fetch_dataframe("solicitacoes_analise", {
        "order": "created_at.desc",
        "limit": str(limit),
    })

    if df.empty:
        return {"error": "Nenhum dado disponível para predição"}

    results = run_prediction_pipeline(df)

    # Preparar dados para salvar
    predictions_to_save = []
    for _, row in results.iterrows():
        pred = {
            "solicitacao_id": str(row.get("id", "")),
            "score_prioridade": float(row.get("score_prioridade", 0)),
            "probabilidade_reincidencia": float(row.get("probabilidade_resolucao", 0)),
            "classificacao_prevista": str(row.get("classificacao_label", "")),
        }
        predictions_to_save.append(pred)

    # Salvar no Supabase em lotes
    saved_count = 0
    for i in range(0, min(len(predictions_to_save), 50), 10):
        batch = predictions_to_save[i:i + 10]
        try:
            await supabase.post("predicoes_ml", batch)
            saved_count += len(batch)
        except Exception as e:
            print(f"Erro ao salvar predição: {e}")

    return {
        "total_predicted": len(results),
        "total_saved": saved_count,
        "sample": predictions_to_save[:5],
    }


@router.post("/retrain")
async def retrain_model(request: RetrainRequest):
    """Re-treina o modelo ML."""
    try:
        metrics = run_training_pipeline(version=request.version)

        if metrics and "error" not in metrics:
            supabase = get_supabase_client()
            metrics_data = {
                "modelo_versao": request.version,
                "accuracy": metrics.get("accuracy"),
                "precision_score": metrics.get("precision"),
                "recall_score": metrics.get("recall"),
                "f1_score": metrics.get("f1_score"),
                "total_samples": metrics.get("total_samples"),
                "features_count": metrics.get("features_count"),
                "notas": f"Modelo: {request.model_type}",
            }
            try:
                await supabase.post("ml_model_metrics", metrics_data)
            except Exception:
                pass

        return {"status": "success", "metrics": metrics}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.get("/model-metrics")
async def get_model_metrics():
    """Retorna histórico de métricas do modelo."""
    supabase = get_supabase_client()
    data = await supabase.get("ml_model_metrics", {
        "order": "training_date.desc",
        "limit": "10",
    })
    return {"data": data}
