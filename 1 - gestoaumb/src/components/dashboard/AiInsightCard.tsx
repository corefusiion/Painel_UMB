import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, MapPin, Home, Route, Building2, Sparkles, MessageSquare } from "lucide-react";
import type { EmAnaliseRecord } from "@/hooks/useAiInsights";

interface AiInsightCardProps {
  record: EmAnaliseRecord;
}

export function AiInsightCard({ record }: AiInsightCardProps) {
  const insight = record.insight;
  const hasInsight = !!insight;

  // Safely parse dados_brutos (string or object)
  let dadosBrutos: Record<string, any> | undefined = undefined;
  if (insight?.dados_brutos) {
    if (typeof insight.dados_brutos === "string") {
      try {
        dadosBrutos = JSON.parse(insight.dados_brutos);
      } catch {
        dadosBrutos = {};
      }
    } else {
      dadosBrutos = insight.dados_brutos as Record<string, any>;
    }
  }

  const riscoNivel = (dadosBrutos?.risco_nivel || insight?.risco_nivel) as string | undefined;
  const riscoAlerta = (dadosBrutos?.risco_alerta || insight?.risco_alerta) as string | undefined;
  const historicoLocal = dadosBrutos?.historico_local as Record<string, any> | undefined;

  const isCritico = riscoNivel === "CRITICO";
  const isAlto = riscoNivel === "ALTO" || (riscoAlerta && riscoAlerta.includes("LOTE"));

  // Separação Logradouro (30d / Ano) vs Bairro (Ranking / Lote)
  const q30dLogradouro = dadosBrutos?.q_logr_30d ?? 0;
  const qAnoLogradouro = dadosBrutos?.q_logr_ano ?? insight?.total_chamados_trecho ?? dadosBrutos?.total_chamados_trecho ?? 0;
  const descLogradouro = dadosBrutos?.desc_logradouro || `Ocorreram ${q30dLogradouro} solicitações nos últimos 30 dias neste logradouro. No acumulado do ano já somam ${qAnoLogradouro} chamados.`;

  const simultaneosBairro = dadosBrutos?.simultaneos_lote_bairro ?? dadosBrutos?.simultaneos_lote ?? 1;
  const rankingBairros = dadosBrutos?.ranking_bairros || "Nenhum no momento";
  const posRanking = dadosBrutos?.bairro_pos_ranking ?? 1;
  const descBairro = dadosBrutos?.desc_bairro || `O bairro ${record.bairro_nome || 'informado'} acumula ${simultaneosBairro} solicitação(ões) ativa(s). Logradouros mais afetados no bairro:${rankingBairros}`;

  const q15d = historicoLocal?.ultimos_15_dias ?? dadosBrutos?.q_mat_15d ?? 0;
  const q6m = historicoLocal?.ultimos_6_meses ?? dadosBrutos?.q_mat_6m ?? 0;
  const q12m = historicoLocal?.ultimos_12_meses ?? dadosBrutos?.q_mat_12m ?? 0;
  const q24m = historicoLocal?.ultimos_3_anos ?? dadosBrutos?.q_mat_24m ?? 0;

  const obsDiag = dadosBrutos?.obs_diag || (record.observacao ? `Obs da SS: "${record.observacao}"` : "Sem observação descritiva registrada.");
  const sentimentBadge = dadosBrutos?.sentiment_badge || (
    record.observacao?.toLowerCase().includes("sem agua") ? "🟡 Reclamação / Falta d'água" : "🟢 Atendimento Padrão"
  );

  const formatAlertText = (text: string) => {
    if (!text) return text;
    let formatted = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    formatted = formatted.replace(/\s*\((.*?)\)/, ' · $1');
    return formatted;
  };

  const riskBadge = hasInsight && (riscoAlerta || riscoNivel) ? (
    <span
      className={`shrink-0 text-[10px] px-1.5 py-0.5 font-medium rounded bg-gray-100 border border-gray-200 cursor-default shadow-none ${
        isCritico || isAlto
          ? "text-destructive/80"
          : "text-gray-600"
      }`}
    >
      {formatAlertText(riscoAlerta || riscoNivel || "")}
    </span>
  ) : !hasInsight ? (
    <span className="shrink-0 text-[10px] px-1.5 py-0.5 font-medium rounded bg-gray-100 border border-gray-200 text-gray-400 cursor-default shadow-none">
      Aguardando IA
    </span>
  ) : null;

  const chanceReincidencia = hasInsight ? insight.chance_reincidencia : null;

  return (
    <Card className="border border-border/40 bg-card h-full min-w-0 flex flex-col overflow-hidden shadow-xs">
      <div className="p-2.5 pt-2 h-full min-h-0 flex flex-col justify-between gap-2 min-w-0 overflow-y-auto">

        {/* Header: OS + Badge */}
        <div className="flex items-center justify-between gap-1.5 flex-wrap pb-1 border-b border-border/30">
          <div className="flex items-center gap-1.5 min-w-0">
            <MapPin className="h-4 w-4 text-primary shrink-0" />
            <span className="text-xs font-bold text-foreground tracking-tight">
              OS {record.numero_os}
            </span>
          </div>
          {riskBadge}
        </div>

        {/* Endereço Principal */}
        <p className="text-xs text-foreground font-medium break-words leading-tight">
          <strong className="text-foreground font-bold">{record.logradouro || "Logradouro não informado"}</strong>
          {record.bairro_nome ? ` — ${record.bairro_nome}` : ""}
        </p>

        {/* 1️⃣ SEÇÃO: DADOS DA SOLICITAÇÃO / MATRÍCULA */}
        <div className="border border-border/40 rounded-lg p-2 bg-background">
          <div className="flex items-center gap-1.5 border-b border-border/30 pb-1 mb-1.5">
            <Home className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] text-primary uppercase tracking-wider font-bold">
              1. Análise da Matrícula (Domicílio)
            </span>
          </div>
          
          <div className="flex items-center gap-2 bg-muted/30 p-1.5 rounded border border-border/20 mb-1.5">
            {chanceReincidencia != null ? (
              <PredictiveScore score={chanceReincidencia} />
            ) : (
              <div className="h-8 w-8 rounded-full border border-dashed border-border/60 flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-muted-foreground">—</span>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[8px] text-foreground/70 uppercase tracking-wider font-bold">
                PROBABILIDADE DE REINCIDÊNCIA
              </p>
              <p className="text-xs text-foreground font-semibold truncate">
                {hasInsight
                  ? (chanceReincidencia != null ? `${Math.round(chanceReincidencia)}% no domicílio` : "Analisado")
                  : "Aguardando análise"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5 text-center">
            <div className="bg-muted/40 py-1 rounded border border-border/20">
              <p className="text-xs font-bold text-foreground">{q15d}</p>
              <p className="text-[8px] text-foreground/70 uppercase font-bold">15d</p>
            </div>
            <div className="bg-muted/40 py-1 rounded border border-border/20">
              <p className="text-xs font-bold text-foreground">{q6m}</p>
              <p className="text-[8px] text-foreground/70 uppercase font-bold">6m</p>
            </div>
            <div className="bg-muted/40 py-1 rounded border border-border/20">
              <p className="text-xs font-bold text-foreground">{q12m}</p>
              <p className="text-[8px] text-foreground/70 uppercase font-bold">12m</p>
            </div>
          </div>
        </div>

        {/* 💬 SEÇÃO: ANÁLISE DE SENTIMENTO & URGÊNCIA (OBS DA SS) */}
        <div className="border border-border/40 rounded-lg p-2 bg-background">
          <div className="flex items-center justify-between gap-1 border-b border-border/30 pb-1 mb-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <MessageSquare className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="text-[10px] text-primary uppercase tracking-wider font-bold">
                Análise da Obs da SS (Sentimento)
              </span>
            </div>
            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-muted text-foreground shrink-0">
              {sentimentBadge}
            </span>
          </div>

          <p className="text-[11px] text-foreground/90 font-medium leading-snug bg-muted/20 p-1.5 rounded border border-border/20">
            {obsDiag}
          </p>
        </div>

        {/* 2️⃣ SEÇÃO: DADOS DO LOGRADOURO (VIA) */}
        <div className="border border-border/40 rounded-lg p-2 bg-background">
          <div className="flex items-center gap-1.5 border-b border-border/30 pb-1 mb-1.5">
            <Route className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] text-primary uppercase tracking-wider font-bold">
              2. Análise do Logradouro (Via)
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1.5 mb-1.5">
            <div className="bg-muted/30 p-1.5 rounded border border-border/20 flex justify-between items-center">
              <span className="text-[10px] text-foreground/70 font-medium">Últimos 30 dias:</span>
              <span className="text-xs font-bold text-foreground">{q30dLogradouro}</span>
            </div>
            <div className="bg-muted/30 p-1.5 rounded border border-border/20 flex justify-between items-center">
              <span className="text-[10px] text-foreground/70 font-medium">Total no Ano:</span>
              <span className="text-xs font-bold text-foreground">{qAnoLogradouro}</span>
            </div>
          </div>

          <p className="text-[11px] text-foreground/90 font-medium leading-snug bg-muted/20 p-1.5 rounded border border-border/20">
            "{descLogradouro}"
          </p>
        </div>

        {/* 3️⃣ SEÇÃO: DADOS DO BAIRRO */}
        <div className="border border-border/40 rounded-lg p-2 bg-background">
          <div className="flex items-center gap-1.5 border-b border-border/30 pb-1 mb-1.5">
            <Building2 className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] text-primary uppercase tracking-wider font-bold">
              3. Análise do Bairro ({record.bairro_nome || "Localidade"})
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1.5 mb-1.5">
            <div className="bg-muted/30 p-1.5 rounded border border-border/20 flex justify-between items-center">
              <span className="text-[10px] text-foreground/70 font-medium">OSs Ativas no Bairro:</span>
              <span className="text-xs font-bold text-warning">{simultaneosBairro}</span>
            </div>
            <div className="bg-muted/30 p-1.5 rounded border border-border/20 flex justify-between items-center">
              <span className="text-[10px] text-foreground/70 font-medium">Logradouros Afetados:</span>
              <span className="text-xs font-bold text-foreground">{dadosBrutos?.bairro_logradouros_afetados ?? 1}</span>
            </div>
          </div>

          <p className="text-[11px] text-foreground/90 font-medium leading-snug bg-muted/20 p-1.5 rounded border border-border/20 whitespace-pre-line">
            {descBairro}
          </p>
        </div>

        {/* 4️⃣ SEÇÃO: DIAGNÓSTICO OPERACIONAL */}
        <div className="border border-border/40 bg-muted/10 p-2 rounded-lg flex flex-col justify-between max-h-[64px] overflow-hidden">
          <p className="text-[10px] uppercase tracking-wider font-bold text-foreground/80 leading-none mb-1.5 shrink-0">
            Diagnóstico Operacional
          </p>
          {hasInsight ? (
            <div className="flex flex-col min-h-0 justify-end h-full">
              <p className="text-[11px] text-foreground font-medium leading-tight truncate">
                {q6m} ocorrência(s) em 6 meses, sendo {q15d} nos últimos 15 dias.
              </p>
              <div className="flex justify-between items-end gap-2 mt-0.5">
                <p className="text-[10px] text-muted-foreground leading-tight truncate flex-1">
                  {(insight.ai_recomendacao || "").replace(/> RECOMENDAÇÃO (OPERACIONAL|TÉCNICA):\s*/i, "")}
                </p>
                <span className={`text-[9px] font-bold tracking-widest uppercase shrink-0 ${
                  isCritico ? 'text-destructive' : 
                  isAlto ? 'text-warning' : 
                  'text-muted-foreground'
                }`}>
                  {isCritico ? 'CRÍTICA' : isAlto ? 'ALTA' : 'BAIXA'}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground italic font-medium truncate mt-0.5">
              Aguardando processamento da IA...
            </p>
          )}
        </div>

      </div>
    </Card>
  );
}

function PredictiveScore({ score }: { score: number }) {
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const remaining = circumference - progress;

  const color = score >= 75
    ? "hsl(var(--destructive))"
    : score >= 50
      ? "hsl(var(--warning))"
      : "hsl(var(--success))";

  return (
    <div className="relative h-9 w-9 shrink-0">
      <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
        <circle cx="18" cy="18" r={radius} fill="none" stroke="hsl(var(--border))" strokeWidth="2.5" opacity="0.4" />
        <circle cx="18" cy="18" r={radius} fill="none" stroke={color} strokeWidth="3" strokeDasharray={`${progress} ${remaining}`} strokeLinecap="round" className="transition-all duration-700 ease-out" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[9px] font-bold text-foreground tabular-nums">{Math.round(score)}%</span>
      </div>
    </div>
  );
}