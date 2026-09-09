"""Engenharia de features avancada para predicao de reincidencia."""

import pandas as pd
import numpy as np


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """Cria features para modelo de reincidencia de infraestrutura."""
    if df.empty:
        return df

    df = df.copy()

    # --- 1. Frequencia por bairro ---
    if "bairro" in df.columns:
        df["frequencia_bairro"] = df["bairro"].map(df["bairro"].value_counts())

    # --- 2. Frequencia por tipo ---
    if "tipo" in df.columns:
        df["frequencia_tipo"] = df["tipo"].map(df["tipo"].value_counts())

    # --- 3. Frequencia por setor ---
    if "setor" in df.columns:
        df["frequencia_setor"] = df["setor"].map(df["setor"].value_counts())

    # --- 4. Frequencia por matricula ---
    if "matricula" in df.columns:
        df["frequencia_matricula"] = df["matricula"].map(df["matricula"].value_counts())

    # --- 5. Interacao: tempo resolucao x reincidencia ---
    if "tempo_resolucao_horas" in df.columns and "count_reincidencia_matricula_90d" in df.columns:
        df["resolucao_x_reincidencia"] = (
            df["tempo_resolucao_horas"] * df["count_reincidencia_matricula_90d"]
        )

    # --- 6. Ratio de velocidade de resolucao ---
    if "tempo_resolucao_horas" in df.columns:
        median_tempo = df["tempo_resolucao_horas"].median()
        if median_tempo > 0:
            df["ratio_velocidade_resolucao"] = df["tempo_resolucao_horas"] / median_tempo
        else:
            df["ratio_velocidade_resolucao"] = 1

    # --- 7. Score de risco do local ---
    if all(c in df.columns for c in ["freq_localizacao", "count_reincidencia_matricula_90d"]):
        df["score_risco_local"] = (
            df["freq_localizacao"] * 0.4 +
            df["count_reincidencia_matricula_90d"] * 0.6
        )

    # --- 8. Periodo do dia ---
    if "hora_encerramento" in df.columns:
        df["periodo_dia"] = pd.cut(
            df["hora_encerramento"],
            bins=[-1, 6, 12, 18, 24],
            labels=[0, 1, 2, 3],
        ).astype(float).fillna(0).astype(int)

    # --- 9. Encoding categorico ---
    categorical_cols = []
    for col in ["tipo", "bairro", "setor", "localidade", "unidade_os", "categoria_tecnica"]:
        if col in df.columns:
            # Limitar cardinalidade (top 30 + 'OUTROS')
            top = df[col].value_counts().nlargest(30).index.tolist()
            df[col] = df[col].apply(lambda x: x if x in top else "OUTROS")
            categorical_cols.append(col)

    if categorical_cols:
        df = pd.get_dummies(df, columns=categorical_cols, drop_first=True, dtype=int)

    # --- 10. Remover matricula (usada para calcular features, nao para modelo) ---
    if "matricula" in df.columns:
        df = df.drop(columns=["matricula"])

    # --- 11. Garantir apenas numericas ---
    non_numeric = df.select_dtypes(exclude=[np.number]).columns.tolist()
    if non_numeric:
        df = df.drop(columns=non_numeric, errors="ignore")

    df = df.fillna(0)

    # Remover colunas com variancia zero
    zero_var = [c for c in df.columns if df[c].nunique() <= 1]
    if zero_var:
        df = df.drop(columns=zero_var)

    print(f"Engenharia de features: {df.shape[1]} features")
    return df
