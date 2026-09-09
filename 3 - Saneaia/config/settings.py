"""Configurações centralizadas da aplicação."""

import os
from pydantic_settings import BaseSettings
from functools import lru_cache

ENV_FILE_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")


class Settings(BaseSettings):
    """Carrega configurações do .env automaticamente com fallbacks seguros."""

    # Supabase (Mock / SQLite local)
    supabase_url: str = "http://local-dummy"
    supabase_anon_key: str = "dummy"
    supabase_service_key: str = "dummy"

    # OpenRouter / Gemini (LLM)
    openrouter_api_key: str = "dummy"
    openrouter_model: str = "deepseek/deepseek-v4-flash"
    gemini_api_key: str = ""

    # App
    app_env: str = "development"
    app_host: str = "0.0.0.0"
    app_port: int = 8000

    # ML
    model_path: str = "ml/models/random_forest_model.joblib"
    features_path: str = "ml/models/model_features.joblib"
    ml_prediction_limit: int = 5000

    model_config = {
        "env_file": ENV_FILE_PATH,
        "env_file_encoding": "utf-8",
        "extra": "ignore",
        "protected_namespaces": ("settings_",)
    }


@lru_cache()
def get_settings() -> Settings:
    """Retorna instância cacheada das configurações."""
    return Settings()
