"""Modelos Pydantic para a API."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


# --- Request Models ---

class ChatRequest(BaseModel):
    """Requisição de chat com o agente."""
    query: str = Field(..., description="Pergunta do gestor")
    year_context: Optional[str] = Field(default=None, description="Ano selecionado no dashboard")


class ConversationCreate(BaseModel):
    title: Optional[str] = "Nova conversa"
    year_context: Optional[str] = None


class ConversationUpdate(BaseModel):
    title: Optional[str] = None
    pinned: Optional[bool] = None
    archived: Optional[bool] = None


class MessageCreate(BaseModel):
    content: str = Field(..., description="Conteúdo da mensagem")
    year_context: Optional[str] = Field(default=None, description="Ano selecionado no dashboard")

class PredictionRequest(BaseModel):
    """Requisição de predição ML."""
    limit: int = Field(default=100, description="Número de registros para predição")


class RetrainRequest(BaseModel):
    """Requisição de re-treinamento do modelo."""
    version: str = Field(default="v1.0", description="Versão do modelo")
    model_type: str = Field(default="random_forest", description="Tipo de modelo")


class SolicitacaoFilter(BaseModel):
    """Filtros para busca de solicitações."""
    bairro: Optional[str] = None
    tipo: Optional[str] = None
    situacao: Optional[str] = None
    setor: Optional[str] = None
    localidade: Optional[str] = None
    data_inicio: Optional[str] = None
    data_fim: Optional[str] = None
    limit: int = Field(default=100, ge=1, le=1000)
    offset: int = Field(default=0, ge=0)


# --- Response Models ---

class ChatResponse(BaseModel):
    """Resposta do chat do agente."""
    response: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class InsightResponse(BaseModel):
    """Insight gerado pela IA."""
    id: Optional[str] = None
    tipo_insight: str
    titulo: str
    descricao: str
    bairro: Optional[str] = None
    tipo_problema: Optional[str] = None
    nivel_criticidade: Optional[str] = None
    recomendacao: Optional[str] = None
    created_at: Optional[datetime] = None


class KpiResponse(BaseModel):
    """KPIs gerais do sistema."""
    total_solicitacoes: int
    total_resolvidas: int
    total_abertas: int
    tempo_medio_resolucao_horas: Optional[float] = None
    total_bairros: int
    total_clientes: int
    total_tipos_problema: int


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    database: bool
    llm: bool
    version: str = "1.0.0"
