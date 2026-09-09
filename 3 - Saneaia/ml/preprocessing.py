"""Pre-processamento avancado para pipeline ML de reincidencia."""

import pandas as pd
import numpy as np
from collections import Counter, defaultdict
from agent.nlp import categorize_technical


def preprocess_data(df: pd.DataFrame) -> pd.DataFrame:
    """Limpeza e pre-processamento com features de infraestrutura."""
    if df.empty:
        return df

    df = df.copy()

    # --- 1. Tratamento de nulos categoricos ---
    fill_map = {
        "tipo": "DESCONHECIDO", "especificacao": "NAO_ESPECIFICADO",
        "bairro": "DESCONHECIDO", "setor": "DESCONHECIDO",
        "situacao": "DESCONHECIDO", "mes": "DESCONHECIDO",
        "localidade": "DESCONHECIDA", "unidade_os": "DESCONHECIDA",
    }
    for col, val in fill_map.items():
        if col in df.columns:
            df[col] = df[col].fillna(val)

    # --- 2. Normalizacao de texto ---
    for col in ["tipo", "especificacao", "bairro", "setor", "localidade", "unidade_os"]:
        if col in df.columns:
            df[col] = df[col].astype(str).str.strip().str.upper()

    # --- 3. Datas ---
    for col in ["data_encerramento", "data_ultima_tramitacao"]:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce", utc=True)

    # --- 4. Tempo de resolucao ---
    if "data_encerramento" in df.columns and "data_ultima_tramitacao" in df.columns:
        df["tempo_resolucao_horas"] = (
            (df["data_encerramento"] - df["data_ultima_tramitacao"])
            .dt.total_seconds() / 3600
        )
        df["tempo_resolucao_horas"] = df["tempo_resolucao_horas"].clip(lower=0, upper=10000)
        df["tempo_resolucao_horas"] = df["tempo_resolucao_horas"].fillna(
            df["tempo_resolucao_horas"].median()
        )

    # --- 5. Features temporais ---
    if "data_encerramento" in df.columns:
        df["dia_da_semana"] = df["data_encerramento"].dt.dayofweek.fillna(-1).astype(int)
        df["mes_do_ano"] = df["data_encerramento"].dt.month.fillna(0).astype(int)
        df["hora_encerramento"] = df["data_encerramento"].dt.hour.fillna(0).astype(int)
        df["eh_fim_de_semana"] = (df["dia_da_semana"] >= 5).astype(int)


    # --- 6. Status ---
    if "situacao" in df.columns:
        df["is_resolved"] = df["situacao"].apply(
            lambda x: 1 if pd.notna(x) and ("conclu" in str(x).lower()) else 0
        )

    # --- 7. Categorizacao tecnica ---
    if "especificacao" in df.columns and "observacao" in df.columns:
        df["categoria_tecnica"] = df.apply(
            lambda row: categorize_technical(
                f"{row.get('tipo', '')} {row.get('especificacao', '')} {row.get('observacao', '')}"
            ), axis=1
        )
    elif "especificacao" in df.columns:
        df["categoria_tecnica"] = df["especificacao"].apply(categorize_technical)

    # --- 8. Reincidencia por matricula (janela 90 dias) ---
    if "matricula" in df.columns and "data_encerramento" in df.columns:
        df = _calc_reincidence_features(df)

    # --- 9. Target: is_reincidencia_30d ---
    if "matricula" in df.columns and "data_encerramento" in df.columns:
        df = _calc_reincidence_target(df)

    print(f"Pre-processamento: {df.shape[0]} linhas, {df.shape[1]} colunas")
    return df


def _calc_reincidence_features(df: pd.DataFrame) -> pd.DataFrame:
    """Calcula features de reincidencia por matricula e localizacao."""
    df = df.sort_values("data_encerramento")

    # Reincidencia por matricula em 90 dias
    reincidence_90d = []
    days_since_last = []

    grouped_matricula = df.groupby("matricula")
    for _, group in grouped_matricula:
        dates = group["data_encerramento"].tolist()
        for i, dt in enumerate(dates):
            # Contar chamados nos 90 dias anteriores
            if pd.notna(dt):
                count_90 = sum(
                    1 for j in range(i)
                    if pd.notna(dates[j]) and 0 < (dt - dates[j]).days <= 90
                )
                # Dias desde ultimo chamado
                if i > 0 and pd.notna(dates[i-1]):
                    days = (dt - dates[i-1]).days
                else:
                    days = 999
            else:
                count_90 = 0
                days = 999

            reincidence_90d.append(count_90)
            days_since_last.append(days)

    df["count_reincidencia_matricula_90d"] = reincidence_90d
    df["dias_desde_ultimo_chamado"] = days_since_last

    # Reincidencia por localizacao (unidade_os + bairro)
    if "unidade_os" in df.columns:
        loc_counts = df.groupby(["unidade_os", "bairro"]).size().to_dict()
        df["freq_localizacao"] = df.apply(
            lambda r: loc_counts.get((r.get("unidade_os", ""), r.get("bairro", "")), 0),
            axis=1,
        )
    else:
        df["freq_localizacao"] = 0

    # Flag reparo paliativo (resolucao < 4h e reincidencia < 7 dias)
    if "tempo_resolucao_horas" in df.columns:
        df["flag_reparo_paliativo"] = (
            (df["tempo_resolucao_horas"] < 4) &
            (df["dias_desde_ultimo_chamado"] <= 7) &
            (df["dias_desde_ultimo_chamado"] > 0)
        ).astype(int)
    else:
        df["flag_reparo_paliativo"] = 0

    return df


def _calc_reincidence_target(df: pd.DataFrame) -> pd.DataFrame:
    """Calcula target: houve reincidencia em < 30 dias."""
    df = df.sort_values("data_encerramento")
    reincidence_30d = []

    grouped = df.groupby("matricula")
    for _, group in grouped:
        dates = group["data_encerramento"].tolist()
        for i, dt in enumerate(dates):
            if pd.notna(dt) and i < len(dates) - 1:
                next_dt = dates[i + 1]
                if pd.notna(next_dt) and 0 < (next_dt - dt).days <= 30:
                    reincidence_30d.append(1)
                else:
                    reincidence_30d.append(0)
            else:
                reincidence_30d.append(0)

    df["is_reincidencia_30d"] = reincidence_30d
    return df


def clean_for_model(df: pd.DataFrame) -> pd.DataFrame:
    """Remove colunas nao-modelo, mantendo features de reincidencia."""
    cols_to_drop = [
        "id", "ss", "observacao", "data_encerramento",
        "data_ultima_tramitacao", "created_at", "updated_at",
        "cep",
    ]
    df = df.drop(columns=[c for c in cols_to_drop if c in df.columns], errors="ignore")
    return df
