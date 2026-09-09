"""Módulo de predição usando modelos treinados."""

import pandas as pd
import numpy as np
from ml.preprocessing import preprocess_data, clean_for_model
from ml.features import engineer_features
from ml.training import load_model


def predict(df: pd.DataFrame, version: str = None) -> pd.DataFrame:
    """
    Faz predições em novos dados usando o modelo treinado.

    Args:
        df: DataFrame com dados brutos (formato da tabela solicitacoes)
        version: Versão do modelo a usar (None = latest)

    Returns:
        DataFrame original com colunas de predição adicionadas
    """
    if df.empty:
        print("❌ DataFrame vazio para predição.")
        return df

    # Carregar modelo
    model, feature_names = load_model(version)

    # Guardar dados originais
    original_df = df.copy()

    # Processar dados
    processed = preprocess_data(df.copy())
    processed = clean_for_model(processed)
    features_df = engineer_features(processed.copy())

    # Alinhar colunas com as do treinamento
    for col in feature_names:
        if col not in features_df.columns:
            features_df[col] = 0

    extra_cols = set(features_df.columns) - set(feature_names)
    features_df = features_df.drop(columns=list(extra_cols), errors="ignore")
    features_df = features_df[feature_names]

    # Predições
    predictions = model.predict(features_df)
    probabilities = model.predict_proba(features_df)

    # Adicionar resultados ao DataFrame original
    original_df["classificacao_prevista"] = predictions
    original_df["classificacao_label"] = [
        "Resolvido" if p == 1 else "Em Aberto" for p in predictions
    ]

    # Probabilidade da classe positiva (resolvido)
    if probabilities.shape[1] > 1:
        original_df["probabilidade_resolucao"] = probabilities[:, 1]
    else:
        original_df["probabilidade_resolucao"] = probabilities[:, 0]

    # Score de prioridade (inversamente proporcional à prob de resolução)
    original_df["score_prioridade"] = (
        (1 - original_df["probabilidade_resolucao"]) * 100
    ).round(2)

    print(f"✅ {len(original_df)} predições realizadas")
    return original_df
