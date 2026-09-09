import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { API_URL, SANEAIA_API_URL } from "@/lib/api";
import { useFaltaDagua } from "@/hooks/useFaltaDagua";
import { useMemo, useEffect, useRef, useState, useCallback } from "react";

export interface AiInsight {
  id: string;
  faltadagua_id: string;
  numero_os: string;
  logradouro: string | null;
  bairro_nome: string | null;
  chance_reincidencia: number | null;
  total_chamados_trecho: number | null;
  reincidencias_90dias: number | null;
  ai_recomendacao: string | null;
  causa_sistemica: string | null;
  score_satisfacao: number | null;
  processado_em: string | null;
  dados_brutos: Record<string, unknown>;
  criado_em: string;
  atualizado_em: string;
}

export interface EmAnaliseRecord {
  id: string;
  numero_os: string;
  logradouro: string | null;
  bairro_nome: string;
  responsavel: string | null;
  unidade_atual: string | null;
  cep: string | null;
  data_tramitacao: string | null;
  observacao: string | null;
  matricula: string | null;
  insight?: AiInsight | null;
}

const AUTO_BATCH_SIZE = 50;

export function useAiInsights() {
  const { records } = useFaltaDagua();
  const queryClient = useQueryClient();
  const [isProcessingAuto, setIsProcessingAuto] = useState(false);
  const processingOsRef = useRef<Set<string>>(new Set());
  const autoProcessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Capturar TODAS as demandas de falta d'água (exceto visitas serviço 37)
  const emAnaliseRecords = useMemo(() => {
    return records.filter(r => !r.servico?.includes("37"));
  }, [records]);

  const { data: insights = [], isLoading: isLoadingInsights, refetch } = useQuery({
    queryKey: ["ai_insights_faltadagua"],
    queryFn: async () => {
      const { data, error } = await fetch(`${API_URL}/ai_insights_faltadagua`).then(res => res.json());

      if (error) throw error;
      return (data || []) as AiInsight[];
    },
    refetchInterval: 30000,
  });

  // Combinar registros em análise com insights existentes
  const enrichedRecords: EmAnaliseRecord[] = useMemo(() => {
    return emAnaliseRecords.map(record => {
      const insight = insights.find(
        (i: AiInsight) => i.numero_os === record.numero_os
      );
      return {
        id: record.id,
        numero_os: record.numero_os,
        logradouro: record.logradouro,
        bairro_nome: record.bairro_nome,
        responsavel: record.responsavel,
        unidade_atual: record.unidade_atual,
        cep: record.cep,
        data_tramitacao: record.data_tramitacao,
        observacao: record.observacao,
        matricula: record.matricula,
        insight: insight || null,
      };
    });
  }, [emAnaliseRecords, insights]);

  // Mutation para processar lote via Edge Function
  const processarLoteMutation = useMutation({
    mutationFn: async (demandas: EmAnaliseRecord[]) => {
      // Limpar cache de insights antigos para garantir reprocessamento com novo modelo
      await fetch(`${API_URL}/ai_insights_faltadagua`, { method: 'DELETE' }).catch(() => {});

      const payload = {
        demandas: demandas.map(d => ({
          id: d.id,
          numero_os: d.numero_os,
          matricula: d.matricula || d.numero_os,
          logradouro: d.logradouro || "",
          bairro_nome: d.bairro_nome,
          observacao: d.observacao || "",
        })),
      };

      const response = await fetch(`${SANEAIA_API_URL}/integrations/analyze-external-demands?_t=${Date.now()}`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload) 
      });
      const data = await response.json();
      const error = data.error || (data.status === 'error' ? data.message : null);

      if (error) {
        const errMsg = typeof error === 'string' ? error : (error.message || "Erro de comunicação com SanealA");
        throw new Error(errMsg);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      // Salvar os insights gerados no SQLite Local
      if (data.analises && data.analises.length > 0) {
        await Promise.all(data.analises.map((insight: any) => 
          fetch(`${API_URL}/ai_insights_faltadagua`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(insight)
          })
        ));
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai_insights_faltadagua"] });
    },
  });

  // Auto-process: find records without ai_recomendacao and process in batches
  const processNextBatch = useCallback(async () => {
    // Find unprocessed records not currently in-flight
    const unprocessed = enrichedRecords.filter(
      r => !r.insight?.ai_recomendacao && !processingOsRef.current.has(r.numero_os)
    );

    if (unprocessed.length === 0) {
      setIsProcessingAuto(false);
      return;
    }

    setIsProcessingAuto(true);
    const batch = unprocessed.slice(0, AUTO_BATCH_SIZE);

    // Mark as in-flight
    batch.forEach(r => processingOsRef.current.add(r.numero_os));

    try {
      const payload = {
        demandas: batch.map(d => ({
          id: d.id,
          numero_os: d.numero_os,
          matricula: d.matricula || d.numero_os,
          logradouro: d.logradouro || "",
          bairro_nome: d.bairro_nome,
          observacao: d.observacao || "",
        })),
      };

      const response = await fetch(`${SANEAIA_API_URL}/integrations/analyze-external-demands?_t=${Date.now()}`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload) 
      });
      const data = await response.json();
      const error = data.error || (data.status === 'error' ? data.message : null);

      if (error || data?.error) {
        console.error("Auto-process batch error:", error?.message || data?.error);
        toast.error(`Erro interno do SanealA: ${error?.message || data?.error}`);
      } else {
        // Salvar os insights gerados no SQLite Local
        if (data.analises && data.analises.length > 0) {
          await Promise.all(data.analises.map((insight: any) => 
            fetch(`${API_URL}/ai_insights_faltadagua`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(insight)
            }).catch(e => console.error("Erro ao salvar insight no SQLite:", e))
          ));
        }
        queryClient.invalidateQueries({ queryKey: ["ai_insights_faltadagua"] });
      }
    } catch (err: any) {
      console.error("Auto-process exception:", err);
      toast.error(`Erro de Conexão com SanealA: ${err.message}`);
    } finally {
      // Remove from in-flight after processing
      batch.forEach(r => processingOsRef.current.delete(r.numero_os));

      // Schedule next batch with delay to avoid overwhelming the API
      autoProcessTimerRef.current = setTimeout(() => {
        processNextBatch();
      }, 3000);
    }
  }, [enrichedRecords, queryClient]);

  // Trigger auto-processing when enrichedRecords change
  useEffect(() => {
    if (isLoadingInsights || processarLoteMutation.isPending) return;

    const hasUnprocessed = enrichedRecords.some(
      r => !r.insight?.ai_recomendacao && !processingOsRef.current.has(r.numero_os)
    );

    if (hasUnprocessed && !isProcessingAuto) {
      // Small delay to debounce rapid data changes
      autoProcessTimerRef.current = setTimeout(() => {
        processNextBatch();
      }, 2000);
    }

    return () => {
      if (autoProcessTimerRef.current) {
        clearTimeout(autoProcessTimerRef.current);
      }
    };
  }, [enrichedRecords, isLoadingInsights, processarLoteMutation.isPending, isProcessingAuto, processNextBatch]);

  return {
    emAnaliseRecords: enrichedRecords,
    totalEmAnalise: emAnaliseRecords.length,
    insights,
    isLoadingInsights,
    refetch,
    processarLote: processarLoteMutation.mutateAsync,
    isProcessing: processarLoteMutation.isPending,
    isProcessingAuto,
    processError: processarLoteMutation.error,
  };
}
