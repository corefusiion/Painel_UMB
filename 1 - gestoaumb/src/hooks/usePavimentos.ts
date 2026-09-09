import { useQuery, useQueryClient } from "@tanstack/react-query";
import { API_URL } from "@/lib/api";
import { getBairroRegiao } from "@/utils/csvParser";

export interface PavimentoRecord {
  id: string;
  numero_os: string;
  especificacao: string | null;
  servico: string | null;
  tipo_pavimento: string;
  localidade: string | null;
  bairro_codigo: string;
  bairro_nome: string;
  logradouro: string | null;
  data_tramitacao: string | null;
  data_importacao: string;
  criado_em: string;
}

export interface BairroCount {
  bairro: string;
  count: number;
  regiao: string;
}

export function usePavimentos() {
  const queryClient = useQueryClient();
  
  const { data: records = [], isLoading, error, refetch } = useQuery({
    queryKey: ["pavimentos"],
    queryFn: async () => {
      const { data, error } = await fetch(`${API_URL}/pavimentos`).then(res => res.json());
      
      if (error) throw error;
      
      const today = new Date().toISOString().split("T")[0];
      const filtered = (data || []).filter((r: any) => r.data_importacao === today);
      return filtered as PavimentoRecord[];
    },
    refetchInterval: 30000, // Polling a cada 30 segundos
  });

  // Filtrar registros excluindo visitas (serviço 37)
  const filteredRecords = records.filter(r => !r.servico?.includes("37"));

  // Funções de filtro por localidade
  const isLauroFreitas = (r: PavimentoRecord) => r.localidade?.includes("700");
  const isSalvador = (r: PavimentoRecord) => r.localidade?.includes("900");

  // Calcular totais por tipo
  const total = filteredRecords.length;
  const asfalto = filteredRecords.filter(r => r.tipo_pavimento === 'asfalto').length;
  const concreto = filteredRecords.filter(r => r.tipo_pavimento === 'concreto').length;

  // Totais por localidade
  const totalLF = filteredRecords.filter(isLauroFreitas).length;
  const totalSSA = filteredRecords.filter(isSalvador).length;

  // Por tipo e localidade
  const concretoLF = filteredRecords.filter(r => r.tipo_pavimento === 'concreto' && isLauroFreitas(r)).length;
  const concretoSSA = filteredRecords.filter(r => r.tipo_pavimento === 'concreto' && isSalvador(r)).length;
  const asfaltoLF = filteredRecords.filter(r => r.tipo_pavimento === 'asfalto' && isLauroFreitas(r)).length;
  const asfaltoSSA = filteredRecords.filter(r => r.tipo_pavimento === 'asfalto' && isSalvador(r)).length;

  // Agrupar por bairro e pegar Top 5
  const bairrosCounts = filteredRecords.reduce((acc, record) => {
    const bairro = record.bairro_nome || "Desconhecido";
    acc[bairro] = (acc[bairro] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const top5Bairros: BairroCount[] = Object.entries(bairrosCounts)
    .map(([bairro, count]) => ({ 
      bairro, 
      count, 
      regiao: getBairroRegiao(bairro) 
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Função para invalidar cache após importação
  const invalidateCache = () => {
    queryClient.invalidateQueries({ queryKey: ["pavimentos"] });
  };

  return {
    records,
    total,
    asfalto,
    concreto,
    totalSSA,
    totalLF,
    concretoSSA,
    concretoLF,
    asfaltoSSA,
    asfaltoLF,
    top5Bairros,
    isLoading,
    error,
    refetch,
    invalidateCache,
  };
}
