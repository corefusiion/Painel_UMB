"""Rotas do Agente de IA (insights, chat, análises)."""

import traceback
from fastapi import APIRouter
from api.models import ChatRequest, ChatResponse, ConversationCreate, ConversationUpdate, MessageCreate
from agent.analyzer import get_analyzer
from agent.nlp import batch_analyze
from database.connection import get_supabase_client
from loguru import logger

router = APIRouter(prefix="/api/agent", tags=["Agente IA"])


@router.post("/chat", response_model=ChatResponse)
async def chat_with_agent(request: ChatRequest):
    """Chat interativo com o agente de IA."""
    try:
        analyzer = get_analyzer()
        response = await analyzer.chat(request.query, request.year_context)
        return ChatResponse(response=response)

    except Exception as e:
        logger.error(f"❌ Erro no chat: {e}")
        traceback.print_exc()
        return ChatResponse(response=f"Erro ao processar: {str(e)}")


@router.post("/analyze")
async def run_analysis():
    """Executa análise completa e gera insights."""
    try:
        analyzer = get_analyzer()
        response = await analyzer.generate_insights()
        return {"insights": response}
    except Exception as e:
        logger.error(f"❌ Erro na análise: {e}")
        traceback.print_exc()
        return {"insights": f"Erro ao gerar insights: {str(e)}"}


@router.post("/analyze-and-save")
async def run_analysis_and_save():
    """Executa análise completa, gera e salva insights no banco."""
    analyzer = get_analyzer()
    saved = await analyzer.generate_and_save_insights()
    return {"saved": saved}


@router.get("/insights")
async def list_insights(limit: int = 10):
    """Lista insights gerados pela IA."""
    supabase = get_supabase_client()
    data = await supabase.get("insights_ia", {
        "order": "created_at.desc",
        "limit": str(limit),
        "ativo": "eq.true",
    })
    return {"data": data}


@router.post("/analyze-kpis")
async def analyze_kpis():
    """Gera análise executiva dos KPIs."""
    analyzer = get_analyzer()
    response = await analyzer.analyze_kpis()
    return {"analysis": response}


@router.get("/nlp-summary")
async def get_nlp_summary(limit: int = 5000):
    """Retorna resumo da análise NLP das observações registradas no banco com separação anual e mensal baseada estritamente na Data/Hora de Última Tramitação."""
    import os, sqlite3, re
    db_path = os.path.abspath(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "database", "saneaia.db"))

    def parse_year_month(d_str):
        if not d_str or str(d_str).strip() in ('N', 'None', 'nan', ''):
            return None, None
        d = str(d_str).strip()
        m_iso = re.match(r'^(\d{4})-(\d{2})-(\d{2})', d)
        if m_iso:
            return int(m_iso.group(1)), int(m_iso.group(2))
        m_br = re.match(r'^(\d{1,2})/(\d{1,2})/(\d{4})', d)
        if m_br:
            return int(m_br.group(3)), int(m_br.group(2))
        return None, None

    total_ano_solicitacoes = 0
    total_mes_solicitacoes = 0
    obs_ano = []
    obs_mes = []

    if os.path.exists(db_path):
        try:
            conn = sqlite3.connect(db_path)
            cur = conn.cursor()
            cur.execute("SELECT data_ultima_tramitacao, observacao FROM solicitacoes")
            rows = cur.fetchall()
            conn.close()

            for dt, obs in rows:
                y, m = parse_year_month(dt)
                has_obs = bool(obs and len(str(obs).strip()) > 3 and str(obs).strip().upper() != 'N')
                if y == 2026:
                    total_ano_solicitacoes += 1
                    if has_obs:
                        obs_ano.append(str(obs).strip())
                    if m == 8:
                        total_mes_solicitacoes += 1
                        if has_obs:
                            obs_mes.append(str(obs).strip())
        except Exception as e:
            logger.error(f"Erro ao buscar observações no SQLite: {e}")

    # Análise NLP de batch para o Mês Corrente e para o Acumulado do Ano
    summary_mes = batch_analyze(obs_mes)
    summary_ano = batch_analyze(obs_ano)

    # Estrutura unificada com detalhamento temporal rigoroso pela Data/Hora de Última Tramitação
    summary = dict(summary_mes) # Padrão Mês Corrente para retrocompatibilidade
    summary["coluna_filtro"] = "Data/Hora Última Tramitação da OS"
    summary["total_ano"] = len(obs_ano)
    summary["total_ano_solicitacoes"] = total_ano_solicitacoes
    summary["total_mes_corrente"] = len(obs_mes)
    summary["total_mes_solicitacoes"] = total_mes_solicitacoes
    summary["nome_mes_corrente"] = "Mês Corrente (Agosto/2026)"
    summary["periodo_detalhado_mes"] = "01/08/2026 a 31/08/2026"
    summary["periodo_detalhado_ano"] = "01/01/2026 a 31/12/2026"
    summary["descricao_amostra"] = (
        f"Análise filtrada estritamente pela Data/Hora de Última Tramitação da OS: "
        f"{len(obs_mes):,} observações mineradas no Mês Corrente - Agosto/2026 (de {total_mes_solicitacoes:,} OSs tramitadas) vs. "
        f"{len(obs_ano):,} observações no Acumulado do Ano - 2026 (de {total_ano_solicitacoes:,} OSs tramitadas)."
    )
    summary["analise_mes"] = summary_mes
    summary["analise_ano"] = summary_ano

    return {"data": summary}


@router.get("/conversations")
async def get_all_conversations():
    """Retorna todas as conversas do usuário ordenadas por pinned DESC, updated_at DESC."""
    try:
        analyzer = get_analyzer()
        data = await analyzer.list_conversations()
        return {"data": data}
    except Exception as e:
        logger.error(f"Erro ao listar conversas: {e}")
        return {"data": [], "error": str(e)}


@router.post("/conversations")
async def create_new_conversation(request: ConversationCreate):
    """Cria uma nova conversa."""
    try:
        analyzer = get_analyzer()
        data = await analyzer.create_conversation(request.title)
        return {"data": data}
    except Exception as e:
        logger.error(f"Erro ao criar conversa: {e}")
        return {"error": str(e)}


@router.get("/conversations/{id}")
async def get_conversation_details(id: str):
    """Retorna os detalhes de uma conversa específica."""
    try:
        analyzer = get_analyzer()
        data = await analyzer.get_conversation(id)
        if not data:
            return {"error": "Conversa não encontrada"}
        return {"data": data}
    except Exception as e:
        logger.error(f"Erro ao obter conversa {id}: {e}")
        return {"error": str(e)}


@router.patch("/conversations/{id}")
async def update_conversation_details(id: str, request: ConversationUpdate):
    """Atualiza título, pinned ou archived de uma conversa."""
    try:
        analyzer = get_analyzer()
        data = await analyzer.update_conversation(
            conversation_id=id,
            title=request.title,
            pinned=request.pinned,
            archived=request.archived
        )
        if not data:
            return {"error": "Conversa não encontrada"}
        return {"data": data}
    except Exception as e:
        logger.error(f"Erro ao atualizar conversa {id}: {e}")
        return {"error": str(e)}


@router.delete("/conversations/{id}")
async def delete_existing_conversation(id: str):
    """Deleta uma conversa e seus registros dependentes."""
    try:
        analyzer = get_analyzer()
        success = await analyzer.delete_conversation(id)
        return {"success": success}
    except Exception as e:
        logger.error(f"Erro ao deletar conversa {id}: {e}")
        return {"success": False, "error": str(e)}


@router.get("/conversations/{id}/messages")
async def get_conversation_messages(id: str):
    """Retorna a lista de mensagens de uma conversa específica."""
    try:
        analyzer = get_analyzer()
        messages = await analyzer.list_messages(id)
        return {"data": messages}
    except Exception as e:
        logger.error(f"Erro ao listar mensagens de {id}: {e}")
        return {"data": [], "error": str(e)}


@router.post("/conversations/{id}/messages")
async def post_message_to_conversation(id: str, request: MessageCreate):
    """Envia uma mensagem de usuário na conversa e retorna a resposta da IA."""
    try:
        analyzer = get_analyzer()
        response = await analyzer.chat_with_conversation(
            conversation_id=id,
            user_query=request.content,
            year_context=request.year_context
        )
        return {"response": response}
    except Exception as e:
        logger.error(f"Erro ao processar mensagem na conversa {id}: {e}")
        traceback.print_exc()
        return {"error": str(e), "response": "Erro ao obter resposta da inteligência artificial."}
