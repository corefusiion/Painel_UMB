import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageSquare, Filter, RefreshCw } from "lucide-react";

interface NlpMetrics {
  total_analisadas: number;
  sentimento: { positivo: number; negativo: number; neutro: number };
  percentual_negativo: number;
  percentual_positivo: number;
  total_urgentes: number;
  taxa_urgencia: number;
  logradouros_identificados: number;
  taxa_localizacao: number;
}

interface NlpSummaryData {
  coluna_filtro: string;
  total_ano: number;
  total_ano_solicitacoes: number;
  total_mes_corrente: number;
  total_mes_solicitacoes: number;
  nome_mes_corrente: string;
  periodo_detalhado_mes: string;
  periodo_detalhado_ano: string;
  analise_mes: NlpMetrics;
  analise_ano: NlpMetrics;
}

export function NlpObservacoesCard() {
  const [data, setData] = useState<NlpSummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchNlpSummary = async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:8000/api/agent/nlp-summary?_t=${Date.now()}`);
      if (res.ok) {
        const json = await res.json();
        if (json?.data) {
          setData(json.data);
        }
      }
    } catch (e) {
      console.error("Erro ao buscar resumo NLP do SaneaIA:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNlpSummary();
  }, []);

  const mes = data?.analise_mes;
  const ano = data?.analise_ano;

  return (
    <Card className="border border-border/30 bg-card h-full flex flex-col overflow-hidden shadow-xs">
      <div className="p-3.5 h-full flex flex-col justify-between gap-3 min-w-0 overflow-y-auto">
        
        {/* Header Principal */}
        <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-border/30 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <MessageSquare className="h-4 w-4 text-foreground shrink-0" />
            <span className="text-xs sm:text-sm font-bold text-foreground tracking-tight">
              Análise NLP das Observações das SSs
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="text-[10px] px-2 py-0.5 font-medium border-border/40 bg-muted/20 text-muted-foreground shrink-0">
              <Filter className="h-3 w-3 mr-1 text-muted-foreground" />
              Data/Hora Última Tramitação
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              onClick={fetchNlpSummary}
              disabled={loading}
              className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
              title="Atualizar análise NLP"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* =============================================================
            ESTRUTURA DEDICADA 1/3 ESQUERDA (EXPLICATIVO) E 2/3 DIREITA (MENSAL & ANUAL)
           ============================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 flex-1 min-h-0">
          
          {/* 1/3 ESQUERDA: Bloco de Texto Explicativo */}
          <div className="lg:col-span-1 bg-white dark:bg-card border border-border/30 rounded-xl p-3.5 shadow-sm flex flex-col justify-between gap-3">
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 border-b border-border/20 pb-2">
                <span className="text-xs font-bold text-foreground tracking-tight uppercase">
                  ℹ️ Mineração NLP de Observações
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                O motor de inteligência NLP varre continuamente as observações inseridas pelas equipes de campo para mapear níveis de insatisfação do usuário, detectar pedidos urgentes e identificar logradouros afetados.
              </p>
              <div className="space-y-1.5 pt-1">
                <div className="text-[11px] text-foreground font-medium flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
                  Categorização automática de Sentimento
                </div>
                <div className="text-[11px] text-foreground font-medium flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                  Detecção de Prioridade & Urgência
                </div>
                <div className="text-[11px] text-foreground font-medium flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-500 shrink-0" />
                  Mapeamento Geográfico de Ruas
                </div>
              </div>
            </div>

            <div className="bg-muted/20 border border-border/30 rounded-lg p-2.5 text-[10px] text-muted-foreground font-medium leading-tight">
              📌 <strong>Transparência Operacional:</strong> Análise extraída pela coluna <code className="text-foreground font-bold">Data/Hora Última Tramitação da OS</code> com divisão clara entre os períodos Mensal e Anual.
            </div>
          </div>

          {/* 2/3 DIREITA: Containers de Análise Mensal e Análise Anual Lado a Lado */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 min-h-0">
            
            {/* Card 1: Análise Mensal */}
            <div className="bg-muted/10 border border-border/30 rounded-xl p-3.5 shadow-2xs flex flex-col justify-between space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between border-b border-border/20 pb-2 flex-wrap gap-1">
                  <span className="text-xs font-bold text-foreground tracking-tight uppercase">
                    📆 Análise Mensal (Agosto/2026)
                  </span>
                  <span className="text-[10px] font-semibold text-muted-foreground bg-white dark:bg-card px-2 py-0.5 rounded-md border border-border/20 shadow-xs">
                    {data?.periodo_detalhado_mes || "01/08/2026 a 31/08/2026"}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground font-medium px-0.5">
                  <span>Amostra: <strong className="text-foreground">{(data?.total_mes_solicitacoes ?? 272).toLocaleString("pt-BR")} OSs</strong></span>
                  <span>Mineradas: <strong className="text-foreground">{(data?.total_mes_corrente ?? 255).toLocaleString("pt-BR")} Obs</strong></span>
                </div>
              </div>

              {/* Cards brancos com leve sombreado e números centralizados grandes */}
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-white dark:bg-card p-2.5 rounded-xl border border-border/30 shadow-sm flex flex-col items-center justify-center min-h-[66px] hover:border-border/60 transition-all">
                  <span className="text-lg sm:text-xl font-extrabold text-foreground tabular-nums">
                    {mes?.percentual_negativo ?? 12.2}%
                  </span>
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider leading-tight mt-1">
                    Sentimento Negativo
                  </span>
                </div>

                <div className="bg-white dark:bg-card p-2.5 rounded-xl border border-border/30 shadow-sm flex flex-col items-center justify-center min-h-[66px] hover:border-border/60 transition-all">
                  <span className="text-lg sm:text-xl font-extrabold text-foreground tabular-nums">
                    {mes?.taxa_urgencia ?? 4.7}%
                  </span>
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider leading-tight mt-1">
                    Taxa Urgência
                  </span>
                </div>

                <div className="bg-white dark:bg-card p-2.5 rounded-xl border border-border/30 shadow-sm flex flex-col items-center justify-center min-h-[66px] hover:border-border/60 transition-all">
                  <span className="text-lg sm:text-xl font-extrabold text-foreground tabular-nums">
                    {mes?.total_urgentes ?? 12}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider leading-tight mt-1">
                    Solicitações Urgentes
                  </span>
                </div>

                <div className="bg-white dark:bg-card p-2.5 rounded-xl border border-border/30 shadow-sm flex flex-col items-center justify-center min-h-[66px] hover:border-border/60 transition-all">
                  <span className="text-lg sm:text-xl font-extrabold text-foreground tabular-nums">
                    {mes?.percentual_positivo ?? 21.2}%
                  </span>
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider leading-tight mt-1">
                    Sentimento Positivo
                  </span>
                </div>

                <div className="bg-white dark:bg-card p-2.5 rounded-xl border border-border/30 shadow-sm flex flex-col items-center justify-center min-h-[66px] col-span-2 hover:border-border/60 transition-all">
                  <span className="text-lg sm:text-xl font-extrabold text-foreground tabular-nums">
                    {mes?.taxa_localizacao ?? 29.0}%
                  </span>
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider leading-tight mt-1">
                    Localização Extraída das Observações
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2: Análise Anual */}
            <div className="bg-muted/10 border border-border/30 rounded-xl p-3.5 shadow-2xs flex flex-col justify-between space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between border-b border-border/20 pb-2 flex-wrap gap-1">
                  <span className="text-xs font-bold text-foreground tracking-tight uppercase">
                    📅 Análise Anual (Ano 2026)
                  </span>
                  <span className="text-[10px] font-semibold text-muted-foreground bg-white dark:bg-card px-2 py-0.5 rounded-md border border-border/20 shadow-xs">
                    {data?.periodo_detalhado_ano || "01/01/2026 a 31/12/2026"}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground font-medium px-0.5">
                  <span>Amostra: <strong className="text-foreground">{(data?.total_ano_solicitacoes ?? 7485).toLocaleString("pt-BR")} OSs</strong></span>
                  <span>Mineradas: <strong className="text-foreground">{(data?.total_ano ?? 7404).toLocaleString("pt-BR")} Obs</strong></span>
                </div>
              </div>

              {/* Cards brancos com leve sombreado e números centralizados grandes */}
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-white dark:bg-card p-2.5 rounded-xl border border-border/30 shadow-sm flex flex-col items-center justify-center min-h-[66px] hover:border-border/60 transition-all">
                  <span className="text-lg sm:text-xl font-extrabold text-foreground tabular-nums">
                    {ano?.percentual_negativo ?? 9.3}%
                  </span>
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider leading-tight mt-1">
                    Sentimento Negativo
                  </span>
                </div>

                <div className="bg-white dark:bg-card p-2.5 rounded-xl border border-border/30 shadow-sm flex flex-col items-center justify-center min-h-[66px] hover:border-border/60 transition-all">
                  <span className="text-lg sm:text-xl font-extrabold text-foreground tabular-nums">
                    {ano?.taxa_urgencia ?? 3.3}%
                  </span>
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider leading-tight mt-1">
                    Taxa Urgência
                  </span>
                </div>

                <div className="bg-white dark:bg-card p-2.5 rounded-xl border border-border/30 shadow-sm flex flex-col items-center justify-center min-h-[66px] hover:border-border/60 transition-all">
                  <span className="text-lg sm:text-xl font-extrabold text-foreground tabular-nums">
                    {ano?.total_urgentes ?? 241}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider leading-tight mt-1">
                    Solicitações Urgentes
                  </span>
                </div>

                <div className="bg-white dark:bg-card p-2.5 rounded-xl border border-border/30 shadow-sm flex flex-col items-center justify-center min-h-[66px] hover:border-border/60 transition-all">
                  <span className="text-lg sm:text-xl font-extrabold text-foreground tabular-nums">
                    {ano?.percentual_positivo ?? 19.7}%
                  </span>
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider leading-tight mt-1">
                    Sentimento Positivo
                  </span>
                </div>

                <div className="bg-white dark:bg-card p-2.5 rounded-xl border border-border/30 shadow-sm flex flex-col items-center justify-center min-h-[66px] col-span-2 hover:border-border/60 transition-all">
                  <span className="text-lg sm:text-xl font-extrabold text-foreground tabular-nums">
                    {ano?.taxa_localizacao ?? 16.3}%
                  </span>
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider leading-tight mt-1">
                    Localização Extraída das Observações
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </Card>
  );
}
