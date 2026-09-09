"""Treinamento de modelos ML - Target: Reincidencia em 30 dias."""

import joblib
import os
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.metrics import classification_report, accuracy_score, f1_score, roc_auc_score
from config.settings import get_settings


def train_model(
    df: pd.DataFrame,
    target_column: str = "is_reincidencia_30d",
    model_type: str = "gradient_boosting",
) -> tuple:
    """
    Treina modelo para prever reincidencia em 30 dias.

    Args:
        df: DataFrame com features
        target_column: Target (default: reincidencia 30 dias)
        model_type: 'gradient_boosting' ou 'random_forest'

    Returns:
        (model, feature_names, metrics_dict)
    """
    # Fallback para is_resolved se target nao existir
    if target_column not in df.columns:
        if "is_resolved" in df.columns:
            print(f"Target '{target_column}' nao encontrado. Usando 'is_resolved'.")
            target_column = "is_resolved"
        else:
            print(f"Nenhum target encontrado.")
            return None, None, None

    # Separar features e target
    X = df.drop(columns=[target_column, "is_resolved", "is_reincidencia_30d"], errors="ignore")
    y = df[target_column]

    X = X.select_dtypes(include=[np.number])

    if X.empty or y.nunique() < 2:
        print(f"Dados insuficientes (features={X.shape[1]}, classes={y.nunique()}).")
        return None, None, None

    feature_names = X.columns.tolist()

    # Split estratificado
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42,
        stratify=y if y.nunique() > 1 else None
    )

    # Modelo
    if model_type == "random_forest":
        model = RandomForestClassifier(
            n_estimators=200, max_depth=12, random_state=42,
            class_weight="balanced", n_jobs=-1,
        )
    else:
        model = GradientBoostingClassifier(
            n_estimators=200, max_depth=6, learning_rate=0.1,
            random_state=42, subsample=0.8,
        )

    print(f"Treinando {model_type} (target: {target_column})...")
    model.fit(X_train, y_train)

    # Avaliacao
    y_pred = model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred, average="weighted", zero_division=0)

    # AUC se possivel
    auc = None
    try:
        y_proba = model.predict_proba(X_test)[:, 1]
        auc = roc_auc_score(y_test, y_proba)
    except Exception:
        pass

    report = classification_report(y_test, y_pred, output_dict=True, zero_division=0)
    print(classification_report(y_test, y_pred, zero_division=0))

    metrics = {
        "accuracy": round(accuracy, 4),
        "f1_score": round(f1, 4),
        "precision": round(report.get("weighted avg", {}).get("precision", 0), 4),
        "recall": round(report.get("weighted avg", {}).get("recall", 0), 4),
        "auc_roc": round(auc, 4) if auc else None,
        "total_samples": len(X),
        "features_count": len(feature_names),
        "model_type": model_type,
        "target": target_column,
    }

    # Feature importance
    if hasattr(model, "feature_importances_"):
        importances = dict(
            sorted(
                zip(feature_names, model.feature_importances_),
                key=lambda x: x[1], reverse=True,
            )[:15]
        )
        metrics["top_features"] = importances
        print("\nTop 15 Features:")
        for feat, imp in importances.items():
            print(f"   {feat}: {imp:.4f}")

    print(f"\nModelo: Acc={accuracy:.4f} F1={f1:.4f}" + (f" AUC={auc:.4f}" if auc else ""))
    return model, feature_names, metrics


def save_model(model, feature_names: list, version: str = "v2.0"):
    """Salva modelo e features."""
    settings = get_settings()
    os.makedirs(os.path.dirname(settings.model_path), exist_ok=True)

    model_path = settings.model_path.replace(".joblib", f"_{version}.joblib")
    features_path = settings.features_path.replace(".joblib", f"_{version}.joblib")

    joblib.dump(model, model_path)
    joblib.dump(feature_names, features_path)
    joblib.dump(model, settings.model_path)
    joblib.dump(feature_names, settings.features_path)

    print(f"Modelo salvo: {model_path}")
    return model_path, features_path


def load_model(version: str = None):
    """Carrega modelo."""
    settings = get_settings()
    if version:
        model_path = settings.model_path.replace(".joblib", f"_{version}.joblib")
        features_path = settings.features_path.replace(".joblib", f"_{version}.joblib")
    else:
        model_path = settings.model_path
        features_path = settings.features_path

    model = joblib.load(model_path)
    feature_names = joblib.load(features_path)
    return model, feature_names
