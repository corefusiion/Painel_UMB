"""Rotas de integração externa (Webhooks para Dashboards como Lovable)."""

import traceback
import unicodedata
import re
import asyncio
from typing import List, Optional
from fastapi import APIRouter
from pydantic import BaseModel

from agent.analyzer import get_analyzer, clean_logradouro_name, normalize_logradouro_key
from loguru import logger

router = APIRouter(prefix="/api/integrations", tags=["Integrações Externas"])

class ExternalDemand(BaseModel):
    id: str  # UID da demanda
    matricula: Optional[str] = None
    logradouro: str
    bairro: Optional[str] = None
    bairro_nome: Optional[str] = None
    numero_os: Optional[str] = None
    observacao: Optional[str] = None

class ExternalDemandsPayload(BaseModel):
    demandas: List[ExternalDemand]

def clean_bairro_name(bairro: str) -> str:
    """Remove código numérico do bairro (ex: '15 - CENTRO' -> 'CENTRO')."""
    if not bairro:
        return ""
    text = bairro.strip()
    text = re.sub(r'^\d+\s*[-–—]\s*', '', text)
    return text.strip()

def normalize_bairro_key(bairro: str) -> str:
    cleaned = clean_bairro_name(bairro)
    if not cleaned:
        return ""
    nfkd = unicodedata.normalize('NFKD', cleaned)
    text = "".join([c for c in nfkd if not unicodedata.combining(c)]).upper()
    return re.sub(r'[^\w\s]', '', text).strip()

@router.post("/analyze-external-demands")
async def analyze_external_demands(raw_payload: dict):
    """
    Recebe uma lista de demandas de falta de água do Gestão UMB e retorna um insight preditivo para cada.
    """
    logger.info(f"[INTEGRATION RAW] Payload recebido no servidor: {raw_payload}")
    
    try:
        demandas_raw = raw_payload.get("demandas", [])
        if not demandas_raw:
             if isinstance(raw_payload, list):
                 demandas_raw = raw_payload
             else:
                 logger.warning("[WARNING] Nenhuma demanda encontrada no payload")
        
        analyzer = get_analyzer()
        
        # Mapear contagem por Logradouro + Bairro, Logradouro Geral e Logradouros internos por Bairro no lote
        lote_logr_bairro_total = {}
        lote_logr_geral_total = {}
        lote_bairro_total = {}
        lote_bairro_logradouros = {} # {b_key: {clean_l_name: count}}

        for d in demandas_raw:
            logr = d.get("logradouro") or d.get("logr") or ""
            bairro = d.get("bairro_nome") or d.get("bairro") or ""
            
            l_key = normalize_logradouro_key(logr)
            b_key = normalize_bairro_key(bairro)
            clean_l = clean_logradouro_name(logr)

            if l_key:
                lote_logr_geral_total[l_key] = lote_logr_geral_total.get(l_key, 0) + 1
                lb_key = f"{l_key}::{b_key}" if b_key else l_key
                lote_logr_bairro_total[lb_key] = lote_logr_bairro_total.get(lb_key, 0) + 1
                
            if b_key:
                lote_bairro_total[b_key] = lote_bairro_total.get(b_key, 0) + 1
                if clean_l:
                    if b_key not in lote_bairro_logradouros:
                        lote_bairro_logradouros[b_key] = {}
                    lote_bairro_logradouros[b_key][clean_l] = lote_bairro_logradouros[b_key].get(clean_l, 0) + 1

        # Ordenar bairros mais afetados no lote atual
        sorted_bairros = sorted(lote_bairro_total.items(), key=lambda item: item[1], reverse=True)
        top_bairros_nomes = [clean_bairro_name(b[0]) for b in sorted_bairros if b[0] and clean_bairro_name(b[0])][:3]
        ranking_bairros_str = ", ".join(top_bairros_nomes) if top_bairros_nomes else "Nenhum no momento"

        logger.debug(f"[DEBUG LOTE LOGR+BAIRRO]: {lote_logr_bairro_total}")
        logger.debug(f"[DEBUG LOTE LOGR GERAL]: {lote_logr_geral_total}")

        logrados_processed_count = {}
        first_logradouro_insight = {}
        
        async def process_demand(d: dict):
            d_id = str(d.get("id", "0"))
            m = d.get("matricula")
            logr = d.get("logradouro") or d.get("logr") or ""
            bairro = d.get("bairro_nome") or d.get("bairro") or ""
            obs = d.get("observacao") or ""
            
            if not m or m in ["nan", "None", ""]:
                match = re.search(r'MATRICULA:\s*(\d+)', obs, re.IGNORECASE)
                if match:
                    m = match.group(1)
            
            l_key = normalize_logradouro_key(logr)
            b_key = normalize_bairro_key(bairro)
            lb_key = f"{l_key}::{b_key}" if b_key else l_key

            logrados_processed_count[lb_key] = logrados_processed_count.get(lb_key, 0) + 1
            
            # Pega contagem exata no mesmo bairro e contagem geral na rua
            count_bairro = lote_logr_bairro_total.get(lb_key, 1)
            count_geral = lote_logr_geral_total.get(l_key, count_bairro)
            count_apenas_bairro = lote_bairro_total.get(b_key, 1) if b_key else 1

            b_nome_clean = clean_bairro_name(bairro) or "Bairro"
            pos_ranking = 1
            for idx, (b_k, _) in enumerate(sorted_bairros):
                if b_k == b_key:
                    pos_ranking = idx + 1
                    break

            # Ranqueamento dos logradouros (ruas) DENTRO do bairro
            logr_counts = lote_bairro_logradouros.get(b_key, {})
            sorted_logr = sorted(logr_counts.items(), key=lambda x: x[1], reverse=True)
            top_ruas_lines = [f" - {idx+1}º {r[0]} ({r[1]} OS{'s' if r[1]>1 else ''});" for idx, r in enumerate(sorted_logr[:3])]
            if top_ruas_lines:
                top_ruas_lines[-1] = top_ruas_lines[-1][:-1] + "."
            top_ruas_str = "\n" + "\n".join(top_ruas_lines) if top_ruas_lines else f"\n - 1º {clean_logradouro_name(logr) or 'Logradouro'} (1 OS)."
            qtd_logradouros_afetados = len(logr_counts) or 1

            desc_bairro_text = f"O bairro {b_nome_clean} acumula {count_apenas_bairro} solicitação(ões) ativas em aberto. Logradouros mais afetados no bairro:{top_ruas_str}"

            # Se já analisamos esta rua no mesmo bairro > 2x no lote, reutilizamos os dados estruturados
            if logrados_processed_count[lb_key] > 2 and lb_key in first_logradouro_insight:
                cached = first_logradouro_insight[lb_key]
                hist_trecho = cached.get("total_chamados_trecho", 0)
                rec_text = f"> RECOMENDAÇÃO TÉCNICA: Identificadas {count_bairro} solicitações pendentes no mesmo trecho do logradouro. Recomenda-se enviar equipe de campo para vistoria da rede distribuidora local e inspeção de pressão nas válvulas." if count_bairro > 1 else cached.get("ai_recomendacao", "")

                res_cached = {
                    "id": d_id,
                    "numero_os": d.get("numero_os") or d.get("os_numero") or d_id,
                    "matricula": m,
                    "logradouro": logr,
                    "ai_recomendacao": rec_text,
                    "chance_reincidencia": cached.get("chance_reincidencia", 25),
                    "logradouro_historico": f"{hist_trecho} chamados históricos no trecho.",
                    "total_chamados_trecho": hist_trecho,
                    "desc_logradouro": cached.get("desc_logradouro", ""),
                    "desc_bairro": desc_bairro_text,
                    "ranking_bairros": top_ruas_str,
                    "bairro_pos_ranking": pos_ranking,
                    "bairro_logradouros_afetados": qtd_logradouros_afetados,
                    "q_logr_30d": cached.get("q_logr_30d", count_geral),
                    "q_logr_ano": cached.get("q_logr_ano", hist_trecho),
                    "simultaneos_lote": count_bairro,
                    "simultaneos_lote_logradouro": count_geral,
                    "simultaneos_lote_bairro": count_apenas_bairro,
                    "reincidencias_90dias": cached.get("reincidencias_90dias", 1),
                    "reincidencias_15dias": cached.get("reincidencias_15dias", 1),
                    "q_mat_15d": cached.get("q_mat_15d", 1),
                    "q_mat_6m": cached.get("q_mat_6m", 1),
                    "q_mat_12m": cached.get("q_mat_12m", 1),
                    "q_mat_24m": cached.get("q_mat_24m", 1),
                    "tendencia_matricula": cached.get("tendencia_matricula", "Analisando..."),
                    "timeline_meses": cached.get("timeline_meses", {}),
                    "risco_nivel": "ALTO" if count_bairro > 1 else cached.get("risco_nivel", "REGULAR"),
                    "risco_alerta": f"ALERTA EM LOTE ({count_bairro}x no mesmo trecho)" if count_bairro > 1 else cached.get("risco_alerta", "SITUAÇÃO REGULAR"),
                    "sentimento": cached.get("sentimento", "Neutro"),
                    "sentiment_diagnosis": cached.get("sentiment_diagnosis", "Neutro"),
                    "urgency_level": cached.get("urgency_level", "MODERADA"),
                    "sentiment_badge": cached.get("sentiment_badge", "🟢 Atendimento Padrão"),
                    "obs_diag": cached.get("obs_diag", "")
                }
                res_cached["dados_brutos"] = dict(res_cached)
                return res_cached

            insight = await analyzer.analyze_single_demand(
                matricula=str(m or ""),
                logradouro=logr,
                observacao=obs,
                bairro=b_nome_clean
            )
            
            score = insight.get("ml_score_probabilidade", 25)
            q_total = insight.get("q_mat_total", 1)
            q_24m = insight.get("q_mat_24m", 1)
            q_12m = insight.get("q_mat_12m", 1)
            q_6m = insight.get("q_mat_6m", 1)
            q_15d = insight.get("q_mat_15d", 1)
            q_l6m = insight.get("q_logr_6m", 0)
            q_l30d = insight.get("q_logr_30d", 0)
            q30d_final = max(count_bairro, q_l30d)
            q_lano = insight.get("q_logr_ano", q_l6m)
            qano_final = max(q_lano, q_l6m, q30d_final)
            
            desc_logr = f"Ocorreram {q30d_final} solicitação(ões) nos últimos 30 dias neste logradouro. No acumulado do ano já somam {qano_final} chamados."
            
            total_chamados_calc = max(qano_final, q_l6m)
            reincidencias_15d_calc = q_15d

            sentiment = insight.get("sentiment_diagnosis", "Neutro")
            urgency_lvl = insight.get("urgency_level", "MODERADA")
            sentiment_bdg = insight.get("sentiment_badge", "🟢 Atendimento Padrão")
            obs_diagnosis = insight.get("obs_diag", "")
            
            # Insight Técnico Operacional executivo, profissional e cirúrgico
            p_insight = ""
            if score >= 75 and q_6m >= 4:
                p_insight = f"> RECOMENDAÇÃO OPERACIONAL: Reincidência frequente no imóvel ({q_6m} chamados em 6m). Vistoria presencial no ramal predial e teste de vazão no hidrômetro."
            elif count_bairro > 1:
                p_insight = f"> RECOMENDAÇÃO OPERACIONAL: Concentração de {count_bairro} OSs pendentes no mesmo trecho da via. Enviar equipe de campo para inspeção da rede distribuidora e medição de pressão."
            elif q_6m > 1:
                p_insight = f"> RECOMENDAÇÃO OPERACIONAL: Reincidência recente no domicílio ({q_6m} chamados em 6m). Verificar estabilidade da pressão na rede local."
            else:
                p_insight = "> RECOMENDAÇÃO OPERACIONAL: Demanda pontual. Atendimento padrão de verificação de pressão no ponto de entrega."

            risco_lvl = "CRITICO" if score >= 75 else ("ALTO" if count_bairro > 1 else "REGULAR")
            risco_alr = f"ALERTA EM LOTE ({count_bairro}x no trecho)" if count_bairro > 1 else ("RISCO ELEVADO" if score >= 75 else "SITUAÇÃO REGULAR")

            result_obj = {
                "id": d_id,
                "numero_os": d.get("numero_os") or d.get("os_numero") or d_id,
                "matricula": m,
                "logradouro": logr,
                "ai_recomendacao": p_insight,
                "chance_reincidencia": score,
                "logradouro_historico": f"{total_chamados_calc} chamados históricos no trecho.",
                "total_chamados_trecho": total_chamados_calc,
                "desc_logradouro": desc_logr,
                "desc_bairro": desc_bairro_text,
                "ranking_bairros": top_ruas_str,
                "bairro_pos_ranking": pos_ranking,
                "bairro_logradouros_afetados": qtd_logradouros_afetados,
                "q_logr_30d": q30d_final,
                "q_logr_ano": qano_final,
                "simultaneos_lote": count_bairro,
                "simultaneos_lote_logradouro": count_geral,
                "simultaneos_lote_bairro": count_apenas_bairro,
                "reincidencias_90dias": reincidencias_15d_calc,
                "reincidencias_15dias": reincidencias_15d_calc,
                "q_mat_15d": q_15d,
                "q_mat_6m": q_6m,
                "q_mat_12m": q_12m,
                "q_mat_24m": q_24m,
                "tendencia_matricula": insight.get("tendencia_matricula", "Analisando..."),
                "timeline_meses": insight.get("timeline_meses", {}),
                "risco_nivel": risco_lvl,
                "risco_alerta": risco_alr,
                "sentimento": sentiment,
                "sentiment_diagnosis": sentiment,
                "urgency_level": urgency_lvl,
                "sentiment_badge": sentiment_bdg,
                "obs_diag": obs_diagnosis
            }
            result_obj["dados_brutos"] = dict(result_obj)

            if lb_key not in first_logradouro_insight:
                first_logradouro_insight[lb_key] = result_obj

            return result_obj

        tasks = [process_demand(d) for d in demandas_raw]
        resultados = await asyncio.gather(*tasks)

        logger.debug(f"[DEBUG] Devolvendo {len(resultados)} analises separadas por bairro e logradouro.")
        return {"status": "success", "analises": resultados}
    except Exception as e:
        logger.error(f"Erro na integração externa: {e}")
        traceback.print_exc()
        return {"status": "error", "message": str(e)}
