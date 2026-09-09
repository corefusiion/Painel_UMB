import asyncio
from datetime import datetime, timedelta
from collections import defaultdict, Counter
from database.connection import get_supabase_client

class HydraulicClusterer:
    """Motor de Clustering Espaço-Temporal para detecção de Causa Raiz."""

    def __init__(self):
        self.supabase = get_supabase_client()
        # Palavras-chave de criticidade técnica
        self.critical_services = ["FALTA AGUA", "VAZAMENTO", "ESGOTO", "QUALIDADE", "PRES-BAIXA"]

    async def get_recent_data(self, hours=48):
        """Busca dados recentes para análise de clusters."""
        # Para dados históricos, buscamos as solicitações mais recentes por data de encerramento
        # em vez de filtrar por created_at (que é timestamp de importação)
        params = {
            "limit": "5000",
        }
        data = await self.supabase.get("solicitacoes", params)
        return data

    def detect_events(self, data):
        """
        Agrupa solicitações em Eventos Mestres ou diagnósticos isolados.
        Retorna uma lista de dicionários de eventos.
        """
        clusters = defaultdict(list)
        
        # 1. Agrupamento Espacial por Logradouro/Bairro + Setor
        for d in data:
            loc = d.get("logradouro") or d.get("bairro") or "Região Indefinida"
            sec = d.get("setor") or d.get("bairro") or "Setor Geral"
            key = (sec, loc)
            clusters[key].append(d)
            
        events = []
        
        for (setor, logradouro), demands in clusters.items():
            count = len(demands)
            
            # Caso A: Evento Mestre (Cluster de massa)
            if count >= 3:
                srv_counts = Counter([str(d.get("servico", "")).upper() for d in demands])
                main_srv = srv_counts.most_common(1)[0][0] if srv_counts else "FALTA DE AGUA"
                
                signature = "Vazamento em Adutora / Falha de Pressão na Rede" if "VAZ" in str(srv_counts) and "FALTA" in str(srv_counts) else "Oscilação no Abastecimento ou Manutenção de Ramal"
                
                events.append({
                    "type": "MASTER_EVENT",
                    "severity": "CRITICAL" if count > 5 else "WARNING",
                    "description": f"Evento Hidráulico Mestre: {logradouro}",
                    "impact": f"{count} solicitações reincidentes no local",
                    "probable_cause": signature,
                    "location": f"{logradouro} ({setor})",
                    "demands": [d.get("id") for d in demands]
                })
                
            # Caso B: Diagnóstico Isolado (Regra de Obstrução de Ramal)
            elif count == 1:
                d = demands[0]
                srv = str(d.get("servico", "")).upper()
                mat = d.get("matricula") or "Sem Matrícula"
                
                events.append({
                    "type": "ISOLATED_DIAGNOSTIC",
                    "severity": "NORMAL",
                    "description": f"Diagnóstico de Obstrução / Manutenção no Imóvel (Matrícula: {mat})",
                    "impact": "Demanda pontual isolada",
                    "probable_cause": f"Serviço: {srv[:35]} — Verificação de hidrômetro/ferrolho local",
                    "location": f"{logradouro} ({setor})",
                    "demands": [d.get("id")]
                })
                    
        return events

async def test():
    clusterer = HydraulicClusterer()
    data = await clusterer.get_recent_data()
    print(f"Dados recuperados: {len(data)}")
    events = clusterer.detect_events(data)
    print(f"Eventos detectados: {len(events)}")
    for e in events[:3]:
        print(f" - [{e['type']}] {e['description']} -> {e['probable_cause']}")

if __name__ == "__main__":
    asyncio.run(test())
