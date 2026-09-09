"""Pipeline completo de Machine Learning."""

import pandas as pd
from database.connection import get_supabase_client
from ml.preprocessing import preprocess_data, clean_for_model
from ml.features import engineer_features
from ml.training import train_model, save_model, load_model
from ml.prediction import predict


def run_training_pipeline(version: str = "v1.0") -> dict:
    """
    Executa o pipeline completo de treinamento.

    Returns:
        Dict com métricas do modelo treinado
    """
    print("=" * 60)
    print("🚀 PIPELINE ML - MODO TREINAMENTO")
    print("=" * 60)

    # 1. Coleta via REST API
    print("\n📥 Fase 1: Coleta de Dados")
    supabase = get_supabase_client()
    df = supabase.fetch_all_paginated("solicitacoes_analise")
    print(f"   {df.shape[0]} registros coletados")

    if df.empty:
        print("❌ Nenhum dado encontrado. Abortando.")
        return {"error": "No data"}

    # 2. Pré-processamento
    print("\n🧹 Fase 2: Pré-processamento")
    processed = preprocess_data(df)

    # 3. Limpeza para modelo
    print("\n🗑️ Fase 3: Limpeza para modelo")
    cleaned = clean_for_model(processed)

    # 4. Engenharia de features
    print("\n⚙️ Fase 4: Engenharia de Features")
    features = engineer_features(cleaned)

    # 5. Treinamento
    print("\n🎯 Fase 5: Treinamento")
    model, feature_names, metrics = train_model(features)

    if model is None:
        print("❌ Falha no treinamento.")
        return {"error": "Training failed"}

    # 6. Salvar modelo
    print("\n💾 Fase 6: Salvando Modelo")
    save_model(model, feature_names, version)

    print("\n" + "=" * 60)
    print("✅ PIPELINE CONCLUÍDO COM SUCESSO")
    print("=" * 60)

    return metrics


def run_prediction_pipeline(new_data: pd.DataFrame = None, version: str = None) -> pd.DataFrame:
    """
    Executa o pipeline de predição.

    Args:
        new_data: Novos dados para predição. Se None, usa dados do banco.
        version: Versão do modelo.

    Returns:
        DataFrame com predições
    """
    print("=" * 60)
    print("🔮 PIPELINE ML - MODO PREDIÇÃO")
    print("=" * 60)

    if new_data is None:
        supabase = get_supabase_client()
        new_data = supabase.fetch_dataframe("solicitacoes_analise", {
            "limit": "100",
            "order": "created_at.desc",
        })

    results = predict(new_data, version)

    print("\n" + "=" * 60)
    print("✅ PREDIÇÕES CONCLUÍDAS")
    print("=" * 60)

    return results


# CLI
if __name__ == "__main__":
    import sys

    mode = sys.argv[1] if len(sys.argv) > 1 else "train"

    if mode == "train":
        metrics = run_training_pipeline()
        print(f"\nMétricas: {metrics}")
    elif mode == "predict":
        results = run_prediction_pipeline()
        print(f"\nResultados: {results.head()}")
    else:
        print("Uso: python -m ml.pipeline [train|predict]")
